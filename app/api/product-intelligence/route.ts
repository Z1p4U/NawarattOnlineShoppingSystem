import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { productIntelligence, productSyncRuns } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";
import { buildLiveProductIntelligence, isLiveProductType } from "../../../lib/live-product-intelligence";

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const live = await buildLiveProductIntelligence();
    const [activeRun] = await getDb().select().from(productSyncRuns).where(eq(productSyncRuns.isActive, true)).orderBy(desc(productSyncRuns.createdAt), desc(productSyncRuns.id)).limit(1);
    const [fallbackRun] = activeRun ? [] : await getDb().select().from(productSyncRuns).orderBy(desc(productSyncRuns.createdAt), desc(productSyncRuns.id)).limit(1);
    const run = activeRun || fallbackRun;
    if (!run) return Response.json({ run: null, items: live.items, live }, { headers: { "cache-control": "no-store" } });
    const items = await getDb().select().from(productIntelligence).where(eq(productIntelligence.syncRunId, run.id)).orderBy(asc(productIntelligence.insightType), asc(productIntelligence.rank), asc(productIntelligence.id)).limit(10000);
    const isComplete = ["completed", "completed_with_warnings"].includes(run.status) && items.length === run.itemCount;
    const status = isComplete ? run.status : "failed";
    if (!isComplete && (run.status !== status || run.itemCount !== items.length)) {
      await getDb().update(productSyncRuns).set({ status, itemCount: items.length }).where(eq(productSyncRuns.id, run.id));
    }
    const retained = isComplete ? items.filter((item) => !isLiveProductType(item.insightType)) : [];
    const incoming = retained.filter((item) => item.insightType === "incoming");
    const incomingCodes = new Set(incoming.map((item) => normalizeProduct(item.productCode)).filter(Boolean));
    const incomingNames = new Set(incoming.map((item) => normalizeProduct(item.productName)).filter(Boolean));
    const reconciledLiveItems = live.items.filter((item) => item.insightType !== "stock_out"
      || (!incomingCodes.has(normalizeProduct(item.productCode)) && !incomingNames.has(normalizeProduct(item.productName))));
    const excludedStockOut = live.items.length - reconciledLiveItems.length;
    const reconciledLive = {
      ...live,
      items: reconciledLiveItems,
      summary: {
        ...live.summary,
        stockOut: reconciledLiveItems.filter((item) => item.insightType === "stock_out").length,
        stockOutExcludedByIncoming: excludedStockOut,
      },
    };
    return Response.json({
      run: { ...run, status, itemCount: items.length, sourceSummary: safeJson(run.sourceSummary), errors: safeJson(run.errorSummary) },
      items: [...reconciledLive.items, ...retained],
      live: reconciledLive,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live Product Data ရယူမရပါ";
    return Response.json({ error: message.includes("no such table") ? "Live Product Data စတင်ပြင်ဆင်နေပါသည်" : message }, { status: 500 });
  }
}

function normalizeProduct(value: string) {
  return String(value || "").trim().toLocaleLowerCase().replace(/[\s_\-\/().:*'’]+/g, "");
}

function safeJson(value: string) {
  try { return JSON.parse(value) as unknown; } catch { return {}; }
}
