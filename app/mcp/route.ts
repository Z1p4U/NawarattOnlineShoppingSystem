import { env } from "cloudflare:workers";
import { asc, desc, eq, ne } from "drizzle-orm";
import { getDb } from "../../db";
import { appUsers, customerPurchaseRequests, productIntelligence, productSyncRuns, saleOrderPhotos } from "../../db/schema";
import { notifyDepartments } from "../../lib/department-notifications";
import { recordAuditLog } from "../../lib/audit-log";
import { commitWeeklyProductKnowledge } from "../../lib/weekly-product-knowledge";
import { runDailySalesGrowthReconciliation } from "../../lib/sales-growth-daily";

const MCP_VERSION = "2026-07-28";
const TYPES = new Set(["incoming", "stock_out", "top_sale", "low_sale", "overstock", "near_expired", "price_change", "supplier"]);
const WEEKLY_TYPES = new Set(["low_sale", "overstock", "near_expired"]);

type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type InsightInput = { insightType?: unknown; productCode?: unknown; productName?: unknown; metricLabel?: unknown; metricValue?: unknown; details?: unknown; sourceName?: unknown; priority?: unknown; rank?: unknown };
type PurchaseInput = { lineKey?: unknown; sourceFileId?: unknown; sourceFileName?: unknown; orderDate?: unknown; customerName?: unknown; township?: unknown; salesperson?: unknown; productCode?: unknown; productName?: unknown; quantity?: unknown; unit?: unknown; supplierName?: unknown; aiConfidence?: unknown; note?: unknown };
type PurchaseRecordInput = { requestId?: unknown; purchaseTab?: unknown; purchaseDate?: unknown; supplierName?: unknown; productCode?: unknown; productName?: unknown; purchasedQuantity?: unknown };

function str(value: unknown, max = 500) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function rpc(id: RpcRequest["id"], result: unknown, status = 200) { return Response.json({ jsonrpc: "2.0", id: id ?? null, result }, { status }); }
function rpcError(id: RpcRequest["id"], code: number, message: string, status = 400) { return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status }); }

async function requireAdmin(request: Request) {
  const email = str(request.headers.get("oai-authenticated-user-email"), 255).toLowerCase();
  if (!email) return null;
  const [user] = await getDb().select().from(appUsers).where(eq(appUsers.email, email)).limit(1);
  return user?.role === "admin" ? user : null;
}

export async function POST(request: Request) {
  let body: RpcRequest;
  try { body = await request.json() as RpcRequest; } catch { return rpcError(null, -32700, "Parse error"); }
  const id = body.id;
  if (body.method === "server/discover") return rpc(id, { name: "Nawaratt Product Intelligence", version: "1.0.0", supportedVersions: [MCP_VERSION], capabilities: { tools: {} } });
  if (body.method === "tools/list") return rpc(id, { tools: [syncTool, weeklyKnowledgeSyncTool, salesGrowthReconciliationTool, statusTool, purchaseSyncTool, purchaseRecordTool, purchaseStatusTool, pendingSaleOrderPhotosTool, completeSaleOrderPhotoSyncTool] });
  if (body.method !== "tools/call") return rpcError(id, -32601, "Method not found", 404);

  const user = await requireAdmin(request);
  if (!user) return rpcError(id, -32001, "Nawaratt Admin access required", 403);
  const name = str(body.params?.name, 100);
  const args = (body.params?.arguments && typeof body.params.arguments === "object" ? body.params.arguments : {}) as Record<string, unknown>;
  try {
    if (name === "sync_product_intelligence") return rpc(id, await saveSync(args, user.email));
    if (name === "sync_weekly_product_knowledge") {
      const result = await commitWeeklyProductKnowledge(`${user.displayName} • Weekly Monday 10:00 AM`, "weekly_sheet");
      return rpc(id, { content: [{ type: "text", text: `Weekly Product Knowledge sync completed: ${result.managedItemCount} items` }], structuredContent: result });
    }
    if (name === "reconcile_sales_growth") {
      const result = await runDailySalesGrowthReconciliation(`${user.displayName} • Daily 10:00 AM`);
      return rpc(id, { content: [{ type: "text", text: `Sales Growth reconciliation completed: ${result.customersWithSaleVr} customers with Sale VR` }], structuredContent: result });
    }
    if (name === "get_product_intelligence_status") return rpc(id, await getStatus());
    if (name === "sync_purchase_requests") return rpc(id, await savePurchaseRequests(args, user));
    if (name === "confirm_purchase_records") return rpc(id, await confirmPurchaseRecords(args, user));
    if (name === "get_purchase_request_status") return rpc(id, await getPurchaseRequestStatus(args));
    if (name === "get_pending_sale_order_photos") return rpc(id, await getPendingSaleOrderPhotos(args, request));
    if (name === "complete_sale_order_photo_sync") return rpc(id, await completeSaleOrderPhotoSync(args, user));
    return rpcError(id, -32602, "Unknown tool", 404);
  } catch (error) {
    return rpcError(id, -32000, error instanceof Error ? error.message : "Tool failed", 500);
  }
}

