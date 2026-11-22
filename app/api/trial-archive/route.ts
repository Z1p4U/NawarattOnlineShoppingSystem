import { and, desc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerOpeningBalances,
  customerPurchaseRequests,
  orders,
  paymentTransactions,
  purchaseRequests,
  trialOpeningBalances,
} from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";
import { getOperationalPeriod, previousDate } from "../../../lib/operational-period";
import { getPurchaseOperationalPeriod } from "../../../lib/purchase-operational-period";

function total<T>(rows: T[], value: (row: T) => number) {
  return rows.reduce((sum, row) => sum + value(row), 0);
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ Trial Archive ကြည့်နိုင်ပါသည်" }, { status: 403 });

  try {
    const [period, purchasePeriod] = await Promise.all([getOperationalPeriod(), getPurchaseOperationalPeriod()]);
    const dateRange = and(
      gte(orders.orderDate, period.trialStartDate),
      lt(orders.orderDate, period.officialStartDate),
    );
    const paymentRange = and(
      gte(paymentTransactions.paymentDate, period.trialStartDate),
      lt(paymentTransactions.paymentDate, period.officialStartDate),
    );
    const purchaseOrderRange = and(
      gte(orders.orderDate, purchasePeriod.trialStartDate),
      lt(orders.orderDate, purchasePeriod.officialStartDate),
    );
    const customerRequestRange = and(
      gte(customerPurchaseRequests.requestDate, purchasePeriod.trialStartDate),
      lt(customerPurchaseRequests.requestDate, purchasePeriod.officialStartDate),
    );
    const db = getDb();
    const [trialOrders, trialPayments, currentTrialOpenings, savedTrialOpenings, orderPurchaseRows, customerPurchaseRows] = await Promise.all([
      db.select().from(orders).where(dateRange).orderBy(desc(orders.orderDate), desc(orders.id)).limit(1000),
      db.select().from(paymentTransactions).where(paymentRange).orderBy(desc(paymentTransactions.paymentDate), desc(paymentTransactions.id)).limit(1000),
      db.select().from(customerOpeningBalances).where(lt(customerOpeningBalances.asOfDate, period.officialStartDate)).orderBy(desc(customerOpeningBalances.asOfDate), desc(customerOpeningBalances.id)).limit(1000),
      db.select().from(trialOpeningBalances).orderBy(desc(trialOpeningBalances.asOfDate), desc(trialOpeningBalances.id)).limit(1000),
      db.select({ id: purchaseRequests.id, orderId: purchaseRequests.orderId, status: purchaseRequests.status })
        .from(purchaseRequests).innerJoin(orders, eq(purchaseRequests.orderId, orders.id)).where(purchaseOrderRange),
      db.select({ id: customerPurchaseRequests.id, status: customerPurchaseRequests.status })
        .from(customerPurchaseRequests).where(customerRequestRange),
    ]);
    const savedOriginalIds = new Set(savedTrialOpenings.map((item) => item.originalId));
    const trialOpenings = [
      ...savedTrialOpenings,
      ...currentTrialOpenings.filter((item) => !savedOriginalIds.has(item.id)).map((item) => ({
        ...item,
        originalId: item.id,
        originalCreatedAt: item.createdAt,
        originalUpdatedAt: item.updatedAt,
        archivedBy: "System",
        archivedAt: "",
      })),
    ].sort((a, b) => b.asOfDate.localeCompare(a.asOfDate) || b.id - a.id);

    return Response.json({
      period: { ...period, trialEndDate: previousDate(period.officialStartDate), purchaseOfficialStartDate: purchasePeriod.officialStartDate },
      summary: {
        orders: trialOrders.length,
        packages: total(trialOrders, (item) => item.initialBoxes + item.initialBundles + item.addonBoxes + item.addonBundles),
        voucherAmount: total(trialOrders, (item) => item.voucherAmount),
        payments: trialPayments.length,
        paymentAmount: total(trialPayments, (item) => item.amount),
        openings: trialOpenings.length,
        openingOutstanding: total(trialOpenings, (item) => item.openingOutstanding - item.paidAmount),
        purchaseRequests: orderPurchaseRows.length + customerPurchaseRows.length,
      },
      orders: trialOrders,
      payments: trialPayments,
      openings: trialOpenings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trial Archive ရယူမရပါ";
    return Response.json({ error: message.includes("no such table") ? "Trial Archive Database ပြင်ဆင်နေပါသည်။ ခဏနေရင် Refresh လုပ်ပါ" : message }, { status: 500 });
  }
}
