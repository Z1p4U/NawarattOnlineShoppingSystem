import { adjustmentTotals } from "../../../lib/balance-adjustments";
import { asc, eq, gte } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerOpeningBalances, customers } from "../../../db/schema";
import { getAppUser, roleAllowed } from "../../../lib/app-user";
import { recordAuditLog } from "../../../lib/audit-log";
import { getCustomerDirectory, normalizeCustomerKey } from "../../../lib/customer-directory";
import { getOperationalPeriod, isLiveDate, preserveTrialOpening } from "../../../lib/operational-period";

const SALE_PEOPLE = ["Zaw Tun Kyaw", "Zin Mg Mg Lin", "Myo Min", "Htin Lin Kyaw Swar", "Aung Kyaw Zaw", "Admin"];
async function saveSalesperson(key: string, name: string, township: string, value: unknown, user: { displayName: string; email: string; role: string }) {
  if (value === undefined) return;
  const salesperson = String(value);
  if (!SALE_PEOPLE.includes(salesperson)) throw new Error("Sale Man ကို ရွေးပါ");
  const db = getDb();
  const [before] = await db.select().from(customers).where(eq(customers.customerKey, key)).limit(1);
  if (before?.salesperson === salesperson) return;
  await db.insert(customers).values({ customerKey: key, customerName: name, township, salesperson, createdBy: user.displayName }).onConflictDoUpdate({ target: customers.customerKey, set: { salesperson, updatedAt: new Date().toISOString() } });
  await recordAuditLog(user, { action: "opening_salesperson_edit", entityType: "customer", entityId: key, summary: `${name} • Sale Man ${before?.salesperson || "Admin"} → ${salesperson}` });
}
function cleanText(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function cleanSignedAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { officialStartDate } = await getOperationalPeriod();
    const balances = await getDb().select().from(customerOpeningBalances)
      .where(gte(customerOpeningBalances.asOfDate, officialStartDate))
      .orderBy(asc(customerOpeningBalances.customerName), asc(customerOpeningBalances.township));
    const totals = await adjustmentTotals(officialStartDate);
    return Response.json({ balances: balances.map(row => ({ ...row, adjustmentAmount: totals.get(row.customerKey) || 0 })), defaultAsOfDate: officialStartDate });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAllowed(user.role, [])) return Response.json({ error: "Admin သာ Opening စာရင်း ထည့်/ပြင်နိုင်ပါသည်" }, { status: 403 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const { officialStartDate } = await getOperationalPeriod();
    const rawEntries = Array.isArray(payload.entries) ? payload.entries : [payload];
    if (rawEntries.length === 0 || rawEntries.length > 500) {
      return Response.json({ error: "တစ်ကြိမ်လျှင် Customer 1 မှ 500 အထိ ထည့်နိုင်ပါသည်" }, { status: 400 });
    }
    for (const raw of rawEntries) { const person = (raw as Record<string, unknown>).salesperson; if (person !== undefined && !SALE_PEOPLE.includes(String(person))) throw new Error("Sale Man ကို ရွေးပါ"); }
    const directory = await getCustomerDirectory();
    const knownKeys = new Set(directory.map((item) => normalizeCustomerKey(item.name, item.township)));
    const missingCustomers = new Map<string, { customerName: string; township: string; customerKey: string }>();
    const entries = rawEntries.map((raw) => {
      const item = raw as Record<string, unknown>;
      const customerName = cleanText(item.customerName);
      const township = cleanText(item.township, 120);
      const asOfDate = cleanText(item.asOfDate, 10) || officialStartDate;
      if (!customerName || !township) throw new Error(`${customerName || "Customer"} — Customer Name နှင့် Township ထည့်ပါ`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) || Number.isNaN(Date.parse(`${asOfDate}T00:00:00Z`))) throw new Error(`${customerName} — Opening Date မှန်ကန်စွာ ထည့်ပါ`);
      if (!isLiveDate(asOfDate, officialStartDate)) throw new Error(`${customerName} — Official Opening Date ${officialStartDate} သို့မဟုတ် နောက်ပိုင်းရက်ကို သုံးပါ`);
      const key = normalizeCustomerKey(customerName, township);
      if (!knownKeys.has(key)) missingCustomers.set(key, { customerName, township, customerKey: key });
      return {
        asOfDate,
        customerName,
        township,
        customerKey: key,
        openingPackages: cleanCount(item.openingPackages),
        deliveredPackages: cleanCount(item.deliveredPackages),
        openingOutstanding: cleanSignedAmount(item.openingOutstanding),
        paidAmount: cleanCount(item.paidAmount),
        note: cleanText(item.note, 400),
        enteredBy: user.displayName,
        updatedAt: new Date().toISOString(),
      };
    });
    const db = getDb();
    const missing = [...missingCustomers.values()];
    for (let index = 0; index < missing.length; index += 8) {
      await db.insert(customers).values(missing.slice(index, index + 8).map((item) => ({
        ...item,
        phone: "",
        address: "",
        route: "",
        salesperson: "Admin",
        active: true,
        createdBy: user.displayName,
        updatedAt: new Date().toISOString(),
      }))).onConflictDoNothing();
    }
    for (const [index, entry] of entries.entries()) {
      await saveSalesperson(entry.customerKey, entry.customerName, entry.township, (rawEntries[index] as Record<string, unknown>).salesperson, user);
      await preserveTrialOpening(entry.customerKey, officialStartDate, user.displayName);
      entry.deliveredPackages = Math.min(entry.deliveredPackages, entry.openingPackages);
      entry.paidAmount = entry.openingOutstanding > 0 ? Math.min(entry.paidAmount, entry.openingOutstanding) : 0;
      await db.insert(customerOpeningBalances).values(entry).onConflictDoUpdate({
        target: customerOpeningBalances.customerKey,
        set: entry,
      });
    }
    await recordAuditLog(user, { action: "opening_saved", entityType: "opening", summary: `Opening ${entries.length} Customers သိမ်းခဲ့သည်` });
    return Response.json({ saved: entries.length, customersAdded: missing.length });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAllowed(user.role, [])) return Response.json({ error: "Admin သာ Opening စာရင်း ထည့်/ပြင်နိုင်ပါသည်" }, { status: 403 });
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const { officialStartDate } = await getOperationalPeriod();
    if (payload.salesperson !== undefined && !SALE_PEOPLE.includes(String(payload.salesperson))) throw new Error("Sale Man ကို ရွေးပါ");
    const id = cleanCount(payload.id);
    const db = getDb();
    const [current] = await db.select().from(customerOpeningBalances).where(eq(customerOpeningBalances.id, id)).limit(1);
    if (!current) return Response.json({ error: "Opening စာရင်း မတွေ့ပါ" }, { status: 404 });

    const customerName = payload.customerName === undefined ? current.customerName : cleanText(payload.customerName);
    const township = payload.township === undefined ? current.township : cleanText(payload.township, 120);
    const asOfDate = payload.asOfDate === undefined ? current.asOfDate : cleanText(payload.asOfDate, 10);
    if (!customerName || !township) return Response.json({ error: "Customer Name နှင့် Township ထည့်ပါ" }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) || Number.isNaN(Date.parse(`${asOfDate}T00:00:00Z`))) {
      return Response.json({ error: "Opening Date မှန်ကန်စွာ ထည့်ပါ" }, { status: 400 });
    }
    if (!isLiveDate(asOfDate, officialStartDate)) return Response.json({ error: `Official Opening Date ${officialStartDate} သို့မဟုတ် နောက်ပိုင်းရက်ကို သုံးပါ` }, { status: 400 });

    const customerKey = normalizeCustomerKey(customerName, township);
    await preserveTrialOpening(current.customerKey, officialStartDate, user.displayName);
    if (customerKey !== current.customerKey && (await adjustmentTotals(officialStartDate)).has(current.customerKey)) throw new Error("Adjustment ရှိသော Customer အမည်/မြို့နယ်ကို ဤနေရာမှ ပြောင်း၍မရပါ");
    if (customerKey !== current.customerKey) {
      const [duplicate] = await db.select().from(customerOpeningBalances).where(eq(customerOpeningBalances.customerKey, customerKey)).limit(1);
      if (duplicate && duplicate.id !== current.id) {
        return Response.json({ error: "ပြင်မည့် Customer အတွက် Opening စာရင်းရှိပြီးသားဖြစ်ပါသည်" }, { status: 409 });
      }
    }

    const openingPackages = payload.openingPackages === undefined ? current.openingPackages : cleanCount(payload.openingPackages);
    const openingOutstanding = payload.openingOutstanding === undefined ? current.openingOutstanding : cleanSignedAmount(payload.openingOutstanding);
    const deliveredPackages = payload.deliveredPackages === undefined
      ? Math.min(current.deliveredPackages, openingPackages)
      : Math.min(cleanCount(payload.deliveredPackages), openingPackages);
    const adjustmentAmount = (await adjustmentTotals(officialStartDate)).get(current.customerKey) || 0;
    const paidAmount = openingOutstanding === current.openingOutstanding && (payload.paidAmount === undefined || cleanCount(payload.paidAmount) === current.paidAmount) ? current.paidAmount : openingOutstanding + adjustmentAmount > 0
      ? Math.min(payload.paidAmount === undefined ? current.paidAmount : cleanCount(payload.paidAmount), openingOutstanding + adjustmentAmount)
      : 0;
    const [balance] = await db.update(customerOpeningBalances).set({
      asOfDate,
      customerName,
      township,
      customerKey,
      openingPackages,
      openingOutstanding,
      deliveredPackages,
      paidAmount,
      note: payload.note === undefined ? current.note : cleanText(payload.note, 400),
      enteredBy: user.displayName,
      updatedAt: new Date().toISOString(),
    }).where(eq(customerOpeningBalances.id, id)).returning();

    if (customerKey !== current.customerKey) {
      const [targetCustomer] = await db.select().from(customers).where(eq(customers.customerKey, customerKey)).limit(1);
      if (targetCustomer) {
        await db.delete(customers).where(eq(customers.customerKey, current.customerKey));
      } else {
        await db.update(customers).set({
          customerName,
          township,
          customerKey,
          updatedAt: new Date().toISOString(),
        }).where(eq(customers.customerKey, current.customerKey));
      }
    }
    await saveSalesperson(customerKey, customerName, township, payload.salesperson, user);
    await recordAuditLog(user, { action: "opening_updated", entityType: "opening", entityId: balance.id, summary: `${balance.customerName} Opening ပြင်ခဲ့သည်` });
    return Response.json({ balance });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 400 });
  }
}
