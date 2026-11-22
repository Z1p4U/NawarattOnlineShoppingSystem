import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { orders } from "../../../db/schema";
import { getAppUser, roleAllowed } from "../../../lib/app-user";
import { notifyDepartments } from "../../../lib/department-notifications";
import { recordAuditLog } from "../../../lib/audit-log";
import { getOperationalPeriod, isLiveDate } from "../../../lib/operational-period";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 8 * 1024 * 1024;

function cleanId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function extension(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const orderId = cleanId(new URL(request.url).searchParams.get("orderId"));
  if (!orderId) return Response.json({ error: "Order ID လိုအပ်ပါသည်" }, { status: 400 });
  const [order] = await getDb().select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.deliveryProofKey) return Response.json({ error: "ကားဂိတ် / ငွေသိမ်းဘောင်ချာ မတင်ရသေးပါ" }, { status: 404 });
  if (!env.BUCKET) return Response.json({ error: "File storage မချိတ်ဆက်ရသေးပါ" }, { status: 503 });
  const object = await env.BUCKET.get(order.deliveryProofKey);
  if (!object) return Response.json({ error: "ဘောင်ချာပုံ မတွေ့ပါ" }, { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": order.deliveryProofType || object.httpMetadata?.contentType || "image/jpeg",
      "content-disposition": `inline; filename="${(order.deliveryProofName || "delivery-proof.jpg").replace(/["\\]/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAllowed(user.role, ["delivery"])) return Response.json({ error: "Admin သို့မဟုတ် Delivery Role သာ ကားဂိတ် / ငွေသိမ်းဘောင်ချာ တင်နိုင်ပါသည်" }, { status: 403 });
  try {
    const form = await request.formData();
    const orderId = cleanId(form.get("orderId"));
    const file = form.get("file");
    if (!orderId || !(file instanceof File)) return Response.json({ error: "Order နှင့် ဘောင်ချာပုံ ရွေးပါ" }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "JPG, PNG သို့မဟုတ် WEBP ပုံသာ တင်နိုင်ပါသည်" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return Response.json({ error: "ပုံ Size သည် 8 MB အောက် ဖြစ်ရပါမည်" }, { status: 400 });

    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return Response.json({ error: "Order မတွေ့ပါ" }, { status: 404 });
    const { officialStartDate } = await getOperationalPeriod();
    if (!isLiveDate(order.orderDate, officialStartDate)) return Response.json({ error: "Trial Order ကို Archive ထားပြီးဖြစ်၍ ပြင်ဆင်၍မရပါ" }, { status: 409 });
    if (!order.saleApproved) return Response.json({ error: "Sale Team Approved ဖြစ်ပြီးမှ ဘောင်ချာတင်နိုင်ပါသည်" }, { status: 409 });

    if (!env.BUCKET) return Response.json({ error: "File storage မချိတ်ဆက်ရသေးပါ" }, { status: 503 });
    const key = `delivery-proofs/order-${orderId}-${Date.now()}.${extension(file.type)}`;
    await env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type }, customMetadata: { orderId: String(orderId), uploadedBy: user.email } });
    if (order.deliveryProofKey && order.deliveryProofKey !== key) await env.BUCKET.delete(order.deliveryProofKey);
    const uploadedAt = new Date().toISOString();
    const [updated] = await db.update(orders).set({
      deliveryProofKey: key,
      deliveryProofName: file.name.slice(0, 180),
      deliveryProofType: file.type,
      deliveryProofUploadedBy: user.displayName,
      deliveryProofUploadedAt: uploadedAt,
      updatedBy: user.displayName,
      updatedAt: uploadedAt,
    }).where(eq(orders.id, orderId)).returning();
    await notifyDepartments({ roles: ["sale", "warehouse", "purchase", "finance"], title: "ကားဂိတ် / ငွေသိမ်းဘောင်ချာ တင်ပြီးပါပြီ", message: `${order.customerName} • ${order.orderNo} • နှိပ်၍ ဘောင်ချာပုံကြည့်ရန်`, targetTab: "dashboard", sourceId: order.id, actor: user.displayName });
    await recordAuditLog(user, { action: "delivery_proof_uploaded", entityType: "order", entityId: orderId, summary: `${order.customerName} • ကားဂိတ် / ငွေသိမ်းဘောင်ချာ တင်ခဲ့သည်` });
    return Response.json({ proof: { deliveryProofKey: updated.deliveryProofKey, deliveryProofName: updated.deliveryProofName, deliveryProofType: updated.deliveryProofType, deliveryProofUploadedBy: updated.deliveryProofUploadedBy, deliveryProofUploadedAt: updated.deliveryProofUploadedAt }, proofUrl: `/api/delivery-proof?orderId=${orderId}&v=${encodeURIComponent(uploadedAt)}` });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "ဘောင်ချာပုံ တင်မရပါ" }, { status: 500 });
  }
}
