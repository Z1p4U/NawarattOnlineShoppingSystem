import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs, balanceAdjustments, customerOpeningBalances } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";
import { getCustomerDirectory } from "../../../lib/customer-directory";
import { getOperationalPeriod, preserveTrialOpening } from "../../../lib/operational-period";

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { officialStartDate } = await getOperationalPeriod();
  const adjustments = await getDb().select().from(balanceAdjustments).where(gte(balanceAdjustments.adjustmentDate, officialStartDate)).orderBy(desc(balanceAdjustments.createdAt));
  return Response.json({ adjustments });
}
export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ စာရင်းကွာငွေ Adjust လုပ်နိုင်ပါသည်" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const db = getDb();
    const { officialStartDate } = await getOperationalPeriod();
    const id = String(body.id || "");
    const reason = String(body.reason || "").trim();
    const date = String(body.adjustmentDate || "");
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Yangon" });
    if (!/^[\da-f-]{36}$/i.test(id) || !reason || reason.length > 400 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date || date < officialStartDate || date > today) throw new Error("Reason နှင့် မှန်ကန်သော Date ဖြည့်ပါ");
    const [existing] = await db.select().from(balanceAdjustments).where(eq(balanceAdjustments.id, id));
    if (existing) return Response.json({ adjustment: existing });
    const customer = (await getCustomerDirectory()).find(c => c.customerKey === body.customerKey);
    if (!customer) throw new Error("Customer ရွေးပါ");
    let amount = Number(body.amount);
    const reversalOf = body.reversalOf ? String(body.reversalOf) : null;
    if (reversalOf) {
      const [original] = await db.select().from(balanceAdjustments).where(and(eq(balanceAdjustments.id, reversalOf), eq(balanceAdjustments.customerKey, customer.customerKey)));
      if (!original || original.reversalOf || original.adjustmentDate < officialStartDate) throw new Error("Reverse လုပ်နိုင်သော Adjustment မတွေ့ပါ");
      if (date < original.adjustmentDate) throw new Error("Reverse Date ကို မူလ Adjustment Date နောက်ပိုင်း ရွေးပါ");
      amount = -original.amount;
    }
    const before = Number(body.beforeBalance);
    if (!Number.isSafeInteger(amount) || !amount || !Number.isSafeInteger(before) || !Number.isSafeInteger(before + amount)) throw new Error("Amount မှန်ကန်စွာ ဖြည့်ပါ");
    const now = new Date().toISOString();
    // The INSERT checks the live balance within the same atomic D1 batch.
    const liveBalance = sql`(coalesce((select sum(opening_outstanding-paid_amount) from customer_opening_balances where customer_key=${customer.customerKey} and as_of_date>=${officialStartDate}),0) + coalesce((select sum(max(0,voucher_amount-paid_amount)) from orders where customer_name=${customer.name} and township=${customer.township} and order_date>=${officialStartDate} and voucher_status='updated'),0) + coalesce((select sum(amount) from balance_adjustments where customer_key=${customer.customerKey} and adjustment_date>=${officialStartDate}),0))`;
    const insert = sql`select ${id}, ${customer.customerKey}, ${amount}, ${date}, ${reason}, ${before}, ${before+amount}, ${reversalOf}, ${user.displayName}, ${user.email}, ${now} where ${liveBalance}=${before}`;
    await preserveTrialOpening(customer.customerKey, officialStartDate, user.displayName);
    await db.batch([
      db.insert(balanceAdjustments).select(insert),
      db.insert(customerOpeningBalances).values({ customerKey: customer.customerKey, customerName: customer.name, township: customer.township, asOfDate: officialStartDate, enteredBy: user.displayName }).onConflictDoUpdate({ target: customerOpeningBalances.customerKey, set: { asOfDate: officialStartDate, openingOutstanding: 0, paidAmount: 0, openingPackages: 0, deliveredPackages: 0, enteredBy: user.displayName }, setWhere: sql`${customerOpeningBalances.asOfDate} < ${officialStartDate}` }),
      db.insert(auditLogs).select(sql`select null, 'balance_adjustment', 'customer', ${customer.customerKey}, ${`${customer.name} • ${before} → ${before+amount} MMK • ${reason}`}, ${user.email}, ${user.displayName}, ${user.role}, ${now} where exists(select 1 from balance_adjustments where id=${id})`),
    ]);
    const [saved] = await db.select().from(balanceAdjustments).where(eq(balanceAdjustments.id, id));
    if (!saved) return Response.json({ error: "လက်ကျန်ပြောင်းသွားပါပြီ။ Refresh လုပ်ပြီး ပြန်စစ်ပါ" }, { status: 409 });
    return Response.json({ adjustment: saved });
  } catch (error) { return Response.json({ error: error instanceof Error && !error.message.includes("UNIQUE") ? error.message : "Adjustment ကို Reverse လုပ်ပြီးသားဖြစ်ပါသည်" }, { status: 400 }); }
}