async function saveSync(args: Record<string, unknown>, actorEmail: string) {
  const syncDate = str(args.syncDate, 10);
  const tabs = (args.tabs && typeof args.tabs === "object" ? args.tabs : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(args.items) ? args.items.slice(0, 500) as InsightInput[] : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(syncDate)) throw new Error("syncDate must be YYYY-MM-DD");
  const incomingItems = rawItems.map((item, index) => ({
    insightType: str(item.insightType, 40), productCode: str(item.productCode, 80), productName: str(item.productName, 220),
    metricLabel: str(item.metricLabel, 100), metricValue: str(item.metricValue, 120), details: str(item.details, 1200),
    sourceName: str(item.sourceName, 180), priority: str(item.priority, 20) || "normal",
    rank: Number.isFinite(Number(item.rank)) ? Math.max(0, Math.round(Number(item.rank))) : index + 1,
  })).filter((item) => TYPES.has(item.insightType) && item.productName);
  const db = getDb();
  const [activeRun] = await db.select().from(productSyncRuns).where(eq(productSyncRuns.isActive, true)).orderBy(desc(productSyncRuns.createdAt), desc(productSyncRuns.id)).limit(1);
  const currentItems = activeRun
    ? await db.select().from(productIntelligence).where(eq(productIntelligence.syncRunId, activeRun.id)).orderBy(asc(productIntelligence.id))
    : [];
  const retainedWeekly = currentItems.filter((item) => WEEKLY_TYPES.has(item.insightType));
  const incomingDaily = retainedWeekly.length ? incomingItems.filter((item) => !WEEKLY_TYPES.has(item.insightType)) : incomingItems;
  const retainedValues = retainedWeekly.map((item) => ({
    syncRunId: item.syncRunId, insightType: item.insightType, productCode: item.productCode, productName: item.productName,
    metricLabel: item.metricLabel, metricValue: item.metricValue, details: item.details, sourceName: item.sourceName,
    priority: item.priority, rank: item.rank, uniqueKey: item.uniqueKey, sourceRowNumber: item.sourceRowNumber,
    entryDate: item.entryDate, enteredBy: item.enteredBy, expiryDate: item.expiryDate,
    knowledgeLocation: item.knowledgeLocation, checkedTime: item.checkedTime,
  }));
  const items = [...incomingDaily, ...retainedValues];
  const [run] = await db.insert(productSyncRuns).values({
    syncDate, saleTab: str(tabs.sale, 120), purchaseTab: str(tabs.purchase, 120), inventoryTab: str(tabs.inventory, 120), slowItemsTab: str(tabs.slowItems, 120),
    sourceSummary: JSON.stringify(args.sourceSummary && typeof args.sourceSummary === "object" ? args.sourceSummary : {}), itemCount: 0,
    status: "processing", triggeredBy: actorEmail, runType: "daily", isActive: false,
  }).returning();
  try {
    // D1 accepts only a limited number of bound values per statement. Each row has
    // ten values, so small batches keep large daily snapshots safely below the limit.
    for (let index = 0; index < items.length; index += 8) {
      const batch = items.slice(index, index + 8).map((item) => ({ ...item, syncRunId: run.id }));
      await db.insert(productIntelligence).values(batch);
    }
    const saved = await db.select({ id: productIntelligence.id }).from(productIntelligence).where(eq(productIntelligence.syncRunId, run.id));
    if (saved.length !== items.length) throw new Error(`Expected ${items.length} items but saved ${saved.length}`);
    if (activeRun) await db.update(productSyncRuns).set({ isActive: false }).where(eq(productSyncRuns.id, activeRun.id));
    await db.update(productSyncRuns).set({ status: "completed", itemCount: saved.length, isActive: true, completedAt: new Date().toISOString() }).where(eq(productSyncRuns.id, run.id));
    return { content: [{ type: "text", text: `Product Intelligence sync completed: ${saved.length} items for ${syncDate}` }], structuredContent: { runId: run.id, syncDate, itemCount: saved.length, status: "completed", tabs } };
  } catch (error) {
    const saved = await db.select({ id: productIntelligence.id }).from(productIntelligence).where(eq(productIntelligence.syncRunId, run.id));
    await db.update(productSyncRuns).set({ status: "failed", itemCount: saved.length }).where(eq(productSyncRuns.id, run.id));
    throw new Error(`Product Intelligence sync failed after saving ${saved.length}/${items.length} items: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

async function getStatus() {
  const db = getDb();
  const [activeRun] = await db.select().from(productSyncRuns).where(eq(productSyncRuns.isActive, true)).orderBy(desc(productSyncRuns.createdAt), desc(productSyncRuns.id)).limit(1);
  const [latestRun] = activeRun ? [] : await db.select().from(productSyncRuns).orderBy(desc(productSyncRuns.createdAt), desc(productSyncRuns.id)).limit(1);
  const run = activeRun || latestRun;
  if (!run) return { content: [{ type: "text", text: "No Product Intelligence sync has run yet." }], structuredContent: { run: null } };
  const counts = await db.select({ insightType: productIntelligence.insightType }).from(productIntelligence).where(eq(productIntelligence.syncRunId, run.id)).orderBy(asc(productIntelligence.insightType));
  const isComplete = ["completed", "completed_with_warnings"].includes(run.status) && counts.length === run.itemCount;
  const status = isComplete ? run.status : "failed";
  if (!isComplete && (run.status !== status || run.itemCount !== counts.length)) {
    await db.update(productSyncRuns).set({ status, itemCount: counts.length }).where(eq(productSyncRuns.id, run.id));
  }
  const verifiedRun = { ...run, status, itemCount: counts.length };
  return { content: [{ type: "text", text: `Latest sync ${run.syncDate}: ${counts.length} verified items (${status})` }], structuredContent: { run: verifiedRun, expectedItemCount: run.itemCount, verifiedItemCount: counts.length, isComplete, categories: counts.reduce<Record<string, number>>((all, row) => ({ ...all, [row.insightType]: (all[row.insightType] || 0) + 1 }), {}) } };
}

async function savePurchaseRequests(args: Record<string, unknown>, user: { email: string; displayName: string; role: string }) {
  const syncDate = str(args.syncDate, 10);
  const sourceFolder = str(args.sourceFolder, 500);
  const rawItems = Array.isArray(args.items) ? args.items.slice(0, 300) as PurchaseInput[] : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(syncDate)) throw new Error("syncDate must be YYYY-MM-DD");
  if (!rawItems.length) throw new Error("At least one validated purchase request is required");
  const items = rawItems.map((item) => {
    const sourceFileId = str(item.sourceFileId, 180);
    const lineKey = str(item.lineKey, 120);
    const orderDate = str(item.orderDate, 10) || syncDate;
    const customerName = str(item.customerName, 180);
    const productName = str(item.productName, 180);
    const quantity = Number.isFinite(Number(item.quantity)) ? Math.max(0, Math.round(Number(item.quantity))) : 0;
    const unit = str(item.unit, 40);
    if (!sourceFileId || !lineKey || !customerName || !productName || quantity < 1 || !unit || !/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
      throw new Error(`Invalid purchase request line: ${sourceFileId || "missing-file"}/${lineKey || "missing-line"}`);
    }
    return {
      processingKey: `${sourceFileId}::${lineKey}`,
      sourceFileId,
      sourceFileName: str(item.sourceFileName, 240),
      requestDate: orderDate,
      customerName,
      township: str(item.township, 120),
      salesperson: str(item.salesperson, 80),
      productCode: str(item.productCode, 80),
      productName,
      quantity,
      unit,
      supplierName: str(item.supplierName, 180),
      aiConfidence: Number.isFinite(Number(item.aiConfidence)) ? Math.max(0, Math.min(100, Math.round(Number(item.aiConfidence)))) : 0,
      note: str(item.note, 300),
    };
  });
  const db = getDb();
  const created: (typeof customerPurchaseRequests.$inferSelect)[] = [];
  let duplicates = 0;
  for (const item of items) {
    const [existing] = await db.select({ id: customerPurchaseRequests.id }).from(customerPurchaseRequests).where(eq(customerPurchaseRequests.processingKey, item.processingKey)).limit(1);
    if (existing) { duplicates += 1; continue; }
    const [assignedUser] = item.salesperson
      ? await db.select({ email: appUsers.email }).from(appUsers).where(eq(appUsers.displayName, item.salesperson)).limit(1)
      : [];
    const [saved] = await db.insert(customerPurchaseRequests).values({
      ...item,
      requestedByEmail: assignedUser?.email || "",
      status: "pending",
      requestedBy: "AI Sale Order Sync",
      updatedBy: user.displayName,
    }).returning();
    created.push(saved);
  }
  if (created.length) {
    await notifyDepartments({
      roles: ["purchase"],
      title: `AI Purchase Request ${created.length} မျိုး`,
      message: `${new Set(created.map((item) => item.customerName)).size} Customers • Supplier/Status စစ်ဆေးရန်`,
      targetTab: "purchase",
      sourceId: created[0].id,
      actor: user.displayName,
    });
    await recordAuditLog(user, {
      action: "ai_purchase_requests_synced",
      entityType: "purchase_request",
      entityId: created[0].id,
      summary: `${syncDate} • AI Purchase Request ${created.length} မျိုး • Duplicate ${duplicates}`,
    });
  }
  return {
    content: [{ type: "text", text: `Purchase Request sync completed: ${created.length} new, ${duplicates} duplicates skipped.` }],
    structuredContent: { syncDate, sourceFolder, created: created.length, duplicates, requestIds: created.map((item) => item.id), status: "completed" },
  };
}

async function getPurchaseRequestStatus(args: Record<string, unknown>) {
  const sourceFileId = str(args.sourceFileId, 180);
  const db = getDb();
  const rows = sourceFileId
    ? await db.select().from(customerPurchaseRequests).where(eq(customerPurchaseRequests.sourceFileId, sourceFileId)).orderBy(desc(customerPurchaseRequests.updatedAt), desc(customerPurchaseRequests.id)).limit(100)
    : await db.select().from(customerPurchaseRequests).where(ne(customerPurchaseRequests.sourceFileId, "")).orderBy(desc(customerPurchaseRequests.updatedAt), desc(customerPurchaseRequests.id)).limit(100);
  const counts = rows.reduce((all, item) => ({ ...all, [item.status]: (all[item.status] || 0) + 1 }), {} as Record<string, number>);
  return {
    content: [{ type: "text", text: `AI Purchase Requests: ${rows.length} rows${sourceFileId ? ` for ${sourceFileId}` : ""}.` }],
    structuredContent: { sourceFileId: sourceFileId || null, count: rows.length, counts, requests: rows },
  };
}

async function confirmPurchaseRecords(args: Record<string, unknown>, user: { email: string; displayName: string; role: string }) {
  const sourceSheet = str(args.sourceSheet, 500);
  const rawItems = Array.isArray(args.items) ? args.items.slice(0, 300) as PurchaseRecordInput[] : [];
  if (!sourceSheet) throw new Error("sourceSheet is required");
  if (!rawItems.length) throw new Error("At least one verified purchase match is required");
  const items = rawItems.map((item) => {
    const requestId = Number(item.requestId);
    const purchaseDate = str(item.purchaseDate, 10);
    const supplierName = str(item.supplierName, 180);
    const productName = str(item.productName, 180);
    const purchasedQuantity = Number.isFinite(Number(item.purchasedQuantity)) ? Math.max(0, Math.round(Number(item.purchasedQuantity))) : 0;
    if (!Number.isInteger(requestId) || requestId < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) || !supplierName || !productName || purchasedQuantity < 1) {
      throw new Error(`Invalid purchase match for request ${requestId || "missing"}`);
    }
    return {
      requestId,
      purchaseTab: str(item.purchaseTab, 120),
      purchaseDate,
      supplierName,
      productCode: str(item.productCode, 80),
      productName,
      purchasedQuantity,
    };
  });
  const db = getDb();
  const updated: (typeof customerPurchaseRequests.$inferSelect)[] = [];
  const skipped: Array<{ requestId: number; reason: string }> = [];
  for (const item of items) {
    const [request] = await db.select().from(customerPurchaseRequests).where(eq(customerPurchaseRequests.id, item.requestId)).limit(1);
    if (!request) { skipped.push({ requestId: item.requestId, reason: "request_not_found" }); continue; }
    if (request.status === "unavailable") { skipped.push({ requestId: item.requestId, reason: "manually_unavailable" }); continue; }
    if (item.purchaseDate < request.requestDate) { skipped.push({ requestId: item.requestId, reason: "purchase_before_request" }); continue; }
    const requestCode = str(request.productCode, 80).toLowerCase();
    const recordCode = item.productCode.toLowerCase();
    const requestName = str(request.productName, 180).toLowerCase();
    const recordName = item.productName.toLowerCase();
    if (requestCode && recordCode ? requestCode !== recordCode : requestName !== recordName) {
      skipped.push({ requestId: item.requestId, reason: "product_mismatch" });
      continue;
    }
    const [saved] = await db.update(customerPurchaseRequests).set({
      supplierName: item.supplierName,
      status: "ordered_company",
      updatedBy: user.displayName,
      updatedAt: new Date().toISOString(),
    }).where(eq(customerPurchaseRequests.id, item.requestId)).returning();
    if (saved) updated.push(saved);
  }
  if (updated.length) {
    await notifyDepartments({
      roles: ["sale", "purchase"],
      title: `Purchase — မှာပြီး Company ${updated.length} မျိုး`,
      message: `${new Set(updated.map((item) => item.customerName)).size} Customers • Supplier နှင့် Company order status update လုပ်ပြီး`,
      targetTab: "purchase",
      sourceId: updated[0].id,
      actor: user.displayName,
    });
    await recordAuditLog(user, {
      action: "purchase_records_confirmed",
      entityType: "purchase_request",
      entityId: updated[0].id,
      summary: `Purchase 2026 • Ordered Company ${updated.length} • Skipped ${skipped.length}`,
    });
  }
  return {
    content: [{ type: "text", text: `Purchase 2026 check completed: ${updated.length} requests marked Ordered Company, ${skipped.length} skipped.` }],
    structuredContent: { sourceSheet, updated: updated.length, skipped, requestIds: updated.map((item) => item.id), status: "completed" },
  };
}

async function getPendingSaleOrderPhotos(args: Record<string, unknown>, request: Request) {
  const requestedLimit = Number(args.limit);
  const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(20, requestedLimit)) : 10;
  const rows = await getDb().select().from(saleOrderPhotos).where(eq(saleOrderPhotos.syncStatus, "pending")).orderBy(asc(saleOrderPhotos.uploadedAt), asc(saleOrderPhotos.id)).limit(limit);
  const origin = new URL(request.url).origin;
  const photos = rows.map((photo) => {
    const downloadUrl = `${origin}/api/sale-order-photo?photoId=${photo.id}&token=${encodeURIComponent(photo.downloadToken)}`;
    return {
      photoId: photo.id,
      orderId: photo.orderId,
      batchSequence: photo.batchSequence,
      customerName: photo.customerName,
      orderNo: photo.orderNo,
      orderDate: photo.orderDate,
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      fileSize: photo.fileSize,
      uploadedAt: photo.uploadedAt,
      downloadUrl,
      fileUri: { file_id: downloadUrl, download_url: downloadUrl, file_name: photo.fileName, mime_type: photo.mimeType },
    };
  });
  return {
    content: [
      { type: "text", text: `Pending Sale Order Photos: ${photos.length}` },
      ...photos.map((photo) => ({ type: "resource_link", name: photo.fileName, uri: photo.downloadUrl, description: `${photo.customerName} • ${photo.orderNo} • Sale Order #${photo.batchSequence}`, mimeType: photo.mimeType, size: photo.fileSize })),
    ],
    structuredContent: {
      count: photos.length,
      destinationFolderId: "11EqVwSjrDrobH1EfKTJ66gioJMnXwsGa",
      destinationFolderUrl: "https://drive.google.com/drive/folders/11EqVwSjrDrobH1EfKTJ66gioJMnXwsGa",
      photos,
    },
  };
}

