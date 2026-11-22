import { and, asc, eq, gte, inArray, or } from "drizzle-orm";
import { getDb } from "../db";
import {
  customerPurchaseRequests,
  orders,
  purchaseRequestAllocations,
  purchaseRequests,
  saleOrderItems,
} from "../db/schema";
import { normalizeCustomerKey } from "./customer-directory";
import { getPurchaseOperationalPeriod } from "./purchase-operational-period";

const ACTIVE_PURCHASE_STATUSES = ["pending", "ordered", "ordered_company", "ordered_mglz", "unavailable", "stock_out"];
const RESOLVED_STATUS = "resolved_by_available_stock";

type PurchaseSourceType = "sale_order" | "customer_request";

type CandidateRequest = {
  sourceType: PurchaseSourceType;
  id: number;
  productCode: string;
  productName: string;
  quantity: number;
  status: string;
  requestedAt: string;
  customerKey: string;
};

function normalizeProductCode(value: string) {
  return value.toLocaleUpperCase().replace(/\s+/g, " ").trim();
}

function normalizeProductName(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameProduct(request: CandidateRequest, actualCode: string, actualName: string) {
  const requestCode = normalizeProductCode(request.productCode);
  if (requestCode && actualCode) return requestCode === actualCode;
  const requestName = normalizeProductName(request.productName);
  const normalizedActualName = normalizeProductName(actualName);
  return Boolean(requestName && normalizedActualName && requestName === normalizedActualName);
}

function finishedBatchSequences(rawBatches: string) {
  try {
    const parsed = JSON.parse(rawBatches) as Array<{ sequence?: unknown; status?: unknown }>;
    return new Set(parsed
      .filter((batch) => batch.status === "finished")
      .map((batch) => Number(batch.sequence))
      .filter((sequence) => Number.isInteger(sequence) && sequence > 0));
  } catch {
    return new Set<number>();
  }
}

async function activeRequestsForCustomer(customerKey: string) {
  const db = getDb();
  const { officialStartDate } = await getPurchaseOperationalPeriod();
  const [customerRows, orderRows] = await Promise.all([
    db.select({
      id: customerPurchaseRequests.id,
      productCode: customerPurchaseRequests.productCode,
      productName: customerPurchaseRequests.productName,
      quantity: customerPurchaseRequests.quantity,
      status: customerPurchaseRequests.status,
      requestedAt: customerPurchaseRequests.requestedAt,
      customerKey: customerPurchaseRequests.customerKey,
      customerName: customerPurchaseRequests.customerName,
      township: customerPurchaseRequests.township,
    })
      .from(customerPurchaseRequests)
      .where(and(
        gte(customerPurchaseRequests.requestDate, officialStartDate),
        inArray(customerPurchaseRequests.status, ACTIVE_PURCHASE_STATUSES),
        or(eq(customerPurchaseRequests.customerKey, customerKey), eq(customerPurchaseRequests.customerKey, "")),
      ))
      .orderBy(asc(customerPurchaseRequests.requestedAt), asc(customerPurchaseRequests.id)),
    db.select({
      id: purchaseRequests.id,
      productCode: purchaseRequests.productCode,
      productName: purchaseRequests.productName,
      quantity: purchaseRequests.quantity,
      status: purchaseRequests.status,
      requestedAt: purchaseRequests.requestedAt,
      customerKey: orders.customerKey,
    })
      .from(purchaseRequests)
      .innerJoin(orders, eq(purchaseRequests.orderId, orders.id))
      .where(and(gte(orders.orderDate, officialStartDate), eq(orders.customerKey, customerKey), inArray(purchaseRequests.status, ACTIVE_PURCHASE_STATUSES)))
      .orderBy(asc(purchaseRequests.requestedAt), asc(purchaseRequests.id)),
  ]);

  const candidates: CandidateRequest[] = [
    ...customerRows
      .filter((row) => (row.customerKey || normalizeCustomerKey(row.customerName, row.township)) === customerKey)
      .map((row) => ({
        sourceType: "customer_request" as const,
        id: row.id,
        productCode: row.productCode,
        productName: row.productName,
        quantity: row.quantity,
        status: row.status,
        requestedAt: row.requestedAt,
        customerKey,
      })),
    ...orderRows.map((row) => ({ sourceType: "sale_order" as const, ...row })),
  ];

  return candidates.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt) || a.id - b.id);
}

