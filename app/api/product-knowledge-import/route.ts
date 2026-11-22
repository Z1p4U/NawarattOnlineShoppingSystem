import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { getDb } from "../../../db";
import { productKnowledge } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";
import { recordAuditLog } from "../../../lib/audit-log";

type ImportRow = {
  rowNumber: number;
  productName: string;
  genericName: string;
  category: string;
  keyBenefits: string;
  talkingPoints: string;
  usageNote: string;
  caution: string;
  tags: string;
  active: boolean;
  action: "add" | "update";
  existingId: number;
  error: string;
};

const TEMPLATE_HEADERS = [
  "Product Name *",
  "Generic Name",
  "Category",
  "Key Benefits *",
  "Customer Talking Points",
  "Usage Note",
  "Caution",
  "Tags",
  "Active",
];

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function key(value: unknown) {
  return clean(value, 240).toLocaleLowerCase().replace(/[\s_\-\/().:*]+/g, "");
}

function productKey(productName: string, genericName: string) {
  return `${key(productName)}|||${key(genericName)}`;
}

function activeValue(value: unknown) {
  const normalized = key(value);
  if (["no", "n", "false", "0", "inactive", "ပိတ်"].includes(normalized)) return false;
  return true;
}

function findHeaderRow(grid: unknown[][]) {
  const aliases = {
    productName: ["productname", "product", "ကုန်ပစ္စည်းအမည်", "ဆေးအမည်"],
    genericName: ["genericname", "generic", "genericအမည်"],
    category: ["category", "အမျိုးအစား"],
    keyBenefits: ["keybenefits", "benefits", "benefit", "အကျိုးကျေးဇူး", "အဓိကအကျိုးကျေးဇူး"],
    talkingPoints: ["customertalkingpoints", "talkingpoints", "customerpoints", "customerပြောရန်အချက်များ"],
    usageNote: ["usagenote", "usageproductnote", "productnote", "note", "အသုံးပြုပုံ"],
    caution: ["caution", "warning", "သတိပြုရန်"],
    tags: ["tags", "tag", "keywords"],
    active: ["active", "status", "အသုံးပြုမည်"],
  };
  for (let rowIndex = 0; rowIndex < Math.min(20, grid.length); rowIndex += 1) {
    const headers = grid[rowIndex].map(key);
    const find = (values: string[]) => headers.findIndex((header) => values.includes(header));
    const columns = {
      productName: find(aliases.productName),
      genericName: find(aliases.genericName),
      category: find(aliases.category),
      keyBenefits: find(aliases.keyBenefits),
      talkingPoints: find(aliases.talkingPoints),
      usageNote: find(aliases.usageNote),
      caution: find(aliases.caution),
      tags: find(aliases.tags),
      active: find(aliases.active),
    };
    if (columns.productName >= 0 && columns.keyBenefits >= 0) return { rowIndex, columns };
  }
  return null;
}

async function parseWorkbook(source: ArrayBuffer, sourceLabel: string, options: { allSheets?: boolean; allowCategoryLists?: boolean } = {}) {
  const workbook = XLSX.read(source, { type: "array" });
  const existing = await getDb().select().from(productKnowledge);
  const existingByKey = new Map(existing.map((item) => [productKey(item.productName, item.genericName), item]));
  const existingByName = new Map(existing.map((item) => [key(item.productName), item]));
  const seen = new Set<string>();
  const rows: ImportRow[] = [];
  const value = (source: unknown[], column: number, max: number) => column >= 0 ? clean(source[column], max) : "";
  const sheetNames = options.allSheets ? workbook.SheetNames : workbook.SheetNames.slice(0, 1);
  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
    const header = findHeaderRow(grid);
    if (!header && !options.allowCategoryLists) {
      throw new Error("Product Name နှင့် Key Benefits Columns မတွေ့ပါ။ Template ကို Download လုပ်ပြီး ဖြည့်ပါ");
    }
    const firstRow = header ? header.rowIndex + 1 : 0;
    for (let index = firstRow; index < grid.length; index += 1) {
      const source = grid[index] || [];
      if (!source.some((item) => clean(item))) continue;
      const simpleList = !header;
      const listedName = simpleList ? value(source, 0, 180) : "";
      const listedCurrent = simpleList ? existingByName.get(key(listedName)) : undefined;
      const productName = simpleList ? listedName : value(source, header.columns.productName, 180);
      const genericName = simpleList ? listedCurrent?.genericName || "" : value(source, header.columns.genericName, 180);
      const category = simpleList
        ? clean(sheetName, 100) || "General"
        : value(source, header.columns.category, 100) || (options.allSheets ? clean(sheetName, 100) : "General");
      const keyBenefits = simpleList ? listedCurrent?.keyBenefits || "" : value(source, header.columns.keyBenefits, 1800);
      const talkingPoints = simpleList ? listedCurrent?.talkingPoints || "" : value(source, header.columns.talkingPoints, 1800);
      const usageNote = simpleList ? listedCurrent?.usageNote || "" : value(source, header.columns.usageNote, 1200);
      const caution = simpleList ? listedCurrent?.caution || "" : value(source, header.columns.caution, 1200);
      const tags = simpleList ? listedCurrent?.tags || category : value(source, header.columns.tags, 400);
      const id = simpleList ? key(productName) : productKey(productName, genericName);
      const current = simpleList ? listedCurrent : existingByKey.get(id);
      const errors: string[] = [];
      if (!productName) errors.push("Product Name မရှိပါ");
      if (!simpleList && !keyBenefits) errors.push("Key Benefits မရှိပါ");
      if (productName && seen.has(id)) errors.push("Google Sheet ထဲတွင် Product ထပ်နေသည်");
      if (productName) seen.add(id);
      rows.push({
        rowNumber: rows.length + 1,
        productName,
        genericName,
        category,
        keyBenefits,
        talkingPoints,
        usageNote,
        caution,
        tags,
        active: simpleList ? listedCurrent?.active ?? true : header.columns.active >= 0 ? activeValue(source[header.columns.active]) : true,
        action: current ? "update" : "add",
        existingId: current?.id || 0,
        error: errors.join(" • "),
      });
    }
  }
  if (!rows.length) throw new Error(`${sourceLabel} တွင် Product Data မတွေ့ပါ`);
  return rows;
}

