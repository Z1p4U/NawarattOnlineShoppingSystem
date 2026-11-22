import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  customerPurchaseRequests,
  dataQualityAliases,
  orders,
  productIntelligence,
  productMaster,
  purchaseArrivalAllocations,
  purchaseArrivalUnmatched,
  purchaseRequests,
} from "../db/schema";

const ACTIVE_REQUEST_STATUSES = ["pending", "ordered", "ordered_company", "ordered_mglz", "stock_out", "unavailable"];

export type IncomingArrivalInput = {
  action: "add" | "update";
  uniqueKey: string;
  productCode: string;
  productName: string;
  quantity: number;
  supplierName: string;
  purchaseDate: string;
};

type RequestCandidate = {
  sourceType: "sale_order" | "customer_request";
  id: number;
  productCode: string;
  productName: string;
  quantity: number;
  requestedAt: string;
  canonicalProductId: number;
};

function normalizeCode(value: string) {
  return String(value || "").normalize("NFKC").toLocaleUpperCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function normalizeName(value: string) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function timestamp(value: string) {
  const source = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const time = Date.parse(source);
  return Number.isFinite(time) ? time : 0;
}

function dayFromTimestamp(value: string) {
  const time = timestamp(value);
  if (!time) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yangon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));
}

function daysBefore(left: string, right: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(left) || !/^\d{4}-\d{2}-\d{2}$/.test(right)) return 0;
  return Math.floor((Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / 86_400_000);
}

