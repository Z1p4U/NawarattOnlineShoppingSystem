import { env as rawEnv } from "cloudflare:workers";
import { getAppUser } from "../../../../lib/app-user";
import { recordAuditLog } from "../../../../lib/audit-log";
import {
  duplicatePairKey,
  findCustomerDuplicates,
  findProductDuplicates,
  type CustomerDuplicateRecord,
  type ProductDuplicateRecord,
} from "../../../../lib/duplicate-detection";

const env = rawEnv as typeof rawEnv & { DB: D1Database };

type DecisionRow = { pair_key: string; decision: string };
type CountRow = { record_key: string; usage_count: number };
type CustomerRow = {
  id: number; customer_name: string; township: string; customer_key: string; phone: string;
  address: string; route: string; salesperson: string; created_at: string;
};
type ProductRow = {
  id: number; product_code: string; product_name: string; sku: string; sale_price: number; created_at: string;
};

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function adminUser() {
  const user = await getAppUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "admin") return { error: Response.json({ error: "Admin သာ Duplicate Detection ကို အသုံးပြုနိုင်ပါသည်" }, { status: 403 }) };
  return { user };
}

function countMap(rows: CountRow[]) {
  return new Map(rows.map((row) => [String(row.record_key || ""), Number(row.usage_count || 0)]));
}

async function scanDuplicates() {
  const [customerResult, productResult, decisionResult, customerCountResult, productCountResult] = await Promise.all([
    env.DB.prepare("SELECT id, customer_name, township, customer_key, phone, address, route, salesperson, created_at FROM customers WHERE active = 1 ORDER BY id").all<CustomerRow>(),
    env.DB.prepare("SELECT id, product_code, product_name, sku, sale_price, created_at FROM product_master WHERE active = 1 ORDER BY id").all<ProductRow>(),
    env.DB.prepare("SELECT pair_key, decision FROM duplicate_review_decisions").all<DecisionRow>(),
    env.DB.prepare(`SELECT record_key, SUM(usage_count) AS usage_count FROM (
      SELECT customer_key AS record_key, COUNT(*) AS usage_count FROM orders GROUP BY customer_key
      UNION ALL SELECT customer_key, COUNT(*) FROM customer_opening_balances GROUP BY customer_key
      UNION ALL SELECT customer_key, COUNT(*) FROM customer_purchase_requests GROUP BY customer_key
      UNION ALL SELECT customer_key, COUNT(*) FROM sales_follow_ups GROUP BY customer_key
      UNION ALL SELECT customer_key, COUNT(*) FROM customer_locations GROUP BY customer_key
      UNION ALL SELECT customer_key, COUNT(*) FROM sales_route_stops GROUP BY customer_key
      UNION ALL SELECT customer_key, COUNT(*) FROM balance_adjustments GROUP BY customer_key
    ) WHERE record_key <> '' GROUP BY record_key`).all<CountRow>(),
    env.DB.prepare(`SELECT record_key, SUM(usage_count) AS usage_count FROM (
      SELECT original_product_code AS record_key, COUNT(*) AS usage_count FROM sale_order_items GROUP BY original_product_code
      UNION ALL SELECT matched_product_code, COUNT(*) FROM sale_order_items GROUP BY matched_product_code
      UNION ALL SELECT substitute_product_code, COUNT(*) FROM sale_order_items GROUP BY substitute_product_code
      UNION ALL SELECT product_code, COUNT(*) FROM purchase_requests GROUP BY product_code
      UNION ALL SELECT product_code, COUNT(*) FROM customer_purchase_requests GROUP BY product_code
      UNION ALL SELECT product_code, COUNT(*) FROM purchase_request_allocations GROUP BY product_code
      UNION ALL SELECT product_code, COUNT(*) FROM product_intelligence GROUP BY product_code
    ) WHERE record_key <> '' GROUP BY record_key`).all<CountRow>(),
  ]);

  const decisions = new Map((decisionResult.results || []).map((row) => [row.pair_key, row.decision]));
  const customerCounts = countMap(customerCountResult.results || []);
  const productCounts = countMap(productCountResult.results || []);
  const customers: CustomerDuplicateRecord[] = (customerResult.results || []).map((row) => ({
    id: row.id, customerName: row.customer_name, township: row.township, customerKey: row.customer_key,
    phone: row.phone, address: row.address, route: row.route, salesperson: row.salesperson,
    createdAt: row.created_at, usageCount: customerCounts.get(row.customer_key) || 0,
  }));
  const products: ProductDuplicateRecord[] = (productResult.results || []).map((row) => ({
    id: row.id, productCode: row.product_code, productName: row.product_name, sku: row.sku,
    salePrice: row.sale_price, createdAt: row.created_at, usageCount: productCounts.get(row.product_code) || 0,
  }));
  const customerMatches = findCustomerDuplicates(customers, decisions);
  const productMatches = findProductDuplicates(products, decisions);
  return {
    customerMatches,
    productMatches,
    summary: {
      activeCustomers: customers.length,
      activeProducts: products.length,
      customerMatches: customerMatches.length,
      productMatches: productMatches.length,
      reviewLater: [...customerMatches, ...productMatches].filter((item) => item.reviewStatus === "review_later").length,
    },
  };
}