async function parseFile(file: File) {
  return parseWorkbook(await file.arrayBuffer(), "Excel File");
}

function googleSheetExportUrl(value: unknown) {
  const raw = clean(value, 1000);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Google Sheet Link မှန်ကန်စွာထည့်ပါ");
  }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") {
    throw new Error("docs.google.com Google Sheet Link ကိုသာ အသုံးပြုနိုင်ပါသည်");
  }
  const match = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("Google Sheet ID မတွေ့ပါ");
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
}

async function parseGoogleSheet(sheetUrl: unknown) {
  const response = await fetch(googleSheetExportUrl(sheetUrl), {
    redirect: "follow",
    headers: { accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*;q=0.1" },
  });
  if (!response.ok) throw new Error("Google Sheet ကို ဖတ်မရပါ။ Anyone with the link — Viewer ဖွင့်ထားကြောင်း စစ်ပါ");
  const contentType = response.headers.get("content-type") || "";
  const source = await response.arrayBuffer();
  if (source.byteLength > 8 * 1024 * 1024) throw new Error("Google Sheet Data 8 MB အောက်သာ အသုံးပြုပါ");
  if (contentType.includes("text/html")) throw new Error("Google Sheet Access မရပါ။ Viewer Permission ဖွင့်ထားပါ");
  return parseWorkbook(source, "Google Sheet", { allSheets: true, allowCategoryLists: true });
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ Template ရယူနိုင်ပါသည်" }, { status: 403 });
  const sheet = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ["Example Product", "Generic Example", "General", "အဓိကအကျိုးကျေးဇူး", "Customer ကိုပြောရန်အချက်", "Usage Note", "သတိပြုရန်", "example, general", "Yes"],
  ]);
  sheet["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 42 }, { wch: 42 }, { wch: 34 }, { wch: 34 }, { wch: 24 }, { wch: 12 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Product Knowledge");
  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Response(output, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="Nawaratt_Product_Knowledge_Template.xlsx"',
      "cache-control": "private, no-store",
    },
  });
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ Product Excel ထည့်နိုင်ပါသည်" }, { status: 403 });
  try {
    const contentType = request.headers.get("content-type") || "";
    let mode = "preview";
    let sourceType: "excel" | "google_sheet" = "excel";
    let rows: ImportRow[];
    if (contentType.includes("application/json")) {
      const body = await request.json() as { mode?: unknown; sheetUrl?: unknown };
      mode = clean(body.mode, 20) || "preview";
      sourceType = "google_sheet";
      rows = await parseGoogleSheet(body.sheetUrl);
    } else {
      const form = await request.formData();
      const file = form.get("file");
      mode = clean(form.get("mode"), 20) || "preview";
      if (!(file instanceof File)) return Response.json({ error: "Excel File ရွေးပါ" }, { status: 400 });
      if (file.size > 8 * 1024 * 1024) return Response.json({ error: "Excel File 8 MB အောက်သာ တင်ပါ" }, { status: 400 });
      rows = await parseFile(file);
    }
    const validRows = rows.filter((row) => !row.error);
    const preview = {
      rows,
      validCount: validRows.length,
      errorCount: rows.length - validRows.length,
      addCount: validRows.filter((row) => row.action === "add").length,
      updateCount: validRows.filter((row) => row.action === "update").length,
    };
    if (mode !== "commit") return Response.json(preview);
    if (preview.errorCount > 0) return Response.json({ error: `စစ်ရန် ${preview.errorCount} Rows ရှိသောကြောင့် Product မသိမ်းရသေးပါ`, ...preview }, { status: 400 });
    if (!validRows.length) return Response.json({ error: "သိမ်းနိုင်သော Product မရှိပါ" }, { status: 400 });

    const db = getDb();
    const now = new Date().toISOString();
    for (const row of validRows) {
      const values = {
        productName: row.productName,
        genericName: row.genericName,
        category: row.category,
        keyBenefits: row.keyBenefits,
        talkingPoints: row.talkingPoints,
        usageNote: row.usageNote,
        caution: row.caution,
        tags: row.tags,
        active: row.active,
        updatedBy: user.displayName,
        updatedAt: now,
      };
      if (row.existingId) await db.update(productKnowledge).set(values).where(eq(productKnowledge.id, row.existingId));
      else await db.insert(productKnowledge).values({ ...values, createdBy: user.displayName, createdAt: now });
    }
    await recordAuditLog(user, {
      action: sourceType === "google_sheet" ? "product_knowledge_google_sheet_synced" : "product_knowledge_excel_imported",
      entityType: "product_knowledge",
      entityId: String(validRows.length),
      summary: `Product Knowledge ${sourceType === "google_sheet" ? "Google Sheet Manual Sync" : "Excel"} • အသစ် ${preview.addCount} • ပြင်ဆင် ${preview.updateCount}`,
    });
    return Response.json({ ...preview, importedCount: validRows.length, sourceType });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Product Excel Import မအောင်မြင်ပါ" }, { status: 400 });
  }
}
