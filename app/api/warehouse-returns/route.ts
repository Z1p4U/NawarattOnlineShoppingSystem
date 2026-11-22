import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { orderEvents, orders, warehouseReturns } from "../../../db/schema";
import { getAppUser, roleAllowed } from "../../../lib/app-user";
import { recordAuditLog } from "../../../lib/audit-log";
import { notifyDepartments } from "../../../lib/department-notifications";
import { getOperationalPeriod, isLiveDate } from "../../../lib/operational-period";

const FINANCE_STATUSES = new Set(["deducted", "not_deducted"]);

function cleanCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const orderId = cleanCount(new URL(request.url).searchParams.get("orderId"));
  if (!orderId) return Response.json({ error: "Order ရွေးပါ" }, { status: 400 });
  try {
    const returns = await getDb().select().from(warehouseReturns)
      .where(eq(warehouseReturns.orderId, orderId))
      .orderBy(desc(warehouseReturns.acceptedAt), desc(warehouseReturns.id));
    return Response.json({ returns });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Return မှတ်တမ်း ရယူမရပါ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAllowed(user.role, ["warehouse"])) {
    return Response.json({ error: "Admin သို့မဟုတ် Warehouse Role သာ Return လက်ခံနိုင်ပါသည်" }, { status: 403 });
  }
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const orderId = cleanCount(payload.orderId);
    const returnedBoxes = cleanCount(payload.returnedBoxes);
    const returnedBundles = cleanCount(payload.returnedBundles);
    const financeStatus = cleanText(payload.financeStatus, 30);
    const note = cleanText(payload.note, 800);
    if (!orderId) return Response.json({ error: "Order ရွေးပါ" }, { status: 400 });
    if (returnedBoxes + returnedBundles === 0) return Response.json({ error: "Return ဘုံး သို့မဟုတ် ဆွဲ အရေအတွက်ထည့်ပါ" }, { status: 400 });
    if (!FINANCE_STATUSES.has(financeStatus)) return Response.json({ error: "ငွေစာရင်း နှုတ်ပြီး / မနှုတ်ရသေး ရွေးပါ" }, { status: 400 });
    if (!note) return Response.json({ error: "Return မှတ်ချက် ရေးပါ" }, { status: 400 });

    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return Response.json({ error: "Order မတွေ့ပါ" }, { status: 404 });
    const { officialStartDate } = await getOperationalPeriod();
    if (!isLiveDate(order.orderDate, officialStartDate)) return Response.json({ error: "Trial Order ကို Archive ထားပြီးဖြစ်၍ ပြင်ဆင်၍မရပါ" }, { status: 409 });
    const existing = await db.select().from(warehouseReturns).where(eq(warehouseReturns.orderId, orderId));
    const alreadyReturnedBoxes = existing.reduce((sum, item) => sum + item.returnedBoxes, 0);
    const alreadyReturnedBundles = existing.reduce((sum, item) => sum + item.returnedBundles, 0);
    if (alreadyReturnedBoxes + returnedBoxes > order.deliveredBoxes || alreadyReturnedBundles + returnedBundles > order.deliveredBundles) {
      return Response.json({ error: `ပို့ပြီးအရေအတွက်ထက် Return မကျော်ရပါ။ လက်ခံနိုင်သေး: ${Math.max(0, order.deliveredBoxes - alreadyReturnedBoxes)} ဘုံး / ${Math.max(0, order.deliveredBundles - alreadyReturnedBundles)} ဆွဲ` }, { status: 400 });
    }

    const now = new Date().toISOString();
    const [created] = await db.insert(warehouseReturns).values({
      orderId,
      returnedBoxes,
      returnedBundles,
      financeStatus,
      note,
      acceptedBy: user.displayName,
      acceptedAt: now,
      updatedBy: user.displayName,
      updatedAt: now,
    }).returning();
    const financeLabel = financeStatus === "deducted" ? "ငွေစာရင်း နှုတ်ပြီး" : "ငွေစာရင်း မနှုတ်ရသေး";
    await db.insert(orderEvents).values({ orderId, eventType: "warehouse_return", message: `Return လက်ခံ: ${returnedBoxes} ဘုံး / ${returnedBundles} ဆွဲ • ${financeLabel} • ${note}`, actor: user.displayName });
    await notifyDepartments({ roles: ["sale", "finance"], title: "Warehouse Return လက်ခံပြီး", message: `${order.customerName} • ${returnedBoxes} ဘုံး / ${returnedBundles} ဆွဲ • ${financeLabel}`, targetTab: financeStatus === "deducted" ? "sale" : "finance", sourceId: orderId, actor: user.displayName });
    await recordAuditLog(user, { action: "warehouse_return_created", entityType: "order", entityId: orderId, summary: `${order.customerName} • Return ${returnedBoxes} ဘုံး / ${returnedBundles} ဆွဲ` });
    return Response.json({ return: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Return လက်ခံမှတ်တမ်း သိမ်းမရပါ" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAllowed(user.role, ["warehouse"])) {
    return Response.json({ error: "Admin သို့မဟုတ် Warehouse Role သာ Return မှတ်တမ်း ပြင်နိုင်ပါသည်" }, { status: 403 });
  }
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = cleanCount(payload.id);
    const financeStatus = cleanText(payload.financeStatus, 30);
    if (!id || !FINANCE_STATUSES.has(financeStatus)) return Response.json({ error: "Return မှတ်တမ်းနှင့် ငွေစာရင်းအခြေအနေ ရွေးပါ" }, { status: 400 });
    const db = getDb();
    const [current] = await db.select().from(warehouseReturns).where(eq(warehouseReturns.id, id)).limit(1);
    if (!current) return Response.json({ error: "Return မှတ်တမ်း မတွေ့ပါ" }, { status: 404 });
    const [order] = await db.select().from(orders).where(eq(orders.id, current.orderId)).limit(1);
    const { officialStartDate } = await getOperationalPeriod();
    if (!order || !isLiveDate(order.orderDate, officialStartDate)) return Response.json({ error: "Trial Order ကို Archive ထားပြီးဖြစ်၍ ပြင်ဆင်၍မရပါ" }, { status: 409 });
    const now = new Date().toISOString();
    const [updated] = await db.update(warehouseReturns).set({ financeStatus, updatedBy: user.displayName, updatedAt: now }).where(eq(warehouseReturns.id, id)).returning();
    const financeLabel = financeStatus === "deducted" ? "ငွေစာရင်း နှုတ်ပြီး" : "ငွေစာရင်း မနှုတ်ရသေး";
    await db.insert(orderEvents).values({ orderId: current.orderId, eventType: "warehouse_return_finance", message: `Return မှတ်တမ်း • ${financeLabel}`, actor: user.displayName });
    await notifyDepartments({ roles: ["sale", "finance"], title: "Return ငွေစာရင်း Update", message: financeLabel, targetTab: financeStatus === "deducted" ? "sale" : "finance", sourceId: current.orderId, actor: user.displayName });
    await recordAuditLog(user, { action: "warehouse_return_updated", entityType: "warehouse_return", entityId: id, summary: `Return ငွေစာရင်းကို ${financeStatus} ပြောင်းခဲ့သည်` });
    return Response.json({ return: updated });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Return မှတ်တမ်း ပြင်မရပါ" }, { status: 500 });
  }
}