export async function GET() {
  const access = await adminUser();
  if ("error" in access) return access.error;
  try {
    return Response.json(await scanDuplicates(), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Duplicate scan failed";
    return Response.json({ error: message.includes("no such table") ? "Database migration ပြင်ဆင်နေပါသည်။ ခဏနေရင် Refresh ပြန်လုပ်ပါ" : message }, { status: 500 });
  }
}

async function rows(sql: string, ...bindings: unknown[]) {
  return (await env.DB.prepare(sql).bind(...bindings).all<Record<string, unknown>>()).results || [];
}

async function customerSnapshot(canonical: CustomerRow, duplicate: CustomerRow) {
  const keys = [canonical.customer_key, duplicate.customer_key];
  return {
    records: [canonical, duplicate],
    orders: await rows("SELECT * FROM orders WHERE customer_key IN (?, ?)", ...keys),
    openings: await rows("SELECT * FROM customer_opening_balances WHERE customer_key IN (?, ?)", ...keys),
    customerRequests: await rows("SELECT * FROM customer_purchase_requests WHERE customer_key IN (?, ?)", ...keys),
    allocations: await rows("SELECT * FROM purchase_request_allocations WHERE customer_key IN (?, ?)", ...keys),
    followUps: await rows("SELECT * FROM sales_follow_ups WHERE customer_key IN (?, ?)", ...keys),
    locations: await rows("SELECT * FROM customer_locations WHERE customer_key IN (?, ?)", ...keys),
    routeStops: await rows("SELECT * FROM sales_route_stops WHERE customer_key IN (?, ?)", ...keys),
    balanceAdjustments: await rows("SELECT * FROM balance_adjustments WHERE customer_key IN (?, ?)", ...keys),
    trialOpenings: await rows("SELECT * FROM trial_opening_balances WHERE customer_key IN (?, ?)", ...keys),
    payments: await rows("SELECT * FROM payment_transactions WHERE (customer_name = ? AND township = ?) OR (customer_name = ? AND township = ?)", canonical.customer_name, canonical.township, duplicate.customer_name, duplicate.township),
  };
}

async function productSnapshot(canonical: ProductRow, duplicate: ProductRow) {
  const codes = [canonical.product_code, duplicate.product_code];
  return {
    records: [canonical, duplicate],
    saleOrderItems: await rows("SELECT * FROM sale_order_items WHERE original_product_code IN (?, ?) OR matched_product_code IN (?, ?) OR substitute_product_code IN (?, ?)", ...codes, ...codes, ...codes),
    purchaseRequests: await rows("SELECT * FROM purchase_requests WHERE product_code IN (?, ?)", ...codes),
    customerRequests: await rows("SELECT * FROM customer_purchase_requests WHERE product_code IN (?, ?)", ...codes),
    allocations: await rows("SELECT * FROM purchase_request_allocations WHERE product_code IN (?, ?)", ...codes),
    intelligence: await rows("SELECT * FROM product_intelligence WHERE product_code IN (?, ?)", ...codes),
  };
}

function decisionStatement(entityType: string, firstId: number, secondId: number, decision: string, canonicalId: number, note: string, actor: string, now: string) {
  const pairKey = duplicatePairKey(entityType as "customer" | "product", firstId, secondId);
  const [recordAId, recordBId] = [firstId, secondId].sort((left, right) => left - right);
  return env.DB.prepare(`INSERT INTO duplicate_review_decisions
    (entity_type, record_a_id, record_b_id, pair_key, decision, canonical_id, note, decided_by, decided_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pair_key) DO UPDATE SET decision = excluded.decision, canonical_id = excluded.canonical_id,
    note = excluded.note, decided_by = excluded.decided_by, decided_at = excluded.decided_at`)
    .bind(entityType, recordAId, recordBId, pairKey, decision, canonicalId, note, actor, now);
}

async function mergeCustomer(firstId: number, secondId: number, canonicalId: number, note: string, actor: { displayName: string; email: string; role: string }) {
  const result = await env.DB.prepare("SELECT id, customer_name, township, customer_key, phone, address, route, salesperson, created_at FROM customers WHERE id IN (?, ?) AND active = 1 ORDER BY id").bind(firstId, secondId).all<CustomerRow>();
  if ((result.results || []).length !== 2) throw new Error("Merge လုပ်မည့် Active Customers နှစ်ဦး မတွေ့ပါ");
  const canonical = result.results!.find((row) => row.id === canonicalId);
  const duplicate = result.results!.find((row) => row.id !== canonicalId);
  if (!canonical || !duplicate) throw new Error("Master Customer ကို မှန်ကန်စွာရွေးပါ");

  const snapshot = await customerSnapshot(canonical, duplicate);
  const openings = snapshot.openings;
  const canonicalOpening = openings.find((row) => row.customer_key === canonical.customer_key);
  const duplicateOpening = openings.find((row) => row.customer_key === duplicate.customer_key);
  const locations = snapshot.locations;
  const canonicalLocation = locations.find((row) => row.customer_key === canonical.customer_key);
  const duplicateLocation = locations.find((row) => row.customer_key === duplicate.customer_key);
  const now = new Date().toISOString();
  const backupId = crypto.randomUUID();
  const statements = [
    env.DB.prepare("INSERT INTO data_quality_merge_backups (id, entity_type, canonical_record_id, duplicate_record_id, snapshot_json, created_by, created_at) VALUES (?, 'customer', ?, ?, ?, ?, ?)").bind(backupId, canonical.id, duplicate.id, JSON.stringify(snapshot), actor.displayName, now),
    env.DB.prepare("INSERT INTO data_quality_aliases (entity_type, canonical_record_id, alias_record_id, alias_key, alias_name, alias_details, merged_by, merged_at) VALUES ('customer', ?, ?, ?, ?, ?, ?, ?)").bind(canonical.id, duplicate.id, duplicate.customer_key, duplicate.customer_name, JSON.stringify({ township: duplicate.township, phone: duplicate.phone, address: duplicate.address }), actor.displayName, now),
    decisionStatement("customer", firstId, secondId, "merged", canonical.id, note, actor.displayName, now),
    env.DB.prepare("UPDATE customers SET phone = CASE WHEN TRIM(phone) = '' THEN ? ELSE phone END, address = CASE WHEN TRIM(address) = '' THEN ? ELSE address END, updated_at = ? WHERE id = ?").bind(duplicate.phone, duplicate.address, now, canonical.id),
    env.DB.prepare("UPDATE customers SET active = 0, updated_at = ? WHERE id = ?").bind(now, duplicate.id),
    env.DB.prepare("UPDATE orders SET customer_key = ?, customer_name = ?, township = ?, updated_by = ?, updated_at = ? WHERE customer_key = ?").bind(canonical.customer_key, canonical.customer_name, canonical.township, actor.displayName, now, duplicate.customer_key),
    env.DB.prepare("UPDATE customer_purchase_requests SET customer_key = ?, customer_name = ?, township = ?, updated_by = ?, updated_at = ? WHERE customer_key = ?").bind(canonical.customer_key, canonical.customer_name, canonical.township, actor.displayName, now, duplicate.customer_key),
    env.DB.prepare("UPDATE purchase_request_allocations SET customer_key = ?, updated_at = ? WHERE customer_key = ?").bind(canonical.customer_key, now, duplicate.customer_key),
    env.DB.prepare("UPDATE sales_follow_ups SET customer_key = ?, customer_name = ?, township = ?, updated_by = ?, updated_at = ? WHERE customer_key = ?").bind(canonical.customer_key, canonical.customer_name, canonical.township, actor.displayName, now, duplicate.customer_key),
    env.DB.prepare("UPDATE sales_route_stops SET customer_key = ?, customer_name = ?, township = ?, updated_at = ? WHERE customer_key = ?").bind(canonical.customer_key, canonical.customer_name, canonical.township, now, duplicate.customer_key),
    env.DB.prepare("UPDATE balance_adjustments SET customer_key = ? WHERE customer_key = ?").bind(canonical.customer_key, duplicate.customer_key),
    env.DB.prepare("UPDATE trial_opening_balances SET customer_key = ?, customer_name = ?, township = ? WHERE customer_key = ?").bind(canonical.customer_key, canonical.customer_name, canonical.township, duplicate.customer_key),
    env.DB.prepare("UPDATE payment_transactions SET customer_name = ?, township = ? WHERE customer_name = ? AND township = ?").bind(canonical.customer_name, canonical.township, duplicate.customer_name, duplicate.township),
  ];

  if (canonicalOpening && duplicateOpening) {
    const notes = [String(canonicalOpening.note || ""), String(duplicateOpening.note || ""), `Merged duplicate ${duplicate.customer_name}`].filter(Boolean).join(" • ").slice(0, 800);
    statements.push(env.DB.prepare("UPDATE customer_opening_balances SET as_of_date = ?, opening_packages = ?, delivered_packages = ?, opening_outstanding = ?, paid_amount = ?, note = ?, updated_at = ? WHERE id = ?")
      .bind(String(canonicalOpening.as_of_date) < String(duplicateOpening.as_of_date) ? canonicalOpening.as_of_date : duplicateOpening.as_of_date, Number(canonicalOpening.opening_packages || 0) + Number(duplicateOpening.opening_packages || 0), Number(canonicalOpening.delivered_packages || 0) + Number(duplicateOpening.delivered_packages || 0), Number(canonicalOpening.opening_outstanding || 0) + Number(duplicateOpening.opening_outstanding || 0), Number(canonicalOpening.paid_amount || 0) + Number(duplicateOpening.paid_amount || 0), notes, now, canonicalOpening.id));
    statements.push(env.DB.prepare("DELETE FROM customer_opening_balances WHERE id = ?").bind(duplicateOpening.id));
  } else if (duplicateOpening) {
    statements.push(env.DB.prepare("UPDATE customer_opening_balances SET customer_key = ?, customer_name = ?, township = ?, updated_at = ? WHERE id = ?").bind(canonical.customer_key, canonical.customer_name, canonical.township, now, duplicateOpening.id));
  }

  if (canonicalLocation && duplicateLocation) {
    statements.push(env.DB.prepare(`UPDATE customer_locations SET
      latitude = CASE WHEN TRIM(latitude) = '' THEN ? ELSE latitude END,
      longitude = CASE WHEN TRIM(longitude) = '' THEN ? ELSE longitude END,
      landmark = CASE WHEN TRIM(landmark) = '' THEN ? ELSE landmark END,
      directions_note = CASE WHEN TRIM(directions_note) = '' THEN ? ELSE directions_note END,
      shop_photo_url = CASE WHEN TRIM(shop_photo_url) = '' THEN ? ELSE shop_photo_url END,
      verified = CASE WHEN verified = 1 OR ? = 1 THEN 1 ELSE 0 END, updated_by = ?, updated_at = ? WHERE id = ?`)
      .bind(duplicateLocation.latitude, duplicateLocation.longitude, duplicateLocation.landmark, duplicateLocation.directions_note, duplicateLocation.shop_photo_url, duplicateLocation.verified, actor.displayName, now, canonicalLocation.id));
    statements.push(env.DB.prepare("DELETE FROM customer_locations WHERE id = ?").bind(duplicateLocation.id));
  } else if (duplicateLocation) {
    statements.push(env.DB.prepare("UPDATE customer_locations SET customer_key = ?, updated_by = ?, updated_at = ? WHERE id = ?").bind(canonical.customer_key, actor.displayName, now, duplicateLocation.id));
  }

  await env.DB.batch(statements);
  await recordAuditLog(actor, { action: "duplicate_customer_merged", entityType: "customer", entityId: canonical.id, summary: `${duplicate.customer_name} • ${duplicate.township} → ${canonical.customer_name} • ${canonical.township} merged • Backup ${backupId}` });
  return { canonical, duplicate, backupId };
}

async function mergeProduct(firstId: number, secondId: number, canonicalId: number, note: string, actor: { displayName: string; email: string; role: string }) {
  const result = await env.DB.prepare("SELECT id, product_code, product_name, sku, sale_price, created_at FROM product_master WHERE id IN (?, ?) AND active = 1 ORDER BY id").bind(firstId, secondId).all<ProductRow>();
  if ((result.results || []).length !== 2) throw new Error("Merge လုပ်မည့် Active Products နှစ်ခု မတွေ့ပါ");
  const canonical = result.results!.find((row) => row.id === canonicalId);
  const duplicate = result.results!.find((row) => row.id !== canonicalId);
  if (!canonical || !duplicate) throw new Error("Master Product ကို မှန်ကန်စွာရွေးပါ");

  const snapshot = await productSnapshot(canonical, duplicate);
  const now = new Date().toISOString();
  const backupId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO data_quality_merge_backups (id, entity_type, canonical_record_id, duplicate_record_id, snapshot_json, created_by, created_at) VALUES (?, 'product', ?, ?, ?, ?, ?)").bind(backupId, canonical.id, duplicate.id, JSON.stringify(snapshot), actor.displayName, now),
    env.DB.prepare("INSERT INTO data_quality_aliases (entity_type, canonical_record_id, alias_record_id, alias_key, alias_name, alias_details, merged_by, merged_at) VALUES ('product', ?, ?, ?, ?, ?, ?, ?)").bind(canonical.id, duplicate.id, duplicate.product_code, duplicate.product_name, JSON.stringify({ sku: duplicate.sku, salePrice: duplicate.sale_price }), actor.displayName, now),
    decisionStatement("product", firstId, secondId, "merged", canonical.id, note, actor.displayName, now),
    env.DB.prepare("UPDATE product_master SET sku = CASE WHEN TRIM(sku) = '' THEN ? ELSE sku END, sale_price = CASE WHEN sale_price = 0 THEN ? ELSE sale_price END, updated_by = ?, updated_at = ? WHERE id = ?").bind(duplicate.sku, duplicate.sale_price, actor.displayName, now, canonical.id),
    env.DB.prepare("UPDATE product_master SET active = 0, updated_by = ?, updated_at = ? WHERE id = ?").bind(actor.displayName, now, duplicate.id),
    env.DB.prepare(`UPDATE sale_order_items SET
      original_product_code = CASE WHEN original_product_code = ? THEN ? ELSE original_product_code END,
      original_description = CASE WHEN original_product_code = ? THEN ? ELSE original_description END,
      matched_product_code = CASE WHEN matched_product_code = ? THEN ? ELSE matched_product_code END,
      matched_product_name = CASE WHEN matched_product_code = ? THEN ? ELSE matched_product_name END,
      substitute_product_code = CASE WHEN substitute_product_code = ? THEN ? ELSE substitute_product_code END,
      substitute_product_name = CASE WHEN substitute_product_code = ? THEN ? ELSE substitute_product_name END,
      updated_at = ?
      WHERE original_product_code = ? OR matched_product_code = ? OR substitute_product_code = ?`)
      .bind(duplicate.product_code, canonical.product_code, duplicate.product_code, canonical.product_name, duplicate.product_code, canonical.product_code, duplicate.product_code, canonical.product_name, duplicate.product_code, canonical.product_code, duplicate.product_code, canonical.product_name, now, duplicate.product_code, duplicate.product_code, duplicate.product_code),
    env.DB.prepare("UPDATE purchase_requests SET product_code = ?, product_name = ?, updated_by = ?, updated_at = ? WHERE product_code = ?").bind(canonical.product_code, canonical.product_name, actor.displayName, now, duplicate.product_code),
    env.DB.prepare("UPDATE customer_purchase_requests SET product_code = ?, product_name = ?, updated_by = ?, updated_at = ? WHERE product_code = ?").bind(canonical.product_code, canonical.product_name, actor.displayName, now, duplicate.product_code),
    env.DB.prepare("UPDATE purchase_request_allocations SET product_code = ?, updated_at = ? WHERE product_code = ?").bind(canonical.product_code, now, duplicate.product_code),
    env.DB.prepare("UPDATE product_intelligence SET product_code = ?, product_name = ? WHERE product_code = ?").bind(canonical.product_code, canonical.product_name, duplicate.product_code),
  ]);
  await recordAuditLog(actor, { action: "duplicate_product_merged", entityType: "product_master", entityId: canonical.id, summary: `${duplicate.product_code} • ${duplicate.product_name} → ${canonical.product_code} • ${canonical.product_name} merged • Backup ${backupId}` });
  return { canonical, duplicate, backupId };
}