export async function fulfillActivePurchaseRequestsForBatch({
  orderId,
  batchSequence,
  actor,
}: {
  orderId: number;
  batchSequence: number;
  actor: string;
}) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { requestCount: 0, quantity: 0, itemCount: 0 };

  const items = await db.select().from(saleOrderItems)
    .where(and(eq(saleOrderItems.orderId, orderId), eq(saleOrderItems.batchSequence, batchSequence)))
    .orderBy(asc(saleOrderItems.originalRowNumber), asc(saleOrderItems.id));
  const existingAllocations = await db.select({
    itemId: purchaseRequestAllocations.fulfillmentOrderItemId,
    quantity: purchaseRequestAllocations.quantity,
  }).from(purchaseRequestAllocations).where(and(
    eq(purchaseRequestAllocations.fulfillmentOrderId, orderId),
    eq(purchaseRequestAllocations.batchSequence, batchSequence),
    eq(purchaseRequestAllocations.status, "active"),
  ));
  const allocatedQuantityByItem = new Map<number, number>();
  for (const allocation of existingAllocations) {
    allocatedQuantityByItem.set(
      allocation.itemId,
      (allocatedQuantityByItem.get(allocation.itemId) || 0) + allocation.quantity,
    );
  }
  const candidates = await activeRequestsForCustomer(order.customerKey);
  if (!items.length || !candidates.length) return { requestCount: 0, quantity: 0, itemCount: 0 };

  const now = new Date().toISOString();
  const statements: any[] = [];
  const affectedRequests = new Set<string>();
  const affectedItems = new Set<number>();
  let fulfilledQuantity = 0;

  for (const item of items) {
    const hasConfirmedSubstitute = item.substitutionStatus === "confirmed" && Boolean(item.substituteProductCode);
    const actualCode = normalizeProductCode(hasConfirmedSubstitute
      ? item.substituteProductCode
      : item.matchedProductCode || item.originalProductCode);
    const actualName = hasConfirmedSubstitute
      ? item.substituteProductName
      : item.matchedProductName || item.originalDescription;
    const checkedQuantity = hasConfirmedSubstitute
      ? Math.max(0, item.substituteQuantity)
      : Math.max(0, item.checkedQuantity);
    let availableQuantity = Math.max(0, checkedQuantity - (allocatedQuantityByItem.get(item.id) || 0));
    if ((!actualCode && !normalizeProductName(actualName)) || availableQuantity <= 0) continue;

    for (const request of candidates) {
      if (availableQuantity <= 0) break;
      if (request.quantity <= 0 || !sameProduct(request, actualCode, actualName)) continue;
      const allocationQuantity = Math.min(availableQuantity, request.quantity);
      const previousStatus = request.status;
      request.quantity -= allocationQuantity;
      availableQuantity -= allocationQuantity;
      const nextStatus = request.quantity === 0 ? RESOLVED_STATUS : request.status;
      request.status = nextStatus;

      statements.push(request.sourceType === "customer_request"
        ? db.update(customerPurchaseRequests).set({
            quantity: request.quantity,
            status: nextStatus,
            updatedBy: actor,
            updatedAt: now,
          }).where(eq(customerPurchaseRequests.id, request.id))
        : db.update(purchaseRequests).set({
            quantity: request.quantity,
            status: nextStatus,
            updatedBy: actor,
            updatedAt: now,
          }).where(eq(purchaseRequests.id, request.id)));
      statements.push(db.insert(purchaseRequestAllocations).values({
        sourceType: request.sourceType,
        purchaseRequestId: request.id,
        fulfillmentOrderId: orderId,
        fulfillmentOrderItemId: item.id,
        batchSequence,
        customerKey: order.customerKey,
        productCode: actualCode,
        quantity: allocationQuantity,
        previousStatus,
        status: "active",
        createdBy: actor,
        updatedAt: now,
      }));
      fulfilledQuantity += allocationQuantity;
      affectedRequests.add(`${request.sourceType}:${request.id}`);
      affectedItems.add(item.id);
    }
  }

  if (statements.length) await db.batch(statements as [any, ...any[]]);
  return { requestCount: affectedRequests.size, quantity: fulfilledQuantity, itemCount: affectedItems.size };
}

