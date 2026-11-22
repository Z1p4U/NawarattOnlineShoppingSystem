import { env } from "cloudflare:workers";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../../../db";
import { deliveryIncidents, orderEvents, orders } from "../../../db/schema";
import { getAppUser, roleAllowed } from "../../../lib/app-user";
import { notifyDepartments } from "../../../lib/department-notifications";
import { recordAuditLog } from "../../../lib/audit-log";
import { getOperationalPeriod, isLiveDate } from "../../../lib/operational-period";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ISSUE_TYPES = new Set(["return", "wrong", "extra", "missing"]);
const MAX_FILE_SIZE = 8 * 1024 * 1024;

const ISSUE_LABELS: Record<string, string> = {
  return: "Return ပစ္စည်း",
  wrong: "ပစ္စည်းမှား",
  extra: "ပစ္စည်းပို",
  missing: "ပစ္စည်းလို",
};

function cleanId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function cleanAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function extension(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const issueId = cleanId(url.searchParams.get("issueId"));
  const orderId = cleanId(url.searchParams.get("orderId"));
  const db = getDb();

  if (issueId) {
    const [issue] = await db.select().from(deliveryIncidents).where(eq(deliveryIncidents.id, issueId)).limit(1);
    if (!issue) return Response.json({ error: "Delivery အထောက်အထား မတွေ့ပါ" }, { status: 404 });
    if (!env.BUCKET) return Response.json({ error: "File storage မချိတ်ဆက်ရသေးပါ" }, { status: 503 });
    const object = await env.BUCKET.get(issue.proofKey);
    if (!object) return Response.json({ error: "အထောက်အထားပုံ မတွေ့ပါ" }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": issue.proofType || object.httpMetadata?.contentType || "image/jpeg",
        "content-disposition": `inline; filename="${(issue.proofName || "delivery-issue.jpg").replace(/["\\]/g, "")}"`,
        "cache-control": "private, no-store",
      },
    });
  }

  if (!orderId) {
    const { officialStartDate } = await getOperationalPeriod();
    const issues = await db.select({
      id: deliveryIncidents.id,
      orderId: deliveryIncidents.orderId,
      issueType: deliveryIncidents.issueType,
      itemDetails: deliveryIncidents.itemDetails,
      deductionAmount: deliveryIncidents.deductionAmount,
      voucherBefore: deliveryIncidents.voucherBefore,
      voucherAfter: deliveryIncidents.voucherAfter,
      proofName: deliveryIncidents.proofName,
      createdBy: deliveryIncidents.createdBy,
      createdAt: deliveryIncidents.createdAt,
      customerName: orders.customerName,
      orderNo: orders.orderNo,
      route: orders.route,
    }).from(deliveryIncidents)
      .innerJoin(orders, eq(deliveryIncidents.orderId, orders.id))
      .where(gte(orders.orderDate, officialStartDate))
      .orderBy(desc(deliveryIncidents.createdAt), desc(deliveryIncidents.id));
    return Response.json({ issues });
  }
  const issues = await db.select().from(deliveryIncidents)
    .where(eq(deliveryIncidents.orderId, orderId))
    .orderBy(desc(deliveryIncidents.createdAt), desc(deliveryIncidents.id));
  return Response.json({ issues });
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAllowed(user.role, ["delivery"])) {
    return Response.json({ error: "Admin သို့မဟုတ် Delivery Role သာ အထောက်အထား တင်နိုင်ပါသည်" }, { status: 403 });
  }

  let uploadedKey = "";
  let persisted = false;
  try {
    const form = await request.formData();
    const orderId = cleanId(form.get("orderId"));
    const issueType = cleanText(form.get("issueType"), 30);
    const itemDetails = cleanText(form.get("itemDetails"), 800);
    const requestedDeduction = cleanAmount(form.get("deductionAmount"));
    const file = form.get("file");

    if (!orderId || !ISSUE_TYPES.has(issueType)) return Response.json({ error: "Order နှင့် အမျိုးအစား ရွေးပါ" }, { status: 400 });
    if (!itemDetails) return Response.json({ error: "ပစ္စည်းအမည်၊ အရေအတွက်နှင့် အကြောင်းအရာ ရေးပါ" }, { status: 400 });
    if (!(file instanceof File)) return Response.json({ error: "အထောက်အထားပုံ ရိုက်ပါ / ရွေးပါ" }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "JPG, PNG သို့မဟုတ် WEBP ပုံသာ တင်နိုင်ပါသည်" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return Response.json({ error: "ပုံ Size သည် 8 MB အောက် ဖြစ်ရပါမည်" }, { status: 400 });

    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return Response.json({ error: "Order မတွေ့ပါ" }, { status: 404 });
    const { officialStartDate } = await getOperationalPeriod();
    if (!isLiveDate(order.orderDate, officialStartDate)) return Response.json({ error: "Trial Order ကို Archive ထားပြီးဖြစ်၍ ပြင်ဆင်၍မရပါ" }, { status: 409 });
    if (!order.saleApproved) return Response.json({ error: "Sale Team Approved ဖြစ်ပြီးမှ Delivery အထောက်အထား တင်နိုင်ပါသည်" }, { status: 409 });

    const deductionAmount = issueType === "return" ? requestedDeduction : 0;
    if (issueType === "return" && deductionAmount <= 0) {
      return Response.json({ error: "Return ပစ္စည်းတန်ဖိုး ထည့်ပါ" }, { status: 400 });
    }
    if (deductionAmount > order.voucherAmount) {
      return Response.json({ error: `နှုတ်မည့်ငွေသည် လက်ရှိ Voucher ${order.voucherAmount.toLocaleString()} MMK ထက် မကျော်ရပါ` }, { status: 400 });
    }

    if (!env.BUCKET) return Response.json({ error: "File storage မချိတ်ဆက်ရသေးပါ" }, { status: 503 });
    const createdAt = new Date().toISOString();
    uploadedKey = `delivery-incidents/order-${orderId}-${Date.now()}.${extension(file.type)}`;
    await env.BUCKET.put(uploadedKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { orderId: String(orderId), issueType, uploadedBy: user.email },
    });

    const voucherAfter = Math.max(0, order.voucherAmount - deductionAmount);
    const paymentStatus = order.paidAmount >= voucherAfter
      ? "paid"
      : order.paidAmount > 0 ? "partial" : order.paymentStatus;

    await db.batch([
      db.insert(deliveryIncidents).values({
        orderId,
        issueType,
        itemDetails,
        deductionAmount,
        voucherBefore: order.voucherAmount,
        voucherAfter,
        proofKey: uploadedKey,
        proofName: file.name.slice(0, 180),
        proofType: file.type,
        createdBy: user.displayName,
        createdAt,
      }),
      db.update(orders).set({
        voucherAmount: voucherAfter,
        paymentStatus,
        updatedBy: user.displayName,
        updatedAt: createdAt,
      }).where(and(eq(orders.id, orderId), eq(orders.voucherAmount, order.voucherAmount))),
      db.insert(orderEvents).values({
        orderId,
        eventType: `delivery_${issueType}`,
        message: deductionAmount > 0
          ? `${ISSUE_LABELS[issueType]} • ${itemDetails} • ${deductionAmount.toLocaleString()} MMK နှုတ်ပြီး`
          : `${ISSUE_LABELS[issueType]} • ${itemDetails} • ငွေမနှုတ်ပါ`,
        actor: user.displayName,
        createdAt,
      }),
    ]);
    persisted = true;

    const [issue] = await db.select().from(deliveryIncidents)
      .where(and(eq(deliveryIncidents.orderId, orderId), eq(deliveryIncidents.createdAt, createdAt)))
      .orderBy(desc(deliveryIncidents.id)).limit(1);
    const [updatedOrder] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

    const notificationMessage = deductionAmount > 0
      ? `${order.customerName} • ${ISSUE_LABELS[issueType]} • ${deductionAmount.toLocaleString()} MMK နှုတ်ပြီး • ပုံကြည့်ရန် နှိပ်ပါ`
      : `${order.customerName} • ${ISSUE_LABELS[issueType]} • ငွေမနှုတ်ပါ • ပုံကြည့်ရန် နှိပ်ပါ`;
    await notifyDepartments({
      roles: ["sale", "warehouse", "purchase", "delivery", "finance"],
      title: "Delivery အထောက်အထား အသစ်တင်ပြီးပါပြီ",
      message: notificationMessage,
      targetTab: "dashboard",
      sourceId: orderId,
      actor: user.displayName,
    }).catch(() => undefined);
    await recordAuditLog(user, { action: `delivery_${issueType}`, entityType: "order", entityId: orderId, summary: `${order.customerName} • ${ISSUE_LABELS[issueType]} • ${deductionAmount > 0 ? `${deductionAmount.toLocaleString()} MMK နှုတ်ပြီး` : "ငွေမနှုတ်"}` });

    return Response.json({
      issue,
      order: {
        voucherAmount: updatedOrder.voucherAmount,
        paymentStatus: updatedOrder.paymentStatus,
        updatedBy: updatedOrder.updatedBy,
      },
    });
  } catch (error) {
    if (uploadedKey && !persisted && env.BUCKET) await env.BUCKET.delete(uploadedKey).catch(() => undefined);
    return Response.json({ error: error instanceof Error ? error.message : "Delivery အထောက်အထား တင်မရပါ" }, { status: 500 });
  }
}
