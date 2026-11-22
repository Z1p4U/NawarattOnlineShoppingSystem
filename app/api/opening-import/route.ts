import { eq, gte, inArray, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { getDb } from "../../../db";
import { customerOpeningBalances, customers, orders, paymentTransactions } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";
import { getCustomerDirectory, normalizeCustomerKey } from "../../../lib/customer-directory";
import { getOperationalPeriod, preserveTrialOpening } from "../../../lib/operational-period";
const SALE_PEOPLE = ["Zaw Tun Kyaw", "Zin Mg Mg Lin", "Myo Min", "Htin Lin Kyaw Swar", "Aung Kyaw Zaw", "Admin"] as const;

type ImportRow = {
  rowNumber: number;
  customerCode: string;
  sourceSalesperson: string;
  salesperson: string;
  sourceCustomerName: string;
  customerName: string;
  township: string;
  openingOutstanding: number;
  paidAmount: number;
  error: string;
};

function cleanText(value: unknown, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizedName(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function canonicalSalesperson(value: string) {
  const normalized = normalizedName(value);
  if (normalized === "zaw tun kyaw") return "Zaw Tun Kyaw";
  if (normalized === "zin mg mg lin") return "Zin Mg Mg Lin";
  if (normalized === "myo min") return "Myo Min";
  if (normalized === "htin lin kyaw swar" || normalized === "htin lin kyaw swar hein") return "Htin Lin Kyaw Swar";
  if (normalized === "aung kyaw zaw") return "Aung Kyaw Zaw";
  if (normalized === "admin") return "Admin";
  return "";
}

function amount(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : NaN;
  const parsed = Number(cleanText(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Opening Excel Import မအောင်မြင်ပါ";
}

async function parseFile(file: File) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("Excel Sheet မတွေ့ပါ");
  const sourceRows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, raw: true, defval: "" });
  const { officialStartDate } = await getOperationalPeriod();
  const [directory, openings, customerPayments, orderRows] = await Promise.all([
    getCustomerDirectory(),
    getDb().select().from(customerOpeningBalances).where(gte(customerOpeningBalances.asOfDate, officialStartDate)),
    getDb().select({ customerName: paymentTransactions.customerName, township: paymentTransactions.township, amount: paymentTransactions.amount }).from(paymentTransactions).where(gte(paymentTransactions.paymentDate, officialStartDate)),
    getDb().select({ customerKey: orders.customerKey, paidAmount: orders.paidAmount }).from(orders).where(gte(orders.orderDate, officialStartDate)),
  ]);
  const customersByName = new Map<string, typeof directory>();
  for (const customer of directory) {
    const key = normalizedName(customer.name);
    customersByName.set(key, [...(customersByName.get(key) || []), customer]);
  }
  const openingsByKey = new Map(openings.map((item) => [item.customerKey, item]));
  const paymentTotals = new Map<string, number>();
  for (const payment of customerPayments) {
    const key = normalizeCustomerKey(payment.customerName, payment.township);
    paymentTotals.set(key, (paymentTotals.get(key) || 0) + payment.amount);
  }
  const orderPaidTotals = new Map<string, number>();
  for (const order of orderRows) {
    orderPaidTotals.set(order.customerKey, (orderPaidTotals.get(order.customerKey) || 0) + order.paidAmount);
  }
  const seenKeys = new Set<string>();

  const rows: ImportRow[] = [];
  for (let index = 0; index < sourceRows.length; index += 1) {
    const source = sourceRows[index];
    if (!source.some((value) => cleanText(value))) continue;
    const customerCode = cleanText(source[0], 80);
    const sourceSalesperson = cleanText(source[1], 120);
    const sourceCustomerName = cleanText(source[2]);
    const openingOutstanding = amount(source[3]);
    const salesperson = canonicalSalesperson(sourceSalesperson);
    const matches = customersByName.get(normalizedName(sourceCustomerName)) || [];
    const errorParts: string[] = [];
    if (!sourceCustomerName) errorParts.push("Customer Name မရှိပါ");
    if (!salesperson || !SALE_PEOPLE.includes(salesperson as (typeof SALE_PEOPLE)[number])) errorParts.push("Sale Man မကိုက်ညီပါ");
    if (!Number.isFinite(openingOutstanding)) errorParts.push("Amount မမှန်ပါ");
    if (matches.length === 0) errorParts.push("Customer မတွေ့ပါ");
    if (matches.length > 1) errorParts.push("အမည်တူ Customer တစ်ယောက်ထက်ပိုရှိသည်");
    const match = matches.length === 1 ? matches[0] : null;
    const customerKey = match ? normalizeCustomerKey(match.name, match.township) : "";
    if (customerKey && seenKeys.has(customerKey)) errorParts.push("Customer ထပ်နေသည်");
    if (customerKey) seenKeys.add(customerKey);
    const current = customerKey ? openingsByKey.get(customerKey) : undefined;
    const paymentHistoryPaid = customerKey
      ? Math.max(0, (paymentTotals.get(customerKey) || 0) - (orderPaidTotals.get(customerKey) || 0))
      : 0;
    const paidAmount = openingOutstanding > 0
      ? Math.min(Math.max(current?.paidAmount || 0, paymentHistoryPaid), openingOutstanding)
      : 0;
    rows.push({
      rowNumber: index + 1,
      customerCode,
      sourceSalesperson,
      salesperson,
      sourceCustomerName,
      customerName: match?.name || "",
      township: match?.township || "",
      openingOutstanding: Number.isFinite(openingOutstanding) ? openingOutstanding : 0,
      paidAmount,
      error: errorParts.join(" • "),
    });
  }
  if (!rows.length) throw new Error("Excel File ထဲတွင် Opening Data မတွေ့ပါ");
  return rows;
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ Opening Excel File ထည့်နိုင်ပါသည်" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const mode = cleanText(form.get("mode"), 20) || "preview";
    if (!(file instanceof File)) return Response.json({ error: "Excel File ရွေးပါ" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return Response.json({ error: "Excel File 5 MB အောက်သာ တင်ပါ" }, { status: 400 });
    const rows = await parseFile(file);
    const { officialStartDate } = await getOperationalPeriod();
    const validRows = rows.filter((row) => !row.error);
    const total = validRows.reduce((sum, row) => sum + row.openingOutstanding, 0);
    const preview = { rows, validCount: validRows.length, errorCount: rows.length - validRows.length, total, asOfDate: officialStartDate };
    if (mode !== "commit") return Response.json(preview);
    if (preview.errorCount > 0) return Response.json({ error: `စစ်ရန် ${preview.errorCount} Rows ရှိသောကြောင့် Opening ကို မပြင်ရသေးပါ`, ...preview }, { status: 400 });

    const db = getDb();
    const now = new Date().toISOString();
    for (let index = 0; index < validRows.length; index += 8) {
      const chunk = validRows.slice(index, index + 8);
      for (const row of chunk) {
        await preserveTrialOpening(normalizeCustomerKey(row.customerName, row.township), officialStartDate, user.displayName);
      }
      await db.insert(customers).values(chunk.map((row) => ({
        customerName: row.customerName,
        township: row.township,
        customerKey: normalizeCustomerKey(row.customerName, row.township),
        phone: "",
        address: "",
        route: "HTY Ways",
        salesperson: row.salesperson,
        active: true,
        createdBy: user.displayName,
        updatedAt: now,
      }))).onConflictDoUpdate({
        target: customers.customerKey,
        set: { salesperson: sql`excluded.salesperson`, active: true, updatedAt: now },
      });
      await db.insert(customerOpeningBalances).values(chunk.map((row) => ({
        asOfDate: officialStartDate,
        customerName: row.customerName,
        township: row.township,
        customerKey: normalizeCustomerKey(row.customerName, row.township),
        openingPackages: 0,
        deliveredPackages: 0,
        openingOutstanding: row.openingOutstanding,
        paidAmount: row.paidAmount,
        note: `${row.customerCode ? `${row.customerCode} • ` : ""}${row.salesperson} • Opening Excel ပြင်ဆင်မှု`,
        enteredBy: user.displayName,
        updatedAt: now,
      }))).onConflictDoUpdate({
        target: customerOpeningBalances.customerKey,
        set: {
          asOfDate: officialStartDate,
          customerName: sql`excluded.customer_name`,
          township: sql`excluded.township`,
          openingOutstanding: sql`excluded.opening_outstanding`,
          paidAmount: sql`excluded.paid_amount`,
          note: sql`excluded.note`,
          enteredBy: user.displayName,
          updatedAt: now,
        },
      });
    }

    const importedKeys = new Set(validRows.map((row) => normalizeCustomerKey(row.customerName, row.township)));
    const resetKeys = rows.length
      ? (await db.select({ customerKey: customerOpeningBalances.customerKey }).from(customerOpeningBalances)
        .where(eq(customerOpeningBalances.asOfDate, officialStartDate)))
        .map((row) => row.customerKey)
        .filter((key) => !importedKeys.has(key))
      : [];
    for (let index = 0; index < resetKeys.length; index += 40) {
      await db.update(customerOpeningBalances).set({
        openingOutstanding: 0,
        paidAmount: 0,
        note: `${officialStartDate} Opening replacement file တွင် မပါဝင်ပါ`,
        enteredBy: user.displayName,
        updatedAt: now,
      }).where(inArray(customerOpeningBalances.customerKey, resetKeys.slice(index, index + 40)));
    }
    return Response.json({ ...preview, importedCount: validRows.length });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}
