import { asc, desc, eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { getDb } from "../db";
import { productIntelligence, productSyncRuns } from "../db/schema";
import { notifyDepartments } from "./department-notifications";

export const WEEKLY_PRODUCT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1Ft2uotkYX6FvGzai-jlyJlGGcRa_XntwotkAoPufeP0/edit";
export const WEEKLY_PRODUCT_SHEET_TAB = "Sheet1";

const MANAGED_TYPES = new Set(["low_sale", "overstock", "near_expired"]);

export type WeeklySheetRow = {
  rowNumber: number;
  entryDate: string;
  enteredBy: string;
  productName: string;
  expiryDate: string;
  insightType: "low_sale" | "overstock" | "near_expired" | "";
  originalType: string;
  knowledgeLocation: string;
  checkedTime: string;
  uniqueKey: string;
  error: string;
  duplicate: boolean;
};

export type WeeklySyncPreview = {
  sourceRows: number;
  validCount: number;
  uniqueCount: number;
  duplicateCount: number;
  skippedCount: number;
  lowSaleCount: number;
  overstockCount: number;
  nearExpiredCount: number;
  unclassifiedCount: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  rows: WeeklySheetRow[];
  detectedAt: string;
};

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function normalizedName(value: string) {
  return value.toLocaleLowerCase().replace(/[\s_\-\/().:*'’]+/g, "");
}

function normalizeLocation(value: string) {
  const original = clean(value, 120);
  const compact = original.replace(/\s+/g, "");
  if (["ဂိုထောင်", "ဂိုဒေါင်"].includes(compact)) return "ဂိုဒေါင်";
  if (compact === "အလယ်") return "အလယ်ထပ်";
  if (compact.startsWith("ဂိုထာင်/")) return compact.replace("ဂိုထာင်/", "ဂိုဒေါင်/");
  if (compact.startsWith("ဂိုထောင်/")) return compact.replace("ဂိုထောင်/", "ဂိုဒေါင်/");
  return original;
}

function normalizeType(value: string): WeeklySheetRow["insightType"] {
  const normalized = clean(value, 120).toLocaleLowerCase().replace(/[\s_-]+/g, "");
  if (["slow", "slowitem"].includes(normalized)) return "low_sale";
  if (["overstock", "overstocks", "over", "overstork", "overshocks"].includes(normalized)) return "overstock";
  if (["nearexpired", "neardate", "date", "dateနီး"].includes(normalized)) return "near_expired";
  return "";
}

function myanmarToday() {
  return new Date(Date.now() + 6.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeEntryDate(value: string) {
  const raw = clean(value, 40);
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,5})$/);
  if (!match) return { value: "", error: raw ? "Entry Date format မမှန်ပါ" : "Entry Date မရှိပါ" };
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  const currentYear = Number(myanmarToday().slice(0, 4));
  if (year < 2020 || year > currentYear) return { value: "", error: `Entry Year ${year} မမှန်ပါ` };
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return { value: "", error: "Entry Date မမှန်ပါ" };
  if (iso > myanmarToday()) return { value: "", error: "Entry Date သည် အနာဂတ်ရက်ဖြစ်နေပါသည်" };
  return { value: iso, error: "" };
}

function normalizeExpiry(value: string) {
  const raw = clean(value, 40);
  const match = raw.match(/^(\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!match) return raw;
  let year = Number(match[2]);
  if (year < 100) year += 2000;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return raw;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function exportUrl() {
  return "https://docs.google.com/spreadsheets/d/1Ft2uotkYX6FvGzai-jlyJlGGcRa_XntwotkAoPufeP0/export?format=xlsx";
}

async function readSheetRows() {
  const response = await fetch(exportUrl(), {
    redirect: "follow",
    headers: { accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*;q=0.1" },
  });
  if (!response.ok) throw new Error("Google Sheet ကို ဖတ်မရပါ။ Viewer Permission ကို စစ်ပါ");
  const source = await response.arrayBuffer();
  if (source.byteLength > 8 * 1024 * 1024) throw new Error("Google Sheet Data 8 MB အောက်သာ အသုံးပြုပါ");
  const workbook = XLSX.read(source, { type: "array" });
  const sheet = workbook.Sheets[WEEKLY_PRODUCT_SHEET_TAB];
  if (!sheet) throw new Error(`Google Sheet တွင် ${WEEKLY_PRODUCT_SHEET_TAB} Tab မတွေ့ပါ`);
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  return grid.slice(1).filter((row) => row.some((cell) => clean(cell)));
}

function itemFingerprint(item: { entryDate: string; enteredBy: string; checkedTime: string; productName: string }) {
  return `${item.entryDate}|${item.enteredBy}|${item.checkedTime}|${item.productName}`;
}

export async function previewWeeklyProductKnowledge(): Promise<WeeklySyncPreview> {
  const grid = await readSheetRows();
  const rows: WeeklySheetRow[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < grid.length; index += 1) {
    const source = grid[index] || [];
    const originalDate = clean(source[0], 40);
    const enteredBy = clean(source[1], 80);
    const productName = clean(source[2], 180);
    const expiryDate = normalizeExpiry(clean(source[3], 40));
    const originalType = clean(source[4], 120);
    const insightType = normalizeType(originalType);
    const knowledgeLocation = normalizeLocation(clean(source[5], 120));
    const checkedTime = clean(source[6], 80);
    const date = normalizeEntryDate(originalDate);
    const errors: string[] = [];
    if (!productName) errors.push("Product Name မရှိပါ");
    if (!originalType) errors.push("Type မရှိပါ");
    else if (!insightType) errors.push(`Type “${originalType}” ကို မသတ်မှတ်ရသေးပါ`);
    if (!knowledgeLocation) errors.push("Location မရှိပါ");
    if (date.error) errors.push(date.error);
    const uniqueKey = productName && insightType && knowledgeLocation
      ? `${normalizedName(productName)}|${insightType}|${expiryDate.toLocaleLowerCase()}|${knowledgeLocation.toLocaleLowerCase()}`
      : "";
    const duplicate = Boolean(uniqueKey && seen.has(uniqueKey) && errors.length === 0);
    if (uniqueKey && !errors.length) seen.add(uniqueKey);
    rows.push({
      rowNumber: index + 2,
      entryDate: date.value,
      enteredBy,
      productName,
      expiryDate,
      insightType,
      originalType,
      knowledgeLocation,
      checkedTime,
      uniqueKey,
      error: errors.join(" • "),
      duplicate,
    });
  }

  const valid = rows.filter((row) => !row.error);
  const unique = valid.filter((row) => !row.duplicate);
  const db = getDb();
  const [activeRun] = await db.select().from(productSyncRuns).where(eq(productSyncRuns.isActive, true)).orderBy(desc(productSyncRuns.createdAt), desc(productSyncRuns.id)).limit(1);
  const currentItems = activeRun
    ? await db.select().from(productIntelligence).where(eq(productIntelligence.syncRunId, activeRun.id)).orderBy(asc(productIntelligence.id))
    : [];
  const currentByKey = new Map(currentItems.filter((item) => MANAGED_TYPES.has(item.insightType) && item.uniqueKey).map((item) => [item.uniqueKey, item]));
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  for (const row of unique) {
    const current = currentByKey.get(row.uniqueKey);
    if (!current) newCount += 1;
    else if (itemFingerprint(current) === itemFingerprint(row)) unchangedCount += 1;
    else updatedCount += 1;
  }
  return {
    sourceRows: rows.length,
    validCount: valid.length,
    uniqueCount: unique.length,
    duplicateCount: valid.length - unique.length,
    skippedCount: rows.filter((row) => row.error).length,
    lowSaleCount: unique.filter((row) => row.insightType === "low_sale").length,
    overstockCount: unique.filter((row) => row.insightType === "overstock").length,
    nearExpiredCount: unique.filter((row) => row.insightType === "near_expired").length,
    unclassifiedCount: rows.filter((row) => row.originalType && !row.insightType).length,
    newCount,
    updatedCount,
    unchangedCount,
    rows,
    detectedAt: new Date().toISOString(),
  };
}

export async function commitWeeklyProductKnowledge(triggeredBy: string, runType: "weekly_sheet" | "manual_sheet") {
  const startedAt = Date.now();
  const preview = await previewWeeklyProductKnowledge();
  const errors = preview.rows.filter((row) => row.error);
  const uniqueRows = preview.rows.filter((row) => !row.error && !row.duplicate);
  if (!uniqueRows.length) throw new Error("Sync လုပ်နိုင်သော Valid Product မရှိပါ");
  const db = getDb();
  const [activeRun] = await db.select().from(productSyncRuns).where(eq(productSyncRuns.isActive, true)).orderBy(desc(productSyncRuns.createdAt), desc(productSyncRuns.id)).limit(1);
  const currentItems = activeRun
    ? await db.select().from(productIntelligence).where(eq(productIntelligence.syncRunId, activeRun.id)).orderBy(asc(productIntelligence.id))
    : [];
  const retained = currentItems.filter((item) => !MANAGED_TYPES.has(item.insightType));
  const [run] = await db.insert(productSyncRuns).values({
    syncDate: myanmarToday(),
    slowItemsTab: WEEKLY_PRODUCT_SHEET_TAB,
    sourceSummary: JSON.stringify({ sheet: WEEKLY_PRODUCT_SHEET_TAB, source: WEEKLY_PRODUCT_SHEET_URL }),
    status: "syncing",
    triggeredBy,
    runType,
    sourceUrl: WEEKLY_PRODUCT_SHEET_URL,
    sourceRows: preview.sourceRows,
    validCount: preview.validCount,
    uniqueCount: preview.uniqueCount,
    duplicateCount: preview.duplicateCount,
    skippedCount: preview.skippedCount,
    lowSaleCount: preview.lowSaleCount,
    overstockCount: preview.overstockCount,
    nearExpiredCount: preview.nearExpiredCount,
    unclassifiedCount: preview.unclassifiedCount,
    newCount: preview.newCount,
    updatedCount: preview.updatedCount,
    unchangedCount: preview.unchangedCount,
    errorSummary: JSON.stringify(errors),
    isActive: false,
  }).returning();
  try {
    const retainedValues = retained.map((item) => ({
      syncRunId: run.id, insightType: item.insightType, productCode: item.productCode, productName: item.productName,
      metricLabel: item.metricLabel, metricValue: item.metricValue, details: item.details, sourceName: item.sourceName,
      priority: item.priority, rank: item.rank, uniqueKey: item.uniqueKey, sourceRowNumber: item.sourceRowNumber,
      entryDate: item.entryDate, enteredBy: item.enteredBy, expiryDate: item.expiryDate,
      knowledgeLocation: item.knowledgeLocation, checkedTime: item.checkedTime,
    }));
    const weeklyValues = uniqueRows.map((row, index) => ({
      syncRunId: run.id,
      insightType: row.insightType,
      productCode: "",
      productName: row.productName,
      metricLabel: "Knowledge Location",
      metricValue: row.knowledgeLocation,
      details: [row.expiryDate ? `Expiry ${row.expiryDate}` : "", row.enteredBy ? `Entered by ${row.enteredBy}` : "", row.checkedTime ? `Checked ${row.checkedTime}` : ""].filter(Boolean).join(" • "),
      sourceName: `Products Knowledge • ${WEEKLY_PRODUCT_SHEET_TAB}`,
      priority: row.insightType === "near_expired" ? "urgent" : row.insightType === "overstock" ? "attention" : "normal",
      rank: index + 1,
      uniqueKey: row.uniqueKey,
      sourceRowNumber: row.rowNumber,
      entryDate: row.entryDate,
      enteredBy: row.enteredBy,
      expiryDate: row.expiryDate,
      knowledgeLocation: row.knowledgeLocation,
      checkedTime: row.checkedTime,
    }));
    const combined = [...retainedValues, ...weeklyValues];
    for (let index = 0; index < combined.length; index += 8) {
      await db.insert(productIntelligence).values(combined.slice(index, index + 8));
    }
    const saved = await db.select({ id: productIntelligence.id }).from(productIntelligence).where(eq(productIntelligence.syncRunId, run.id));
    if (saved.length !== combined.length) throw new Error(`Saved ${saved.length}/${combined.length} records`);
    if (activeRun) await db.update(productSyncRuns).set({ isActive: false }).where(eq(productSyncRuns.id, activeRun.id));
    const status = errors.length ? "completed_with_warnings" : "completed";
    const completedAt = new Date().toISOString();
    await db.update(productSyncRuns).set({
      itemCount: combined.length,
      status,
      isActive: true,
      durationMs: Date.now() - startedAt,
      completedAt,
    }).where(eq(productSyncRuns.id, run.id));
    await notifyDepartments({
      roles: ["admin"],
      title: errors.length ? "Product Knowledge Sync completed with warnings" : "Product Knowledge Weekly Sync Completed",
      message: errors.length ? `${weeklyValues.length} Products synced • ${errors.length} skipped records ကို စစ်ဆေးပါ` : `${weeklyValues.length} Products အောင်မြင်စွာ Sync လုပ်ပြီးပါပြီ`,
      targetTab: "dashboard",
      sourceId: run.id,
      actor: triggeredBy,
    });
    return { ...preview, runId: run.id, itemCount: combined.length, managedItemCount: weeklyValues.length, retainedItemCount: retainedValues.length, status, completedAt, durationMs: Date.now() - startedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await db.update(productSyncRuns).set({
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorSummary: JSON.stringify([...errors, { error: message }]),
      completedAt: new Date().toISOString(),
    }).where(eq(productSyncRuns.id, run.id));
    await notifyDepartments({
      roles: ["admin"],
      title: "Product Knowledge Weekly Sync Failed",
      message: "Previous successful data is still active.",
      targetTab: "dashboard",
      sourceId: run.id,
      actor: triggeredBy,
    });
    throw error;
  }
}

export function safeJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
