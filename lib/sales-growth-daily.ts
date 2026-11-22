import { gte } from "drizzle-orm";
import { getDb } from "../db";
import { orders } from "../db/schema";
import { getCustomerDirectory, normalizeCustomerKey, normalizeCustomerValue } from "./customer-directory";
import { removeCustomersWithSaleFromPendingGrowth } from "./sales-growth-reconciliation";

function todayYangonKey() {
  return new Date(Date.now() + 6.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysBefore(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

export async function runDailySalesGrowthReconciliation(actor = "Sales Growth Daily 10:00 AM") {
  const today = todayYangonKey();
  const start = daysBefore(today, 6);
  const db = getDb();
  const [customerRows, orderRows] = await Promise.all([
    getCustomerDirectory().then((rows) => rows.map((row) => ({ customerKey: row.customerKey, customerName: row.name, township: row.township }))),
    db.select({
      customerKey: orders.customerKey, customerName: orders.customerName, township: orders.township,
      voucherAmount: orders.voucherAmount, orderNo: orders.orderNo, orderDate: orders.orderDate,
    }).from(orders).where(gte(orders.orderDate, start)),
  ]);
  const byKey = new Map(customerRows.map((row) => [row.customerKey, row]));
  const byPair = new Map(customerRows.map((row) => [normalizeCustomerKey(row.customerName, row.township), row]));
  const byName = new Map<string, typeof customerRows>();
  for (const row of customerRows) {
    const name = normalizeCustomerValue(row.customerName);
    byName.set(name, [...(byName.get(name) || []), row]);
  }
  const matched = new Map<string, { customerKey: string; customerName: string; voucherAmount: number; orderNo: string }>();
  let unmatchedOrders = 0;
  for (const order of orderRows) {
    if (order.orderDate > today || order.voucherAmount <= 0) continue;
    const customer = byKey.get(order.customerKey)
      || byPair.get(normalizeCustomerKey(order.customerName, order.township))
      || ((byName.get(normalizeCustomerValue(order.customerName)) || []).length === 1 ? byName.get(normalizeCustomerValue(order.customerName))![0] : null);
    if (!customer) { unmatchedOrders += 1; continue; }
    const current = matched.get(customer.customerKey);
    matched.set(customer.customerKey, {
      customerKey: customer.customerKey, customerName: customer.customerName,
      voucherAmount: (current?.voucherAmount || 0) + order.voucherAmount, orderNo: order.orderNo,
    });
  }
  const result = await removeCustomersWithSaleFromPendingGrowth({ customers: [...matched.values()], actor });
  return { period: { start, end: today }, customersWithSaleVr: matched.size, unmatchedOrders, ...result };
}
