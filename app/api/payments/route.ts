import { adjustmentTotals } from "../../../lib/balance-adjustments";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerOpeningBalances, orders, paymentTransactions } from "../../../db/schema";
import { recordAuditLog } from "../../../lib/audit-log";
import { getAppUser, roleAllowed } from "../../../lib/app-user";
import { normalizeCustomerKey } from "../../../lib/customer-directory";
import { getOperationalPeriod, isLiveDate } from "../../../lib/operational-period";

type PaymentRow = typeof paymentTransactions.$inferSelect;

function cleanText(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

async function loadCustomerAccounts(customerName: string, township: string, officialStartDate: string) {
  const db = getDb();
  const [openingRows, customerOrders, payments] = await Promise.all([
    db.select().from(customerOpeningBalances).where(and(
      gte(customerOpeningBalances.asOfDate, officialStartDate),
      eq(customerOpeningBalances.customerKey, normalizeCustomerKey(customerName, township)),
    )).limit(1),
    db.select().from(orders).where(and(
      gte(orders.orderDate, officialStartDate),
      eq(orders.customerName, customerName),
      eq(orders.township, township),
      eq(orders.voucherStatus, "updated"),
    )).orderBy(asc(orders.orderDate), asc(orders.id)),
    db.select().from(paymentTransactions).where(and(
      gte(paymentTransactions.paymentDate, officialStartDate),
      eq(paymentTransactions.customerName, customerName),
      eq(paymentTransactions.township, township),
    )).orderBy(asc(paymentTransactions.paymentDate), asc(paymentTransactions.id)),
  ]);
  const adjustment = (await adjustmentTotals(officialStartDate)).get(normalizeCustomerKey(customerName, township)) || 0;
  return { opening: openingRows[0], customerOrders, payments, adjustment };
}

function allocationStatements(input: {
  opening: typeof customerOpeningBalances.$inferSelect | undefined;
  customerOrders: Array<typeof orders.$inferSelect>;
  payments: PaymentRow[];
  actor: string;
  adjustment: number;
}) {
  const db = getDb();
  const totalPaid = input.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalDue = (input.opening?.openingOutstanding || 0) + input.adjustment + input.customerOrders.reduce((sum, order) => sum + order.voucherAmount, 0);
  if (totalPaid > totalDue) {
    throw new Error(`ပြင်ဆင်ပြီး Payment စုစုပေါင်းသည် Customer Outstanding ${totalDue.toLocaleString()} MMK ထက် ကျော်နေပါသည်`);
  }

  const now = new Date().toISOString();
  const statements: any[] = [];
  let remaining = totalPaid;
  if (input.opening) {
    const openingPaid = Math.max(0, Math.min(input.opening.openingOutstanding + input.adjustment, remaining));
    remaining -= openingPaid;
    statements.push(db.update(customerOpeningBalances).set({ paidAmount: openingPaid, enteredBy: input.actor, updatedAt: now }).where(eq(customerOpeningBalances.id, input.opening.id)));
  }
  for (const order of input.customerOrders) {
    const paidAmount = Math.min(order.voucherAmount, remaining);
    remaining -= paidAmount;
    const paymentStatus = paidAmount <= 0 ? "unpaid" : paidAmount >= order.voucherAmount ? "paid" : "partial";
    statements.push(db.update(orders).set({ paidAmount, paymentStatus, updatedBy: input.actor, updatedAt: now }).where(eq(orders.id, order.id)));
  }
  return statements;
}

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAllowed(user.role, ["finance", "sale", "warehouse", "delivery"])) return Response.json({ error: "ဒီ Role မှာ Payment Report ကြည့်ခွင့်မရှိပါ" }, { status: 403 });
  try {
    const url = new URL(request.url);
    const startDate = (url.searchParams.get("startDate") || "").slice(0, 10);
    const endDate = (url.searchParams.get("endDate") || "").slice(0, 10);
    const { officialStartDate } = await getOperationalPeriod();
    const requestedCondition = startDate && endDate
      ? and(gte(paymentTransactions.paymentDate, startDate), lte(paymentTransactions.paymentDate, endDate))
      : startDate ? gte(paymentTransactions.paymentDate, startDate)
        : endDate ? lte(paymentTransactions.paymentDate, endDate) : undefined;
    const condition = requestedCondition
      ? and(gte(paymentTransactions.paymentDate, officialStartDate), requestedCondition)
      : gte(paymentTransactions.paymentDate, officialStartDate);
    const payments = await getDb().select().from(paymentTransactions).where(condition).orderBy(asc(paymentTransactions.paymentDate), asc(paymentTransactions.id));
    return Response.json({ payments });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Payment report load failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ Payment ပြင်နိုင်ပါသည်" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = cleanAmount(payload.id);
    const amount = cleanAmount(payload.amount);
    const method = cleanText(payload.method, 20);
    const paymentDate = cleanText(payload.paymentDate, 10);
    const reason = cleanText(payload.reason, 300);
    if (!id || !amount || !["cash", "banking"].includes(method) || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      return Response.json({ error: "Payment Date, Amount နှင့် Cash/Bank ကို မှန်ကန်စွာ ဖြည့်ပါ" }, { status: 400 });
    }
    if (!reason) return Response.json({ error: "ပြင်ဆင်ရသည့်အကြောင်းရင်း ထည့်ပါ" }, { status: 400 });
    const { officialStartDate } = await getOperationalPeriod();
    if (!isLiveDate(paymentDate, officialStartDate)) return Response.json({ error: `Official Live Start ${officialStartDate} မှစ၍ Payment Date ပြင်နိုင်ပါသည်` }, { status: 400 });

    const db = getDb();
    const [current] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.id, id)).limit(1);
    if (!current) return Response.json({ error: "Payment မတွေ့ပါ" }, { status: 404 });
    const accounts = await loadCustomerAccounts(current.customerName, current.township, officialStartDate);
    const updatedPayment: PaymentRow = { ...current, amount, method, paymentDate };
    const nextPayments = accounts.payments.map((payment) => payment.id === id ? updatedPayment : payment)
      .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.id - b.id);
    const statements = [
      db.update(paymentTransactions).set({ amount, method, paymentDate }).where(eq(paymentTransactions.id, id)),
      ...allocationStatements({ ...accounts, payments: nextPayments, actor: user.displayName }),
    ];
    await db.batch(statements as [any, ...any[]]);
    await recordAuditLog(user, { action: "payment_edit", entityType: "payment", entityId: id, summary: `${current.customerName} • ${current.amount.toLocaleString()} → ${amount.toLocaleString()} MMK • ${current.method}/${current.paymentDate} → ${method}/${paymentDate} • ${reason}` });
    return Response.json({ payment: updatedPayment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment ပြင်မရပါ";
    return Response.json({ error: message }, { status: message.includes("Outstanding") ? 400 : 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ Payment ဖျက်နိုင်ပါသည်" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = cleanAmount(payload.id);
    const reason = cleanText(payload.reason, 300);
    if (!id || cleanText(payload.confirmation, 20) !== "DELETE") return Response.json({ error: "Payment Delete confirmation မမှန်ပါ" }, { status: 400 });
    if (!reason) return Response.json({ error: "ဖျက်ရသည့်အကြောင်းရင်း ထည့်ပါ" }, { status: 400 });
    const db = getDb();
    const [current] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.id, id)).limit(1);
    if (!current) return Response.json({ error: "Payment မတွေ့ပါ" }, { status: 404 });
    const { officialStartDate } = await getOperationalPeriod();
    const accounts = await loadCustomerAccounts(current.customerName, current.township, officialStartDate);
    const nextPayments = accounts.payments.filter((payment) => payment.id !== id);
    const statements = [
      db.delete(paymentTransactions).where(eq(paymentTransactions.id, id)),
      ...allocationStatements({ ...accounts, payments: nextPayments, actor: user.displayName }),
    ];
    await db.batch(statements as [any, ...any[]]);
    await recordAuditLog(user, { action: "payment_delete", entityType: "payment", entityId: id, summary: `${current.customerName} • ${current.amount.toLocaleString()} MMK • ${current.method}/${current.paymentDate} • ${reason}` });
    return Response.json({ deletedId: id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Payment ဖျက်မရပါ" }, { status: 500 });
  }
}