export async function processPurchaseArrivalImport({
  runId,
  completedAt,
  incoming,
  actor,
}: {
  runId: number;
  completedAt: string;
  incoming: IncomingArrivalInput[];
  actor: string;
}) {
  const db = getDb();
  const [masters, aliases, saleRows, customerRows, existingAllocations, incomingRows] = await Promise.all([
    db.select().from(productMaster).where(eq(productMaster.active, true)).orderBy(asc(productMaster.id)),
    db.select().from(dataQualityAliases).where(eq(dataQualityAliases.entityType, "product")).orderBy(asc(dataQualityAliases.id)),
    db.select({
      id: purchaseRequests.id,
      productCode: purchaseRequests.productCode,
      productName: purchaseRequests.productName,
      quantity: purchaseRequests.quantity,
      requestedAt: purchaseRequests.requestedAt,
    }).from(purchaseRequests)
      .innerJoin(orders, eq(purchaseRequests.orderId, orders.id))
      .where(inArray(purchaseRequests.status, ACTIVE_REQUEST_STATUSES))
      .orderBy(asc(purchaseRequests.requestedAt), asc(purchaseRequests.id)),
    db.select({
      id: customerPurchaseRequests.id,
      productCode: customerPurchaseRequests.productCode,
      productName: customerPurchaseRequests.productName,
      quantity: customerPurchaseRequests.quantity,
      requestedAt: customerPurchaseRequests.requestedAt,
    }).from(customerPurchaseRequests)
      .where(inArray(customerPurchaseRequests.status, ACTIVE_REQUEST_STATUSES))
      .orderBy(asc(customerPurchaseRequests.requestedAt), asc(customerPurchaseRequests.id)),
    db.select({
      id: purchaseArrivalAllocations.id,
      incomingUniqueKey: purchaseArrivalAllocations.incomingUniqueKey,
      sourceType: purchaseArrivalAllocations.sourceType,
      purchaseRequestId: purchaseArrivalAllocations.purchaseRequestId,
      allocatedQuantity: purchaseArrivalAllocations.allocatedQuantity,
    }).from(purchaseArrivalAllocations).where(eq(purchaseArrivalAllocations.status, "active")),
    db.select({ id: productIntelligence.id, uniqueKey: productIntelligence.uniqueKey })
      .from(productIntelligence)
      .where(and(eq(productIntelligence.syncRunId, runId), eq(productIntelligence.insightType, "incoming"))),
  ]);

  const masterById = new Map<number, (typeof masters)[number]>(masters.map((item) => [item.id, item]));
  const codeToId = new Map<string, number>();
  for (const item of masters) {
    const code = normalizeCode(item.productCode);
    if (code) codeToId.set(code, item.id);
  }
  const nameToIds = new Map<string, Set<number>>();
  const addName = (name: string, id: number) => {
    const key = normalizeName(name);
    if (!key || !masterById.has(id)) return;
    const ids = nameToIds.get(key) || new Set<number>();
    ids.add(id);
    nameToIds.set(key, ids);
  };
  for (const item of masters) addName(item.productName, item.id);

  const aliasCodeToId = new Map<string, number>();
  for (const alias of aliases) {
    if (!masterById.has(alias.canonicalRecordId)) continue;
    const code = normalizeCode(alias.aliasKey);
    if (code) aliasCodeToId.set(code, alias.canonicalRecordId);
    addName(alias.aliasName, alias.canonicalRecordId);
  }

  function resolveProduct(codeValue: string, nameValue: string): { id: number; matchedBy: "code" | "alias" | "name" | ""; reason: string } {
    const code = normalizeCode(codeValue);
    if (code && codeToId.has(code)) return { id: codeToId.get(code)!, matchedBy: "code" as const, reason: "" };
    if (code && aliasCodeToId.has(code)) return { id: aliasCodeToId.get(code)!, matchedBy: "alias" as const, reason: "" };
    const name = normalizeName(nameValue);
    const ids = name ? [...(nameToIds.get(name) || [])] : [];
    if (ids.length === 1) return { id: ids[0], matchedBy: "name" as const, reason: "" };
    return { id: 0, matchedBy: "" as const, reason: ids.length > 1 ? "ambiguous_name" : "product_not_found" };
  }

  const requests: RequestCandidate[] = [
    ...saleRows.map((row) => ({ sourceType: "sale_order" as const, ...row })),
    ...customerRows.map((row) => ({ sourceType: "customer_request" as const, ...row })),
  ].map((row) => ({ ...row, canonicalProductId: resolveProduct(row.productCode, row.productName).id }))
    .filter((row) => row.canonicalProductId > 0 && row.quantity > 0 && timestamp(row.requestedAt) <= timestamp(completedAt))
    .sort((left, right) => timestamp(left.requestedAt) - timestamp(right.requestedAt) || left.id - right.id);

  const alreadyAllocated = new Map<string, number>();
  const updatedKeys = new Set(incoming.filter((item) => item.action === "update").map((item) => item.uniqueKey));
  for (const row of existingAllocations) {
    if (updatedKeys.has(row.incomingUniqueKey)) continue;
    const key = `${row.sourceType}:${row.purchaseRequestId}`;
    alreadyAllocated.set(key, (alreadyAllocated.get(key) || 0) + Math.max(0, row.allocatedQuantity));
  }
  const supersededAllocationCount = existingAllocations.filter((row) => updatedKeys.has(row.incomingUniqueKey)).length;
  const updatedKeyList = [...updatedKeys];
  for (let index = 0; index < updatedKeyList.length; index += 50) {
    const keys = updatedKeyList.slice(index, index + 50);
    await db.update(purchaseArrivalAllocations).set({ status: "superseded", updatedBy: actor, updatedAt: completedAt }).where(and(
      eq(purchaseArrivalAllocations.status, "active"),
      inArray(purchaseArrivalAllocations.incomingUniqueKey, keys),
    ));
    await db.update(purchaseArrivalUnmatched).set({ status: "superseded" }).where(and(
      eq(purchaseArrivalUnmatched.status, "unmatched"),
      inArray(purchaseArrivalUnmatched.incomingUniqueKey, keys),
    ));
  }
  const incomingIdByKey = new Map(incomingRows.map((row) => [row.uniqueKey, row.id]));
  const allocationValues: Array<typeof purchaseArrivalAllocations.$inferInsert> = [];
  const unmatchedValues: Array<typeof purchaseArrivalUnmatched.$inferInsert> = [];
  let allocatedQuantity = 0;
  let fullCount = 0;
  let partialCount = 0;
  let reviewCount = 0;
  let unmatchedCount = 0;
  const matchedMethodCounts = { code: 0, alias: 0, name: 0 };

  for (const item of incoming) {
    const product = resolveProduct(item.productCode, item.productName);
    const incomingRecordId = incomingIdByKey.get(item.uniqueKey) || 0;
    if (!product.id) {
      unmatchedValues.push({
        importRunId: runId,
        incomingRecordId,
        incomingUniqueKey: item.uniqueKey,
        productCode: item.productCode,
        productName: item.productName,
        incomingQuantity: item.quantity,
        supplierName: item.supplierName,
        purchaseDate: item.purchaseDate,
        importedAt: completedAt,
        reason: product.reason,
      });
      unmatchedCount += 1;
      continue;
    }

    const master = masterById.get(product.id)!;
    let available = Math.max(0, Math.round(item.quantity));
    const candidates = requests.filter((request) => request.canonicalProductId === product.id);
    for (const request of candidates) {
      if (available <= 0) break;
      const requestKey = `${request.sourceType}:${request.id}`;
      const priorAllocated = alreadyAllocated.get(requestKey) || 0;
      const required = Math.max(0, request.quantity - priorAllocated);
      if (required <= 0) continue;
      const consideredQuantity = Math.min(available, required);
      const needsReview = daysBefore(item.purchaseDate, dayFromTimestamp(request.requestedAt)) > 7;
      const allocation = needsReview ? 0 : consideredQuantity;
      const remaining = Math.max(0, required - allocation);
      const arrivalStatus = needsReview ? "review" : remaining === 0 ? "full" : "partial";
      allocationValues.push({
        importRunId: runId,
        incomingRecordId,
        incomingUniqueKey: item.uniqueKey,
        sourceType: request.sourceType,
        purchaseRequestId: request.id,
        canonicalProductId: product.id,
        productCode: master.productCode,
        productName: master.productName,
        incomingQuantity: item.quantity,
        allocatedQuantity: allocation,
        requestedQuantity: request.quantity,
        remainingQuantity: remaining,
        supplierName: item.supplierName,
        purchaseDate: item.purchaseDate,
        importedAt: completedAt,
        matchedBy: product.matchedBy,
        arrivalStatus,
        reviewReason: needsReview ? "purchase_date_more_than_7_days_before_request" : "",
        createdBy: actor,
        updatedBy: actor,
      });
      matchedMethodCounts[product.matchedBy as "code" | "alias" | "name"] += 1;
      available -= consideredQuantity;
      if (!needsReview) {
        alreadyAllocated.set(requestKey, priorAllocated + allocation);
        allocatedQuantity += allocation;
        if (arrivalStatus === "full") fullCount += 1;
        else partialCount += 1;
      } else reviewCount += 1;
    }
  }

  for (let index = 0; index < allocationValues.length; index += 4) {
    await db.insert(purchaseArrivalAllocations).values(allocationValues.slice(index, index + 4)).onConflictDoNothing();
  }
  for (let index = 0; index < unmatchedValues.length; index += 7) {
    await db.insert(purchaseArrivalUnmatched).values(unmatchedValues.slice(index, index + 7)).onConflictDoNothing();
  }
  return {
    importRunId: runId,
    incomingEvents: incoming.length,
    allocationCount: allocationValues.length,
    allocatedQuantity,
    fullCount,
    partialCount,
    reviewCount,
    unmatchedCount,
    matchedMethodCounts,
    supersededAllocationCount,
  };
}
