import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { orders, saleOrderPhotos } from "../../../db/schema";
import { getAppUser, roleAllowed } from "../../../lib/app-user";
import { notifyDepartments } from "../../../lib/department-notifications";
import { recordAuditLog } from "../../../lib/audit-log";

const SALE_ORDER_FOLDER_URL = "https://drive.google.com/drive/folders/11EqVwSjrDrobH1EfKTJ66gioJMnXwsGa";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 3 * 1024 * 1024;

function cleanId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function cleanFileName(value: string) {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim().slice(0, 150) || "sale-order";
}

function extension(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

function hasBatch(value: string, sequence: number) {
  try {
    const batches = JSON.parse(value) as Array<{ sequence?: unknown }>;
    return Array.isArray(batches) && batches.some((batch) => Number(batch?.sequence) === sequence);
  } catch {
    return sequence === 1;
  }
}

function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const photoId = cleanId(url.searchParams.get("photoId"));
  const token = url.searchParams.get("token")?.trim() || "";
  if (!photoId || !/^[a-f0-9-]{36}$/.test(token) || !env.BUCKET) return new Response("Not found", { status: 404 });
  const [photo] = await getDb().select().from(saleOrderPhotos).where(and(eq(saleOrderPhotos.id, photoId), eq(saleOrderPhotos.downloadToken, token))).limit(1);
  if (!photo || photo.syncStatus === "synced") return new Response("Not found", { status: 404 });
  const object = await env.BUCKET.get(photo.fileKey);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": photo.mimeType || object.httpMetadata?.contentType || "image/webp",
      "content-disposition": `attachment; filename="${cleanFileName(photo.fileName)}"`,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAllowed(user.role, ["warehouse"])) return Response.json({ error: "Admin သို့မဟုတ် Warehouse Role သာ Sale Order Photo တင်နိုင်ပါသည်" }, { status: 403 });
  if (!validateOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  try {
    const form = await request.formData();
    const orderId = cleanId(form.get("orderId"));
    const batchSequence = cleanId(form.get("batchSequence"));
    const file = form.get("file");
    if (!orderId || !batchSequence || !(file instanceof File)) return Response.json({ error: "Sale Order နှင့် Photo ရွေးပါ" }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "JPG, PNG သို့မဟုတ် WEBP ပုံသာ တင်နိုင်ပါသည်" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return Response.json({ error: "လျှော့ချပြီး Photo Size သည် 3 MB အောက် ဖြစ်ရပါမည်" }, { status: 400 });

    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return Response.json({ error: "Order မတွေ့ပါ" }, { status: 404 });
    if (!hasBatch(order.warehouseBatches, batchSequence)) return Response.json({ error: "Sale Order မတွေ့ပါ" }, { status: 404 });
    if (!env.BUCKET) return Response.json({ error: "Photo storage မချိတ်ဆက်ရသေးပါ" }, { status: 503 });

    const token = crypto.randomUUID();
    const fileName = cleanFileName(`${order.orderDate}_${order.customerName}_${order.orderNo}_SO${batchSequence}.${extension(file.type)}`);
    const fileKey = `sale-order-photos/${order.orderDate}/${token}.${extension(file.type)}`;
    await env.BUCKET.put(fileKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { fileName, uploadedBy: user.email, orderId: String(orderId), batchSequence: String(batchSequence) },
    });
    try {
      const [saved] = await db.insert(saleOrderPhotos).values({
        orderId,
        batchSequence,
        customerName: order.customerName,
        orderNo: order.orderNo,
        orderDate: order.orderDate,
        fileKey,
        fileName,
        mimeType: file.type,
        fileSize: file.size,
        downloadToken: token,
        syncStatus: "pending",
        uploadedBy: user.displayName,
      }).returning();
      await recordAuditLog(user, {
        action: "sale_order_photo_queued_for_drive",
        entityType: "order",
        entityId: orderId,
        summary: `${order.customerName} • ${order.orderNo} • Sale Order #${batchSequence} • ${Math.ceil(file.size / 1024)} KB`,
      });
      await notifyDepartments({
        roles: ["purchase", "warehouse"],
        title: "Sale Order Photo တင်ပြီး",
        message: `${order.customerName} • ${order.orderNo} • Google Drive Auto Sync စောင့်နေသည်`,
        targetTab: "purchase",
        sourceId: order.id,
        actor: user.displayName,
      });
      return Response.json({ success: true, photoId: saved.id, fileName, size: file.size, syncStatus: "pending", folderUrl: SALE_ORDER_FOLDER_URL });
    } catch (error) {
      await env.BUCKET.delete(fileKey).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Sale Order Photo မသိမ်းနိုင်ပါ" }, { status: 500 });
  }
}
