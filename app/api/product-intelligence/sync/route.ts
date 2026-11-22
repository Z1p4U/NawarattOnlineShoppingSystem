import { getAppUser } from "../../../../lib/app-user";
import { recordAuditLog } from "../../../../lib/audit-log";
import { commitWeeklyProductKnowledge, previewWeeklyProductKnowledge, WEEKLY_PRODUCT_SHEET_TAB, WEEKLY_PRODUCT_SHEET_URL } from "../../../../lib/weekly-product-knowledge";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ Product Knowledge Sync လုပ်နိုင်ပါသည်" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({})) as { mode?: unknown };
    const mode = body.mode === "commit" ? "commit" : "preview";
    if (mode === "preview") {
      const preview = await previewWeeklyProductKnowledge();
      return Response.json({ ...preview, sourceUrl: WEEKLY_PRODUCT_SHEET_URL, sheetTab: WEEKLY_PRODUCT_SHEET_TAB }, { headers: { "cache-control": "private, no-store" } });
    }
    const result = await commitWeeklyProductKnowledge(`${user.displayName} • Manual Sync`, "manual_sheet");
    await recordAuditLog(user, {
      action: "weekly_product_knowledge_synced",
      entityType: "product_sync_run",
      entityId: result.runId,
      summary: `Low Sale ${result.lowSaleCount} • Over Stock ${result.overstockCount} • Near Expired ${result.nearExpiredCount} • Skipped ${result.skippedCount}`,
    });
    return Response.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Product Knowledge Sync မအောင်မြင်ပါ" }, { status: 400 });
  }
}
