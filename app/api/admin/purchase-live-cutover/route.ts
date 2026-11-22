import { env } from "cloudflare:workers";
import { and, desc, eq, gte, lt, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import { customerPurchaseRequests, orders, purchaseCutoverRuns, purchaseRequests } from "../../../../db/schema";
import { getAppUser } from "../../../../lib/app-user";
import { getPurchaseOperationalPeriod } from "../../../../lib/purchase-operational-period";

const TARGET_LIVE_DATE = "2026-11-17";
const ACTIVE_STATUSES = ["pending", "ordered", "received", "ordered_company", "ordered_mglz", "stock_out", "unavailable"];
type PurchaseRow = { productCode: string; productName: string; unit: string; status: string };
type SchemaRow = { name: string; sql: string | null };

function productKey(row: PurchaseRow) {
  const code = row.productCode.trim().toLocaleUpperCase();
  const name = row.productName.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const unit = (row.unit || "unit").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return `${code ? `code:${code}` : `name:${name}`}|||unit:${unit}`;
}

function statusBucket(status: string) {
  return status === "ordered" || status === "received" ? "ordered_company" : status;
}

function groupBucket(statuses: string[]) {
  const buckets = statuses.map(statusBucket);
  if (buckets.includes("pending")) return "pending";
  if (buckets.includes("ordered_company")) return "ordered_company";
  if (buckets.includes("ordered_mglz")) return "ordered_mglz";
  if (buckets.includes("stock_out")) return "stock_out";
  return "unavailable";
}

async function cutoverSnapshot(previousStartDate: string, targetDate: string) {
  const db = getDb();
  const [orderRows, customerRows] = await Promise.all([
    db.select({ productCode: purchaseRequests.productCode, productName: purchaseRequests.productName, unit: purchaseRequests.unit, status: purchaseRequests.status })
      .from(purchaseRequests).innerJoin(orders, eq(purchaseRequests.orderId, orders.id)).where(and(
        gte(orders.orderDate, previousStartDate), lt(orders.orderDate, targetDate),
        ne(purchaseRequests.status, "resolved_by_available_stock"), ne(purchaseRequests.status, "cancelled"),
      )),
    db.select({ productCode: customerPurchaseRequests.productCode, productName: customerPurchaseRequests.productName, unit: customerPurchaseRequests.unit, status: customerPurchaseRequests.status })
      .from(customerPurchaseRequests).where(and(
        gte(customerPurchaseRequests.requestDate, previousStartDate), lt(customerPurchaseRequests.requestDate, targetDate),
        ne(customerPurchaseRequests.status, "resolved_by_available_stock"), ne(customerPurchaseRequests.status, "cancelled"),
      )),
  ]);
  const rows = [...orderRows, ...customerRows].filter((row) => ACTIVE_STATUSES.includes(row.status));
  const groups = new Map<string, string[]>();
  for (const row of rows) groups.set(productKey(row), [...(groups.get(productKey(row)) || []), row.status]);
  const counts = { pending: 0, ordered_company: 0, ordered_mglz: 0, unavailable: 0, stock_out: 0 };
  for (const statuses of groups.values()) counts[groupBucket(statuses) as keyof typeof counts] += 1;
  return { productGroupCount: groups.size, sourceRequestCount: rows.length, counts };
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function createFullBackup(user: { email: string; displayName: string; role: string }) {
  if (!env.DB || !env.BUCKET) throw new Error("Database Backup storage is unavailable");
  const schemaResult = await env.DB.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all<SchemaRow>();
  // D1 exposes Cloudflare-owned metadata tables (for example `_cf_KV`) in
  // sqlite_master, but Workers are not allowed to read their rows. A full
  // application backup must include every user table while excluding SQLite
  // and Cloudflare internal tables.
  const schema = (schemaResult.results || []).filter((row) =>
    row.name && !row.name.startsWith("sqlite_") && !row.name.startsWith("_cf_"),
  );
  const tables: Record<string, { rowCount: number; rows: Record<string, unknown>[] }> = {};
  let totalRows = 0;
  for (const table of schema) {
    const rows: Record<string, unknown>[] = [];
    let offset = 0;
    while (true) {
      const page = await env.DB.prepare(`SELECT * FROM ${quoteIdentifier(table.name)} LIMIT 1000 OFFSET ?`).bind(offset).all<Record<string, unknown>>();
      const pageRows = page.results || [];
      rows.push(...pageRows);
      offset += pageRows.length;
      if (pageRows.length < 1000) break;
    }
    tables[table.name] = { rowCount: rows.length, rows };
    totalRows += rows.length;
  }
  const exportedAt = new Date().toISOString();
  const backup = JSON.stringify({ format: "nawaratt-full-db-backup", formatVersion: 1, exportedAt, timezone: "Asia/Yangon", exportedBy: user, database: "Cloudflare D1 / SQLite", summary: { tableCount: schema.length, totalRows }, schema: schema.map((table) => ({ table: table.name, createSql: table.sql || "" })), tables });
  const stamp = exportedAt.replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
  const key = `system-backups/purchase-live-cutover/Nawaratt_Full_DB_Backup_${stamp}_UTC.json`;
  await env.BUCKET.put(key, backup, { httpMetadata: { contentType: "application/json; charset=utf-8" }, customMetadata: { reason: "Purchase Live Cutover", exportedBy: user.email } });
  const saved = await env.BUCKET.head(key);
  if (!saved) throw new Error("Database Backup verification failed");
  return { key, size: saved.size, exportedAt };
}

async function requireAdmin() {
  const user = await getAppUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "admin") return { error: Response.json({ error: "Admin သာ Live Cutover လုပ်နိုင်ပါသည်" }, { status: 403 }) };
  return { user };
}

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  try {
    const url = new URL(request.url);
    const downloadRunId = Number(url.searchParams.get("downloadRunId") || 0);
    if (downloadRunId) {
      const [run] = await getDb().select().from(purchaseCutoverRuns).where(eq(purchaseCutoverRuns.id, downloadRunId)).limit(1);
      if (!run || !env.BUCKET) return Response.json({ error: "Cutover Backup မတွေ့ပါ" }, { status: 404 });
      const object = await env.BUCKET.get(run.backupKey);
      if (!object) return Response.json({ error: "Cutover Backup File မတွေ့ပါ" }, { status: 404 });
      return new Response(object.body, { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="Nawaratt_Purchase_Cutover_Backup_${run.officialStartDate}.json"`, "cache-control": "private, no-store" } });
    }
    const period = await getPurchaseOperationalPeriod();
    const snapshot = period.officialStartDate >= TARGET_LIVE_DATE
      ? { productGroupCount: 0, sourceRequestCount: 0, counts: { pending: 0, ordered_company: 0, ordered_mglz: 0, unavailable: 0, stock_out: 0 } }
      : await cutoverSnapshot(period.officialStartDate, TARGET_LIVE_DATE);
    const [lastRun] = await getDb().select().from(purchaseCutoverRuns).orderBy(desc(purchaseCutoverRuns.id)).limit(1);
    return Response.json({ period, targetDate: TARGET_LIVE_DATE, snapshot, completed: period.officialStartDate >= TARGET_LIVE_DATE, lastRun: lastRun || null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Cutover Preview မရပါ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const user = access.user!;
  try {
    const payload = await request.json() as { confirmation?: string; targetDate?: string };
    const targetDate = payload.targetDate || "";
    const period = await getPurchaseOperationalPeriod();
    if (targetDate !== TARGET_LIVE_DATE) return Response.json({ error: "Live Start Date မမှန်ပါ" }, { status: 400 });
    if (period.officialStartDate >= targetDate) return Response.json({ error: "Purchase Live Cutover လုပ်ပြီးပါပြီ" }, { status: 409 });
    const snapshot = await cutoverSnapshot(period.officialStartDate, targetDate);
    const requiredConfirmation = `ARCHIVE ${snapshot.productGroupCount}`;
    if (payload.confirmation?.trim() !== requiredConfirmation) return Response.json({ error: `နောက်ဆုံး Count ပြောင်းထားပါသည်။ ${requiredConfirmation} ဟု ပြန်အတည်ပြုပါ`, snapshot }, { status: 409 });
    if (snapshot.productGroupCount !== 993) return Response.json({ error: `Safety Check မကိုက်ပါ — Expected 993, Current ${snapshot.productGroupCount}`, snapshot }, { status: 409 });
    const backup = await createFullBackup({ email: user.email, displayName: user.displayName, role: user.role });
    if (!env.DB) throw new Error("Database binding is unavailable");
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO purchase_operational_settings (id, trial_start_date, official_start_date, updated_by, updated_at) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET official_start_date=excluded.official_start_date, updated_by=excluded.updated_by, updated_at=excluded.updated_at`).bind(period.trialStartDate, targetDate, user.displayName, now),
      env.DB.prepare(`INSERT INTO purchase_cutover_runs (previous_start_date, official_start_date, product_group_count, source_request_count, status_counts, backup_key, backup_size, executed_by_email, executed_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(period.officialStartDate, targetDate, snapshot.productGroupCount, snapshot.sourceRequestCount, JSON.stringify(snapshot.counts), backup.key, backup.size, user.email, user.displayName, now),
      env.DB.prepare(`INSERT INTO audit_logs (action, entity_type, entity_id, summary, actor_email, actor_name, actor_role, created_at) VALUES ('purchase_official_live_cutover', 'system', ?, ?, ?, ?, ?, ?)`).bind(targetDate, `Purchase Trial Archive • ${snapshot.productGroupCount} Product Groups • ${snapshot.sourceRequestCount} Source Requests • Backup ${backup.key}`, user.email, user.displayName, user.role, now),
    ]);
    const [run] = await getDb().select().from(purchaseCutoverRuns).where(eq(purchaseCutoverRuns.officialStartDate, targetDate)).limit(1);
    return Response.json({ success: true, officialStartDate: targetDate, archived: snapshot, backup: { size: backup.size, exportedAt: backup.exportedAt }, runId: run?.id || 0, activeCount: 0 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Live Cutover မလုပ်နိုင်ပါ" }, { status: 500 });
  }
}