async function completeSaleOrderPhotoSync(args: Record<string, unknown>, user: { email: string; displayName: string; role: string }) {
  const photoId = Number(args.photoId);
  const status = str(args.status, 20);
  if (!Number.isInteger(photoId) || photoId < 1 || !["synced", "failed"].includes(status)) throw new Error("Valid photoId and status are required");
  const db = getDb();
  const [photo] = await db.select().from(saleOrderPhotos).where(eq(saleOrderPhotos.id, photoId)).limit(1);
  if (!photo) throw new Error("Sale Order Photo not found");
  if (photo.syncStatus === "synced") {
    return { content: [{ type: "text", text: `Photo ${photoId} was already synced.` }], structuredContent: { photoId, status: "synced", duplicate: true } };
  }
  if (status === "failed") {
    const error = str(args.error, 500) || "Google Drive upload failed";
    await db.update(saleOrderPhotos).set({ syncError: error }).where(eq(saleOrderPhotos.id, photoId));
    return { content: [{ type: "text", text: `Photo ${photoId} remains pending for retry: ${error}` }], structuredContent: { photoId, status: "pending", error } };
  }
  const driveFileId = str(args.driveFileId, 250);
  const driveFileUrl = str(args.driveFileUrl, 500);
  if (!driveFileId && !driveFileUrl) throw new Error("Verified Google Drive file ID or URL is required");
  const syncedAt = new Date().toISOString();
  await db.update(saleOrderPhotos).set({ syncStatus: "synced", driveFileId, driveFileUrl, syncError: "", syncedAt }).where(eq(saleOrderPhotos.id, photoId));
  if (env.BUCKET) await env.BUCKET.delete(photo.fileKey).catch(() => undefined);
  await notifyDepartments({
    roles: ["purchase", "warehouse"],
    title: "Sale Order Photo Google Drive သိမ်းပြီး",
    message: `${photo.customerName} • ${photo.orderNo} • Sale Order #${photo.batchSequence}`,
    targetTab: "purchase",
    sourceId: photo.orderId,
    actor: user.displayName,
  });
  await recordAuditLog(user, {
    action: "sale_order_photo_synced_to_drive",
    entityType: "order",
    entityId: photo.orderId,
    summary: `${photo.customerName} • ${photo.orderNo} • Sale Order #${photo.batchSequence} • App storage deleted`,
  });
  return { content: [{ type: "text", text: `Photo ${photoId} synced to Google Drive and removed from temporary App storage.` }], structuredContent: { photoId, status: "synced", driveFileId, driveFileUrl, syncedAt } };
}

