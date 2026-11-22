import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { productMaster } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";
import { recordAuditLog } from "../../../lib/audit-log";

function cleanText(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanMoney(value: unknown) {
  const parsed = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function normalizeCode(value: unknown) {
  return cleanText(value, 120).toLocaleUpperCase();
}

async function admin() {
  const user = await getAppUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "admin") return { error: Response.json({ error: "Admin သာ Product Master ကို ပြင်နိုင်ပါသည်" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const products = await getDb().select().from(productMaster).where(eq(productMaster.active, true)).orderBy(asc(productMaster.productName), asc(productMaster.productCode));
  return Response.json({ products, canManage: user.role === "admin" }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await admin();
  if ("error" in access) return access.error;
  const payload = await request.json() as Record<string, unknown>;
  const rows = Array.isArray(payload.products) ? payload.products.slice(0, 5000) : [payload];
  if (!rows.length) return Response.json({ error: "Product Rows မရှိပါ" }, { status: 400 });

  const validRowsByCode = new Map<string, { productCode: string; productName: string; sku: string; salePrice: number }>();
  let skipped = 0;
  const now = new Date().toISOString();
  for (const raw of rows) {
    const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const productCode = normalizeCode(row.productCode ?? row.code);
    const productName = cleanText(row.productName ?? row.name ?? row.description);
    const sku = cleanText(row.sku, 120);
    const salePrice = cleanMoney(row.salePrice ?? row.price);
    if (!productCode || !productName || (productCode === "7" && productName === "7")) { skipped += 1; continue; }
    if (validRowsByCode.has(productCode)) skipped += 1;
    validRowsByCode.set(productCode, { productCode, productName, sku, salePrice });
  }
  const validRows = [...validRowsByCode.values()];
  if (!validRows.length) return Response.json({ error: "Product Code နှင့် Product Name ပါသော Row မတွေ့ပါ" }, { status: 400 });
  const chunkSize = 30;
  for (let offset = 0; offset < validRows.length; offset += chunkSize) {
    const statements = validRows.slice(offset, offset + chunkSize).map(({ productCode, productName, sku, salePrice }) => getDb().insert(productMaster).values({ productCode, productName, sku, salePrice, active: true, createdBy: access.user.displayName, updatedBy: access.user.displayName, updatedAt: now }).onConflictDoUpdate({
      target: productMaster.productCode,
      set: { productName, sku, salePrice, active: true, updatedBy: access.user.displayName, updatedAt: now },
    }));
    if (statements.length) await getDb().batch(statements as [any, ...any[]]);
  }
  const imported = validRows.length;
  await recordAuditLog(access.user, { action: "product_master_import", entityType: "product_master", entityId: "bulk", summary: `${imported} Products imported • ${skipped} skipped` });
  return Response.json({ imported, skipped });
}

export async function PATCH(request: Request) {
  const access = await admin();
  if ("error" in access) return access.error;
  const payload = await request.json() as Record<string, unknown>;
  const id = Number(payload.id);
  const productCode = normalizeCode(payload.productCode);
  const productName = cleanText(payload.productName);
  const sku = cleanText(payload.sku, 120);
  const salePrice = cleanMoney(payload.salePrice);
  if (!Number.isInteger(id) || id <= 0 || !productCode || !productName) return Response.json({ error: "Product Code နှင့် Product Name လိုအပ်ပါသည်" }, { status: 400 });
  const [duplicate] = await getDb().select({ id: productMaster.id }).from(productMaster).where(and(eq(productMaster.productCode, productCode), ne(productMaster.id, id))).limit(1);
  if (duplicate) return Response.json({ error: "ဒီ Product Code ရှိပြီးသားဖြစ်ပါသည်" }, { status: 409 });
  const [product] = await getDb().update(productMaster).set({ productCode, productName, sku, salePrice, updatedBy: access.user.displayName, updatedAt: new Date().toISOString() }).where(and(eq(productMaster.id, id), eq(productMaster.active, true))).returning();
  if (!product) return Response.json({ error: "Product မတွေ့ပါ" }, { status: 404 });
  await recordAuditLog(access.user, { action: "product_master_edit", entityType: "product_master", entityId: id, summary: `${productCode} • ${productName}` });
  return Response.json({ product });
}

export async function DELETE(request: Request) {
  const access = await admin();
  if ("error" in access) return access.error;
  const payload = await request.json() as Record<string, unknown>;
  const id = Number(payload.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Product ID မမှန်ပါ" }, { status: 400 });
  const [product] = await getDb().update(productMaster).set({ active: false, updatedBy: access.user.displayName, updatedAt: new Date().toISOString() }).where(and(eq(productMaster.id, id), eq(productMaster.active, true))).returning();
  if (!product) return Response.json({ error: "Product မတွေ့ပါ" }, { status: 404 });
  await recordAuditLog(access.user, { action: "product_master_delete", entityType: "product_master", entityId: id, summary: `${product.productCode} • ${product.productName} archived` });
  return Response.json({ deleted: true });
}
