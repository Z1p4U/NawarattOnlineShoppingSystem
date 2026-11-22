import { adjustmentTotals } from "../../../lib/balance-adjustments";
import { env } from "cloudflare:workers";
import { and, asc, desc, eq, gte, inArray, lte, ne, notInArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerOpeningBalances, deliveryIncidents, notifications, orderEvents, orderProductAdjustments, orders, paymentTransactions, productIntelligence, productMaster, purchaseRequestAllocations, purchaseRequests, saleOrderItems, warehouseReturns } from "../../../db/schema";
import { getAppUser, roleAllowed } from "../../../lib/app-user";
import { normalizeCustomerKey, resolveCustomerSelection } from "../../../lib/customer-directory";
import { notifyDepartments } from "../../../lib/department-notifications";
import { recordAuditLog } from "../../../lib/audit-log";
import { getOperationalPeriod, isLiveDate } from "../../../lib/operational-period";
import { removeCustomersWithSaleFromPendingGrowth } from "../../../lib/sales-growth-reconciliation";
import { fulfillActivePurchaseRequestsForBatch, resyncPurchaseRequestAllocationsForOrder, restoreActivePurchaseRequestAllocations } from "../../../lib/purchase-request-reconciliation";

const ROUTES = ["HTY Ways", "Pick Up", "Aung Mingalar", "BayinNaung"];
const SALE_PEOPLE = ["Zaw Tun Kyaw", "Zin Mg Mg Lin", "Myo Min", "Htin Lin Kyaw Swar", "Aung Kyaw Zaw", "Admin"];
const WAREHOUSE_STAFF = ["Han Htoo Aung", "Zin Wint Aung Htoo", "Ye Lwin Han", "Khant Ko Ko Htut", "Pyae Phyo Aung", "Naing Ko Win", "Thet Paing Htwe", "Aung Paing Phyo", "Kyaw Min Aung", "Myo Wai Tun", "Aye Min Soe", "Zar Ni", "Thet Zaw Ye"];
const DELIVERY_STATUSES = ["packed", "out_for_delivery", "delivered", "partial", "returned", "rescheduled"];
const ADDON_BLOCKED_STATUSES = ["out_for_delivery", "delivered", "partial", "returned"];
const PAYMENT_STATUSES = ["unpaid", "partial", "paid", "credit", "pending"];
const ROUTE_SALESPERSON_DELIVERY_EDIT_STATUSES = ["packed", "rescheduled", "out_for_delivery", "partial"];

type WarehouseBatch = {
  sequence: number;
  label?: string;
  salesperson?: string;
  voucherAmount?: number;
  packageMode?: "original" | "new";
  linkedOrderId?: number;
  linkedOrderNo?: string;
  linkedOrderDate?: string;
  plannedPackages?: number;
  boxes: number;
  bundles: number;
  status: "pending" | "picking" | "picked" | "finished";
  pickingStartedBy?: string;
  pickingStartedAt?: string;
  itemPackedBy: string;
  itemPackedAt: string;
  itemCheckedBy: string;
  itemCheckedAt: string;
  boxClosedBy: string;
  boxClosedAt: string;
  confirmedBy: string;
  confirmedAt: string;
};

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof saleOrderItems.$inferSelect;

function cleanText(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function normalizeCustomer(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function hasMergeableOriginalPackage(order: OrderRow) {
  return readWarehouseBatches(order).some((batch) =>
    batch.status === "finished" && (batch.packageMode === "original" || batch.boxes + batch.bundles > 0),
  );
}

function readWarehouseBatches(order: OrderRow): WarehouseBatch[] {
  try {
    const parsed = JSON.parse(order.warehouseBatches) as WarehouseBatch[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      const hasVoucherBreakdown = parsed.some((batch) => Object.prototype.hasOwnProperty.call(batch, "voucherAmount"));
      return parsed.map((batch, index) => ({
        sequence: cleanCount(batch.sequence),
        label: cleanText(batch.label, 80) || undefined,
        salesperson: SALE_PEOPLE.includes(cleanText(batch.salesperson, 80)) ? cleanText(batch.salesperson, 80) : order.salesperson,
        voucherAmount: Object.prototype.hasOwnProperty.call(batch, "voucherAmount")
          ? cleanCount(batch.voucherAmount)
          : !hasVoucherBreakdown && index === 0
            ? cleanCount(order.voucherAmount)
            : 0,
        packageMode: batch.packageMode === "original" ? "original" : batch.packageMode === "new" ? "new" : undefined,
        linkedOrderId: cleanCount(batch.linkedOrderId) || undefined,
        linkedOrderNo: cleanText(batch.linkedOrderNo, 80) || undefined,
        linkedOrderDate: cleanText(batch.linkedOrderDate, 10) || undefined,
        plannedPackages: cleanCount(batch.plannedPackages),
        boxes: cleanCount(batch.boxes),
        bundles: cleanCount(batch.bundles),
        status: batch.status === "finished" ? "finished" : batch.status === "picked" ? "picked" : batch.status === "picking" ? "picking" : "pending",
        pickingStartedBy: cleanText(batch.pickingStartedBy, 120) || undefined,
        pickingStartedAt: cleanText(batch.pickingStartedAt, 60) || undefined,
        itemPackedBy: cleanText(batch.itemPackedBy, 120),
        itemPackedAt: cleanText(batch.itemPackedAt, 60),
        itemCheckedBy: cleanText(batch.itemCheckedBy, 120),
        itemCheckedAt: cleanText(batch.itemCheckedAt, 60),
        boxClosedBy: WAREHOUSE_STAFF.includes(cleanText(batch.boxClosedBy, 120)) ? cleanText(batch.boxClosedBy, 120) : "",
        boxClosedAt: cleanText(batch.boxClosedAt, 60),
        confirmedBy: cleanText(batch.confirmedBy, 120),
        confirmedAt: cleanText(batch.confirmedAt, 60),
      }));
    }
  } catch { /* Fall through to legacy conversion. */ }

  const count = Math.max(1, cleanCount(order.saleOrderCount));
  const boxes = cleanCount(order.initialBoxes) + cleanCount(order.addonBoxes);
  const bundles = cleanCount(order.initialBundles) + cleanCount(order.addonBundles);
  const hasPreviousCounts = boxes + bundles > 0;

  if (order.warehouseStatus === "finished") {
    return [{
      sequence: count,
      label: count > 1 ? `အရင် ${count} Sale Orders စုစုပေါင်း` : "Sale Order #1",
      salesperson: order.salesperson,
      voucherAmount: cleanCount(order.voucherAmount),
      packageMode: "new",
      plannedPackages: boxes + bundles,
      boxes,
      bundles,
      status: "finished",
      itemPackedBy: "",
      itemPackedAt: "",
      itemCheckedBy: "",
      itemCheckedAt: "",
      boxClosedBy: "",
      boxClosedAt: "",
      confirmedBy: order.warehouseConfirmedBy,
      confirmedAt: order.warehouseConfirmedAt,
    }];
  }

  return Array.from({ length: count }, (_, index) => ({
    sequence: index + 1,
    salesperson: order.salesperson,
    voucherAmount: index === 0 ? cleanCount(order.voucherAmount) : 0,
    packageMode: "new",
    plannedPackages: index === 0 && hasPreviousCounts ? boxes + bundles : 0,
    boxes: index === 0 && hasPreviousCounts ? boxes : 0,
    bundles: index === 0 && hasPreviousCounts ? bundles : 0,
    status: index === 0 && hasPreviousCounts ? "finished" as const : "pending" as const,
    itemPackedBy: "",
    itemPackedAt: "",
    itemCheckedBy: "",
    itemCheckedAt: "",
    boxClosedBy: "",
    boxClosedAt: "",
    confirmedBy: index === 0 && hasPreviousCounts ? order.warehouseConfirmedBy : "",
    confirmedAt: index === 0 && hasPreviousCounts ? order.warehouseConfirmedAt : "",
  }));
}

function presentOrder(order: OrderRow, orderItems: OrderItemRow[] = []) {
  return { ...order, warehouseBatches: readWarehouseBatches(order), orderItems };
}

async function itemsForOrders(db: ReturnType<typeof getDb>, orderIds: number[]) {
  const grouped = new Map<number, OrderItemRow[]>();
  if (!orderIds.length) return grouped;
  // Cloudflare D1 has a bounded number of SQL bind parameters. Finance/All
  // views can return hundreds of orders, so query item rows in safe batches.
  const uniqueIds = [...new Set(orderIds.filter((id) => Number.isInteger(id) && id > 0))];
  const chunkSize = 80;
  for (let offset = 0; offset < uniqueIds.length; offset += chunkSize) {
    const ids = uniqueIds.slice(offset, offset + chunkSize);
    const rows = await db.select().from(saleOrderItems).where(inArray(saleOrderItems.orderId, ids)).orderBy(asc(saleOrderItems.batchSequence), asc(saleOrderItems.originalRowNumber), asc(saleOrderItems.id));
    for (const row of rows) grouped.set(row.orderId, [...(grouped.get(row.orderId) || []), row]);
  }
  return grouped;
}

function normalizeProduct(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9\u1000-\u109f]+/g, " ").replace(/\s+/g, " ").trim();
}

async function matchImportedItems(db: ReturnType<typeof getDb>, rawItems: unknown, batchSequence: number) {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 500) {
    throw new Error("Excel file ထဲတွင် အနည်းဆုံး Product Row တစ်ကြောင်းရှိရမည် (အများဆုံး 500 Rows)");
  }
  const masterRows = await db.select({ id: productMaster.id, productCode: productMaster.productCode, productName: productMaster.productName }).from(productMaster).where(eq(productMaster.active, true));
  const inventoryRows = masterRows.length
    ? masterRows
    : await db.select({ id: productIntelligence.id, productCode: productIntelligence.productCode, productName: productIntelligence.productName }).from(productIntelligence);
  const byCode = new Map<string, { productCode: string; productName: string }>();
  const byNameCandidates = new Map<string, Array<{ productCode: string; productName: string }>>();
  for (const product of inventoryRows) {
    const codeKey = normalizeProduct(product.productCode);
    const nameKey = normalizeProduct(product.productName);
    if (codeKey && !byCode.has(codeKey)) byCode.set(codeKey, product);
    if (nameKey) {
      const candidates = byNameCandidates.get(nameKey) || [];
      if (!candidates.some((candidate) => candidate.productCode === product.productCode && candidate.productName === product.productName)) candidates.push(product);
      byNameCandidates.set(nameKey, candidates);
    }
  }
  return rawItems.map((raw, index) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const originalProductCode = cleanText(item.productCode, 120);
    const originalDescription = cleanText(item.description, 240);
    const originalQuantity = cleanText(String(item.quantity ?? ""), 80);
    const quantity = cleanCount(item.quantity);
    const originalUnit = cleanText(item.unit, 80);
    const originalSalePrice = cleanText(String(item.salePrice ?? ""), 80);
    if (!originalDescription || !originalQuantity || quantity <= 0) throw new Error(`Excel Row ${index + 1}: Description နှင့် Quantity ကို စစ်ပါ`);
    const byExactCode = originalProductCode ? byCode.get(normalizeProduct(originalProductCode)) : undefined;
    const nameCandidates = byNameCandidates.get(normalizeProduct(originalDescription)) || [];
    const matched = byExactCode || (nameCandidates.length === 1 ? nameCandidates[0] : undefined);
    return {
      batchSequence,
      originalRowNumber: cleanCount(item.rowNumber) || index + 2,
      originalProductCode,
      originalDescription,
      originalQuantity,
      quantity,
      originalUnit,
      originalSalePrice,
      matchedProductCode: matched?.productCode || "",
      matchedProductName: matched?.productName || "",
      matchStatus: matched ? "matched" : "unknown",
      fulfillmentStatus: "pending",
      pickedQuantity: 0,
      shortageQuantity: 0,
    };
  });
}

async function insertImportedItems(db: ReturnType<typeof getDb>, orderId: number, items: Awaited<ReturnType<typeof matchImportedItems>>) {
  // Keep one product per SQL statement. The checker/substitution fields make a
  // multi-row INSERT exceed D1's bound-parameter ceiling even for four rows.
  // db.batch still sends several safe single-row statements in one round trip.
  const chunkSize = 20;
  for (let offset = 0; offset < items.length; offset += chunkSize) {
    const statements = items.slice(offset, offset + chunkSize).map((item) => db.insert(saleOrderItems).values({ ...item, orderId }).onConflictDoNothing());
    if (statements.length) await db.batch(statements as [any, ...any[]]);
  }
}

function isRecentInterruptedOrder(order: OrderRow) {
  const created = Date.parse(order.updatedAt.includes("T") ? order.updatedAt : `${order.updatedAt.replace(" ", "T")}Z`);
  return Number.isFinite(created) && Date.now() - created < 30 * 60 * 1000 && order.warehouseStatus === "processing" && order.voucherStatus === "pending" && !order.saleApproved && order.dispatchStatus === "awaiting_warehouse";
}

async function auth() {
  return getAppUser();
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("Failed query") || message.includes("too many SQL variables")) {
    return "Order products could not be saved. Please retry. If the problem continues, contact Admin.";
  }
  return message.includes("no such table")
    ? "Database is preparing. Please refresh in a moment."
    : message;
}

