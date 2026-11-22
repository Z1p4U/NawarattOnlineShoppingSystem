import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { productSyncRuns } from "../../../../db/schema";
import { getAppUser } from "../../../../lib/app-user";
import { recordAuditLog } from "../../../../lib/audit-log";
import { safeJson } from "../../../../lib/weekly-product-knowledge";

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ Sync History ကြည့်နိုင်ပါသည်" }, { status: 403 });
  const runs = await getDb().select().from(productSyncRuns).orderBy(desc(productSyncRuns.createdAt), desc(productSyncRuns.id)).limit(120);
  return Response.json({
    runs: runs.map((run) => ({ ...run, sourceSummary: safeJson(run.sourceSummary, {}), errors: safeJson(run.errorSummary, []) })),
  }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ Previous Sync Restore လုပ်နိုင်ပါသည်" }, { status: 403 });
  try {
    const body = await request.json() as { runId?: unknown };
    const runId = Number(body.runId);
    if (!Number.isInteger(runId) || runId < 1) return Response.json({ error: "Sync Run မမှန်ပါ" }, { status: 400 });
    const db = getDb();
    const [target] = await db.select().from(productSyncRuns).where(eq(productSyncRuns.id, runId)).limit(1);
    if (!target || !["completed", "completed_with_warnings"].includes(target.status)) {
      return Response.json({ error: "Completed Sync Snapshot ကိုသာ Restore လုပ်နိုင်ပါသည်" }, { status: 400 });
    }
    const [current] = await db.select().from(productSyncRuns).where(eq(productSyncRuns.isActive, true)).orderBy(desc(productSyncRuns.createdAt), desc(productSyncRuns.id)).limit(1);
    if (current?.id === target.id) return Response.json({ run: target, restored: false, message: "ရွေးထားသော Snapshot ကို လက်ရှိအသုံးပြုနေပါသည်" });
    if (current) await db.update(productSyncRuns).set({ isActive: false }).where(eq(productSyncRuns.id, current.id));
    const [restored] = await db.update(productSyncRuns).set({ isActive: true }).where(eq(productSyncRuns.id, target.id)).returning();
    await recordAuditLog(user, {
      action: "product_knowledge_sync_restored",
      entityType: "product_sync_run",
      entityId: target.id,
      summary: `Product Knowledge Sync #${target.id} (${target.syncDate}) ကို Restore လုပ်ခဲ့သည်`,
    });
    return Response.json({ run: restored, restored: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Sync Restore မအောင်မြင်ပါ" }, { status: 400 });
  }
}
