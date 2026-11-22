import { asc, desc, eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { getDb } from "../../../../db";
import { productIntelligence, productMaster, productSyncRuns } from "../../../../db/schema";
import { getAppUser } from "../../../../lib/app-user";
import { recordAuditLog } from "../../../../lib/audit-log";
import { processPurchaseArrivalImport } from "../../../../lib/purchase-arrival-reconciliation";

type FileType = "inventory" | "purchase";
type ImportItem = {
  rowNumber: number; sheetName: string; insightType: string; productCode: string; productName: string;
  metricLabel: string; metricValue: string; details: string; sourceName: string; priority: string;
  uniqueKey: string; entryDate: string; enteredBy: string; expiryDate: string; knowledgeLocation: string;
  checkedTime: string; inventoryMatch: "code" | "name" | "unmatched"; action: "add" | "update" | "unchanged";
  error: string; duplicate: boolean; arrivalQuantity?: number; supplierName?: string;
};

const SYSTEM_TYPES = new Set(["top_sale", "stock_out"]);
const INVENTORY_TYPES = new Set(["low_sale", "overstock", "near_expired"]);
const PURCHASE_TYPES = new Set(["incoming", "supplier", "price_change"]);

function clean(value: unknown, max = 500) { return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max); }
function compact(value: unknown) { return clean(value, 240).toLocaleLowerCase().replace(/[\s_\-\/().:*'’]+/g, ""); }
function supplierFromGroupRow(row: unknown[]) {
  for (let index = 0; index < row.length; index += 1) {
    const cell = clean(row[index], 240);
    if (!cell) continue;
    const inline = cell.match(/^supplier(?:\s*name)?\s*[:：–—\-]\s*(.+)$/i);
    if (inline?.[1]) return clean(inline[1], 160);
    if (/^supplier(?:\s*name)?$/i.test(cell)) {
      const adjacent = row.slice(index + 1).find((value) => clean(value));
      if (adjacent) return clean(adjacent, 160);
    }
  }
  return "";
}
function numberValue(value: unknown) {
  const result = Number(clean(value, 80).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(result) ? Math.max(0, result) : 0;
}
function productKey(code: string, name: string) { return code ? `code:${compact(code)}` : `name:${compact(name)}`; }
function yangonDate() { return new Date(Date.now() + 6.5 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function normalizeType(value: unknown) {
  const type = compact(value);
  if (["lowsale", "slow", "slowitem", "lowstock"].includes(type)) return "low_sale";
  if (["overstock", "overstocks", "over", "overstork"].includes(type)) return "overstock";
  if (["nearexpired", "nearexpiry", "neardate", "date", "expired", "dateနီး", "dateကုန်"].includes(type)) return "near_expired";
  return "";
}
function dateValue(value: unknown) {
  if (typeof value === "number" && value > 1) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const raw = clean(value, 50);
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (local) {
    const year = Number(local[3]) < 100 ? Number(local[3]) + 2000 : Number(local[3]);
    return `${year}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  }
  const monthYear = raw.match(/^(\d{1,2})[./-](\d{2}|\d{4})$/);
  if (monthYear) {
    const year = Number(monthYear[2]) < 100 ? Number(monthYear[2]) + 2000 : Number(monthYear[2]);
    return `${year}-${monthYear[1].padStart(2, "0")}`;
  }
  return raw;
}

const ALIASES = {
  code: ["productcode", "code", "itemcode", "sku", "no"],
  name: ["productname", "product", "description", "itemname", "ကုန်ပစ္စည်းအမည်", "ဆေးအမည်"],
  enteredBy: ["enteredby", "staffcode", "staff", "name"],
  type: ["type", "category", "reporttype", "status", "အမျိုးအစား"],
  supplier: ["supplier", "suppliername", "vendor", "company", "suppliers"],
  price: ["purchaseprice", "purprice", "unitprice", "buyprice", "cost", "price", "lastpurchaseprice"],
  quantity: ["quantity", "qty", "purchasedqty", "incomingqty", "stockin"],
  date: ["purchasedate", "entrydate", "date", "invoicedate", "receiveddate"],
  expiry: ["expirydate", "expiry", "exp", "expiredate"],
  location: ["location", "knowledgelocation", "place"],
  metric: ["metric", "reason", "remark", "note", "details"],
  time: ["time", "checkedtime", "checktime"],
};

function findHeader(grid: unknown[][], fileType: FileType) {
  for (let rowIndex = 0; rowIndex < Math.min(25, grid.length); rowIndex += 1) {
    const row = grid[rowIndex].map(compact);
    const find = (names: string[]) => row.findIndex((cell) => names.includes(cell));
    const columns = Object.fromEntries(Object.entries(ALIASES).map(([name, aliases]) => [name, find(aliases)])) as Record<keyof typeof ALIASES, number>;
    if (columns.name >= 0 || (columns.code >= 0 && (fileType === "purchase" ? columns.price >= 0 || columns.quantity >= 0 : columns.type >= 0))) return { rowIndex, columns };
  }
  return null;
}

function inventoryKey(item: Pick<ImportItem, "insightType" | "productCode" | "productName" | "expiryDate" | "knowledgeLocation">) {
  return `${item.insightType}|${productKey(item.productCode, item.productName)}|${compact(item.expiryDate)}|${compact(item.knowledgeLocation)}`;
}
function existingKey(item: typeof productIntelligence.$inferSelect) {
  if (INVENTORY_TYPES.has(item.insightType)) return inventoryKey(item);
  return item.uniqueKey || `${item.insightType}|${productKey(item.productCode, item.productName)}|${compact(item.entryDate)}|${compact(item.metricValue)}`;
}
function fingerprint(item: Pick<ImportItem, "metricLabel" | "metricValue" | "details" | "expiryDate" | "knowledgeLocation">) {
  return [item.metricLabel, item.metricValue, item.details, item.expiryDate, item.knowledgeLocation].map(compact).join("|");
}

async function parseWorkbook(source: ArrayBuffer, fileType: FileType, fileName: string, enteredBy: string) {
  const workbook = XLSX.read(source, { type: "array", cellDates: false });
  const db = getDb();
  const [masters, activeRuns] = await Promise.all([
    db.select().from(productMaster).orderBy(asc(productMaster.productName)),
    db.select().from(productSyncRuns).where(eq(productSyncRuns.isActive, true)).orderBy(desc(productSyncRuns.createdAt), desc(productSyncRuns.id)).limit(1),
  ]);
  const activeRun = activeRuns[0];
  const current = activeRun ? await db.select().from(productIntelligence).where(eq(productIntelligence.syncRunId, activeRun.id)).orderBy(asc(productIntelligence.id)) : [];
  const byCode = new Map(masters.filter((item) => item.productCode).map((item) => [compact(item.productCode), item]));
  const nameGroups = new Map<string, typeof masters>();
  for (const item of masters) nameGroups.set(compact(item.productName), [...(nameGroups.get(compact(item.productName)) || []), item]);
  const currentByKey = new Map(current.filter((item) => !SYSTEM_TYPES.has(item.insightType)).map((item) => [existingKey(item), item]));
  const latestPrice = new Map<string, { price: number; date: string }>();
  for (const item of current.filter((entry) => entry.insightType === "incoming")) {
    const price = numberValue(item.metricValue);
    const key = productKey(item.productCode, item.productName);
    if (price > 0 && (!latestPrice.has(key) || (item.entryDate || item.createdAt) >= latestPrice.get(key)!.date)) latestPrice.set(key, { price, date: item.entryDate || item.createdAt });
  }
  const rows: ImportItem[] = [];
  const seen = new Set<string>();
  const suppliers = new Set<string>();
  let sourceRows = 0;
  let inventoryColumns: Record<keyof typeof ALIASES, number> | null = null;
  const add = (item: Omit<ImportItem, "action" | "duplicate">) => {
    const duplicate = seen.has(item.uniqueKey);
    seen.add(item.uniqueKey);
    const previous = currentByKey.get(item.uniqueKey);
    const action = !previous ? "add" : fingerprint(item) === fingerprint(previous) ? "unchanged" : "update";
    rows.push({ ...item, duplicate, action });
  };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
    const detectedHeader = findHeader(grid, fileType);
    if (fileType === "inventory" && detectedHeader) {
      inventoryColumns = { ...detectedHeader.columns, date: detectedHeader.columns.date >= 0 ? detectedHeader.columns.date : 0 };
    }
    const header = detectedHeader || (fileType === "inventory" && inventoryColumns ? { rowIndex: -1, columns: inventoryColumns } : null);
    if (!header) continue;
    const c = header.columns;
    let reportDate = "";
    for (const row of grid.slice(0, header.rowIndex)) {
      const fromIndex = row.findIndex((cell) => compact(cell) === "from");
      if (fromIndex >= 0) {
        reportDate = dateValue(row.slice(fromIndex + 1).find((cell) => clean(cell)) || "");
        if (reportDate) break;
      }
    }
    let carriedSupplier = fileType === "purchase" && !["sheet1", "purchase", "purchaserecord", "incoming"].includes(compact(sheetName)) ? clean(sheetName, 160) : "";
    for (let index = header.rowIndex + 1; index < grid.length; index += 1) {
      const row = grid[index] || [];
      if (!row.some((cell) => clean(cell))) continue;
      const firstCell = clean(row[0], 240);
      const supplierGroup = fileType === "purchase" ? supplierFromGroupRow(row) : "";
      if (supplierGroup) { carriedSupplier = supplierGroup; suppliers.add(compact(supplierGroup)); continue; }
      const firstCompact = compact(firstCell);
      if (firstCompact.startsWith("township") || firstCompact.startsWith("currency") || firstCompact.endsWith("total") || ["itemdiscount", "voudiscount", "netamount"].includes(firstCompact)) continue;
      sourceRows += 1;
      const originalCode = c.code >= 0 ? clean(row[c.code], 80) : "";
      const originalName = c.name >= 0 ? clean(row[c.name], 180) : "";
      if (c.supplier >= 0 && clean(row[c.supplier])) {
        carriedSupplier = clean(row[c.supplier], 160);
        suppliers.add(compact(carriedSupplier));
      }
      if (!originalName && !originalCode) continue;
      const matchedByCode = originalCode ? byCode.get(compact(originalCode)) : undefined;
      const matchedByName = !matchedByCode && originalName ? nameGroups.get(compact(originalName)) : undefined;
      const matched = matchedByCode || (matchedByName?.length === 1 ? matchedByName[0] : undefined);
      const productCode = matched?.productCode || originalCode;
      const productName = matched?.productName || originalName;
      const inventoryMatch: ImportItem["inventoryMatch"] = matchedByCode ? "code" : matched ? "name" : "unmatched";
      const entryDate = dateValue(c.date >= 0 ? row[c.date] : "") || reportDate || yangonDate();
      const expiryDate = dateValue(c.expiry >= 0 ? row[c.expiry] : "");
      const location = c.location >= 0 ? clean(row[c.location], 120) : "";
      const note = c.metric >= 0 ? clean(row[c.metric], 500) : "";
      const baseError = !productName ? "Product Name မရှိပါ" : "";
      const matchNote = inventoryMatch === "unmatched" ? "Inventory Match မတွေ့ — original name ဖြင့်သိမ်းမည်" : `Inventory matched by ${inventoryMatch}`;
      if (fileType === "inventory") {
        const rowEnteredBy = c.enteredBy >= 0 ? clean(row[c.enteredBy], 100) : enteredBy;
        const rowCheckedTime = c.time >= 0 ? clean(row[c.time], 100) : "Manual Excel Upload";
        const insightType = normalizeType(c.type >= 0 ? row[c.type] : sheetName);
        const error = baseError || (!insightType ? "Type ကို Low Sale / Over Stock / Near Expired အဖြစ် သတ်မှတ်ပါ" : "");
        const draft = { insightType, productCode, productName, expiryDate, knowledgeLocation: location };
        add({ rowNumber: index + 1, sheetName, ...draft, metricLabel: note ? "Report Note" : "Excel Report", metricValue: note || location || "Listed", details: [note, expiryDate ? `Expiry ${expiryDate}` : "", location ? `Location ${location}` : "", rowEnteredBy ? `Entered by ${rowEnteredBy}` : "", rowCheckedTime ? `Checked ${rowCheckedTime}` : "", matchNote].filter(Boolean).join(" • "), sourceName: `Excel • ${fileName}`, priority: insightType === "near_expired" ? "urgent" : insightType === "overstock" ? "attention" : "normal", uniqueKey: insightType ? inventoryKey(draft) : `invalid|${sheetName}|${index}`, entryDate, enteredBy: rowEnteredBy, checkedTime: rowCheckedTime, inventoryMatch, error });
        continue;
      }

      const supplier = carriedSupplier;
      const price = numberValue(c.price >= 0 ? row[c.price] : "");
      const quantity = numberValue(c.quantity >= 0 ? row[c.quantity] : "");
      const error = baseError || (!supplier ? "Supplier မရှိပါ" : "") || (!price && !quantity ? "Purchase Price သို့မဟုတ် Quantity မရှိပါ" : "");
      const pKey = productKey(productCode, productName);
      const common = { rowNumber: index + 1, sheetName, productCode, productName, sourceName: `Purchase Excel • ${fileName}`, priority: "normal", entryDate, enteredBy, expiryDate, knowledgeLocation: location, checkedTime: "Manual Excel Upload", inventoryMatch, error };
      add({ ...common, insightType: "incoming", metricLabel: "Purchase Price", metricValue: price ? `${price.toLocaleString()} MMK` : `${quantity.toLocaleString()} Qty`, details: [`Supplier ${supplier}`, quantity ? `Incoming Qty ${quantity.toLocaleString()}` : "", price ? `Purchase Price ${price.toLocaleString()} MMK` : "", `Latest Purchase ${entryDate}`, expiryDate ? `Expiry ${expiryDate}` : "", matchNote].filter(Boolean).join(" • "), uniqueKey: `incoming|${pKey}|${compact(supplier)}`, arrivalQuantity: quantity, supplierName: supplier });
      add({ ...common, insightType: "supplier", metricLabel: "Supplier", metricValue: supplier, details: [price ? `Latest Purchase Price ${price.toLocaleString()} MMK` : "", quantity ? `Incoming Qty ${quantity.toLocaleString()}` : "", `Purchase Date ${entryDate}`, matchNote].filter(Boolean).join(" • "), uniqueKey: `supplier|${pKey}|${compact(supplier)}` });
      const previous = latestPrice.get(pKey);
      if (price > 0 && previous?.price && previous.price !== price) {
        const difference = price - previous.price;
        const percentage = previous.price ? (difference / previous.price) * 100 : 0;
        add({ ...common, insightType: "price_change", metricLabel: difference > 0 ? "Price Increased" : "Price Decreased", metricValue: `${previous.price.toLocaleString()} → ${price.toLocaleString()} MMK`, details: `Supplier ${supplier} • Change ${difference > 0 ? "+" : ""}${difference.toLocaleString()} MMK (${percentage > 0 ? "+" : ""}${percentage.toFixed(1)}%) • Purchase Date ${entryDate}`, priority: difference > 0 ? "attention" : "normal", uniqueKey: `price_change|${pKey}|${entryDate}|${compact(supplier)}` });
      }
      if (price > 0) latestPrice.set(pKey, { price, date: entryDate });
    }
  }
  if (!rows.length) throw new Error(fileType === "inventory" ? "Low Sale / Over Stock / Near Expired Columns မတွေ့ပါ" : "Purchase Product / Supplier / Price Columns မတွေ့ပါ");
  const valid = rows.filter((item) => !item.error && !item.duplicate);
  const typeCounts = Object.fromEntries([...PURCHASE_TYPES, ...INVENTORY_TYPES].map((type) => [type, valid.filter((item) => item.insightType === type).length]));
  return {
    fileType, fileName, sourceRows, rows,
    supplierGroupCount: suppliers.size, typeCounts,
    validCount: valid.length, errorCount: rows.filter((item) => item.error).length, duplicateCount: rows.filter((item) => item.duplicate).length,
    addCount: valid.filter((item) => item.action === "add").length, updateCount: valid.filter((item) => item.action === "update").length,
    unchangedCount: valid.filter((item) => item.action === "unchanged").length, unmatchedCount: valid.filter((item) => item.inventoryMatch === "unmatched").length,
    current, activeRun,
  };
}

function template(fileType: FileType) {
  const workbook = XLSX.utils.book_new();
  if (fileType === "inventory") {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Product Code", "Product Name", "Type", "Expiry Date", "Location", "Date", "Note"],
      ["P-001", "Example Product", "Low Sale", "2027-06-30", "Warehouse A", yangonDate(), "Manual report"],
    ]);
    sheet["!cols"] = [{ wch: 16 }, { wch: 32 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "Low-Over-Near");
  } else {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Supplier", "Product Code", "Product Name", "Quantity", "Purchase Price", "Purchase Date", "Expiry Date", "Location"],
      ["Example Supplier", "P-001", "Example Product", 10, 12500, yangonDate(), "2027-06-30", "Warehouse A"],
      ["", "P-002", "Second Product", 5, 9200, yangonDate(), "", "Warehouse A"],
    ]);
    sheet["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 32 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "Purchase Record");
  }
  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Response(output, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="Nawaratt_${fileType === "inventory" ? "Low_Over_Near" : "Purchase_Record"}_Template.xlsx"`, "cache-control": "private, no-store" } });
}

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin Only" }, { status: 403 });
  return template(new URL(request.url).searchParams.get("fileType") === "purchase" ? "purchase" : "inventory");
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ Report Excel ထည့်နိုင်ပါသည်" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const fileType: FileType = clean(form.get("fileType"), 20) === "purchase" ? "purchase" : "inventory";
    const mode = clean(form.get("mode"), 20) || "preview";
    if (!(file instanceof File)) return Response.json({ error: "Excel File ရွေးပါ" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return Response.json({ error: "Excel File 10 MB အောက်သာ တင်ပါ" }, { status: 400 });
    const preview = await parseWorkbook(await file.arrayBuffer(), fileType, clean(file.name, 180), user.displayName);
    const responsePreview = {
      ...preview,
      current: undefined,
      activeRun: undefined,
      rows: preview.rows.slice(0, 150),
      previewRowCount: Math.min(preview.rows.length, 150),
      hiddenRowCount: Math.max(0, preview.rows.length - 150),
    };
    if (mode !== "commit") return Response.json(responsePreview);
    const valid = preview.rows.filter((item) => !item.error && !item.duplicate);
    if (!valid.length) return Response.json({ error: "သိမ်းနိုင်သော Valid Records မရှိပါ", ...responsePreview }, { status: 400 });
    const db = getDb();
    const startedAt = Date.now();
    const managedTypes = fileType === "inventory" ? INVENTORY_TYPES : PURCHASE_TYPES;
    const retained = preview.current.filter((item) => !SYSTEM_TYPES.has(item.insightType));
    const merged = new Map(retained.map((item) => [existingKey(item), item]));
    for (const item of valid) merged.set(item.uniqueKey, { ...item, id: 0, syncRunId: 0, rank: 0, sourceRowNumber: item.rowNumber, createdAt: new Date().toISOString() });
    const combined = [...merged.values()].filter((item) => !SYSTEM_TYPES.has(item.insightType));
    combined.sort((left, right) => left.insightType.localeCompare(right.insightType) || left.productName.localeCompare(right.productName));
    const [run] = await db.insert(productSyncRuns).values({
      syncDate: yangonDate(), sourceSummary: JSON.stringify({ type: fileType, fileName: file.name, source: "Manual Excel Upload" }),
      status: "syncing", triggeredBy: `${user.displayName} • Excel Upload`, runType: fileType === "inventory" ? "excel_inventory" : "excel_purchase",
      sourceRows: preview.sourceRows, validCount: preview.validCount, uniqueCount: valid.length, duplicateCount: preview.duplicateCount,
      skippedCount: preview.errorCount, lowSaleCount: combined.filter((item) => item.insightType === "low_sale").length,
      overstockCount: combined.filter((item) => item.insightType === "overstock").length, nearExpiredCount: combined.filter((item) => item.insightType === "near_expired").length,
      newCount: preview.addCount, updatedCount: preview.updateCount, unchangedCount: preview.unchangedCount,
      errorSummary: JSON.stringify(preview.rows.filter((item) => item.error)), isActive: false,
    }).returning();
    const values = combined.map((item, index) => ({
      syncRunId: run.id, insightType: item.insightType, productCode: item.productCode, productName: item.productName,
      metricLabel: item.metricLabel, metricValue: item.metricValue, details: item.details, sourceName: item.sourceName,
      priority: item.priority, rank: index + 1, uniqueKey: item.uniqueKey, sourceRowNumber: item.sourceRowNumber || 0,
      entryDate: item.entryDate, enteredBy: item.enteredBy, expiryDate: item.expiryDate, knowledgeLocation: item.knowledgeLocation,
      checkedTime: item.checkedTime,
    }));
    try {
      // Cloudflare D1 allows at most 100 bound parameters in one statement. Each insight uses
      // 17, so five rows (85 parameters) is safe. Execute groups through D1 batch to avoid
      // hundreds of sequential network round trips for large Product Knowledge workbooks.
      const statements = [];
      for (let index = 0; index < values.length; index += 5) statements.push(db.insert(productIntelligence).values(values.slice(index, index + 5)));
      for (let index = 0; index < statements.length; index += 40) await db.batch(statements.slice(index, index + 40) as [typeof statements[number], ...typeof statements[number][]]);
      if (preview.activeRun) await db.update(productSyncRuns).set({ isActive: false }).where(eq(productSyncRuns.id, preview.activeRun.id));
      const status = preview.errorCount ? "completed_with_warnings" : "completed";
      const completedAt = new Date().toISOString();
      await db.update(productSyncRuns).set({ status, itemCount: values.length, isActive: true, completedAt, durationMs: Date.now() - startedAt }).where(eq(productSyncRuns.id, run.id));
      let arrivalSummary: Awaited<ReturnType<typeof processPurchaseArrivalImport>> | null = null;
      if (fileType === "purchase") {
        try {
          arrivalSummary = await processPurchaseArrivalImport({
            runId: run.id,
            completedAt,
            actor: user.displayName,
            incoming: valid.filter((item) => item.insightType === "incoming" && item.action !== "unchanged" && (item.arrivalQuantity || 0) > 0).map((item) => ({
              action: item.action as "add" | "update",
              uniqueKey: item.uniqueKey,
              productCode: item.productCode,
              productName: item.productName,
              quantity: item.arrivalQuantity || 0,
              supplierName: item.supplierName || "",
              purchaseDate: item.entryDate,
            })),
          });
          await recordAuditLog(user, {
            action: "purchase_arrivals_allocated",
            entityType: "product_sync_run",
            entityId: run.id,
            summary: `Import Run ${run.id} • ${arrivalSummary.incomingEvents} New/Updated Incoming • Superseded ${arrivalSummary.supersededAllocationCount} prior allocations • Matched code ${arrivalSummary.matchedMethodCounts.code}, alias ${arrivalSummary.matchedMethodCounts.alias}, name ${arrivalSummary.matchedMethodCounts.name} • Qty ${arrivalSummary.allocatedQuantity} allocated • Status full ${arrivalSummary.fullCount}, partial ${arrivalSummary.partialCount}, review ${arrivalSummary.reviewCount} • Unmatched ${arrivalSummary.unmatchedCount}`,
          });
        } catch (arrivalError) {
          const arrivalMessage = arrivalError instanceof Error ? arrivalError.message : "Arrival allocation failed";
          await db.update(productSyncRuns).set({
            status: "completed_with_warnings",
            errorSummary: JSON.stringify([...preview.rows.filter((item) => item.error), { error: `Arrival allocation: ${arrivalMessage.slice(0, 600)}` }]),
          }).where(eq(productSyncRuns.id, run.id));
          await recordAuditLog(user, { action: "purchase_arrivals_allocation_failed", entityType: "product_sync_run", entityId: run.id, summary: `Import Run ${run.id} • ${arrivalMessage.slice(0, 500)}` });
        }
      }
      const finalStatus = fileType === "purchase" && !arrivalSummary ? "completed_with_warnings" : status;
      await recordAuditLog(user, { action: "product_intelligence_excel_imported", entityType: "product_intelligence", entityId: run.id, summary: `${fileType} Excel • ${valid.length} records • New ${preview.addCount} • Updated ${preview.updateCount}` });
      return Response.json({ ...responsePreview, importedCount: valid.length, runId: run.id, status: finalStatus, completedAt, managedTypes: [...managedTypes], arrivalSummary });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database import failed";
      await db.update(productSyncRuns).set({
        status: "failed", isActive: false, completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt,
        errorSummary: JSON.stringify([{ error: message.slice(0, 1000) }]),
      }).where(eq(productSyncRuns.id, run.id));
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report Excel Import မအောင်မြင်ပါ";
    return Response.json({ error: message.startsWith("Failed query:") ? "Database batch limit ကြောင့် Import မအောင်မြင်ပါ။ Previous successful data is still active." : message }, { status: 400 });
  }
}