export async function POST(request: Request) {
  const access = await adminUser();
  if ("error" in access) return access.error;
  try {
    const payload = await request.json() as Record<string, unknown>;
    const entityType = cleanText(payload.entityType, 20);
    const action = cleanText(payload.action, 30);
    const firstId = Number(payload.recordAId);
    const secondId = Number(payload.recordBId);
    const canonicalId = Number(payload.canonicalId || 0);
    const note = cleanText(payload.note, 500);
    if (!["customer", "product"].includes(entityType) || !Number.isInteger(firstId) || !Number.isInteger(secondId) || firstId <= 0 || secondId <= 0 || firstId === secondId) {
      return Response.json({ error: "Duplicate records မမှန်ပါ" }, { status: 400 });
    }
    const now = new Date().toISOString();
    if (["keep_separate", "review_later"].includes(action)) {
      await env.DB.batch([decisionStatement(entityType, firstId, secondId, action, 0, note, access.user.displayName, now)]);
      await recordAuditLog(access.user, { action: `duplicate_${action}`, entityType, entityId: `${firstId}:${secondId}`, summary: `${entityType} duplicate pair ကို ${action.replace("_", " ")} အဖြစ် သတ်မှတ်ခဲ့သည်` });
      return Response.json({ saved: true, action });
    }
    if (action !== "merge" || ![firstId, secondId].includes(canonicalId)) return Response.json({ error: "Master Record ကို ရွေးပါ" }, { status: 400 });
    const merged = entityType === "customer"
      ? await mergeCustomer(firstId, secondId, canonicalId, note, access.user)
      : await mergeProduct(firstId, secondId, canonicalId, note, access.user);
    return Response.json({ merged: true, ...merged });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Duplicate action failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
