import { adjustmentTotals } from "../../../lib/balance-adjustments";
import { and, asc, eq, gte } from "drizzle-orm";
import * as XLSX from "xlsx";
import { getDb } from "../../../db";
import {
  customerOpeningBalances,
  customers,
  orderEvents,
  orders,
  paymentImportBatches,
  paymentTransactions,
} from "../../../db/schema";
import { getAppUser, roleAllowed } from "../../../lib/app-user";
import { notifyDepartments } from "../../../lib/department-notifications";
import { getOperationalPeriod } from "../../../lib/operational-period";

type Method = "cash" | "banking";
type SourceRow = {
  rowNumber: number;
  paymentDate: string;
  customerName: string;
  township: string;
  amount: number;
  method: Method | "";
  account: string;
};
type CustomerMatch = { customerName: string; township: string };
type CheckedRow = SourceRow & {
  matchedCustomerName: string;
  matchedTownship: string;
  outstandingBefore: number;
  outstandingAfter: number;
  overpayment: number;
  error: string;
};

function clean(value: unknown, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function key(value: unknown) {
  return clean(value)
    .toLocaleLowerCase()
    .replace(/[\s_\-\/()]+/g, "");
}

function customerKey(name: string, township: string) {
  return `${key(name)}|||${key(township)}`;
}

function amountValue(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = clean(value, 30);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (!match) return "";
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const month = Number(match[2]);
  const day = Number(match[1]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function methodValue(value: unknown, account: string): Method | "" {
  const normalized = key(value);
  if (["cash", "cashin", "ငွေသား"].includes(normalized)) return "cash";
  if (["bank", "banking", "bankin", "ဘဏ်", "ဘဏ်အဝင်"].includes(normalized)) return "banking";
  if (/cash/i.test(account)) return "cash";
  if (account) return "banking";
  return "";
}

function findHeaderRow(grid: unknown[][]) {
  const aliases = {
    date: ["date", "paymentdate", "ရက်စွဲ"],
    customer: ["name", "customer", "customername", "ဆိုင်အမည်", "customerအမည်"],
    township: ["township", "မြို့နယ်", "မြို့"],
    amount: ["amount", "paymentamount", "ငွေပမာဏ", "ပမာဏ"],
    method: ["paymenttype", "paymentmethod", "method", "cashbanking", "ငွေလက်ခံပုံ"],
  };
  for (let rowIndex = 0; rowIndex < Math.min(20, grid.length); rowIndex += 1) {
    const headers = grid[rowIndex].map(key);
    const find = (list: string[]) => headers.findIndex((header) => list.includes(header));
    const columns = {
      date: find(aliases.date),
      customer: find(aliases.customer),
      township: find(aliases.township),
      amount: find(aliases.amount),
      method: find(aliases.method),
    };
    if (columns.date >= 0 && columns.customer >= 0 && columns.amount >= 0) return { rowIndex, columns };
  }
  return null;
}

function parseWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
  const header = findHeaderRow(grid);
  if (!header) throw new Error("Date, Name/Customer နှင့် Amount Columns မတွေ့ပါ");

  let account = "";
  const rows: SourceRow[] = [];
  for (let index = header.rowIndex + 1; index < grid.length; index += 1) {
    const source = grid[index] || [];
    const date = dateValue(source[header.columns.date]);
    const name = clean(source[header.columns.customer]);
    const amount = amountValue(source[header.columns.amount]);
    const dateColumnText = clean(source[header.columns.date]);
    if (!date && dateColumnText && !/total/i.test(dateColumnText) && /(cash|pay|bank|yoma|aya|cb|mab|kbz)/i.test(dateColumnText)) {
      account = dateColumnText;
      continue;
    }
    if (!date || !name || !amount) continue;
    const township = header.columns.township >= 0 ? clean(source[header.columns.township], 120) : "";
    const method = methodValue(header.columns.method >= 0 ? source[header.columns.method] : "", account);
    rows.push({ rowNumber: index + 1, paymentDate: date, customerName: name, township, amount, method, account });
  }
  if (!rows.length) throw new Error("Payment Rows မတွေ့ပါ");
  return rows;
}

async function hashFile(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadState() {
  const db = getDb();
  const { officialStartDate } = await getOperationalPeriod();
  const [directory, openings, orderRows] = await Promise.all([
    db.select({ customerName: customers.customerName, township: customers.township }).from(customers),
    db.select().from(customerOpeningBalances).where(gte(customerOpeningBalances.asOfDate, officialStartDate)),
    db.select().from(orders).where(and(gte(orders.orderDate, officialStartDate), eq(orders.voucherStatus, "updated"))).orderBy(asc(orders.orderDate), asc(orders.id)),
  ]);
  const matches = new Map<string, CustomerMatch>();
  for (const row of [...directory, ...openings, ...orderRows]) {
    matches.set(customerKey(row.customerName, row.township), { customerName: row.customerName, township: row.township });
  }
  const byName = new Map<string, CustomerMatch[]>();
  for (const match of matches.values()) {
    const nameKey = key(match.customerName);
    byName.set(nameKey, [...(byName.get(nameKey) || []), match]);
  }
  const totals = await adjustmentTotals(officialStartDate);
  return { db, openings: openings.map(row => ({ ...row, adjustmentAmount: totals.get(row.customerKey) || 0 })), orderRows, byName, officialStartDate };
}

function checkRows(sourceRows: SourceRow[], state: Awaited<ReturnType<typeof loadState>>) {
  const remaining = new Map<string, number>();
  for (const opening of state.openings) {
    const id = customerKey(opening.customerName, opening.township);
    remaining.set(id, (remaining.get(id) || 0) + Math.max(0, opening.openingOutstanding + opening.adjustmentAmount - opening.paidAmount));
  }
  for (const order of state.orderRows) {
    const id = customerKey(order.customerName, order.township);
    remaining.set(id, (remaining.get(id) || 0) + Math.max(0, order.voucherAmount - order.paidAmount));
  }

  const seen = new Set<string>();
  return sourceRows.map<CheckedRow>((row) => {
    const sameName = state.byName.get(key(row.customerName)) || [];
    const matches = row.township ? sameName.filter((item) => key(item.township) === key(row.township)) : sameName;
    const match = matches.length === 1 ? matches[0] : undefined;
    const id = match ? customerKey(match.customerName, match.township) : "";
    const before = id ? remaining.get(id) || 0 : 0;
    const duplicateKey = match ? `${id}|${row.paymentDate}|${row.amount}|${row.method}` : "";
    let error = "";
    if (row.paymentDate < state.officialStartDate) error = `Official Live Start ${state.officialStartDate} မတိုင်မီ Payment ဖြစ်နေပါသည်`;
    else if (!row.method) error = "Cash / Banking မခွဲနိုင်ပါ";
    else if (!match && matches.length > 1) error = "Customer အမည်တူရှိ၍ Township လိုအပ်ပါသည်";
    else if (!match) error = "Customer မတွေ့ပါ";
    else if (!before) error = "Outstanding မရှိပါ";
    else if (seen.has(duplicateKey)) error = "File ထဲတွင် တူညီ Payment နှစ်ကြောင်းရှိပါသည်";
    if (!error) {
      seen.add(duplicateKey);
      remaining.set(id, Math.max(0, before - row.amount));
    }
    const overpayment = !error && row.amount > before ? row.amount - before : 0;
    return {
      ...row,
      matchedCustomerName: match?.customerName || row.customerName,
      matchedTownship: match?.township || row.township,
      outstandingBefore: before,
      outstandingAfter: error ? before : Math.max(0, before - row.amount),
      overpayment,
      error,
    };
  });
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAllowed(user.role, ["finance"])) return Response.json({ error: "Admin နှင့် Finance Team သာ Payment File ထည့်နိုင်ပါသည်" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const mode = clean(form.get("mode"), 20);
    if (!(file instanceof File)) return Response.json({ error: "Excel File ရွေးပါ" }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return Response.json({ error: "File Size 8 MB အောက်သာတင်ပါ" }, { status: 400 });
    const buffer = await file.arrayBuffer();
    const fileHash = await hashFile(buffer);
    const sourceRows = parseWorkbook(buffer);
    const state = await loadState();
    const checked = checkRows(sourceRows, state);
    const valid = checked.filter((row) => !row.error);
    const total = valid.reduce((sum, row) => sum + row.amount, 0);
    const [previous] = await state.db.select().from(paymentImportBatches).where(eq(paymentImportBatches.fileHash, fileHash)).limit(1);

    if (mode !== "commit") {
      return Response.json({
        fileHash,
        duplicate: Boolean(previous),
        previous,
        rows: checked,
        validCount: valid.length,
        errorCount: checked.length - valid.length,
        total,
      });
    }
    if (previous) return Response.json({ error: "ဒီ File ကို အရင်က Import လုပ်ပြီးပါပြီ", duplicate: true }, { status: 409 });
    if (!valid.length) return Response.json({ error: "သိမ်းနိုင်သော Payment မရှိပါ" }, { status: 400 });

    const openingState = state.openings.map((row) => ({ ...row }));
    const orderState = state.orderRows.map((row) => ({ ...row }));
    const statements: any[] = [];
    const customerTotals = new Map<string, { customerName: string; amount: number }>();

    for (const row of valid) {
      let left = row.amount;
      const matchingOpenings = openingState.filter((item) => item.customerName === row.matchedCustomerName && item.township === row.matchedTownship);
      for (const opening of matchingOpenings) {
        if (left <= 0) break;
        const balance = Math.max(0, opening.openingOutstanding + opening.adjustmentAmount - opening.paidAmount);
        const applied = Math.min(balance, left);
        if (!applied) continue;
        opening.paidAmount += applied;
        left -= applied;
        statements.push(state.db.update(customerOpeningBalances).set({ paidAmount: opening.paidAmount, enteredBy: user.displayName, updatedAt: new Date().toISOString() }).where(eq(customerOpeningBalances.id, opening.id)));
      }

      const updatedOrderIds: number[] = [];
      const matchingOrders = orderState.filter((item) => item.customerName === row.matchedCustomerName && item.township === row.matchedTownship);
      for (const order of matchingOrders) {
        if (left <= 0) break;
        const balance = Math.max(0, order.voucherAmount - order.paidAmount);
        const applied = Math.min(balance, left);
        if (!applied) continue;
        order.paidAmount += applied;
        left -= applied;
        const paymentStatus = order.paidAmount >= order.voucherAmount ? "paid" : "partial";
        order.paymentStatus = paymentStatus;
        statements.push(state.db.update(orders).set({ paidAmount: order.paidAmount, paymentStatus, updatedBy: user.displayName, updatedAt: new Date().toISOString() }).where(eq(orders.id, order.id)));
        statements.push(state.db.insert(orderEvents).values({ orderId: order.id, eventType: "customer_payment", message: `Excel Payment ${applied.toLocaleString()} MMK • ${paymentStatus}`, actor: user.displayName }));
        updatedOrderIds.push(order.id);
      }
      statements.push(state.db.insert(paymentTransactions).values({
        orderId: updatedOrderIds.length === 1 ? updatedOrderIds[0] : 0,
        customerName: row.matchedCustomerName,
        township: row.matchedTownship,
        amount: row.amount,
        method: row.method as Method,
        paymentDate: row.paymentDate,
        enteredBy: user.displayName,
        createdAt: new Date().toISOString(),
      }));
      const totalEntry = customerTotals.get(customerKey(row.matchedCustomerName, row.matchedTownship));
      customerTotals.set(customerKey(row.matchedCustomerName, row.matchedTownship), {
        customerName: row.matchedCustomerName,
        amount: (totalEntry?.amount || 0) + row.amount,
      });
    }

    statements.push(state.db.insert(paymentImportBatches).values({
      fileHash,
      fileName: clean(file.name, 180),
      rowCount: valid.length,
      totalAmount: total,
      importedBy: user.displayName,
      createdAt: new Date().toISOString(),
    }));
    await state.db.batch(statements as [any, ...any[]]);

    for (const entry of customerTotals.values()) {
      try {
        await notifyDepartments({ roles: ["sale"], title: "Customer Payment ဝင်ပါပြီ", message: `${entry.customerName} • ${entry.amount.toLocaleString()} MMK • Excel Import`, targetTab: "sale", sourceId: 0, actor: user.displayName });
      } catch { /* Payment commit remains successful if a notification cannot be created. */ }
    }
    return Response.json({ importedCount: valid.length, skippedCount: checked.length - valid.length, total, rows: checked });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Payment File Import မအောင်မြင်ပါ" }, { status: 500 });
  }
}