export async function GET(request: Request) {
  const user = await auth();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(request.url);
    const date = cleanText(url.searchParams.get("date"), 10);
    const startDate = cleanText(url.searchParams.get("startDate"), 10);
    const endDate = cleanText(url.searchParams.get("endDate"), 10);
    const { officialStartDate } = await getOperationalPeriod();
    const requestedCondition = date
      ? eq(orders.orderDate, date)
      : startDate && endDate
        ? and(gte(orders.orderDate, startDate), lte(orders.orderDate, endDate))
        : startDate
          ? gte(orders.orderDate, startDate)
          : endDate
            ? lte(orders.orderDate, endDate)
            : undefined;
    const condition = requestedCondition
      ? and(gte(orders.orderDate, officialStartDate), requestedCondition)
      : gte(orders.orderDate, officialStartDate);
    const db = getDb();
    const rows = await db
      .select()
      .from(orders)
      .where(condition)
      .orderBy(desc(orders.orderDate), desc(orders.updatedAt), desc(orders.id));
    const itemMap = await itemsForOrders(db, rows.map((row) => row.id));
    return Response.json({ orders: rows.map((row) => presentOrder(row, itemMap.get(row.id) || [])) });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await auth();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAllowed(user.role, ["sale"])) {
    return Response.json({ error: "Sale Team သာ Sale Order တင်နိုင်ပါသည်" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const orderDate = cleanText(payload.orderDate, 10);
    const customerName = cleanText(payload.customerName);
    const township = cleanText(payload.township, 120);
    const route = cleanText(payload.route, 40);
    const salesperson = cleanText(payload.salesperson, 80);
    let orderAmount = cleanCount(payload.orderAmount);
    const packageInstruction = cleanText(payload.packageInstruction, 80) || "အဆင်ပြေသလိုထည့်ပေးပါ";
    const orderRelation = cleanText(payload.orderRelation, 20) || "separate";
    const originalOrderId = cleanCount(payload.originalOrderId);
    const remark = cleanText(payload.remark, 400);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
      return Response.json({ error: "Valid order date is required" }, { status: 400 });
    }
    const { officialStartDate } = await getOperationalPeriod();
    if (!isLiveDate(orderDate, officialStartDate)) {
      return Response.json({ error: `Official Live Start ${officialStartDate} မှစ၍ Sale Order တင်နိုင်ပါသည်` }, { status: 400 });
    }
    if (!customerName) {
      return Response.json({ error: "Customer name is required" }, { status: 400 });
    }
    const selectedCustomer = await resolveCustomerSelection(customerName, township);
    if (!selectedCustomer) {
      return Response.json({ error: "Customers Database ထဲက Customer ကို ရွေးချယ်ပါ" }, { status: 400 });
    }
    if (!ROUTES.includes(route)) {
      return Response.json({ error: "Valid route is required" }, { status: 400 });
    }
    if (!SALE_PEOPLE.includes(salesperson)) {
      return Response.json({ error: "Sale Man ကို ရွေးချယ်ပါ" }, { status: 400 });
    }
    const packageInstructions = ["ပုံးနဲ့ထည့်ပေးပါ", "အိတ်နဲ့ထည့်ပေးပါ", "အဆင်ပြေသလိုထည့်ပေးပါ", "ပုံးအကြီးဖြင့်ထည့်ပေးပါ"];
    if (!packageInstructions.includes(packageInstruction)) {
      return Response.json({ error: "Package ထည့်သွင်းပုံကို ရွေးချယ်ပါ" }, { status: 400 });
    }
    const db = getDb();
    const customerKey = selectedCustomer.customerKey;
    if (!['separate', 'addon'].includes(orderRelation)) {
      return Response.json({ error: "Separate Order သို့မဟုတ် နောက်တိုး Order ကို ရွေးပါ" }, { status: 400 });
    }

    if (orderRelation === "addon") {
      if (!originalOrderId) {
        return Response.json({ error: "နောက်တိုး Order အတွက် Original Order ကို ရွေးပါ" }, { status: 400 });
      }
      const [existing] = await db.select().from(orders).where(eq(orders.id, originalOrderId)).limit(1);
      if (!existing || existing.customerKey !== customerKey || normalizeCustomerKey(existing.customerName, existing.township) !== customerKey || existing.route !== route) {
        return Response.json({ error: "ရွေးထားသော Original Order သည် ဒီ Customer / Route နှင့် မကိုက်ညီပါ" }, { status: 409 });
      }
      if (!existing.saleApproved || existing.warehouseStatus !== "finished" || !["packed", "rescheduled"].includes(existing.dispatchStatus)) {
        return Response.json({ error: "Delivery Approved ပြီး ပို့ရန်ကျန်နေသော Original Order ကိုသာ နောက်တိုး Order အဖြစ် ရွေးနိုင်ပါသည်" }, { status: 409 });
      }
      if (!hasMergeableOriginalPackage(existing)) {
        return Response.json({ error: "နောက်တိုး Order ထည့်ပေါင်းရန် မူလ Package မတွေ့ပါ" }, { status: 409 });
      }
      const existingItemMap = await itemsForOrders(db, [existing.id]);
      const existingItems = existingItemMap.get(existing.id) || [];
      const lastBatch = readWarehouseBatches(existing).find((batch) => batch.sequence === existing.saleOrderCount);
      const interruptedAddon = existing.addonPending && existing.saleOrderCount > 1 && lastBatch?.status === "pending" && isRecentInterruptedOrder(existing);
      if (interruptedAddon) {
        const recoveryItems = await matchImportedItems(db, payload.orderItems, existing.saleOrderCount);
        const existingBatchItemCount = existingItems.filter((item) => item.batchSequence === existing.saleOrderCount).length;
        if (existingBatchItemCount < recoveryItems.length) {
        await insertImportedItems(db, existing.id, recoveryItems);
        await db.insert(orderEvents).values({ orderId: existing.id, eventType: "excel_import_recovered", message: `နောက်တိုး Sale Order #${existing.saleOrderCount} • Excel ${recoveryItems.length} Rows ပြန်လည်ဖြည့်ပြီး`, actor: user.displayName });
        await recordAuditLog(user, { action: "excel_import_recovered", entityType: "order", entityId: existing.id, summary: `${existing.orderNo} • Add-on Excel ${recoveryItems.length} Rows recovery` });
        const recoveredMap = await itemsForOrders(db, [existing.id]);
        return Response.json({ order: presentOrder(existing, recoveredMap.get(existing.id) || []), merged: true, recovered: true });
        }
      }
      const nextBatchSequence = existing.saleOrderCount + 1;
      const importedItems = await matchImportedItems(db, payload.orderItems, nextBatchSequence);
      if (!orderAmount) orderAmount = importedItems.reduce((sum, item) => sum + item.quantity * cleanCount(item.originalSalePrice.replaceAll(",", "")), 0);
      const warehouseBatches = readWarehouseBatches(existing);
      warehouseBatches.push({
        sequence: nextBatchSequence,
        salesperson,
        voucherAmount: 0,
        packageMode: undefined,
        plannedPackages: 0,
        boxes: 0,
        bundles: 0,
        status: "pending",
        itemPackedBy: "",
        itemPackedAt: "",
        itemCheckedBy: "",
        itemCheckedAt: "",
        boxClosedBy: "",
        boxClosedAt: "",
        confirmedBy: "",
        confirmedAt: "",
      });
      const [updated] = await db
        .update(orders)
        .set({
          saleOrderCount: existing.saleOrderCount + 1,
          warehouseStatus: "processing",
          warehouseBatches: JSON.stringify(warehouseBatches),
          orderAmount: existing.orderAmount + orderAmount,
          voucherStatus: "pending",
          saleApproved: false,
          saleApprovedBy: "",
          saleApprovedAt: "",
          addonPending: true,
          packageInstruction: [...new Set([existing.packageInstruction, packageInstruction].filter(Boolean))].join(" | "),
          remark: [existing.remark, remark].filter(Boolean).join(" | "),
          updatedBy: user.displayName,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(orders.id, existing.id), notInArray(orders.dispatchStatus, ADDON_BLOCKED_STATUSES)))
        .returning();

      if (!updated) {
        return Response.json({ error: "Delivery status ပြောင်းသွားသောကြောင့် နောက်တိုး Order မပေါင်းနိုင်ပါ။ Refresh လုပ်ပြီး ပြန်စစ်ပါ" }, { status: 409 });
      }

      await insertImportedItems(db, existing.id, importedItems);

      await db.insert(orderEvents).values({
        orderId: existing.id,
        eventType: "addon",
        message: `နောက်တိုး Sale Order #${existing.saleOrderCount + 1} • ${orderDate} • Packaging ကို Warehouse ဆုံးဖြတ်ရန်${remark ? ` • Remark: ${remark}` : ""}`,
        actor: user.displayName,
      });
      await notifyDepartments({ roles: ["warehouse"], title: "နောက်တိုး Sale Order ဝင်လာပါပြီ", message: `${customerName} • ${existing.route} • Sale Order #${existing.saleOrderCount + 1} • ${orderDate}`, targetTab: "warehouse", sourceId: existing.id, actor: user.displayName });
      await recordAuditLog(user, { action: "order_addon", entityType: "order", entityId: existing.id, summary: `${customerName} • နောက်တိုး Sale Order #${existing.saleOrderCount + 1}` });
      const itemMap = await itemsForOrders(db, [updated.id]);
      return Response.json({ order: presentOrder(updated, itemMap.get(updated.id) || []), merged: true });
    }

    const importedItems = await matchImportedItems(db, payload.orderItems, 1);
    if (!orderAmount) orderAmount = importedItems.reduce((sum, item) => sum + item.quantity * cleanCount(item.originalSalePrice.replaceAll(",", "")), 0);

    const recoveryCandidates = await db.select().from(orders).where(and(
      eq(orders.orderDate, orderDate),
      eq(orders.customerKey, customerKey),
      eq(orders.route, route),
      eq(orders.createdBy, user.displayName),
      eq(orders.warehouseStatus, "processing"),
      eq(orders.voucherStatus, "pending"),
    )).orderBy(desc(orders.id)).limit(5);
    for (const candidate of recoveryCandidates) {
      if (!isRecentInterruptedOrder(candidate) || candidate.saleOrderCount !== 1 || candidate.orderAmount !== orderAmount) continue;
      const candidateItems = await itemsForOrders(db, [candidate.id]);
      if ((candidateItems.get(candidate.id) || []).length >= importedItems.length) continue;
      await insertImportedItems(db, candidate.id, importedItems);
      await db.insert(orderEvents).values({ orderId: candidate.id, eventType: "excel_import_recovered", message: `Sale Order Excel ${importedItems.length} Rows ပြန်လည်ဖြည့်ပြီး`, actor: user.displayName });
      await recordAuditLog(user, { action: "excel_import_recovered", entityType: "order", entityId: candidate.id, summary: `${candidate.orderNo} • Excel ${importedItems.length} Rows recovery` });
      const recoveredMap = await itemsForOrders(db, [candidate.id]);
      return Response.json({ order: presentOrder(candidate, recoveredMap.get(candidate.id) || []), merged: false, recovered: true });
    }

    const orderNo = `NWR-${orderDate.replaceAll("-", "").slice(2)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const [created] = await db
      .insert(orders)
      .values({
        orderNo,
        orderDate,
        customerName,
        township,
        customerKey,
        salesperson,
        route,
        warehouseStatus: "processing",
        warehouseBatches: JSON.stringify([{ sequence: 1, salesperson, voucherAmount: 0, packageMode: undefined, plannedPackages: 0, boxes: 0, bundles: 0, status: "pending", itemPackedBy: "", itemPackedAt: "", itemCheckedBy: "", itemCheckedAt: "", boxClosedBy: "", boxClosedAt: "", confirmedBy: "", confirmedAt: "" }]),
        dispatchStatus: "awaiting_warehouse",
        orderAmount,
        voucherStatus: "pending",
        packageInstruction,
        remark,
        createdBy: user.displayName,
        updatedBy: user.displayName,
      })
      .returning();

    await insertImportedItems(db, created.id, importedItems);

    await db.insert(orderEvents).values({
      orderId: created.id,
      eventType: "created",
      message: "Sale Team မှ Sale Order တင်ခဲ့သည် • Packaging ကို Warehouse မှ ဆုံးဖြတ်ရန်",
      actor: user.displayName,
    });
    await notifyDepartments({ roles: ["warehouse"], title: "Sale Order အသစ်ဝင်လာပါပြီ", message: `${customerName} • ${route} • ${orderNo} • Packaging ဆုံးဖြတ်ရန်`, targetTab: "warehouse", sourceId: created.id, actor: user.displayName });
    await recordAuditLog(user, { action: "order_created", entityType: "order", entityId: created.id, summary: `${customerName} • ${orderNo} Sale Order တင်ခဲ့သည် • Packaging ကို Warehouse မှ ဆုံးဖြတ်ရန်` });
    const itemMap = await itemsForOrders(db, [created.id]);
    return Response.json({ order: presentOrder(created, itemMap.get(created.id) || []), merged: false }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await auth();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = cleanCount(payload.id);
    const action = cleanText(payload.action, 40);
    const db = getDb();
    const { officialStartDate } = await getOperationalPeriod();

    if (action === "customer_payment") {
      if (!roleAllowed(user.role, ["finance"])) {
        return Response.json({ error: "Finance Team သာ Payment ထည့်နိုင်ပါသည်" }, { status: 403 });
      }
      const customerName = cleanText(payload.customerName);
      const township = cleanText(payload.township, 120);
      const amount = cleanCount(payload.amount);
      const paymentMethod = cleanText(payload.paymentMethod, 20);
      const paymentDate = cleanText(payload.paymentDate, 10);
      if (!customerName || !amount) return Response.json({ error: "Customer နှင့် Payment Amount ထည့်ပါ" }, { status: 400 });
      if (!["cash", "banking"].includes(paymentMethod)) return Response.json({ error: "Cash သို့မဟုတ် Banking ရွေးပါ" }, { status: 400 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return Response.json({ error: "Payment Date ရွေးပါ" }, { status: 400 });
      const { officialStartDate } = await getOperationalPeriod();
      if (!isLiveDate(paymentDate, officialStartDate)) return Response.json({ error: `Official Live Start ${officialStartDate} မှစ၍ Payment ထည့်နိုင်ပါသည်` }, { status: 400 });
      const customerOrders = await db.select().from(orders)
        .where(and(gte(orders.orderDate, officialStartDate), eq(orders.customerName, customerName), eq(orders.township, township), eq(orders.voucherStatus, "updated")))
        .orderBy(asc(orders.orderDate), asc(orders.id));
      const [opening] = await db.select().from(customerOpeningBalances)
        .where(and(gte(customerOpeningBalances.asOfDate, officialStartDate), eq(customerOpeningBalances.customerKey, `${normalizeCustomer(customerName)}|||${normalizeCustomer(township)}`))).limit(1);
      const outstandingOrders = customerOrders.filter((order) => Math.max(0, order.voucherAmount - order.paidAmount) > 0);
      const adjustment = (await adjustmentTotals(officialStartDate)).get(`${normalizeCustomer(customerName)}|||${normalizeCustomer(township)}`) || 0;
      const openingOutstanding = opening ? opening.openingOutstanding + adjustment - opening.paidAmount : 0;
      const totalOutstanding = Math.max(0, openingOutstanding + outstandingOrders.reduce((sum, order) => sum + Math.max(0, order.voucherAmount - order.paidAmount), 0));
      if (!totalOutstanding) return Response.json({ error: "ဒီ Customer မှာ Outstanding မရှိပါ" }, { status: 409 });
      if (amount > totalOutstanding) return Response.json({ error: `Payment သည် Outstanding ${totalOutstanding.toLocaleString()} MMK ထက် မကျော်ရပါ` }, { status: 400 });

      let remaining = amount;
      const updatedOrders: OrderRow[] = [];
      if (opening && openingOutstanding > 0) {
        const applied = Math.min(openingOutstanding, remaining);
        await db.update(customerOpeningBalances).set({ paidAmount: opening.paidAmount + applied, enteredBy: user.displayName, updatedAt: new Date().toISOString() }).where(eq(customerOpeningBalances.id, opening.id));
        remaining -= applied;
      }
      for (const order of outstandingOrders) {
        if (remaining <= 0) break;
        const balance = Math.max(0, order.voucherAmount - order.paidAmount);
        const applied = Math.min(balance, remaining);
        const paidAmount = order.paidAmount + applied;
        const paymentStatus = paidAmount >= order.voucherAmount ? "paid" : "partial";
        const [updated] = await db.update(orders).set({ paymentStatus, paidAmount, updatedBy: user.displayName, updatedAt: new Date().toISOString() }).where(eq(orders.id, order.id)).returning();
        await db.insert(orderEvents).values({ orderId: order.id, eventType: "customer_payment", message: `Customer Payment ${applied.toLocaleString()} MMK • ${paymentStatus}`, actor: user.displayName });
        updatedOrders.push(updated);
        remaining -= applied;
      }
      await db.insert(paymentTransactions).values({ orderId: updatedOrders.length === 1 ? updatedOrders[0].id : 0, customerName, township, amount, method: paymentMethod, paymentDate, enteredBy: user.displayName, createdAt: new Date().toISOString() });
      await notifyDepartments({ roles: ["sale"], title: "Customer Payment ဝင်ပါပြီ", message: `${customerName} • ${amount.toLocaleString()} MMK • Opening/VR လက်ကျန်မှ နုတ်ပြီး`, targetTab: "sale", sourceId: updatedOrders[0]?.id || 0, actor: user.displayName });
      await recordAuditLog(user, { action: "customer_payment", entityType: "customer", entityId: `${customerName}|${township}`, summary: `${customerName} • Payment ${amount.toLocaleString()} MMK (${paymentMethod})` });
      const itemMap = await itemsForOrders(db, updatedOrders.map((order) => order.id));
      return Response.json({ orders: updatedOrders.map((order) => presentOrder(order, itemMap.get(order.id) || [])), appliedAmount: amount, outstanding: totalOutstanding - amount });
    }

    if (action === "delivery_on_way_bulk") {
      if (!roleAllowed(user.role, ["delivery"])) {
        return Response.json({ error: "Delivery Team သာ ကားပေါ်တင်ပြီး On the way လုပ်နိုင်ပါသည်" }, { status: 403 });
      }
      const ids = Array.isArray(payload.ids)
        ? [...new Set(payload.ids.map(cleanCount).filter(Boolean))].slice(0, 100)
        : [];
      if (ids.length === 0) return Response.json({ error: "ကားပေါ်တင်ထားသော Order ကို အနည်းဆုံးတစ်ခု ရွေးပါ" }, { status: 400 });

      const selected = await db.select().from(orders).where(inArray(orders.id, ids));
      const allReady = selected.length === ids.length && selected.every((order) =>
        isLiveDate(order.orderDate, officialStartDate) &&
        order.warehouseStatus === "finished" &&
        order.saleApproved &&
        ["packed", "rescheduled"].includes(order.dispatchStatus)
      );
      if (!allReady) {
        return Response.json({ error: "ရွေးထားသော Order တစ်ခုခုသည် Delivery Ready မဖြစ်သေးပါ သို့မဟုတ် On the way ဖြစ်ပြီးသားပါ" }, { status: 409 });
      }

      const now = new Date().toISOString();
      const updated = await db.update(orders).set({
        dispatchStatus: "out_for_delivery",
        deliveredAt: "",
        updatedBy: user.displayName,
        updatedAt: now,
      }).where(and(
        inArray(orders.id, ids),
        eq(orders.warehouseStatus, "finished"),
        eq(orders.saleApproved, true),
        inArray(orders.dispatchStatus, ["packed", "rescheduled"]),
      )).returning();

      if (updated.length !== ids.length) {
        return Response.json({ error: "Order status တစ်ခု ပြောင်းသွားပါသည်။ Refresh လုပ်ပြီး ပြန်စစ်ပါ" }, { status: 409 });
      }
      await db.insert(orderEvents).values(updated.map((order) => ({ orderId: order.id, eventType: "on_the_way", message: "ကားပေါ်တင်ပြီး • On the way", actor: user.displayName })));
      await notifyDepartments({ roles: ["sale"], title: `${updated.length} Orders • On the way`, message: updated.map((order) => order.customerName).slice(0, 4).join(" • "), targetTab: "sale", sourceId: updated[0].id, actor: user.displayName });
      await recordAuditLog(user, { action: "delivery_on_way_bulk", entityType: "order_batch", entityId: ids.join(","), summary: `${updated.length} Orders ကားပေါ်တင်ပြီး On the way ပြောင်းခဲ့သည်` });
      const itemMap = await itemsForOrders(db, updated.map((order) => order.id));
      return Response.json({ orders: updated.map((order) => presentOrder(order, itemMap.get(order.id) || [])) });
    }

    if (action === "delivery_delivered_bulk") {
      if (!roleAllowed(user.role, ["delivery"])) {
        return Response.json({ error: "Delivery Team သာ On the way Orders ကို Delivered လုပ်နိုင်ပါသည်" }, { status: 403 });
      }
      const ids = Array.isArray(payload.ids)
        ? [...new Set(payload.ids.map(cleanCount).filter(Boolean))].slice(0, 100)
        : [];
      if (ids.length === 0) return Response.json({ error: "Delivered လုပ်မည့် On the way Order ကို အနည်းဆုံးတစ်ခု ရွေးပါ" }, { status: 400 });

      const selected = await db.select().from(orders).where(inArray(orders.id, ids));
      if (selected.length !== ids.length || selected.some((order) => !isLiveDate(order.orderDate, officialStartDate) || !["out_for_delivery", "partial"].includes(order.dispatchStatus))) {
        return Response.json({ error: "ရွေးထားသော Order တစ်ခုခုသည် On the Way / Partial Delivery မဟုတ်တော့ပါ။ Refresh လုပ်ပြီး ပြန်စစ်ပါ" }, { status: 409 });
      }

      const now = new Date().toISOString();
      const updated: OrderRow[] = [];
      for (const order of selected) {
        const [delivered] = await db.update(orders).set({
          dispatchStatus: "delivered",
          deliveredBoxes: order.initialBoxes + order.addonBoxes,
          deliveredBundles: order.initialBundles + order.addonBundles,
          deliveredAt: now,
          updatedBy: user.displayName,
          updatedAt: now,
        }).where(and(eq(orders.id, order.id), inArray(orders.dispatchStatus, ["out_for_delivery", "partial"]))).returning();
        if (!delivered) return Response.json({ error: "Order status တစ်ခု ပြောင်းသွားပါသည်။ Refresh လုပ်ပြီး ပြန်စစ်ပါ" }, { status: 409 });
        updated.push(delivered);
      }

      await db.insert(orderEvents).values(updated.map((order) => ({ orderId: order.id, eventType: "delivered", message: "Delivery status: delivered", actor: user.displayName })));
      await notifyDepartments({ roles: ["sale"], title: `${updated.length} Orders • ပို့ပြီးပါပြီ`, message: updated.map((order) => order.customerName).slice(0, 4).join(" • "), targetTab: "sale", sourceId: updated[0].id, actor: user.displayName });
      await recordAuditLog(user, { action: "delivery_delivered_bulk", entityType: "order_batch", entityId: ids.join(","), summary: `${updated.length} On the way Orders ကို Delivered ပြောင်းခဲ့သည်` });
      const itemMap = await itemsForOrders(db, updated.map((order) => order.id));
      return Response.json({ orders: updated.map((order) => presentOrder(order, itemMap.get(order.id) || [])) });
    }

    const [current] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!current) return Response.json({ error: "Order not found" }, { status: 404 });
    if (!isLiveDate(current.orderDate, officialStartDate)) return Response.json({ error: "Trial Order ကို Archive ထားပြီးဖြစ်၍ ပြင်ဆင်၍မရပါ" }, { status: 409 });

    if (action === "review_order_items_edit") {
      const isAdmin = user.role === "admin";
      const deliveryStarted = ["out_for_delivery", "partial"].includes(current.dispatchStatus);
      const delivered = current.dispatchStatus === "delivered";
      const awaitingDelivery = current.saleApproved && ["packed", "rescheduled"].includes(current.dispatchStatus);
      const preApprovalEdit = !current.saleApproved && current.warehouseStatus === "finished" && !deliveryStarted && !delivered;
      if (!isAdmin && !(user.role === "warehouse" && preApprovalEdit)) {
        return Response.json({ error: "Admin သာ Delivery Approved၊ ပို့ရန်ကျန်၊ On the Way နှင့် ပို့ပြီး Order ၏ Checked Products ကို ပြင်နိုင်ပါသည်" }, { status: 403 });
      }
      if (current.warehouseStatus !== "finished" || current.dispatchStatus === "returned") {
        return Response.json({ error: "Warehouse Completed ဖြစ်ပြီးသော Active / Delivered Order ကိုသာ Checked Products ပြင်နိုင်ပါသည်" }, { status: 409 });
      }
      const editRemark = cleanText(payload.editRemark, 300);
      if (!editRemark) return Response.json({ error: "ပြင်ဆင်ရသည့်အကြောင်းရင်း Remark ထည့်ပါ" }, { status: 400 });
      const rawItems = Array.isArray(payload.items) ? payload.items.slice(0, 500) : [];
      const rawAddedItems = Array.isArray(payload.addedItems) ? payload.addedItems.slice(0, 100) : [];
      if (!rawItems.length && !rawAddedItems.length) return Response.json({ error: "ပြင်ဆင်မည့် Product Rows မတွေ့ပါ" }, { status: 400 });

      const currentItems = await db.select().from(saleOrderItems).where(eq(saleOrderItems.orderId, current.id));
      if (currentItems.some((item) => item.checkedQuantity < 0 || item.fulfillmentStatus === "pending")) {
        return Response.json({ error: "Product Rows အားလုံး Picked နှင့် Checked ပြီးမှ Final Result ကို ပြင်နိုင်ပါသည်" }, { status: 409 });
      }
      const currentById = new Map(currentItems.map((item) => [item.id, item]));
      const activeProducts = await db.select().from(productMaster).where(eq(productMaster.active, true));
      const productById = new Map(activeProducts.map((product) => [product.id, product]));
      const productByName = new Map(activeProducts.map((product) => [normalizeProduct(product.productName), product]));
      const requestedIds = new Set<number>();
      const requested: Array<{ item: OrderItemRow; productName: string; quantity: number; unit: string; deleted: boolean; selectedProduct?: (typeof activeProducts)[number] }> = [];
      for (const raw of rawItems) {
        const entry = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        const itemId = cleanCount(entry.itemId);
        const productName = cleanText(entry.productName, 300);
        const quantity = cleanCount(entry.quantity);
        const unit = cleanText(entry.unit, 80);
        const deleted = entry.deleted === true;
        const item = currentById.get(itemId);
        if (!itemId || requestedIds.has(itemId) || !item) return Response.json({ error: "Product Row မမှန်ပါ။ Refresh လုပ်ပြီး ပြန်စစ်ပါ" }, { status: 400 });
        if (!deleted && !productName) return Response.json({ error: "Actual Product Name မဖြစ်မနေ ထည့်ပါ" }, { status: 400 });
        if (!deleted && !unit) return Response.json({ error: `${productName} Unit မဖြစ်မနေ ထည့်ပါ` }, { status: 400 });
        if (quantity > 999999) return Response.json({ error: `${productName} Checked Quantity ကို 0 မှ 999,999 အတွင်း ထည့်ပါ` }, { status: 400 });
        const hasConfirmedSubstitute = item.substitutionStatus === "confirmed" && Boolean(item.substituteProductName);
        const currentActualName = hasConfirmedSubstitute ? item.substituteProductName : item.matchedProductName || item.originalDescription;
        const productChanged = !deleted && normalizeProduct(productName) !== normalizeProduct(currentActualName);
        const selectedProduct = productChanged ? productByName.get(normalizeProduct(productName)) : undefined;
        if (productChanged && !selectedProduct) return Response.json({ error: `${productName} ကို Product Master မှ ရွေးပါ` }, { status: 400 });
        requestedIds.add(itemId);
        requested.push({ item, productName, quantity, unit, deleted, selectedProduct });
      }
      if (requested.length !== currentItems.length || currentItems.some((item) => !requestedIds.has(item.id))) {
        return Response.json({ error: "Product Rows အားလုံးကို မူလအစဉ်အတိုင်း ပြင်ဆင်ပြီး သိမ်းပါ" }, { status: 400 });
      }

      const batchSequences = new Set(readWarehouseBatches(current).map((batch) => batch.sequence));
      const addedItems: Array<{ product: (typeof activeProducts)[number]; quantity: number; unit: string; batchSequence: number }> = [];
      for (const raw of rawAddedItems) {
        const entry = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        const product = productById.get(cleanCount(entry.productId));
        const quantity = cleanCount(entry.quantity);
        const unit = cleanText(entry.unit, 80);
        const batchSequence = cleanCount(entry.batchSequence) || 1;
        if (!product) return Response.json({ error: "Add Product ကို Product Master မှ ရွေးပါ" }, { status: 400 });
        if (!quantity || quantity > 999999) return Response.json({ error: `${product.productName} Quantity ကို ပြန်စစ်ပါ` }, { status: 400 });
        if (!unit) return Response.json({ error: `${product.productName} Unit ထည့်ပါ` }, { status: 400 });
        if (!batchSequences.has(batchSequence)) return Response.json({ error: "Add Product ၏ Sale Order Batch မမှန်ပါ" }, { status: 400 });
        addedItems.push({ product, quantity, unit, batchSequence });
      }

      const changes: string[] = [];
      const changedBatchSequences = new Set<number>();
      const now = new Date().toISOString();
      const actualSnapshot = (item: OrderItemRow) => {
        const substituted = item.substitutionStatus === "confirmed" && Boolean(item.substituteProductName);
        return {
          itemId: item.id,
          batchSequence: item.batchSequence,
          productCode: substituted ? item.substituteProductCode : item.matchedProductCode || item.originalProductCode,
          productName: substituted ? item.substituteProductName : item.matchedProductName || item.originalDescription,
          quantity: substituted ? item.substituteQuantity : Math.max(0, item.checkedQuantity),
          unit: item.checkedUnit || item.originalUnit,
        };
      };
      const beforeValue = currentItems.map(actualSnapshot);
      const statements: any[] = requested.map((entry) => {
        const { item, selectedProduct } = entry;
        const hasConfirmedSubstitute = item.substitutionStatus === "confirmed" && Boolean(item.substituteProductName);
        const currentActualName = hasConfirmedSubstitute ? item.substituteProductName : item.matchedProductName || item.originalDescription;
        const currentActualQuantity = hasConfirmedSubstitute ? item.substituteQuantity : item.checkedQuantity >= 0 ? item.checkedQuantity : item.pickedQuantity;
        const currentUnit = item.checkedUnit || item.originalUnit;
        const productChanged = !entry.deleted && normalizeProduct(entry.productName) !== normalizeProduct(currentActualName);
        const nextQuantity = entry.deleted ? 0 : entry.quantity;
        const nextUnit = entry.deleted ? currentUnit : entry.unit;
        const quantityChanged = nextQuantity !== currentActualQuantity;
        const unitChanged = nextUnit !== currentUnit;
        if (!productChanged && !quantityChanged && !unitChanged && !entry.deleted) return null;
        const shortageQuantity = Math.max(0, item.quantity - nextQuantity);
        const fulfillmentStatus = nextQuantity >= item.quantity ? "picked" : nextQuantity > 0 ? "shortage" : "unavailable";
        const nextActualName = selectedProduct?.productName || currentActualName;
        changes.push(entry.deleted
          ? `Delete: ${currentActualName} ${currentActualQuantity} ${currentUnit || "Unit"} → 0`
          : `${currentActualName} ${currentActualQuantity} ${currentUnit || "Unit"} → ${nextActualName} ${nextQuantity} ${nextUnit}`);
        changedBatchSequences.add(item.batchSequence);
        return db.update(saleOrderItems).set({
          matchedProductCode: selectedProduct?.productCode || (hasConfirmedSubstitute ? item.substituteProductCode : item.matchedProductCode),
          matchedProductName: selectedProduct?.productName || (hasConfirmedSubstitute ? item.substituteProductName : item.matchedProductName || item.originalDescription),
          matchStatus: selectedProduct ? "matched" : item.matchStatus,
          fulfillmentStatus,
          pickedQuantity: nextQuantity,
          checkedQuantity: nextQuantity,
          checkedUnit: nextUnit,
          shortageQuantity,
          resolutionNote: `${entry.deleted ? "Checked Product delete" : "Checked Product edit"} by ${user.displayName}: ${currentActualName} ${currentActualQuantity} ${currentUnit} → ${entry.deleted ? "Deleted" : `${nextActualName} ${nextQuantity} ${nextUnit}`} • ${editRemark}`,
          substituteProductCode: selectedProduct || entry.deleted ? "" : item.substituteProductCode,
          substituteProductName: selectedProduct || entry.deleted ? "" : item.substituteProductName,
          substituteSku: selectedProduct || entry.deleted ? "" : item.substituteSku,
          substituteSalePrice: selectedProduct || entry.deleted ? 0 : item.substituteSalePrice,
          substituteQuantity: selectedProduct || entry.deleted ? 0 : nextQuantity,
          substitutionStatus: selectedProduct || entry.deleted ? "none" : item.substitutionStatus,
          substitutionReason: selectedProduct || entry.deleted ? "" : item.substitutionReason,
          substitutionProposedBy: selectedProduct || entry.deleted ? "" : item.substitutionProposedBy,
          substitutionProposedAt: selectedProduct || entry.deleted ? "" : item.substitutionProposedAt,
          substitutionConfirmedBy: selectedProduct || entry.deleted ? "" : user.displayName,
          substitutionConfirmedAt: selectedProduct || entry.deleted ? "" : now,
          substitutionReturnedBy: "",
          substitutionReturnedAt: "",
          substitutionReturnReason: "",
          verifiedBy: user.displayName,
          verifiedAt: now,
          updatedAt: now,
        }).where(and(eq(saleOrderItems.id, item.id), eq(saleOrderItems.orderId, current.id)));
      }).filter(Boolean);
      const nextRowByBatch = new Map<number, number>();
      for (const item of currentItems) nextRowByBatch.set(item.batchSequence, Math.max(nextRowByBatch.get(item.batchSequence) || 1, item.originalRowNumber + 1));
      for (const added of addedItems) {
        const originalRowNumber = nextRowByBatch.get(added.batchSequence) || 2;
        nextRowByBatch.set(added.batchSequence, originalRowNumber + 1);
        changedBatchSequences.add(added.batchSequence);
        changes.push(`Add: None → ${added.product.productName} ${added.quantity} ${added.unit}`);
        statements.push(db.insert(saleOrderItems).values({
          orderId: current.id,
          batchSequence: added.batchSequence,
          originalRowNumber,
          originalProductCode: added.product.productCode,
          originalDescription: added.product.productName,
          originalQuantity: "0",
          quantity: added.quantity,
          originalUnit: added.unit,
          checkedUnit: added.unit,
          originalSalePrice: String(added.product.salePrice || 0),
          matchedProductCode: added.product.productCode,
          matchedProductName: added.product.productName,
          matchStatus: "matched",
          fulfillmentStatus: "picked",
          pickedQuantity: added.quantity,
          checkedQuantity: added.quantity,
          shortageQuantity: 0,
          resolutionNote: `Checked Product added by ${user.displayName} • ${editRemark}`,
          verifiedBy: user.displayName,
          verifiedAt: now,
          updatedAt: now,
        }));
      }
      if (!statements.length) return Response.json({ error: "Picked / Checked Result တွင် ပြင်ဆင်ထားသော Product သို့မဟုတ် Quantity မရှိပါ" }, { status: 400 });
      const requiresWarehouseRecheck = isAdmin && awaitingDelivery;
      const orderValues: Partial<typeof orders.$inferInsert> = { updatedBy: user.displayName, updatedAt: now };
      if (requiresWarehouseRecheck) {
        const batches = readWarehouseBatches(current).map((batch) => changedBatchSequences.has(batch.sequence) ? { ...batch, status: "picked" as const, itemCheckedBy: "", itemCheckedAt: "", boxClosedBy: "", boxClosedAt: "", confirmedBy: "", confirmedAt: "" } : batch);
        orderValues.warehouseBatches = JSON.stringify(batches);
        orderValues.warehouseStatus = "picked";
        orderValues.warehouseConfirmedBy = "";
        orderValues.warehouseConfirmedAt = "";
        orderValues.saleApproved = false;
        orderValues.saleApprovedBy = "";
        orderValues.saleApprovedAt = "";
        orderValues.dispatchStatus = "awaiting_warehouse";
      }
      const [guardedOrder] = await db.update(orders).set(orderValues)
        .where(and(eq(orders.id, current.id), eq(orders.updatedAt, current.updatedAt))).returning();
      if (!guardedOrder) return Response.json({ error: "Order status ပြောင်းသွားပါသည်။ Refresh လုပ်ပြီး ပြန်စစ်ပါ" }, { status: 409 });
      await db.batch(statements as [any, ...any[]]);
      const freshItems = await db.select().from(saleOrderItems).where(eq(saleOrderItems.orderId, current.id));
      const afterValue = freshItems.map(actualSnapshot);
      const purchaseSync = await resyncPurchaseRequestAllocationsForOrder({ orderId: current.id, actor: user.displayName });
      const statusBefore = `${current.warehouseStatus}/${current.dispatchStatus}/${current.saleApproved ? "delivery_approved" : "not_approved"}`;
      const statusAfter = `${guardedOrder.warehouseStatus}/${guardedOrder.dispatchStatus}/${guardedOrder.saleApproved ? "delivery_approved" : "not_approved"}`;
      const message = `Checked Products Edited • Before/After: ${changes.join(" • ")} • Reason: ${editRemark}${requiresWarehouseRecheck ? " • Warehouse Recheck Required" : delivered ? " • Delivered Status Preserved" : deliveryStarted ? " • On the Way Status Preserved" : ""}`;
      await db.insert(orderProductAdjustments).values({
        orderId: current.id,
        orderStatusBefore: statusBefore,
        orderStatusAfter: statusAfter,
        beforeValue: JSON.stringify(beforeValue),
        afterValue: JSON.stringify(afterValue),
        changeSummary: changes.join(" • "),
        reason: editRemark,
        warehouseRecheckRequired: requiresWarehouseRecheck,
        stockAdjustmentStatus: requiresWarehouseRecheck ? "warehouse_recheck" : "review_required",
        packageAdjustmentStatus: requiresWarehouseRecheck ? "warehouse_recheck" : "review_required",
        financeAdjustmentStatus: "review_required",
        saleVrAdjustmentStatus: "review_required",
        editedBy: user.displayName,
        editedAt: now,
      });
      await db.insert(orderEvents).values({ orderId: current.id, eventType: action, message, actor: user.displayName });
      const notifyRoles: Array<"warehouse" | "sale" | "delivery" | "finance"> = requiresWarehouseRecheck ? ["warehouse", "sale", "delivery", "finance"] : delivered || deliveryStarted ? ["warehouse", "sale", "delivery", "finance"] : ["sale"];
      await notifyDepartments({ roles: notifyRoles, title: requiresWarehouseRecheck ? "Checked Products ပြင်ပြီး • Warehouse Recheck လိုအပ်" : delivered ? "ပို့ပြီး Order • Checked Products Adjustment" : deliveryStarted ? "On the Way Order • Checked Products ပြင်ထားသည်" : "Checked Products ပြင်ပြီးပါပြီ", message: `${current.customerName} • ${current.orderNo} • ${changes.length} Changes • Stock/Package/Finance/Sale VR Adjustment Record ဖန်တီးပြီး`, targetTab: requiresWarehouseRecheck ? "warehouse" : "dashboard", sourceId: current.id, actor: user.displayName });
      await recordAuditLog(user, { action, entityType: "order", entityId: current.id, summary: `${current.orderNo} • Before/After: ${changes.join(" | ")} • Edited By: ${user.displayName} • Reason: ${editRemark} • ${statusBefore} → ${statusAfter}` });
      if (purchaseSync.quantity > 0) await recordAuditLog(user, { action: "purchase_request_allocation_resynced", entityType: "order", entityId: current.id, summary: `${current.orderNo} • ဝယ်ရန်စာရင်း ${purchaseSync.requestCount} ခု • Qty ${purchaseSync.quantity} ကို Picked/Checked Result နှင့် ပြန်ချိတ်ခဲ့သည်` });
      return Response.json({ order: presentOrder(guardedOrder, freshItems) });
    }

    if (action === "set_substitute_product" || action === "remove_substitute_product") {
      if (!roleAllowed(user.role, ["warehouse"])) return Response.json({ error: "Warehouse Team သာ Similar Product ပြင်နိုင်ပါသည်" }, { status: 403 });
      if (current.saleApproved || ["out_for_delivery", "partial", "delivered", "returned"].includes(current.dispatchStatus)) {
        return Response.json({ error: "Delivery Approved / Delivery စတင်ပြီးသော Order ကို ပြင်နိုင်မည်မဟုတ်ပါ" }, { status: 409 });
      }
      const itemId = cleanCount(payload.itemId);
      const [item] = await db.select().from(saleOrderItems).where(and(eq(saleOrderItems.id, itemId), eq(saleOrderItems.orderId, current.id))).limit(1);
      if (!item) return Response.json({ error: "Order Product Row မတွေ့ပါ" }, { status: 404 });
      const warehouseBatches = readWarehouseBatches(current);
      const batch = warehouseBatches.find((entry) => entry.sequence === item.batchSequence);
      if (!batch || batch.status === "finished") return Response.json({ error: "Warehouse Completed ဖြစ်ပြီးသော Product ကို Similar Product ပြင်နိုင်မည်မဟုတ်ပါ" }, { status: 409 });
      const now = new Date().toISOString();
      let substitutionMessage = "";
      if (action === "remove_substitute_product") {
        await db.update(saleOrderItems).set({
          substituteProductCode: "",
          substituteProductName: "",
          substituteSku: "",
          substituteSalePrice: 0,
          substituteQuantity: 0,
          substitutionStatus: "none",
          substitutionReason: "",
          substitutionProposedBy: "",
          substitutionProposedAt: "",
          substitutionConfirmedBy: "",
          substitutionConfirmedAt: "",
          substitutionReturnedBy: "",
          substitutionReturnedAt: "",
          substitutionReturnReason: "",
          updatedAt: now,
        }).where(eq(saleOrderItems.id, item.id));
        substitutionMessage = `${item.originalDescription} • Similar Product ဖြုတ်ထားသည်`;
      } else {
        if (["unknown", "new_product_requested"].includes(item.matchStatus)) return Response.json({ error: "မူလ Product ကို Resolve လုပ်ပြီးမှ Similar Product ထည့်ပါ" }, { status: 409 });
        const substituteProductId = cleanCount(payload.substituteProductId);
        const substituteQuantity = cleanCount(payload.substituteQuantity);
        const substitutionReason = cleanText(payload.substitutionReason, 300);
        if (!substituteProductId) return Response.json({ error: "Product Master မှ Similar Product ရွေးပါ" }, { status: 400 });
        if (substituteQuantity <= 0 || substituteQuantity > item.quantity) return Response.json({ error: `Similar Product Qty ကို 1 မှ ${item.quantity} အတွင်း ထည့်ပါ` }, { status: 400 });
        if (!substitutionReason) return Response.json({ error: "Similar Product သုံးရသည့် Reason ထည့်ပါ" }, { status: 400 });
        const [substitute] = await db.select().from(productMaster).where(and(eq(productMaster.id, substituteProductId), eq(productMaster.active, true))).limit(1);
        if (!substitute) return Response.json({ error: "Product Master ထဲတွင် Similar Product မတွေ့ပါ" }, { status: 404 });
        const originalCode = normalizeProduct(item.matchedProductCode || item.originalProductCode);
        if (originalCode && normalizeProduct(substitute.productCode) === originalCode) return Response.json({ error: "မူလ Product နှင့် မတူသော Similar Product ကိုရွေးပါ" }, { status: 400 });
        await db.update(saleOrderItems).set({
          substituteProductCode: substitute.productCode,
          substituteProductName: substitute.productName,
          substituteSku: substitute.sku,
          substituteSalePrice: substitute.salePrice,
          substituteQuantity,
          substitutionStatus: "proposed",
          substitutionReason,
          substitutionProposedBy: user.displayName,
          substitutionProposedAt: now,
          substitutionConfirmedBy: "",
          substitutionConfirmedAt: "",
          substitutionReturnedBy: "",
          substitutionReturnedAt: "",
          substitutionReturnReason: "",
          updatedAt: now,
        }).where(eq(saleOrderItems.id, item.id));
        substitutionMessage = `${item.originalDescription} → ${substitute.productName} ${substituteQuantity} ${item.originalUnit || "Unit"} • Similar Product Proposed`;
      }
      await db.insert(orderEvents).values({ orderId: current.id, eventType: action, message: substitutionMessage, actor: user.displayName });
      await recordAuditLog(user, { action, entityType: "sale_order_item", entityId: item.id, summary: `${current.orderNo} • ${substitutionMessage}` });
      const [freshOrder] = await db.select().from(orders).where(eq(orders.id, current.id)).limit(1);
      const itemMap = await itemsForOrders(db, [current.id]);
      return Response.json({ order: presentOrder(freshOrder, itemMap.get(current.id) || []) });
    }

    if (action === "salesman_return_substitution") {
      if (!roleAllowed(user.role, ["sale"])) return Response.json({ error: "Sale Team သာ Similar Product ကို Warehouse သို့ ပြန်ပို့နိုင်ပါသည်" }, { status: 403 });
      if (current.saleApproved) return Response.json({ error: "Delivery Approved မလုပ်ခင်သာ Similar Product ကို ပြန်ပို့နိုင်ပါသည်" }, { status: 409 });
      if (current.warehouseStatus !== "finished") return Response.json({ error: "Warehouse Completed Order ကို Review လုပ်နေချိန်တွင်သာ ပြန်ပို့နိုင်ပါသည်" }, { status: 409 });
      const itemId = cleanCount(payload.itemId);
      const returnReason = cleanText(payload.returnReason, 300);
      if (!returnReason) return Response.json({ error: "Warehouse သို့ ပြန်ပို့ရသည့် Reason ထည့်ပါ" }, { status: 400 });
      const [item] = await db.select().from(saleOrderItems).where(and(eq(saleOrderItems.id, itemId), eq(saleOrderItems.orderId, current.id))).limit(1);
      if (!item || item.substitutionStatus !== "confirmed" || !item.substituteProductCode) return Response.json({ error: "Checker အတည်ပြုထားသော Similar Product မတွေ့ပါ" }, { status: 404 });
      const warehouseBatches = readWarehouseBatches(current);
      const batchIndex = warehouseBatches.findIndex((entry) => entry.sequence === item.batchSequence);
      if (batchIndex < 0) return Response.json({ error: "Sale Order Batch မတွေ့ပါ" }, { status: 404 });
      const now = new Date().toISOString();
      warehouseBatches[batchIndex] = {
        ...warehouseBatches[batchIndex],
        status: "pending",
        itemPackedBy: "",
        itemPackedAt: "",
        itemCheckedBy: "",
        itemCheckedAt: "",
        boxClosedBy: "",
        boxClosedAt: "",
        confirmedBy: "",
        confirmedAt: "",
      };
      await db.update(saleOrderItems).set({
        substitutionStatus: "returned",
        substitutionReturnedBy: user.displayName,
        substitutionReturnedAt: now,
        substitutionReturnReason: returnReason,
        updatedAt: now,
      }).where(eq(saleOrderItems.id, item.id));
      const [freshOrder] = await db.update(orders).set({
        warehouseBatches: JSON.stringify(warehouseBatches),
        warehouseStatus: "processing",
        warehouseConfirmedBy: "",
        warehouseConfirmedAt: "",
        dispatchStatus: "awaiting_warehouse",
        voucherStatus: "pending",
        saleApproved: false,
        saleApprovedBy: "",
        saleApprovedAt: "",
        addonPending: true,
        updatedBy: user.displayName,
        updatedAt: now,
      }).where(eq(orders.id, current.id)).returning();
      const restoredPurchaseRequests = await restoreActivePurchaseRequestAllocations({ orderId: current.id, batchSequence: item.batchSequence, actor: user.displayName });
      const returnMessage = `${item.originalDescription} အတွက် Similar Product ${item.substituteProductName} ကို Salesman ပြန်ပို့သည် • Reason: ${returnReason}`;
      await db.insert(orderEvents).values({ orderId: current.id, eventType: action, message: returnMessage, actor: user.displayName });
      await notifyDepartments({ roles: ["warehouse"], title: "Warehouse Correction Pending", message: `${current.customerName} • ${current.orderNo} • ${item.substituteProductName}`, targetTab: "warehouse", sourceId: current.id, actor: user.displayName });
      await recordAuditLog(user, { action, entityType: "sale_order_item", entityId: item.id, summary: `${current.orderNo} • ${returnMessage}` });
      if (restoredPurchaseRequests.quantity > 0) await recordAuditLog(user, { action: "purchase_request_allocation_restored", entityType: "order", entityId: current.id, summary: `${current.orderNo} Reopen • ဝယ်ရန်စာရင်း ${restoredPurchaseRequests.requestCount} ခု • Qty ${restoredPurchaseRequests.quantity} ပြန်ထည့်ခဲ့သည်` });
      const itemMap = await itemsForOrders(db, [current.id]);
      return Response.json({ order: presentOrder(freshOrder, itemMap.get(current.id) || []) });
    }

    if (action === "start_picking") {
      if (!roleAllowed(user.role, ["warehouse"])) return Response.json({ error: "Warehouse Team သာ Picking စတင်နိုင်ပါသည်" }, { status: 403 });
      if (current.saleApproved || current.warehouseStatus === "finished" || ["out_for_delivery", "partial", "delivered", "returned"].includes(current.dispatchStatus)) {
        return Response.json({ error: "ဒီ Order ကို Picking စတင်နိုင်သည့်အခြေအနေ မဟုတ်ပါ" }, { status: 409 });
      }
      const warehouseBatches = readWarehouseBatches(current);
      const requestedSequence = cleanCount(payload.batchSequence);
      const batchIndex = requestedSequence
        ? warehouseBatches.findIndex((batch) => batch.sequence === requestedSequence && batch.status !== "finished")
        : warehouseBatches.findIndex((batch) => batch.status !== "picked" && batch.status !== "finished");
      if (batchIndex < 0) return Response.json({ error: "Picking စတင်ရန် Pending Sale Order မရှိပါ" }, { status: 409 });
      const existing = warehouseBatches[batchIndex];
      if (existing.status === "picking" && existing.pickingStartedAt) {
        const itemMap = await itemsForOrders(db, [current.id]);
        return Response.json({ order: presentOrder(current, itemMap.get(current.id) || []), alreadyStarted: true });
      }
      if (existing.status !== "pending") return Response.json({ error: "ဒီ Sale Order ကို Picking စတင်ပြီးဖြစ်သည်။ Refresh လုပ်ပြီး ပြန်စစ်ပါ" }, { status: 409 });
      const now = new Date().toISOString();
      warehouseBatches[batchIndex] = { ...existing, status: "picking", pickingStartedBy: user.displayName, pickingStartedAt: now };
      const [freshOrder] = await db.update(orders).set({
        warehouseBatches: JSON.stringify(warehouseBatches),
        warehouseStatus: "processing",
        updatedBy: user.displayName,
        updatedAt: now,
      }).where(and(eq(orders.id, current.id), eq(orders.warehouseBatches, current.warehouseBatches))).returning();
      if (!freshOrder) return Response.json({ error: "အခြား Picker တစ်ဦး စတင်ထားပါပြီ။ Refresh လုပ်ပြီး ပြန်စစ်ပါ" }, { status: 409 });
      const startMessage = `Sale Order #${existing.sequence} • Picking စတင် • Picker: ${user.displayName}`;
      await db.insert(orderEvents).values({ orderId: current.id, eventType: action, message: startMessage, actor: user.displayName });
      await notifyDepartments({ roles: ["sale", "warehouse", "purchase", "delivery", "finance"], title: "Processing — Picking လုပ်နေပါပြီ", message: `${current.customerName} • ${current.orderNo} • ${user.displayName}`, targetTab: "warehouse", sourceId: current.id, actor: user.displayName });
      await recordAuditLog(user, { action, entityType: "order", entityId: current.id, summary: `${current.orderNo} • ${startMessage}` });
      const itemMap = await itemsForOrders(db, [current.id]);
      return Response.json({ order: presentOrder(freshOrder, itemMap.get(current.id) || []) });
    }

    if (action === "confirm_pickup_items") {
      if (!roleAllowed(user.role, ["warehouse"])) return Response.json({ error: "Warehouse Team သာ Product Pickup အတည်ပြုနိုင်ပါသည်" }, { status: 403 });
      if (current.saleApproved || ["out_for_delivery", "partial", "delivered", "returned"].includes(current.dispatchStatus)) {
        return Response.json({ error: "Ready to Deliver / Delivery စတင်ပြီးသော Order ကို မပြင်နိုင်ပါ။ လိုအပ်ပါက Return Workflow သုံးပါ" }, { status: 409 });
      }
      const batchSequence = cleanCount(payload.batchSequence);
      const pickedItemIds = new Set(Array.isArray(payload.pickedItemIds) ? payload.pickedItemIds.map(cleanCount).filter(Boolean).slice(0, 500) : []);
      const pickedQuantityById = new Map<number, number>();
      if (Array.isArray(payload.pickedQuantities)) {
        for (const raw of payload.pickedQuantities.slice(0, 500)) {
          if (!raw || typeof raw !== "object") continue;
          const entry = raw as Record<string, unknown>;
          const itemId = cleanCount(entry.itemId);
          if (itemId) pickedQuantityById.set(itemId, cleanCount(entry.quantity));
        }
      }
      const batchItems = await db.select().from(saleOrderItems).where(and(eq(saleOrderItems.orderId, current.id), eq(saleOrderItems.batchSequence, batchSequence)));
      if (!batchItems.length) return Response.json({ error: "Sale Order Product Rows မတွေ့ပါ" }, { status: 404 });
      const validIds = new Set(batchItems.map((item) => item.id));
      if ([...pickedItemIds].some((itemId) => !validIds.has(itemId))) return Response.json({ error: "ရွေးထားသော Product Row မမှန်ပါ။ Refresh လုပ်ပြီး ပြန်စစ်ပါ" }, { status: 400 });
      const pickableItems = batchItems.filter((item) => !["unknown", "new_product_requested", "unavailable"].includes(item.matchStatus));
      const pickableIds = new Set(pickableItems.map((item) => item.id));
      if ([...pickedItemIds].some((itemId) => !pickableIds.has(itemId))) return Response.json({ error: "Unknown / Unavailable Product ကို Pickup မရွေးနိုင်ပါ" }, { status: 400 });
      const unresolved = batchItems.filter((item) => ["unknown", "new_product_requested"].includes(item.matchStatus));
      if (unresolved.length) return Response.json({ error: `Unknown Product ${unresolved.length} Rows ကို Resolve လုပ်ပြီးမှ ပစ္စည်းထည့်ခြင်း ပြီးဆုံးနိုင်ပါသည်` }, { status: 409 });
      if (pickableItems.some((item) => !pickedItemIds.has(item.id))) return Response.json({ error: "ရရှိနိုင်သော Product အားလုံးကို Picked အဖြစ်ရွေးပါ" }, { status: 400 });
      const pickedCount = pickableItems.filter((item) => pickedItemIds.has(item.id) && Math.min(item.quantity, pickedQuantityById.get(item.id) ?? item.quantity) > 0).length;
      const now = new Date().toISOString();
      const statements = pickableItems.map((item) => {
        const picked = pickedItemIds.has(item.id);
        const pickedQuantity = picked ? Math.min(item.quantity, pickedQuantityById.get(item.id) ?? item.quantity) : 0;
        const shortageQuantity = Math.max(0, item.quantity - pickedQuantity);
        const fulfillmentStatus = pickedQuantity >= item.quantity ? "picked" : pickedQuantity > 0 ? "shortage" : "unavailable";
        return db.update(saleOrderItems).set({
          fulfillmentStatus,
          pickedQuantity,
          checkedQuantity: -1,
          shortageQuantity,
          resolutionNote: fulfillmentStatus === "picked" ? "Pickup confirmed" : fulfillmentStatus === "shortage" ? `Warehouse quantity changed: ${item.quantity} → ${pickedQuantity}` : "Warehouse confirmed unavailable",
          verifiedBy: user.displayName,
          verifiedAt: now,
          updatedAt: now,
        }).where(and(eq(saleOrderItems.id, item.id), eq(saleOrderItems.orderId, current.id)));
      });
      if (statements.length) await db.batch(statements as [any, ...any[]]);
      const warehouseBatches = readWarehouseBatches(current);
      const batchIndex = warehouseBatches.findIndex((batch) => batch.sequence === batchSequence);
      if (batchIndex < 0) return Response.json({ error: "Sale Order အမှတ် မတွေ့ပါ" }, { status: 400 });
      warehouseBatches[batchIndex] = {
        ...warehouseBatches[batchIndex],
        status: "picked",
        itemPackedBy: user.displayName,
        itemPackedAt: now,
        itemCheckedBy: "",
        itemCheckedAt: "",
      };
      const allPicked = warehouseBatches.every((batch) => batch.status === "picked" || batch.status === "finished");
      const [freshOrder] = await db.update(orders).set({
        warehouseBatches: JSON.stringify(warehouseBatches),
        warehouseStatus: allPicked ? "picked" : "processing",
        updatedBy: user.displayName,
        updatedAt: now,
      }).where(eq(orders.id, current.id)).returning();
      const pickupMessage = `Sale Order #${batchSequence} • Pickup ${pickedCount}/${pickableItems.length} Products ပြီးဆုံး • Picker: ${user.displayName}`;
      await db.insert(orderEvents).values({ orderId: current.id, eventType: action, message: pickupMessage, actor: user.displayName });
      await recordAuditLog(user, { action, entityType: "sale_order_items", entityId: `${current.id}:${batchSequence}`, summary: `${current.orderNo} • ${pickupMessage}` });
      const itemMap = await itemsForOrders(db, [current.id]);
      return Response.json({ order: presentOrder(freshOrder, itemMap.get(current.id) || []) });
    }

    if (action === "admin_delete_unmatched_item" || action === "admin_substitute_unmatched_item") {
      if (user.role !== "admin") return Response.json({ error: "Admin သာ Inventory Matching မဖြစ်သော Product ကို Delete / Substitute လုပ်နိုင်ပါသည်" }, { status: 403 });
      if (current.saleApproved || ["out_for_delivery", "partial", "delivered", "returned"].includes(current.dispatchStatus)) {
        return Response.json({ error: "Ready to Deliver / Delivery စတင်ပြီးသော Order ကို မပြင်နိုင်ပါ" }, { status: 409 });
      }
      const itemId = cleanCount(payload.itemId);
      const [item] = await db.select().from(saleOrderItems).where(and(eq(saleOrderItems.id, itemId), eq(saleOrderItems.orderId, current.id))).limit(1);
      if (!item) return Response.json({ error: "Order Product Row မတွေ့ပါ" }, { status: 404 });
      if (!["unknown", "new_product_requested"].includes(item.matchStatus)) {
        return Response.json({ error: "Inventory Matching မဖြစ်သေးသော Product ကိုသာ ဒီနေရာမှ ပြင်နိုင်ပါသည်" }, { status: 409 });
      }
      const warehouseBatches = readWarehouseBatches(current);
      const batch = warehouseBatches.find((entry) => entry.sequence === item.batchSequence);
      if (!batch || batch.status === "finished") return Response.json({ error: "Warehouse Completed ဖြစ်ပြီးသော Sale Order Product ကို မပြင်နိုင်ပါ" }, { status: 409 });

      const now = new Date().toISOString();
      let eventMessage = "";
      if (action === "admin_delete_unmatched_item") {
        const batchItems = await db.select({ id: saleOrderItems.id }).from(saleOrderItems).where(and(eq(saleOrderItems.orderId, current.id), eq(saleOrderItems.batchSequence, item.batchSequence)));
        if (batchItems.length <= 1) return Response.json({ error: "Sale Order ထဲက နောက်ဆုံး Product ကို မဖျက်နိုင်ပါ။ လိုအပ်ပါက Order တစ်ခုလုံးကို ဖျက်ပါ" }, { status: 409 });
        await db.delete(saleOrderItems).where(and(eq(saleOrderItems.id, item.id), eq(saleOrderItems.orderId, current.id)));
        eventMessage = `Admin Deleted Unmatched Product • Row ${item.originalRowNumber} • ${item.originalProductCode || "No Code"} • ${item.originalDescription} • Qty ${item.originalQuantity}`;
      } else {
        const substituteProductId = cleanCount(payload.substituteProductId);
        const substitutionReason = cleanText(payload.substitutionReason, 300) || "Inventory Matching မဖြစ်သော Product ကို Admin မှ Similar Product ဖြင့် အစားထိုးခဲ့သည်";
        if (!substituteProductId) return Response.json({ error: "Product Master မှ Similar Product ရွေးပါ" }, { status: 400 });
        const [substitute] = await db.select().from(productMaster).where(and(eq(productMaster.id, substituteProductId), eq(productMaster.active, true))).limit(1);
        if (!substitute) return Response.json({ error: "Product Master ထဲတွင် Similar Product မတွေ့ပါ" }, { status: 404 });
        await db.update(saleOrderItems).set({
          matchStatus: "matched",
          fulfillmentStatus: "pending",
          pickedQuantity: 0,
          checkedQuantity: -1,
          shortageQuantity: 0,
          resolutionNote: substitutionReason,
          substituteProductCode: substitute.productCode,
          substituteProductName: substitute.productName,
          substituteSku: substitute.sku,
          substituteSalePrice: substitute.salePrice,
          substituteQuantity: item.quantity,
          substitutionStatus: "confirmed",
          substitutionReason,
          substitutionProposedBy: user.displayName,
          substitutionProposedAt: now,
          substitutionConfirmedBy: user.displayName,
          substitutionConfirmedAt: now,
          substitutionReturnedBy: "",
          substitutionReturnedAt: "",
          substitutionReturnReason: "",
          verifiedBy: user.displayName,
          verifiedAt: now,
          updatedAt: now,
        }).where(and(eq(saleOrderItems.id, item.id), eq(saleOrderItems.orderId, current.id)));
        eventMessage = `Admin Substitute • ${item.originalProductCode || "No Code"} ${item.originalDescription} → ${substitute.productCode} ${substitute.productName} • Qty ${item.quantity}`;
      }

      const [freshOrder] = await db.update(orders).set({ updatedBy: user.displayName, updatedAt: now }).where(eq(orders.id, current.id)).returning();
      await db.insert(orderEvents).values({ orderId: current.id, eventType: action, message: eventMessage, actor: user.displayName });
      await recordAuditLog(user, { action, entityType: "sale_order_item", entityId: item.id, summary: `${current.orderNo} • ${eventMessage}` });
      const itemMap = await itemsForOrders(db, [current.id]);
      return Response.json({ order: presentOrder(freshOrder, itemMap.get(current.id) || []) });
    }

    if (action === "resolve_order_item" || action === "update_order_item") {
      if (!roleAllowed(user.role, ["warehouse"])) return Response.json({ error: "Warehouse Team သာ Product Row စစ်ဆေးနိုင်ပါသည်" }, { status: 403 });
      if (current.saleApproved || ["out_for_delivery", "partial", "delivered", "returned"].includes(current.dispatchStatus)) {
        return Response.json({ error: "Ready to Deliver / Delivery စတင်ပြီးသော Order ကို မပြင်နိုင်ပါ။ လိုအပ်ပါက Return Workflow သုံးပါ" }, { status: 409 });
      }
      const itemId = cleanCount(payload.itemId);
      const [item] = await db.select().from(saleOrderItems).where(and(eq(saleOrderItems.id, itemId), eq(saleOrderItems.orderId, current.id))).limit(1);
      if (!item) return Response.json({ error: "Order Product Row မတွေ့ပါ" }, { status: 404 });
      if (action === "resolve_order_item") {
        const resolution = cleanText(payload.resolution, 40);
        const resolutionNote = cleanText(payload.resolutionNote, 300);
        const now = new Date().toISOString();
        if (resolution === "match") {
          const matchedProductId = cleanCount(payload.matchedProductId);
          const matchedProductCode = cleanText(payload.matchedProductCode, 120);
          const matchedProductName = cleanText(payload.matchedProductName, 240);
          if (!matchedProductCode && !matchedProductName) return Response.json({ error: "Matched Product Code သို့မဟုတ် Product Name ထည့်ပါ" }, { status: 400 });
          const [masterProduct] = matchedProductId
            ? await db.select().from(productMaster).where(and(eq(productMaster.id, matchedProductId), eq(productMaster.active, true))).limit(1)
            : await db.select().from(productMaster).where(and(eq(productMaster.productCode, matchedProductCode.toLocaleUpperCase()), eq(productMaster.active, true))).limit(1);
          if (!masterProduct) return Response.json({ error: "Product Master ထဲက Product ကို Search & Select လုပ်ပါ" }, { status: 400 });
          await db.update(saleOrderItems).set({ matchedProductCode: masterProduct.productCode, matchedProductName: masterProduct.productName, matchStatus: "matched", fulfillmentStatus: "pending", pickedQuantity: 0, checkedQuantity: -1, shortageQuantity: 0, resolutionNote, verifiedBy: user.displayName, verifiedAt: now, updatedAt: now }).where(eq(saleOrderItems.id, item.id));
        } else if (resolution === "new_product_requested") {
          await db.update(saleOrderItems).set({ matchStatus: "new_product_requested", resolutionNote: resolutionNote || "Authorized new product request", verifiedBy: user.displayName, verifiedAt: now, updatedAt: now }).where(eq(saleOrderItems.id, item.id));
        } else if (resolution === "unavailable") {
          await db.update(saleOrderItems).set({ matchStatus: "unavailable", fulfillmentStatus: "unavailable", pickedQuantity: 0, checkedQuantity: -1, shortageQuantity: item.quantity, resolutionNote: resolutionNote || "Warehouse confirmed unavailable", verifiedBy: user.displayName, verifiedAt: now, updatedAt: now }).where(eq(saleOrderItems.id, item.id));
        } else {
          return Response.json({ error: "Invalid unknown-product resolution" }, { status: 400 });
        }
      } else {
        if (["unknown", "new_product_requested"].includes(item.matchStatus)) return Response.json({ error: "Unknown Product ကို Resolve လုပ်ပြီးမှ Picking လုပ်နိုင်ပါသည်" }, { status: 409 });
        const pickedQuantity = Math.min(item.quantity, cleanCount(payload.pickedQuantity));
        const shortageQuantity = Math.max(0, item.quantity - pickedQuantity);
        const fulfillmentStatus = pickedQuantity >= item.quantity ? "picked" : pickedQuantity > 0 ? "shortage" : "unavailable";
        const now = new Date().toISOString();
        await db.update(saleOrderItems).set({ pickedQuantity, checkedQuantity: -1, shortageQuantity, fulfillmentStatus, resolutionNote: cleanText(payload.resolutionNote, 300), verifiedBy: user.displayName, verifiedAt: now, updatedAt: now }).where(eq(saleOrderItems.id, item.id));
      }
      const [freshOrder] = await db.select().from(orders).where(eq(orders.id, current.id)).limit(1);
      const itemMap = await itemsForOrders(db, [current.id]);
      const freshItems = itemMap.get(current.id) || [];
      await db.insert(orderEvents).values({ orderId: current.id, eventType: action, message: `${item.originalDescription} • ${action === "resolve_order_item" ? "Product resolution updated" : "Picking quantity updated"}`, actor: user.displayName });
      await recordAuditLog(user, { action, entityType: "sale_order_item", entityId: item.id, summary: `${current.orderNo} • Row ${item.originalRowNumber} • ${item.originalDescription}` });
      return Response.json({ order: presentOrder(freshOrder, freshItems) });
    }

    const values: Partial<typeof orders.$inferInsert> = {
      updatedBy: user.displayName,
      updatedAt: new Date().toISOString(),
    };
    let departmentNotification: Parameters<typeof notifyDepartments>[0] | null = null;
    const additionalNotifications: Array<Parameters<typeof notifyDepartments>[0]> = [];
    let saleApprovedToBuyItems: Array<{ orderItemId: number; productName: string; productCode: string; quantity: number; unit: string; batchSequence: number }> = [];
    let purchaseReconcileBatchSequence = 0;
    let message = "Order updated";

    if (action === "route_salesperson") {
      if (!roleAllowed(user.role, ["sale"])) {
        return Response.json({ error: "Admin / Sale Team သာ Route နှင့် Sale Man ပြင်နိုင်ပါသည်" }, { status: 403 });
      }
      const route = cleanText(payload.route, 40);
      const salesperson = cleanText(payload.salesperson, 80);
      const editRemark = cleanText(payload.editRemark, 300);
      if (!editRemark) return Response.json({ error: "ပြင်ဆင်ရသည့်အကြောင်းရင်း Remark ထည့်ပါ" }, { status: 400 });
      if (!ROUTES.includes(route)) {
        return Response.json({ error: "Valid Route ကို ရွေးပါ" }, { status: 400 });
      }
      if (!SALE_PEOPLE.includes(salesperson)) {
        return Response.json({ error: "Valid Sale Man ကို ရွေးပါ" }, { status: 400 });
      }
      const isDeliveryStageEdit = current.saleApproved && ROUTE_SALESPERSON_DELIVERY_EDIT_STATUSES.includes(current.dispatchStatus);
      const isPreDeliveryEdit = !current.saleApproved && !["out_for_delivery", "partial", "delivered", "returned"].includes(current.dispatchStatus);
      if (!isPreDeliveryEdit && !isDeliveryStageEdit) {
        return Response.json({ error: "ပို့ရန်ကျန် / On the Way Sale Order များကိုသာ Route / Sale Man ပြင်နိုင်ပါသည်" }, { status: 409 });
      }
      const [conflictingOrder] = await db.select({ id: orders.id }).from(orders).where(and(
        eq(orders.orderDate, current.orderDate),
        eq(orders.customerKey, current.customerKey),
        eq(orders.route, route),
        ne(orders.id, current.id),
      )).limit(1);
      if (conflictingOrder) {
        return Response.json({ error: "ဒီ Customer + Route အတွက် ဒီနေ့ Sale Order ရှိပြီးသားဖြစ်ပါသည်" }, { status: 409 });
      }
      const salespersonChanged = salesperson !== current.salesperson;
      const warehouseBatches = readWarehouseBatches(current).map((batch) => ({
        ...batch,
        salesperson,
        // A delivery-stage metadata correction must not reopen Warehouse or
        // change the order's current delivery state.
        status: salespersonChanged && !isDeliveryStageEdit ? "pending" as const : batch.status,
      }));
      values.route = route;
      values.salesperson = salesperson;
      values.warehouseBatches = JSON.stringify(warehouseBatches);
      if (salespersonChanged && !isDeliveryStageEdit) {
        values.warehouseStatus = "processing";
        values.dispatchStatus = "awaiting_warehouse";
        values.voucherStatus = "pending";
        values.saleApproved = false;
        values.saleApprovedBy = "";
        values.saleApprovedAt = "";
        values.addonPending = true;
      }
      message = `Route / Sale Man ပြောင်း: ${current.route} / ${current.salesperson} → ${route} / ${salesperson} • Remark: ${editRemark}`;
      departmentNotification = { roles: ["sale", "warehouse", "purchase", "delivery", "finance"], title: "Sale Order Route / Sale Man ပြောင်းထားပါသည်", message: `${current.customerName} • ${current.orderNo} • ${route} • ${salesperson}`, targetTab: "dashboard", sourceId: current.id, actor: user.displayName };
    } else if (action === "customer") {
      if (!roleAllowed(user.role, ["sale"])) {
        return Response.json({ error: "Admin / Sale Team သာ Customer Name ပြင်နိုင်ပါသည်" }, { status: 403 });
      }
      const customerName = cleanText(payload.customerName);
      const township = cleanText(payload.township, 120);
      const editRemark = cleanText(payload.editRemark, 300);
      if (!editRemark) return Response.json({ error: "ပြင်ဆင်ရသည့်အကြောင်းရင်း Remark ထည့်ပါ" }, { status: 400 });
      if (!customerName) {
        return Response.json({ error: "Customer Name ရွေးပါ" }, { status: 400 });
      }
      const selectedCustomer = await resolveCustomerSelection(customerName, township);
      if (!selectedCustomer) {
        return Response.json({ error: "Customers Database ထဲက Customer ကို ရွေးချယ်ပါ" }, { status: 400 });
      }
      const customerKey = selectedCustomer.customerKey;
      const [conflictingOrder] = await db.select({ id: orders.id }).from(orders).where(and(
        eq(orders.orderDate, current.orderDate),
        eq(orders.customerKey, customerKey),
        eq(orders.route, current.route),
        ne(orders.id, current.id),
      )).limit(1);
      if (conflictingOrder) {
        return Response.json({ error: "ဒီ Customer + Route အတွက် ဒီနေ့ Sale Order ရှိပြီးသားဖြစ်ပါသည်" }, { status: 409 });
      }
      values.customerName = customerName;
      values.township = township;
      values.customerKey = customerKey;
      message = `Customer ပြောင်း: ${current.customerName} (${current.township || "Township မရှိ"}) → ${customerName} (${township || "Township မရှိ"}) • Remark: ${editRemark}`;
      departmentNotification = { roles: ["warehouse", "purchase", "delivery", "finance"], title: "Sale Order Customer ပြောင်းထားပါသည်", message: `${current.orderNo} • ${current.customerName} → ${customerName}`, targetTab: "dashboard", sourceId: current.id, actor: user.displayName };
    } else if (action === "warehouse") {
      if (!roleAllowed(user.role, ["warehouse"])) {
        return Response.json({ error: "Warehouse Team သာ အရေအတွက်ဖြည့်နိုင်ပါသည်" }, { status: 403 });
      }
      if (current.saleApproved || ["out_for_delivery", "partial", "delivered", "returned"].includes(current.dispatchStatus)) {
        return Response.json({ error: "Ready to Deliver / Delivery စတင်ပြီးသော Order ကို မပြင်နိုင်ပါ။ လိုအပ်ပါက Return Workflow သုံးပါ" }, { status: 409 });
      }
      const batchSequence = cleanCount(payload.batchSequence);
      const batchItems = await db.select().from(saleOrderItems).where(and(eq(saleOrderItems.orderId, current.id), eq(saleOrderItems.batchSequence, batchSequence)));
      const unresolved = batchItems.filter((item) => ["unknown", "new_product_requested"].includes(item.matchStatus));
      if (unresolved.length) return Response.json({ error: `Unknown Product ${unresolved.length} Rows ကို Resolve လုပ်ပြီးမှ Warehouse Finished လုပ်နိုင်ပါသည်` }, { status: 409 });
      const unprocessed = batchItems.filter((item) => item.fulfillmentStatus === "pending");
      if (unprocessed.length) return Response.json({ error: `Product ${unprocessed.length} Rows အတွက် Picked Qty အတည်ပြုပြီးမှ Warehouse Finished လုပ်နိုင်ပါသည်` }, { status: 409 });
      const returnedSubstitutions = batchItems.filter((item) => item.substitutionStatus === "returned");
      if (returnedSubstitutions.length) return Response.json({ error: `Salesman ပြန်ပို့ထားသော Similar Product ${returnedSubstitutions.length} ခုကို ပြင်ဆင် သို့မဟုတ် ဖြုတ်ပြီးမှ Warehouse Finished လုပ်နိုင်ပါသည်` }, { status: 409 });
      const checkedItemIds = new Set(Array.isArray(payload.checkedItemIds) ? payload.checkedItemIds.map(cleanCount).filter(Boolean).slice(0, 500) : []);
      const checkedQuantityById = new Map<number, number>();
      if (Array.isArray(payload.checkedQuantities)) {
        for (const raw of payload.checkedQuantities.slice(0, 500)) {
          if (!raw || typeof raw !== "object") continue;
          const entry = raw as Record<string, unknown>;
          const itemId = cleanCount(entry.itemId);
          if (itemId) checkedQuantityById.set(itemId, cleanCount(entry.quantity));
        }
      }
      const checkableItems = batchItems.filter((item) => !["unknown", "new_product_requested"].includes(item.matchStatus));
      const checkableIds = new Set(checkableItems.map((item) => item.id));
      if ([...checkedItemIds].some((itemId) => !checkableIds.has(itemId))) return Response.json({ error: "Checker ရွေးထားသော Product Row မမှန်ပါ။ Refresh လုပ်ပြီး ပြန်စစ်ပါ" }, { status: 400 });
      if (checkableItems.some((item) => !checkedItemIds.has(item.id))) return Response.json({ error: "Product Rows အားလုံးကို Checker မှ စစ်ပြီး အမှန်ခြစ်ပါ" }, { status: 400 });
      const boxes = cleanCount(payload.boxes);
      const bundles = cleanCount(payload.bundles);
      const boxClosedBy = cleanText(payload.boxClosedBy, 120);
      if (!WAREHOUSE_STAFF.includes(boxClosedBy)) {
        return Response.json({ error: "ပုံးပိတ်သူကို ရွေးပါ" }, { status: 400 });
      }
      const warehouseBatches = readWarehouseBatches(current);
      const batchIndex = warehouseBatches.findIndex((batch) => batch.sequence === batchSequence);
      if (batchIndex < 0) {
        return Response.json({ error: "Sale Order အမှတ် မတွေ့ပါ" }, { status: 400 });
      }
      if (warehouseBatches[batchIndex].status !== "picked") {
        return Response.json({ error: "Picker မှ ပစ္စည်းထည့်ခြင်း ပြီးဆုံးပြီးမှ Checker စစ်နိုင်ပါသည်" }, { status: 409 });
      }
      const itemPackedBy = warehouseBatches[batchIndex].itemPackedBy;
      const itemCheckedBy = user.displayName;
      if (!itemPackedBy) return Response.json({ error: "Picker မှတ်တမ်း မတွေ့ပါ။ Pickup ကို ပြန်အတည်ပြုပါ" }, { status: 409 });
      const requestedPackageMode = cleanText(payload.packageMode, 20);
      const packageMode = requestedPackageMode === "original" || requestedPackageMode === "new"
          ? requestedPackageMode
          : warehouseBatches[batchIndex].packageMode === "original" || warehouseBatches[batchIndex].packageMode === "new"
            ? warehouseBatches[batchIndex].packageMode
            : "";
      if (!packageMode) {
        return Response.json({ error: "Package အသစ်လုပ်မည် သို့မဟုတ် မူလ Package ထဲပေါင်းမည်ကို Warehouse မှ ရွေးပါ" }, { status: 400 });
      }
      if (packageMode === "new" && boxes + bundles === 0) {
        return Response.json({ error: "Package အသစ်အတွက် ဘုံး သို့မဟုတ် ဆွဲ အရေအတွက်ထည့်ပါ" }, { status: 400 });
      }
      if (packageMode === "original" && batchSequence > 1) {
        const hasOriginalPackage = warehouseBatches.some((batch) =>
          batch.sequence < batchSequence
          && batch.status === "finished"
          && (batch.packageMode === "original" || batch.boxes + batch.bundles > 0),
        );
        if (!hasOriginalPackage) {
          return Response.json({ error: "နောက်တိုး Order ထည့်ပေါင်းရန် Finished ဖြစ်သော မူလ Package မတွေ့ပါ" }, { status: 409 });
        }
      }
      let linkedPackageOrder: OrderRow | undefined;
      if (packageMode === "original" && batchSequence === 1) {
        const linkedOrderId = cleanCount(payload.linkedOrderId);
        if (!linkedOrderId || linkedOrderId === current.id) {
          return Response.json({ error: "အနီးဆုံး Order ၏ မူလ Package ထဲပေါင်းရန် Order ကို ရွေးပါ" }, { status: 400 });
        }
        const [candidate] = await db.select().from(orders).where(eq(orders.id, linkedOrderId)).limit(1);
        if (!candidate || candidate.customerKey !== current.customerKey || normalizeCustomer(candidate.township) !== normalizeCustomer(current.township) || candidate.route !== current.route) {
          return Response.json({ error: "Package ချိတ်ရန်ရွေးထားသော Order သည် ဒီ Customer / Route နှင့် မကိုက်ညီပါ" }, { status: 409 });
        }
        if (ADDON_BLOCKED_STATUSES.includes(candidate.dispatchStatus)) {
          return Response.json({ error: "On the way / ပို့ပြီး / Delivery စတင်ပြီးသော Order ၏ Package ထဲ မပေါင်းနိုင်ပါ" }, { status: 409 });
        }
        linkedPackageOrder = candidate;
      }
      const now = new Date().toISOString();
      const checkerQuantityStatements = checkableItems.map((item) => {
        const checkedQuantity = Math.min(item.quantity, checkedQuantityById.get(item.id) ?? item.pickedQuantity);
        const shortageQuantity = Math.max(0, item.quantity - checkedQuantity);
        const fulfillmentStatus = checkedQuantity >= item.quantity ? "picked" : checkedQuantity > 0 ? "shortage" : "unavailable";
        return db.update(saleOrderItems).set({
          checkedQuantity,
          shortageQuantity,
          fulfillmentStatus,
          resolutionNote: checkedQuantity === item.pickedQuantity
            ? item.resolutionNote
            : `Checker actual quantity: ${item.pickedQuantity} → ${checkedQuantity}`,
          verifiedBy: user.displayName,
          verifiedAt: now,
          updatedAt: now,
        }).where(eq(saleOrderItems.id, item.id));
      });
      const proposedSubstitutions = batchItems.filter((item) => item.substitutionStatus === "proposed");
      const confirmStatements = proposedSubstitutions.map((item) => db.update(saleOrderItems).set({
          substitutionStatus: "confirmed",
          substitutionConfirmedBy: user.displayName,
          substitutionConfirmedAt: now,
          updatedAt: now,
        }).where(eq(saleOrderItems.id, item.id)));
      const itemStatements = [...checkerQuantityStatements, ...confirmStatements];
      if (itemStatements.length) await db.batch(itemStatements as [any, ...any[]]);
      warehouseBatches[batchIndex] = {
        ...warehouseBatches[batchIndex],
        packageMode,
        label: linkedPackageOrder ? "Separate Order • မူလ Package ထဲပေါင်းမည်" : batchSequence === 1 ? undefined : warehouseBatches[batchIndex].label,
        linkedOrderId: linkedPackageOrder?.id,
        linkedOrderNo: linkedPackageOrder?.orderNo,
        linkedOrderDate: linkedPackageOrder?.orderDate,
        plannedPackages: 0,
        boxes: packageMode === "original" ? 0 : boxes,
        bundles: packageMode === "original" ? 0 : bundles,
        status: "finished",
        itemPackedBy,
        itemPackedAt: warehouseBatches[batchIndex].itemPackedAt,
        itemCheckedBy,
        itemCheckedAt: now,
        boxClosedBy,
        boxClosedAt: warehouseBatches[batchIndex].boxClosedBy === boxClosedBy && warehouseBatches[batchIndex].boxClosedAt ? warehouseBatches[batchIndex].boxClosedAt : now,
        confirmedBy: user.displayName,
        confirmedAt: now,
      };
      const allFinished = warehouseBatches.every((batch) => batch.status === "finished");
      values.initialBoxes = warehouseBatches.reduce((sum, batch) => sum + batch.boxes, 0);
      values.initialBundles = warehouseBatches.reduce((sum, batch) => sum + batch.bundles, 0);
      values.addonBoxes = 0;
      values.addonBundles = 0;
      values.warehouseBatches = JSON.stringify(warehouseBatches);
      values.voucherStatus = current.voucherAmount > 0 ? "updated" : "pending";
      values.saleApproved = false;
      values.saleApprovedBy = "";
      values.saleApprovedAt = "";
      values.warehouseStatus = allFinished ? "finished" : warehouseBatches.every((batch) => batch.status === "picked" || batch.status === "finished") ? "picked" : "processing";
      values.warehouseConfirmedBy = allFinished ? user.displayName : current.warehouseConfirmedBy;
      values.warehouseConfirmedAt = allFinished ? now : current.warehouseConfirmedAt;
      values.dispatchStatus = allFinished ? "packed" : "awaiting_warehouse";
      values.addonPending = !allFinished;
      purchaseReconcileBatchSequence = batchSequence;
      message = `Warehouse Order #${batchSequence}: ${packageMode === "original" ? `${linkedPackageOrder ? `${linkedPackageOrder.orderNo} • ` : ""}မူလ Package ထဲပေါင်း • Package count မတိုး` : `${boxes} ဘုံး / ${bundles} ဆွဲ • Package အသစ်`} • Picker: ${itemPackedBy} • Checker: ${itemCheckedBy} • ပုံးပိတ်: ${boxClosedBy}`;
      if (allFinished) departmentNotification = { roles: ["sale"], title: "Warehouse Finished ဖြစ်ပါပြီ", message: `${current.customerName} • ${current.orderNo} • Voucher ဖြည့်ရန်`, targetTab: "sale", sourceId: current.id, actor: user.displayName };
    } else if (action === "salesman_review_approve") {
      if (!roleAllowed(user.role, ["sale"])) {
        return Response.json({ error: "Sale Team သာ Warehouse Completed Order ကို Review & Delivery Approved လုပ်နိုင်ပါသည်" }, { status: 403 });
      }
      if (current.saleApproved) return Response.json({ error: "ဒီ Order ကို Delivery Approved လုပ်ပြီးဖြစ်ပါသည်" }, { status: 409 });
      if (current.warehouseStatus !== "finished") {
        return Response.json({ error: "Warehouse Picker နှင့် Checker ပြီးဆုံးပြီးမှ Review & Delivery Approved လုပ်နိုင်ပါသည်" }, { status: 409 });
      }
      const pendingItems = await db.select().from(saleOrderItems).where(and(eq(saleOrderItems.orderId, current.id), inArray(saleOrderItems.fulfillmentStatus, ["pending"])));
      const unresolvedItems = await db.select().from(saleOrderItems).where(and(eq(saleOrderItems.orderId, current.id), inArray(saleOrderItems.matchStatus, ["unknown", "new_product_requested"])));
      if (pendingItems.length || unresolvedItems.length) return Response.json({ error: "Product Rows အားလုံး Warehouse Verification ပြီးမှ Delivery Approved လုပ်နိုင်ပါသည်" }, { status: 409 });
      const substitutionItems = await db.select().from(saleOrderItems).where(eq(saleOrderItems.orderId, current.id));
      const unconfirmedSubstitutions = substitutionItems.filter((item) => item.substitutionStatus !== "none" && item.substitutionStatus !== "confirmed");
      if (unconfirmedSubstitutions.length) return Response.json({ error: "Similar Products အားလုံး Checker Confirm ပြီးမှ Delivery Approved လုပ်နိုင်ပါသည်" }, { status: 409 });
      const toBuyQuantityById = new Map<number, number>();
      if (Array.isArray(payload.toBuyItems)) {
        for (const raw of payload.toBuyItems.slice(0, 500)) {
          if (!raw || typeof raw !== "object") continue;
          const entry = raw as Record<string, unknown>;
          const itemId = cleanCount(entry.itemId);
          if (itemId) toBuyQuantityById.set(itemId, cleanCount(entry.quantity));
        }
      }
      saleApprovedToBuyItems = substitutionItems
        .filter((item) => item.shortageQuantity > 0)
        .map((item) => ({
          orderItemId: item.id,
          productName: item.originalDescription,
          productCode: item.originalProductCode,
          quantity: toBuyQuantityById.has(item.id) ? toBuyQuantityById.get(item.id)! : item.shortageQuantity,
          unit: item.originalUnit || "Unit",
          batchSequence: item.batchSequence,
        }))
        .filter((item) => item.quantity > 0);
      const warehouseBatches = readWarehouseBatches(current);
      const rawVoucherAmounts = Array.isArray(payload.voucherAmounts) ? payload.voucherAmounts : [];
      let voucherAmount = 0;
      if (warehouseBatches.length > 1) {
        const voucherBySequence = new Map<number, unknown>();
        for (const item of rawVoucherAmounts) {
          if (!item || typeof item !== "object") continue;
          const entry = item as Record<string, unknown>;
          voucherBySequence.set(cleanCount(entry.sequence), entry.amount);
        }
        for (const batch of warehouseBatches) {
          const rawAmount = voucherBySequence.get(batch.sequence);
          if (rawAmount === undefined || rawAmount === null || rawAmount === "" || !Number.isFinite(Number(rawAmount))) {
            return Response.json({ error: `Order ${batch.sequence} Sale Voucher Amount ထည့်ပါ` }, { status: 400 });
          }
          batch.voucherAmount = cleanCount(rawAmount);
          voucherAmount += batch.voucherAmount;
        }
      } else {
        const rawVoucherAmount = payload.voucherAmount;
        if (rawVoucherAmount === undefined || rawVoucherAmount === null || rawVoucherAmount === "" || !Number.isFinite(Number(rawVoucherAmount))) {
          return Response.json({ error: "Sale Voucher Amount ထည့်ပါ" }, { status: 400 });
        }
        voucherAmount = cleanCount(rawVoucherAmount);
        warehouseBatches[0].voucherAmount = voucherAmount;
      }
      const now = new Date().toISOString();
      values.warehouseBatches = JSON.stringify(warehouseBatches);
      values.voucherAmount = voucherAmount;
      values.voucherStatus = "updated";
      values.paymentStatus = current.paidAmount <= 0 ? "unpaid" : current.paidAmount >= voucherAmount ? "paid" : "partial";
      values.voucherUpdatedBy = user.displayName;
      values.voucherUpdatedAt = now;
      values.saleApproved = true;
      values.saleApprovedBy = user.displayName;
      values.saleApprovedAt = now;
      message = `Salesman Review Completed • Delivery Approved • Sale Voucher ${voucherAmount.toLocaleString()} MMK`;
      additionalNotifications.push({ roles: ["finance"], title: "Sale Voucher Update ဝင်လာပါပြီ", message: `${current.customerName} • ${voucherAmount.toLocaleString()} MMK`, targetTab: "finance", sourceId: current.id, actor: user.displayName });
      if (saleApprovedToBuyItems.length) additionalNotifications.push({ roles: ["purchase"], title: `Salesman Approved To Buy • ${saleApprovedToBuyItems.length} Products`, message: `${current.customerName} • ${current.orderNo}`, targetTab: "purchase", sourceId: current.id, actor: user.displayName });
      departmentNotification = { roles: ["delivery"], title: "Delivery Approved ဖြစ်ပါပြီ", message: `${current.customerName} • ${current.route} • ${current.orderNo}`, targetTab: "orders", sourceId: current.id, actor: user.displayName };
    } else if (action === "voucher") {
      if (!roleAllowed(user.role, ["sale"])) {
        return Response.json({ error: "Sale Team သာ Sale Voucher Amount ဖြည့်နိုင်ပါသည်" }, { status: 403 });
      }
      if (current.warehouseStatus !== "finished") {
        return Response.json({ error: "Warehouse Finished ဖြစ်ပြီးမှ Sale Voucher Amount ဖြည့်နိုင်ပါသည်" }, { status: 409 });
      }
      if (current.dispatchStatus === "delivered" && user.role !== "admin") {
        return Response.json({ error: "Delivered ဖြစ်ပြီးသော Order ၏ Sale VR Amount ကို Admin သာ ပြင်နိုင်ပါသည်" }, { status: 409 });
      }
      const warehouseBatches = readWarehouseBatches(current);
      const rawVoucherAmounts = Array.isArray(payload.voucherAmounts) ? payload.voucherAmounts : [];
      let voucherAmount = 0;
      if (warehouseBatches.length > 1) {
        const voucherBySequence = new Map<number, unknown>();
        for (const item of rawVoucherAmounts) {
          if (!item || typeof item !== "object") continue;
          const entry = item as Record<string, unknown>;
          voucherBySequence.set(cleanCount(entry.sequence), entry.amount);
        }
        for (const batch of warehouseBatches) {
          const rawAmount = voucherBySequence.get(batch.sequence);
          if (rawAmount === undefined || rawAmount === null || rawAmount === "" || !Number.isFinite(Number(rawAmount))) {
            return Response.json({ error: `Order ${batch.sequence} Sale Voucher Amount ထည့်ပါ` }, { status: 400 });
          }
          batch.voucherAmount = cleanCount(rawAmount);
          voucherAmount += batch.voucherAmount;
        }
        values.warehouseBatches = JSON.stringify(warehouseBatches);
      } else {
        const rawVoucherAmount = payload.voucherAmount;
        if (rawVoucherAmount === undefined || rawVoucherAmount === null || rawVoucherAmount === "" || !Number.isFinite(Number(rawVoucherAmount))) {
          return Response.json({ error: "Sale Voucher Amount ထည့်ပါ" }, { status: 400 });
        }
        voucherAmount = cleanCount(rawVoucherAmount);
        warehouseBatches[0].voucherAmount = voucherAmount;
        values.warehouseBatches = JSON.stringify(warehouseBatches);
      }
      values.voucherAmount = voucherAmount;
      values.voucherStatus = "updated";
      values.paymentStatus = current.paidAmount <= 0 ? "unpaid" : current.paidAmount >= voucherAmount ? "paid" : "partial";
      values.voucherUpdatedBy = user.displayName;
      values.voucherUpdatedAt = new Date().toISOString();
      values.saleApproved = false;
      values.saleApprovedBy = "";
      values.saleApprovedAt = "";
      message = warehouseBatches.length > 1
        ? `${warehouseBatches.map((batch) => `Order ${batch.sequence}: ${cleanCount(batch.voucherAmount).toLocaleString()} MMK`).join(" • ")} • Total: ${voucherAmount.toLocaleString()} MMK`
        : `Sale Voucher Amount: ${voucherAmount} MMK`;
      departmentNotification = { roles: ["finance"], title: "Sale Voucher Update ဝင်လာပါပြီ", message: `${current.customerName} • ${voucherAmount.toLocaleString()} MMK`, targetTab: "finance", sourceId: current.id, actor: user.displayName };
    } else if (action === "voucher_edit") {
      if (!roleAllowed(user.role, ["sale"])) {
        return Response.json({ error: "Admin / Sale Team သာ Sale VR Amount ပြင်နိုင်ပါသည်" }, { status: 403 });
      }
      if (current.warehouseStatus !== "finished") {
        return Response.json({ error: "Warehouse Finished ဖြစ်ပြီးမှ Sale VR Amount ပြင်နိုင်ပါသည်" }, { status: 409 });
      }
      if (current.dispatchStatus === "delivered" && user.role !== "admin") {
        return Response.json({ error: "Delivered ဖြစ်ပြီးသော Order ၏ Sale VR Amount ကို Admin သာ ပြင်နိုင်ပါသည်" }, { status: 409 });
      }
      const warehouseBatches = readWarehouseBatches(current);
      const rawVoucherAmounts = Array.isArray(payload.voucherAmounts) ? payload.voucherAmounts : [];
      let voucherAmount = 0;
      if (warehouseBatches.length > 1) {
        const voucherBySequence = new Map<number, unknown>();
        for (const item of rawVoucherAmounts) {
          if (!item || typeof item !== "object") continue;
          const entry = item as Record<string, unknown>;
          voucherBySequence.set(cleanCount(entry.sequence), entry.amount);
        }
        for (const batch of warehouseBatches) {
          const rawAmount = voucherBySequence.get(batch.sequence);
          if (rawAmount === undefined || rawAmount === null || rawAmount === "" || !Number.isFinite(Number(rawAmount))) {
            return Response.json({ error: `Order ${batch.sequence} Sale VR Amount ထည့်ပါ` }, { status: 400 });
          }
          batch.voucherAmount = cleanCount(rawAmount);
          voucherAmount += batch.voucherAmount;
        }
      } else {
        const rawVoucherAmount = payload.voucherAmount;
        if (rawVoucherAmount === undefined || rawVoucherAmount === null || rawVoucherAmount === "" || !Number.isFinite(Number(rawVoucherAmount))) {
          return Response.json({ error: "Sale VR Amount ထည့်ပါ" }, { status: 400 });
        }
        voucherAmount = cleanCount(rawVoucherAmount);
        warehouseBatches[0].voucherAmount = voucherAmount;
      }
      values.warehouseBatches = JSON.stringify(warehouseBatches);
      values.voucherAmount = voucherAmount;
      values.voucherStatus = "updated";
      values.paymentStatus = current.paidAmount <= 0 ? "unpaid" : current.paidAmount >= voucherAmount ? "paid" : "partial";
      values.voucherUpdatedBy = user.displayName;
      values.voucherUpdatedAt = new Date().toISOString();
      message = `Sale VR Amount ပြောင်း: ${current.voucherAmount.toLocaleString()} → ${voucherAmount.toLocaleString()} MMK`;
      departmentNotification = { roles: ["finance", "delivery"], title: "Sale VR Amount ပြင်ထားပါသည်", message: `${current.customerName} • ${current.orderNo} • ${current.voucherAmount.toLocaleString()} → ${voucherAmount.toLocaleString()} MMK`, targetTab: "dashboard", sourceId: current.id, actor: user.displayName };
    } else if (action === "sale_approve") {
      if (!roleAllowed(user.role, ["sale"])) {
        return Response.json({ error: "Sale Team သာ Delivery Ready အတည်ပြုနိုင်ပါသည်" }, { status: 403 });
      }
      if (current.warehouseStatus !== "finished") {
        return Response.json({ error: "Warehouse Finished ဖြစ်ပြီးမှ အတည်ပြုနိုင်ပါသည်" }, { status: 409 });
      }
      if (current.voucherStatus !== "updated") {
        return Response.json({ error: "Sale Voucher Amount Update လုပ်ပြီးမှ အတည်ပြုနိုင်ပါသည်" }, { status: 409 });
      }
      const pendingItems = await db.select().from(saleOrderItems).where(and(eq(saleOrderItems.orderId, current.id), inArray(saleOrderItems.fulfillmentStatus, ["pending"])));
      const unresolvedItems = await db.select().from(saleOrderItems).where(and(eq(saleOrderItems.orderId, current.id), inArray(saleOrderItems.matchStatus, ["unknown", "new_product_requested"])));
      if (pendingItems.length || unresolvedItems.length) return Response.json({ error: "Product Rows အားလုံး Warehouse Verification ပြီးမှ Delivery Ready လုပ်နိုင်ပါသည်" }, { status: 409 });
      const substitutionItems = await db.select().from(saleOrderItems).where(eq(saleOrderItems.orderId, current.id));
      if (substitutionItems.some((item) => item.substitutionStatus !== "none" && item.substitutionStatus !== "confirmed")) return Response.json({ error: "Similar Products အားလုံး Checker Confirm ပြီးမှ Delivery Ready လုပ်နိုင်ပါသည်" }, { status: 409 });
      values.saleApproved = true;
      values.saleApprovedBy = user.displayName;
      values.saleApprovedAt = new Date().toISOString();
      message = "Sale Team Approved • Delivery Ready";
      departmentNotification = { roles: ["delivery"], title: "Delivery Ready ဖြစ်ပါပြီ", message: `${current.customerName} • ${current.route} • ${current.orderNo}`, targetTab: "orders", sourceId: current.id, actor: user.displayName };
    } else if (action === "delivery") {
      if (!roleAllowed(user.role, ["delivery"])) {
        return Response.json({ error: "Delivery Team သာ Delivery Status ပြင်နိုင်ပါသည်" }, { status: 403 });
      }
      const status = cleanText(payload.status, 40);
      if (!DELIVERY_STATUSES.includes(status)) {
        return Response.json({ error: "Invalid delivery status" }, { status: 400 });
      }
      if (current.warehouseStatus !== "finished") {
        return Response.json({ error: "Warehouse က Finished လုပ်ပြီးမှ ပို့ဆောင်နိုင်ပါသည်" }, { status: 409 });
      }
      if (!current.saleApproved) {
        return Response.json({ error: "Sale Team Approved ဖြစ်ပြီးမှ ပို့ဆောင်နိုင်ပါသည်" }, { status: 409 });
      }
      values.dispatchStatus = status;
      values.deliveredBoxes = Math.min(cleanCount(payload.deliveredBoxes), current.initialBoxes + current.addonBoxes);
      values.deliveredBundles = Math.min(cleanCount(payload.deliveredBundles), current.initialBundles + current.addonBundles);
      values.deliveredAt = status === "delivered"
        ? (current.dispatchStatus === "delivered" && current.deliveredAt ? current.deliveredAt : new Date().toISOString())
        : "";
      message = `Delivery status: ${status}`;
      departmentNotification = { roles: ["sale"], title: status === "delivered" ? "Order ပို့ပြီးပါပြီ" : "Delivery Status ပြောင်းလဲပါပြီ", message: `${current.customerName} • ${current.orderNo} • ${status}`, targetTab: "sale", sourceId: current.id, actor: user.displayName };
    } else if (action === "payment") {
      if (!roleAllowed(user.role, ["finance"])) {
        return Response.json({ error: "Finance Team သာ Payment Status ပြင်နိုင်ပါသည်" }, { status: 403 });
      }
      const status = cleanText(payload.status, 40);
      if (!PAYMENT_STATUSES.includes(status)) {
        return Response.json({ error: "Invalid payment status" }, { status: 400 });
      }
      if (current.voucherStatus !== "updated") {
        return Response.json({ error: "Sale Team က Sale Voucher Amount Update လုပ်ပြီးမှ ငွေစစ်နိုင်ပါသည်" }, { status: 409 });
      }
      const nextPaidAmount = cleanCount(payload.paidAmount);
      const incomingAmount = Math.max(0, nextPaidAmount - current.paidAmount);
      const paymentMethod = cleanText(payload.paymentMethod, 20);
      const paymentDate = cleanText(payload.paymentDate, 10);
      if (incomingAmount > 0 && !["cash", "banking"].includes(paymentMethod)) {
        return Response.json({ error: "Cash သို့မဟုတ် Banking ရွေးပါ" }, { status: 400 });
      }
      if (incomingAmount > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
        return Response.json({ error: "Payment Date ရွေးပါ" }, { status: 400 });
      }
      if (incomingAmount > 0) {
        const { officialStartDate } = await getOperationalPeriod();
        if (!isLiveDate(paymentDate, officialStartDate)) return Response.json({ error: `Official Live Start ${officialStartDate} မှစ၍ Payment ထည့်နိုင်ပါသည်` }, { status: 400 });
      }
      values.paymentStatus = status;
      values.paidAmount = nextPaidAmount;
      message = `Payment status: ${status}`;
      if (incomingAmount > 0) await db.insert(paymentTransactions).values({ orderId: current.id, customerName: current.customerName, township: current.township, amount: incomingAmount, method: paymentMethod, paymentDate, enteredBy: user.displayName, createdAt: new Date().toISOString() });
      departmentNotification = { roles: ["sale"], title: "Payment Status Update", message: `${current.customerName} • ${status} • ${nextPaidAmount.toLocaleString()} MMK`, targetTab: "sale", sourceId: current.id, actor: user.displayName };
    } else {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "salesman_review_approve" && saleApprovedToBuyItems.length) {
      const existingRequests = await db.select({ note: purchaseRequests.note }).from(purchaseRequests).where(eq(purchaseRequests.orderId, current.id));
      const existingOrderItemIds = new Set(existingRequests.map((request) => Number(request.note.match(/Order Item (\d+)/)?.[1] || 0)).filter(Boolean));
      const newToBuyItems = saleApprovedToBuyItems.filter((item) => !existingOrderItemIds.has(item.orderItemId));
      for (let offset = 0; offset < newToBuyItems.length; offset += 8) {
        await db.insert(purchaseRequests).values(newToBuyItems.slice(offset, offset + 8).map((item) => ({
          orderId: current.id,
          batchSequence: item.batchSequence,
          productName: item.productName,
          productCode: item.productCode,
          quantity: item.quantity,
          unit: item.unit,
          note: `Auto To Buy • Salesman approved • Order Item ${item.orderItemId}`,
          status: "pending",
          requestedBy: user.displayName,
          updatedBy: user.displayName,
        })));
      }
    }
    const [updated] = await db.update(orders).set(values).where(eq(orders.id, id)).returning();
    if (purchaseReconcileBatchSequence > 0) {
      const purchaseSync = await fulfillActivePurchaseRequestsForBatch({ orderId: updated.id, batchSequence: purchaseReconcileBatchSequence, actor: user.displayName });
      if (purchaseSync.quantity > 0) {
        await notifyDepartments({ roles: ["purchase", "sale"], title: "ဝယ်ရန်စာရင်းကို Stock ဖြင့် ဖြည့်ဆည်းပြီး", message: `${updated.customerName} • ${purchaseSync.itemCount} Products • Qty ${purchaseSync.quantity} • Active List မှ အလိုအလျောက်ဖယ်ပြီး`, targetTab: "purchase", sourceId: updated.id, actor: user.displayName });
        await recordAuditLog(user, { action: "purchase_request_resolved_by_available_stock", entityType: "order", entityId: updated.id, summary: `${updated.orderNo} • ဝယ်ရန်စာရင်း ${purchaseSync.requestCount} ခု • Qty ${purchaseSync.quantity} ကို Picked & Checked Stock ဖြင့် ဖြည့်ဆည်းခဲ့သည်` });
      }
    }
    if (action === "customer" && updated.warehouseStatus === "finished") {
      const purchaseSync = await resyncPurchaseRequestAllocationsForOrder({ orderId: updated.id, actor: user.displayName });
      if (purchaseSync.quantity > 0) await recordAuditLog(user, { action: "purchase_request_allocation_resynced", entityType: "order", entityId: updated.id, summary: `${updated.orderNo} Customer ပြောင်းပြီး • ဝယ်ရန်စာရင်း ${purchaseSync.requestCount} ခု • Qty ${purchaseSync.quantity} ပြန်ချိတ်ခဲ့သည်` });
    }
    if (["voucher", "voucher_edit", "salesman_review_approve"].includes(action) && updated.voucherAmount > 0) {
      const matchedCustomer = await resolveCustomerSelection(updated.customerName, updated.township);
      await removeCustomersWithSaleFromPendingGrowth({
        customers: [{ customerKey: matchedCustomer?.customerKey || updated.customerKey, customerName: updated.customerName, voucherAmount: updated.voucherAmount, orderNo: updated.orderNo }],
        actor: user.displayName,
        sourceId: updated.id,
      });
    }
    if (action === "customer") {
      await db.update(paymentTransactions).set({ customerName: updated.customerName, township: updated.township }).where(eq(paymentTransactions.orderId, id));
    }
    await db.insert(orderEvents).values({ orderId: id, eventType: action, message, actor: user.displayName });
    if (departmentNotification) await notifyDepartments(departmentNotification);
    for (const notification of additionalNotifications) await notifyDepartments(notification);
    await recordAuditLog(user, { action, entityType: "order", entityId: id, summary: `${current.customerName} • ${message}` });
    const itemMap = await itemsForOrders(db, [updated.id]);
    return Response.json({ order: presentOrder(updated, itemMap.get(updated.id) || []) });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await auth();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") {
    return Response.json({ error: "Admin သာ Sale Order ဖျက်နိုင်ပါသည်" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = cleanCount(payload.id);
    const confirmation = cleanText(payload.confirmation, 40);
    if (!id || confirmation !== "DELETE") {
      return Response.json({ error: "ဖျက်ရန် အတည်ပြုချက် မပြည့်စုံပါ" }, { status: 400 });
    }

    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return Response.json({ error: "Sale Order မတွေ့ပါ" }, { status: 404 });
    const { officialStartDate } = await getOperationalPeriod();
    if (!isLiveDate(order.orderDate, officialStartDate)) return Response.json({ error: "Trial Archive Data ကို ဖျက်၍မရပါ" }, { status: 409 });
    const incidents = await db.select({ proofKey: deliveryIncidents.proofKey }).from(deliveryIncidents).where(eq(deliveryIncidents.orderId, id));
    const restoredPurchaseRequests = await restoreActivePurchaseRequestAllocations({ orderId: id, actor: user.displayName });

    await db.batch([
      db.delete(deliveryIncidents).where(eq(deliveryIncidents.orderId, id)),
      db.delete(warehouseReturns).where(eq(warehouseReturns.orderId, id)),
      db.delete(purchaseRequests).where(eq(purchaseRequests.orderId, id)),
      db.delete(purchaseRequestAllocations).where(eq(purchaseRequestAllocations.fulfillmentOrderId, id)),
      db.delete(saleOrderItems).where(eq(saleOrderItems.orderId, id)),
      db.delete(orderEvents).where(eq(orderEvents.orderId, id)),
      db.delete(paymentTransactions).where(eq(paymentTransactions.orderId, id)),
      db.delete(notifications).where(eq(notifications.sourceId, id)),
      db.delete(orders).where(eq(orders.id, id)),
    ]);

    if (env.BUCKET) {
      const keys = [order.deliveryProofKey, ...incidents.map((incident) => incident.proofKey)].filter(Boolean);
      await Promise.all(keys.map((key) => env.BUCKET.delete(key).catch(() => undefined)));
    }

    await recordAuditLog(user, { action: "order_deleted", entityType: "order", entityId: id, summary: `${order.customerName} • ${order.orderNo} ဖျက်ခဲ့သည်` });
    if (restoredPurchaseRequests.quantity > 0) await recordAuditLog(user, { action: "purchase_request_allocation_restored", entityType: "order", entityId: id, summary: `${order.orderNo} Delete • ဝယ်ရန်စာရင်း ${restoredPurchaseRequests.requestCount} ခု • Qty ${restoredPurchaseRequests.quantity} ပြန်ထည့်ခဲ့သည်` });

    return Response.json({ deleted: true, id, orderNo: order.orderNo, customerName: order.customerName });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