const syncTool = {
  name: "sync_product_intelligence",
  title: "Sync Product Intelligence",
  description: "Save one validated daily Product Knowledge snapshot derived from the approved Nawaratt Google Sheets. Never invent missing supplier or expiry values.",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["syncDate", "tabs", "items"],
    properties: {
      syncDate: { type: "string", description: "Myanmar business date in YYYY-MM-DD" },
      tabs: { type: "object", additionalProperties: false, properties: { sale: { type: "string" }, purchase: { type: "string" }, inventory: { type: "string" }, slowItems: { type: "string" } } },
      sourceSummary: { type: "object", description: "Source coverage, validation notes, and missing fields" },
      items: {
        type: "array", maxItems: 500,
        items: {
          type: "object", additionalProperties: false, required: ["insightType", "productName", "sourceName"],
          properties: {
            insightType: { type: "string", enum: [...TYPES] }, productCode: { type: "string" }, productName: { type: "string" },
            metricLabel: { type: "string" }, metricValue: { type: "string" }, details: { type: "string" }, sourceName: { type: "string" },
            priority: { type: "string", enum: ["normal", "attention", "urgent"] }, rank: { type: "integer" },
          },
        },
      },
    },
  },
};
const weeklyKnowledgeSyncTool = {
  name: "sync_weekly_product_knowledge",
  title: "Sync Weekly Product Knowledge",
  description: "Read the approved read-only Products Knowledge Google Sheet and safely replace only Low Sale, Over Stock, Near Expired and Knowledge Location data. Preserve every other Product Knowledge category and the previous active snapshot if the sync fails.",
  inputSchema: { type: "object", additionalProperties: false, properties: {} },
};
const salesGrowthReconciliationTool = {
  name: "reconcile_sales_growth",
  title: "Reconcile Sales Growth",
  description: "Run the Team A and Team B seven-day Sale VR reconciliation and remove only unstarted Follow Up and Route Sale candidates that now have Sale VR.",
  inputSchema: { type: "object", additionalProperties: false, properties: {} },
};
const statusTool = { name: "get_product_intelligence_status", title: "Get Product Intelligence Status", description: "Verify the latest saved daily Product Knowledge sync.", inputSchema: { type: "object", additionalProperties: false, properties: {} } };
const purchaseSyncTool = {
  name: "sync_purchase_requests",
  title: "Sync Purchase Requests",
  description: "Save validated Sale Order shortage lines into the Nawaratt Purchase workflow. Use Google Drive file ID plus lineKey for duplicate-safe ingestion. Do not send uncertain OCR lines.",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["syncDate", "sourceFolder", "items"],
    properties: {
      syncDate: { type: "string", description: "Myanmar business date in YYYY-MM-DD" },
      sourceFolder: { type: "string", description: "Approved Sale Order Google Drive folder URL" },
      items: {
        type: "array", minItems: 1, maxItems: 300,
        items: {
          type: "object", additionalProperties: false,
          required: ["lineKey", "sourceFileId", "sourceFileName", "orderDate", "customerName", "productName", "quantity", "unit", "aiConfidence"],
          properties: {
            lineKey: { type: "string" }, sourceFileId: { type: "string" }, sourceFileName: { type: "string" }, orderDate: { type: "string" },
            customerName: { type: "string" }, township: { type: "string" }, salesperson: { type: "string" }, productCode: { type: "string" },
            productName: { type: "string" }, quantity: { type: "integer", minimum: 1 }, unit: { type: "string" }, supplierName: { type: "string" },
            aiConfidence: { type: "integer", minimum: 0, maximum: 100 }, note: { type: "string" },
          },
        },
      },
    },
  },
};
const purchaseRecordTool = {
  name: "confirm_purchase_records",
  title: "Confirm Purchase Records",
  description: "Update matched Nawaratt Purchase requests from the approved Purchase 2026 sheet. Match exact Product Code first; use Product Name only when exact and unambiguous. Never match a purchase dated before the request and never override Unavailable.",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["sourceSheet", "items"],
    properties: {
      sourceSheet: { type: "string", description: "Approved Purchase 2026 Google Sheet URL" },
      items: {
        type: "array", minItems: 1, maxItems: 300,
        items: {
          type: "object", additionalProperties: false,
          required: ["requestId", "purchaseTab", "purchaseDate", "supplierName", "productName", "purchasedQuantity"],
          properties: {
            requestId: { type: "integer", minimum: 1 }, purchaseTab: { type: "string" }, purchaseDate: { type: "string" },
            supplierName: { type: "string" }, productCode: { type: "string" }, productName: { type: "string" },
            purchasedQuantity: { type: "integer", minimum: 1 },
          },
        },
      },
    },
  },
};
const purchaseStatusTool = { name: "get_purchase_request_status", title: "Get Purchase Request Status", description: "Read back AI-synced Purchase requests and their current Ordered or Unavailable status.", inputSchema: { type: "object", additionalProperties: false, properties: { sourceFileId: { type: "string" } } } };
const pendingSaleOrderPhotosTool = {
  name: "get_pending_sale_order_photos",
  title: "Get Pending Sale Order Photos",
  description: "Return compressed Sale Order photos waiting for upload to the approved Google Drive folder. Each row includes a downloadable resource and a fileUri object for Google Drive upload.",
  inputSchema: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 20 } } },
};
const completeSaleOrderPhotoSyncTool = {
  name: "complete_sale_order_photo_sync",
  title: "Complete Sale Order Photo Sync",
  description: "After a verified Google Drive upload, save the Drive result and delete the temporary App copy. On upload failure, keep it pending for retry.",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["photoId", "status"],
    properties: {
      photoId: { type: "integer", minimum: 1 }, status: { type: "string", enum: ["synced", "failed"] },
      driveFileId: { type: "string" }, driveFileUrl: { type: "string" }, error: { type: "string" },
    },
  },
};