export async function restoreActivePurchaseRequestAllocations({
  orderId,
  batchSequence,
  actor,
}: {
  orderId: number;
  batchSequence?: number;
  actor: string;
}) {
  const db = getDb();
  const rows = await db.select().from(purchaseRequestAllocations)
    .where(and(eq(purchaseRequestAllocations.fulfillmentOrderId, orderId), eq(purchaseRequestAllocations.status, "active")))
    .orderBy(asc(purchaseRequestAllocations.id));
  const allocations = batchSequence
    ? rows.filter((row) => row.batchSequence === batchSequence)
    : rows;
  if (!allocations.length) return { requestCount: 0, quantity: 0 };

  const grouped = new Map<string, { sourceType: PurchaseSourceType; requestId: number; quantity: number; previousStatus: string }>();
  for (const allocation of allocations) {
    const sourceType = allocation.sourceType === "customer_request" ? "customer_request" : "sale_order";
    const key = `${sourceType}:${allocation.purchaseRequestId}`;
    const group = grouped.get(key) || {
      sourceType,
      requestId: allocation.purchaseRequestId,
      quantity: 0,
      previousStatus: allocation.previousStatus || "pending",
    };
    group.quantity += allocation.quantity;
    grouped.set(key, group);
  }

  const now = new Date().toISOString();
  const statements: any[] = [];
  let restoredQuantity = 0;
  let restoredRequests = 0;
  for (const group of grouped.values()) {
    if (group.sourceType === "customer_request") {
      const [request] = await db.select().from(customerPurchaseRequests).where(eq(customerPurchaseRequests.id, group.requestId)).limit(1);
      if (!request) continue;
      statements.push(db.update(customerPurchaseRequests).set({
        quantity: request.quantity + group.quantity,
        status: request.status === RESOLVED_STATUS ? group.previousStatus : request.status,
        updatedBy: actor,
        updatedAt: now,
      }).where(eq(customerPurchaseRequests.id, request.id)));
    } else {
      const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, group.requestId)).limit(1);
      if (!request) continue;
      statements.push(db.update(purchaseRequests).set({
        quantity: request.quantity + group.quantity,
        status: request.status === RESOLVED_STATUS ? group.previousStatus : request.status,
        updatedBy: actor,
        updatedAt: now,
      }).where(eq(purchaseRequests.id, request.id)));
    }
    restoredQuantity += group.quantity;
    restoredRequests += 1;
  }
  statements.push(...allocations.map((allocation) => db.update(purchaseRequestAllocations).set({
    status: "restored",
    restoredBy: actor,
    restoredAt: now,
    updatedAt: now,
  }).where(eq(purchaseRequestAllocations.id, allocation.id))));
  if (statements.length) await db.batch(statements as [any, ...any[]]);
  return { requestCount: restoredRequests, quantity: restoredQuantity };
}

export async function resyncPurchaseRequestAllocationsForOrder({ orderId, actor }: { orderId: number; actor: string }) {
  await restoreActivePurchaseRequestAllocations({ orderId, actor });
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { requestCount: 0, quantity: 0, itemCount: 0 };
  const finishedBatches = finishedBatchSequences(order.warehouseBatches);
  const total = { requestCount: 0, quantity: 0, itemCount: 0 };
  for (const batchSequence of finishedBatches) {
    const result = await fulfillActivePurchaseRequestsForBatch({ orderId, batchSequence, actor });
    total.requestCount += result.requestCount;
    total.quantity += result.quantity;
    total.itemCount += result.itemCount;
  }
  return total;
}

export { RESOLVED_STATUS as PURCHASE_REQUEST_RESOLVED_STATUS };
