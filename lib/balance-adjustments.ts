import { gte } from "drizzle-orm";
import { getDb } from "../db";
import { balanceAdjustments } from "../db/schema";
export async function adjustmentTotals(start: string) {
  const rows = await getDb().select().from(balanceAdjustments).where(gte(balanceAdjustments.adjustmentDate, start));
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.customerKey, (totals.get(row.customerKey) || 0) + row.amount);
  return totals;
}
