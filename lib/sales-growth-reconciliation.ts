import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { notifications, salesFollowUps, salesRoutePlans, salesRouteStops } from "../db/schema";

const OPEN_FOLLOW_UP_STATUSES = ["planned", "pending", "due", "overdue", "rescheduled", "no_answer"];
const OPEN_ROUTE_STOP_STATUSES = ["pending", "not_visited"];
const QUERY_BATCH_SIZE = 40;

function batches<T>(items: T[], size = QUERY_BATCH_SIZE) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

type SaleCustomer = {
  customerKey: string;
  customerName: string;
  voucherAmount: number;
  orderNo?: string;
};

export async function removeCustomersWithSaleFromPendingGrowth(input: {
  customers: SaleCustomer[];
  actor: string;
  sourceId?: number;
}) {
  const customers = [...new Map(input.customers
    .filter((item) => item.customerKey && item.voucherAmount > 0)
    .map((item) => [item.customerKey, item])).values()];
  if (!customers.length) return { followUpsRemoved: 0, routeStopsRemoved: 0, affectedCustomers: 0 };

  const db = getDb();
  const now = new Date().toISOString();
  const keys = customers.map((item) => item.customerKey);
  const customerMap = new Map(customers.map((item) => [item.customerKey, item]));

  // D1 has a bound-parameter limit. Keep customer keys in small batches and
  // bind the fixed status whitelist separately so a large customer list cannot
  // shift into, or overflow, the status placeholders.
  const openFollowUps: Array<typeof salesFollowUps.$inferSelect> = [];
  for (const customerKeys of batches(keys)) {
    const rows = await db.select().from(salesFollowUps).where(and(
      inArray(salesFollowUps.customerKey, customerKeys),
      eq(salesFollowUps.opportunityType, "follow_up"),
      inArray(salesFollowUps.status, OPEN_FOLLOW_UP_STATUSES),
    ));
    openFollowUps.push(...rows);
  }
  if (openFollowUps.length) {
    for (const item of openFollowUps) {
      await db.update(salesFollowUps).set({
        status: "completed",
        note: [item.note, `Auto removed: Last 7 Days Sale VR > 0 (${(customerMap.get(item.customerKey)?.voucherAmount || 0).toLocaleString()} MMK)`].filter(Boolean).join("\n"),
        updatedBy: input.actor,
        updatedAt: now,
      }).where(eq(salesFollowUps.id, item.id));
    }
  }

  const plannedPlans = await db.select({ id: salesRoutePlans.id }).from(salesRoutePlans).where(eq(salesRoutePlans.status, "planned"));
  const plannedPlanIds = new Set(plannedPlans.map((plan) => plan.id));
  const pendingStops: Array<typeof salesRouteStops.$inferSelect> = [];
  if (plannedPlanIds.size) {
    for (const customerKeys of batches(keys)) {
      const rows = await db.select().from(salesRouteStops).where(and(
        inArray(salesRouteStops.customerKey, customerKeys),
        inArray(salesRouteStops.status, OPEN_ROUTE_STOP_STATUSES),
      ));
      pendingStops.push(...rows.filter((row) => plannedPlanIds.has(row.routePlanId)));
    }
  }
  if (pendingStops.length) {
    await db.delete(salesRouteStops).where(inArray(salesRouteStops.id, pendingStops.map((stop) => stop.id)));
    const affectedPlanIds = [...new Set(pendingStops.map((stop) => stop.routePlanId))];
    for (const planId of affectedPlanIds) {
      const remaining = await db.select({ id: salesRouteStops.id }).from(salesRouteStops)
        .where(eq(salesRouteStops.routePlanId, planId)).orderBy(asc(salesRouteStops.sequence));
      if (!remaining.length) {
        await db.update(salesRoutePlans).set({ status: "cancelled", updatedAt: now }).where(eq(salesRoutePlans.id, planId));
        continue;
      }
      for (const [index, stop] of remaining.entries()) {
        await db.update(salesRouteStops).set({ sequence: index + 1, updatedAt: now }).where(eq(salesRouteStops.id, stop.id));
      }
    }
  }

  const affectedKeys = new Set([
    ...openFollowUps.map((item) => item.customerKey),
    ...pendingStops.map((item) => item.customerKey),
  ]);
  if (affectedKeys.size) {
    const affected = [...affectedKeys].map((key) => customerMap.get(key)).filter((item): item is SaleCustomer => Boolean(item));
    const names = affected.map((item) => item.customerName);
    const first = affected[0];
    await db.insert(notifications).values({
      recipientRole: "admin",
      title: "Sale VR ရှိ၍ Sales Growth စာရင်းမှ ဖယ်ရှားပြီး",
      message: `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3}` : ""}${first ? ` • ${first.voucherAmount.toLocaleString()} MMK${first.orderNo ? ` • ${first.orderNo}` : ""}` : ""} • Follow Up ${openFollowUps.length} • Route ${pendingStops.length}`,
      targetTab: "dashboard",
      sourceId: input.sourceId || 0,
      actor: input.actor,
    });
  }

  return {
    followUpsRemoved: openFollowUps.length,
    routeStopsRemoved: pendingStops.length,
    affectedCustomers: affectedKeys.size,
  };
}
