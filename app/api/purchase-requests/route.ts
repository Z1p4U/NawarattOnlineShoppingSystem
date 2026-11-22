import { and, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { appUsers, customerPurchaseRequests, orders, purchaseArrivalAllocations, purchaseRequestAllocations, purchaseRequests } from "../../../db/schema";
import { getAppUser, roleAllowed } from "../../../lib/app-user";
import { resolveCustomerSelection } from "../../../lib/customer-directory";
import { notifyDepartments } from "../../../lib/department-notifications";
import { recordAuditLog } from "../../../lib/audit-log";
import { isLiveDate } from "../../../lib/operational-period";
import { getPurchaseOperationalPeriod } from "../../../lib/purchase-operational-period";

const PURCHASE_STATUSES = ["ordered_company", "ordered_mglz", "stock_out", "unavailable"];
const RESOLVED_BY_AVAILABLE_STOCK = "resolved_by_available_stock";
const SALE_PEOPLE = ["Zaw Tun Kyaw", "Zin Mg Mg Lin", "Myo Min", "Htin Lin Kyaw Swar", "Aung Kyaw Zaw", "Admin"];

function cleanText(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return message.includes("no such table") ? "Database is preparing. Please refresh in a moment." : message;
}

function safePurchaseError(error: unknown) {
  const message = errorMessage(error);
  return message.includes("Failed query") || message.includes("too many SQL variables")
    ? "ပစ္စည်းစာရင်းကို Database မှာ သိမ်းမရသေးပါ။ Refresh လုပ်ပြီး ပြန်ပို့ကြည့်ပါ။"
    : message;
}

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(request.url);
    const date = cleanText(url.searchParams.get("date"), 10);
    const startDate = cleanText(url.searchParams.get("startDate"), 10);
    const endDate = cleanText(url.searchParams.get("endDate"), 10);
    const { officialStartDate } = await getPurchaseOperationalPeriod();
    const requestedOrderCondition = date
      ? eq(orders.orderDate, date)
      : startDate && endDate
        ? and(gte(orders.orderDate, startDate), lte(orders.orderDate, endDate))
        : startDate
          ? gte(orders.orderDate, startDate)
          : endDate
            ? lte(orders.orderDate, endDate)
            : undefined;
    const orderCondition = requestedOrderCondition
      ? and(gte(orders.orderDate, officialStartDate), requestedOrderCondition)
      : gte(orders.orderDate, officialStartDate);
    const requestedCustomerCondition = date
      ? eq(customerPurchaseRequests.requestDate, date)
      : startDate && endDate
        ? and(gte(customerPurchaseRequests.requestDate, startDate), lte(customerPurchaseRequests.requestDate, endDate))
        : startDate
          ? gte(customerPurchaseRequests.requestDate, startDate)
          : endDate
            ? lte(customerPurchaseRequests.requestDate, endDate)
            : undefined;
    const customerCondition = requestedCustomerCondition
      ? and(gte(customerPurchaseRequests.requestDate, officialStartDate), requestedCustomerCondition)
      : gte(customerPurchaseRequests.requestDate, officialStartDate);
    const db = getDb();
    const rows = await db
      .select({
        id: purchaseRequests.id,
        orderId: purchaseRequests.orderId,
        batchSequence: purchaseRequests.batchSequence,
        productName: purchaseRequests.productName,
        productCode: purchaseRequests.productCode,
        quantity: purchaseRequests.quantity,
        unit: purchaseRequests.unit,
        supplierName: purchaseRequests.supplierName,
        note: purchaseRequests.note,
        status: purchaseRequests.status,
        requestedBy: purchaseRequests.requestedBy,
        requestedAt: purchaseRequests.requestedAt,
        updatedBy: purchaseRequests.updatedBy,
        updatedAt: purchaseRequests.updatedAt,
        orderNo: orders.orderNo,
        orderDate: orders.orderDate,
        customerName: orders.customerName,
        township: orders.township,
        salesperson: orders.salesperson,
        route: orders.route,
      })
      .from(purchaseRequests)
      .innerJoin(orders, eq(purchaseRequests.orderId, orders.id))
      .where(and(orderCondition, ne(purchaseRequests.status, RESOLVED_BY_AVAILABLE_STOCK), ne(purchaseRequests.status, "cancelled")))
      .orderBy(desc(purchaseRequests.updatedAt), desc(purchaseRequests.id));
    const customerRows = await db
      .select()
      .from(customerPurchaseRequests)
      .where(and(customerCondition, ne(customerPurchaseRequests.status, RESOLVED_BY_AVAILABLE_STOCK), ne(customerPurchaseRequests.status, "cancelled")))
      .orderBy(desc(customerPurchaseRequests.updatedAt), desc(customerPurchaseRequests.id));

    const saleIds = rows.map((row) => row.id);
    const customerIds = customerRows.map((row) => row.id);
    async function loadArrivalRows(sourceType: "sale_order" | "customer_request", ids: number[]) {
      const result: Array<typeof purchaseArrivalAllocations.$inferSelect> = [];
      for (let index = 0; index < ids.length; index += 80) {
        const page = await db.select().from(purchaseArrivalAllocations).where(and(
          eq(purchaseArrivalAllocations.status, "active"),
          eq(purchaseArrivalAllocations.sourceType, sourceType),
          inArray(purchaseArrivalAllocations.purchaseRequestId, ids.slice(index, index + 80)),
        ));
        result.push(...page);
      }
      return result.map((item) => ({
        id: item.id,
        importRunId: item.importRunId,
        sourceType: item.sourceType,
        purchaseRequestId: item.purchaseRequestId,
        incomingQuantity: item.incomingQuantity,
        allocatedQuantity: item.allocatedQuantity,
        remainingQuantity: item.remainingQuantity,
        supplierName: item.supplierName,
        purchaseDate: item.purchaseDate,
        importedAt: item.importedAt,
        matchedBy: item.matchedBy,
        arrivalStatus: item.arrivalStatus,
        reviewReason: item.reviewReason,
      }));
    }
    const [saleArrivals, customerArrivals] = await Promise.all([
      loadArrivalRows("sale_order", saleIds),
      loadArrivalRows("customer_request", customerIds),
    ]);
    const arrivalMap = new Map<string, typeof saleArrivals>();
    for (const allocation of [...saleArrivals, ...customerArrivals]) {
      const key = `${allocation.sourceType}:${allocation.purchaseRequestId}`;
      arrivalMap.set(key, [...(arrivalMap.get(key) || []), allocation]);
    }

    function arrivalFor(sourceType: "sale_order" | "customer_request", id: number, requiredQuantity: number) {
      const allocations = arrivalMap.get(`${sourceType}:${id}`) || [];
      const allocatedIncomingQuantity = allocations.reduce((sum, item) => sum + Math.max(0, item.allocatedQuantity), 0);
      const reviewRows = allocations.filter((item) => item.arrivalStatus === "review");
      const arrivalStatus = allocatedIncomingQuantity >= requiredQuantity && requiredQuantity > 0
        ? "full"
        : allocatedIncomingQuantity > 0
          ? "partial"
          : reviewRows.length
            ? "review"
            : "none";
      const latest = [...allocations].sort((left, right) => right.importedAt.localeCompare(left.importedAt))[0];
      const suppliers = [...new Set(allocations.map((item) => item.supplierName).filter(Boolean))];
      const matchedBy = [...new Set(allocations.map((item) => item.matchedBy).filter(Boolean))];
      return {
        incomingAvailable: arrivalStatus === "full" || arrivalStatus === "partial",
        incomingQuantity: allocations.reduce((sum, item) => sum + Math.max(0, item.incomingQuantity), 0),
        allocatedIncomingQuantity,
        remainingQuantity: Math.max(0, requiredQuantity - allocatedIncomingQuantity),
        incomingSupplier: suppliers.join(", "),
        incomingDate: latest?.purchaseDate || "",
        importedAt: latest?.importedAt || "",
        incomingSource: latest ? `Purchase Record Import #${latest.importRunId}` : "",
        incomingMatchedBy: matchedBy.length === 1 ? matchedBy[0] : matchedBy.length ? "mixed" : "",
        incomingRecordCount: allocations.length,
        arrivalStatus,
        arrivalAllocationIds: allocations.map((item) => item.id),
        reviewReason: reviewRows.map((item) => item.reviewReason).filter(Boolean).join("; "),
      };
    }
    const requests = [
      ...rows.map((row) => ({ ...row, sourceType: "sale_order" as const, ...arrivalFor("sale_order", row.id, row.quantity) })),
      ...customerRows.map((row) => ({
        ...row,
        sourceType: "customer_request" as const,
        orderId: 0,
        batchSequence: 0,
        orderNo: "Customer Request",
        orderDate: row.requestDate,
        route: "",
        ...arrivalFor("customer_request", row.id, row.quantity),
      })),
    ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
    return Response.json({ requests });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const sourceType = cleanText(payload.sourceType, 30) || "sale_order";
    if (sourceType === "customer_request") {
      if (!roleAllowed(user.role, ["sale"])) {
        return Response.json({ error: "Sale Team သာ Customer Request ပို့နိုင်ပါသည်" }, { status: 403 });
      }
      const requestDate = cleanText(payload.requestDate, 10);
      const customerName = cleanText(payload.customerName, 180);
      const township = cleanText(payload.township, 120);
      const salesperson = cleanText(payload.salesperson, 80);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requestDate)) return Response.json({ error: "Valid request date is required" }, { status: 400 });
      const { officialStartDate } = await getPurchaseOperationalPeriod();
      if (!isLiveDate(requestDate, officialStartDate)) return Response.json({ error: `Official Live Start ${officialStartDate} မှစ၍ Customer Request တင်နိုင်ပါသည်` }, { status: 400 });
      const selectedCustomer = await resolveCustomerSelection(customerName, township);
      if (!selectedCustomer) {
        return Response.json({ error: "Customers Database ထဲက Customer ကို ရွေးချယ်ပါ" }, { status: 400 });
      }
      if (!SALE_PEOPLE.includes(salesperson)) return Response.json({ error: "မှာယူသော Sale Man ကို ရွေးပါ" }, { status: 400 });
      const rawItems = Array.isArray(payload.items) ? payload.items : [payload];
      if (!rawItems.length || rawItems.length > 200) return Response.json({ error: "တစ်ကြိမ်လျှင် ပစ္စည်း ၁ မှ ၂၀၀ မျိုးအထိ ထည့်နိုင်ပါသည်" }, { status: 400 });
      const items = rawItems.map((raw) => {
        const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        return { productName: cleanText(item.productName, 180), productCode: cleanText(item.productCode, 80), quantity: cleanCount(item.quantity), unit: cleanText(item.unit, 40), supplierName: cleanText(item.supplierName, 180), note: cleanText(item.note, 300) };
      });
      if (items.some((item) => !item.productName || item.quantity < 1 || !item.unit)) {
        return Response.json({ error: "Row တိုင်းမှာ Product Name, Qty နှင့် Unit ဖြည့်ပါ" }, { status: 400 });
      }
      const db = getDb();
      const [assignedUser] = await db
        .select({ email: appUsers.email })
        .from(appUsers)
        .where(salesperson === "Admin" ? eq(appUsers.role, "admin") : eq(appUsers.displayName, salesperson))
        .limit(1);
      const created: (typeof customerPurchaseRequests.$inferSelect)[] = [];
      for (let index = 0; index < items.length; index += 8) {
        const saved = await db.insert(customerPurchaseRequests).values(items.slice(index, index + 8).map((item) => ({
          requestDate,
          customerName,
          township,
          customerKey: selectedCustomer.customerKey,
          productName: item.productName,
          productCode: item.productCode,
          quantity: item.quantity,
          unit: item.unit,
          supplierName: item.supplierName,
          note: item.note,
          salesperson,
          requestedByEmail: salesperson === user.displayName || (salesperson === "Admin" && user.role === "admin") ? user.email : assignedUser?.email || "",
          status: "pending",
          requestedBy: user.displayName,
          updatedBy: user.displayName,
        }))).returning();
        created.push(...saved);
      }
      await notifyDepartments({ roles: ["purchase"], title: "Customer Purchase Request အသစ်", message: `${customerName} • ပစ္စည်း ${created.length} မျိုး • Sale Man: ${salesperson}`, targetTab: "purchase", sourceId: created[0].id, actor: user.displayName });
      await recordAuditLog(user, { action: "customer_request_created", entityType: "purchase_request", entityId: created[0].id, summary: `${customerName} • Customer Request ${created.length} မျိုး` });
      const presented = created.map((item) => ({ ...item, sourceType: "customer_request" as const, orderId: 0, batchSequence: 0, orderNo: "Customer Request", orderDate: item.requestDate, route: "" }));
      return Response.json({ request: presented[0], requests: presented }, { status: 201 });
    }

    if (!roleAllowed(user.role, ["warehouse"])) {
      return Response.json({ error: "Warehouse Team သာ Sale Order Purchase Request ပို့နိုင်ပါသည်" }, { status: 403 });
    }
    const orderId = cleanCount(payload.orderId);
    const batchSequence = Math.max(1, cleanCount(payload.batchSequence));
    const note = cleanText(payload.note, 300);
    const rawItems = Array.isArray(payload.items) ? payload.items : [payload];
    if (rawItems.length > 300) return Response.json({ error: "တစ်ကြိမ်လျှင် ပစ္စည်း ၃၀၀ မျိုးအထိ ပို့နိုင်ပါသည်" }, { status: 400 });
    const items = rawItems.map((raw) => {
      const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      return { productName: cleanText(item.productName, 180), productCode: cleanText(item.productCode, 80), quantity: cleanCount(item.quantity), unit: cleanText(item.unit, 40), supplierName: cleanText(item.supplierName, 180) };
    });
    if (!items.length || items.some((item) => !item.productName || item.quantity < 1 || !item.unit)) {
      return Response.json({ error: "ပစ္စည်းစာရင်းကို Product Name + Qty + Unit ပုံစံဖြင့် စစ်ဆေးပါ" }, { status: 400 });
    }

    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return Response.json({ error: "Sale Order မတွေ့ပါ" }, { status: 404 });
    const { officialStartDate } = await getPurchaseOperationalPeriod();
    if (!isLiveDate(order.orderDate, officialStartDate)) return Response.json({ error: "Trial Order မှ Purchase Request အသစ်တင်၍မရပါ" }, { status: 409 });

    const created: (typeof purchaseRequests.$inferSelect)[] = [];
    for (let index = 0; index < items.length; index += 8) {
      const saved = await db.insert(purchaseRequests).values(items.slice(index, index + 8).map((item) => ({
        orderId,
        batchSequence,
        productName: item.productName,
        productCode: item.productCode,
        quantity: item.quantity,
        unit: item.unit,
        supplierName: item.supplierName,
        note,
        status: "pending",
        requestedBy: user.displayName,
        updatedBy: user.displayName,
      }))).returning();
      created.push(...saved);
    }

    await notifyDepartments({ roles: ["purchase"], title: `ပစ္စည်းဝယ်ရန် Request ${created.length} မျိုး`, message: `${order.customerName} • ${created.map((item) => `${item.productName} ${item.quantity}${item.unit}`).slice(0, 3).join("၊ ")}${created.length > 3 ? ` • နောက်ထပ် ${created.length - 3} မျိုး` : ""}`, targetTab: "purchase", sourceId: order.id, actor: user.displayName });
    await recordAuditLog(user, { action: "purchase_request_created", entityType: "order", entityId: order.id, summary: `${order.customerName} • Purchase Request ${created.length} မျိုး` });

    return Response.json({ requests: created.map((item) => ({ ...item, sourceType: "sale_order", orderNo: order.orderNo, orderDate: order.orderDate, customerName: order.customerName, township: order.township, route: order.route })) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: safePurchaseError(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = cleanText(payload.action, 40) || "status";
    const id = cleanCount(payload.id);
    const sourceType = cleanText(payload.sourceType, 30) || "sale_order";
    if (!id || !["sale_order", "customer_request"].includes(sourceType)) {
      return Response.json({ error: "Purchase Request ကို အတည်ပြု၍မရပါ" }, { status: 400 });
    }
    const db = getDb();

    if (action === "reject_arrival" || action === "reverse_arrival") {
      if (user.role !== "admin") return Response.json({ error: "Admin သာ Arrival Matching ကို Reject / Reverse လုပ်နိုင်ပါသည်" }, { status: 403 });
      const reason = cleanText(payload.reason, 300);
      if (!reason) return Response.json({ error: "Reject / Reverse Reason ကို မဖြစ်မနေထည့်ပါ" }, { status: 400 });
      const allocations = await db.select().from(purchaseArrivalAllocations).where(and(
        eq(purchaseArrivalAllocations.sourceType, sourceType),
        eq(purchaseArrivalAllocations.purchaseRequestId, id),
        eq(purchaseArrivalAllocations.status, "active"),
      ));
      if (!allocations.length) return Response.json({ error: "Active Arrival Allocation မတွေ့ပါ" }, { status: 404 });
      const nextStatus = action === "reject_arrival" ? "rejected" : "reversed";
      const now = new Date().toISOString();
      await db.update(purchaseArrivalAllocations).set({ status: nextStatus, updatedBy: user.displayName, updatedAt: now }).where(and(
        eq(purchaseArrivalAllocations.sourceType, sourceType),
        eq(purchaseArrivalAllocations.purchaseRequestId, id),
        eq(purchaseArrivalAllocations.status, "active"),
      ));
      const allocatedQuantity = allocations.reduce((sum, item) => sum + item.allocatedQuantity, 0);
      await recordAuditLog(user, {
        action: action === "reject_arrival" ? "purchase_arrival_rejected" : "purchase_arrival_reversed",
        entityType: "purchase_request",
        entityId: `${sourceType}:${id}`,
        summary: `Import Run ${[...new Set(allocations.map((item) => item.importRunId))].join(", ")} • Matched ${[...new Set(allocations.map((item) => item.matchedBy))].join(", ")} • Allocated ${allocatedQuantity} • active → ${nextStatus} • Reason: ${reason}`,
      });
      return Response.json({ action, arrivalStatus: "none", allocatedIncomingQuantity: 0, reversed: true });
    }

    if (action === "admin_edit_quantity" || action === "admin_cancel_duplicate") {
      if (user.role !== "admin") return Response.json({ error: "Admin သာ ဝယ်ရန်စာရင်းကို Edit / Cancel လုပ်နိုင်ပါသည်" }, { status: 403 });
      const reason = cleanText(payload.reason, 300);
      if (!reason) return Response.json({ error: "ပြင်ဆင်ရသည့် Reason ကို မဖြစ်မနေထည့်ပါ" }, { status: 400 });
      const [current] = sourceType === "customer_request"
        ? await db.select().from(customerPurchaseRequests).where(eq(customerPurchaseRequests.id, id)).limit(1)
        : await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id)).limit(1);
      if (!current) return Response.json({ error: "Purchase Request မတွေ့ပါ" }, { status: 404 });
      if ([RESOLVED_BY_AVAILABLE_STOCK, "received", "cancelled"].includes(current.status)) {
        return Response.json({ error: "Picked & Checked ဖြင့်ဖြေရှင်းပြီး၊ ရောက်ရှိပြီး သို့မဟုတ် Cancelled Request ကို တိုက်ရိုက်မပြင်နိုင်ပါ" }, { status: 409 });
      }
      const [activeAllocation] = await db.select({ id: purchaseRequestAllocations.id })
        .from(purchaseRequestAllocations)
        .where(and(
          eq(purchaseRequestAllocations.sourceType, sourceType),
          eq(purchaseRequestAllocations.purchaseRequestId, id),
          eq(purchaseRequestAllocations.status, "active"),
        ))
        .limit(1);
      if (activeAllocation) return Response.json({ error: "ဒီ Request ကို Picked & Checked Product ဖြင့် ချိတ်ထားပြီးဖြစ်သောကြောင့် Adjustment ဖြင့်သာ ပြင်နိုင်ပါသည်" }, { status: 409 });

      const now = new Date().toISOString();
      const isOrdered = ["ordered", "ordered_company", "ordered_mglz"].includes(current.status);
      if (action === "admin_edit_quantity") {
        const quantity = cleanCount(payload.quantity);
        if (quantity < 1) return Response.json({ error: "Quantity သည် 1 နှင့်အထက် ဖြစ်ရပါမည်။ မလိုတော့ပါက Cancel Duplicate ကိုသုံးပါ" }, { status: 400 });
        if (quantity === current.quantity) return Response.json({ error: "Quantity ပြောင်းလဲမှုမရှိပါ" }, { status: 400 });
        const note = `${current.note ? `${current.note}\n` : ""}[Admin Qty Edit ${now}: ${current.quantity} → ${quantity} • ${reason}]`;
        const updateValues = { quantity, note, updatedBy: user.displayName, updatedAt: now };
        const [updated] = sourceType === "customer_request"
          ? await db.update(customerPurchaseRequests).set(updateValues).where(eq(customerPurchaseRequests.id, id)).returning()
          : await db.update(purchaseRequests).set(updateValues).where(eq(purchaseRequests.id, id)).returning();
        await notifyDepartments({
          roles: sourceType === "customer_request" ? ["purchase", "sale"] : ["purchase", "warehouse", "sale"],
          title: isOrdered ? "Admin — မှာပြီး Request Quantity ပြင်ထားသည်" : "Admin — Purchase Request Quantity ပြင်ထားသည်",
          message: `${current.productName} • ${current.quantity} → ${quantity} ${current.unit} • Reason: ${reason}`,
          targetTab: "purchase",
          sourceId: "orderId" in current ? current.orderId : current.id,
          actor: user.displayName,
        });
        await recordAuditLog(user, { action: "purchase_request_admin_quantity_updated", entityType: "purchase_request", entityId: `${sourceType}:${id}`, summary: `${current.productName} • Qty ${current.quantity} → ${quantity} ${current.unit} • Status ${current.status} • Reason: ${reason}` });
        return Response.json({ request: updated, action, warning: isOrdered ? "ordered_request_adjusted" : null });
      }

      const note = `${current.note ? `${current.note}\n` : ""}[Admin Cancelled ${now}: ${reason}]`;
      const cancelValues = { status: "cancelled", note, updatedBy: user.displayName, updatedAt: now };
      const [updated] = sourceType === "customer_request"
        ? await db.update(customerPurchaseRequests).set(cancelValues).where(eq(customerPurchaseRequests.id, id)).returning()
        : await db.update(purchaseRequests).set(cancelValues).where(eq(purchaseRequests.id, id)).returning();
      await db.update(purchaseArrivalAllocations).set({ status: "cancelled", updatedBy: user.displayName, updatedAt: now }).where(and(
        eq(purchaseArrivalAllocations.sourceType, sourceType),
        eq(purchaseArrivalAllocations.purchaseRequestId, id),
        eq(purchaseArrivalAllocations.status, "active"),
      ));
      await notifyDepartments({
        roles: sourceType === "customer_request" ? ["purchase", "sale"] : ["purchase", "warehouse", "sale"],
        title: isOrdered ? "Admin — မှာပြီး Request Cancelled" : "Admin — Duplicate Purchase Request Cancelled",
        message: `${current.productName} • ${current.quantity} ${current.unit} • Previous Status: ${current.status} • Reason: ${reason}`,
        targetTab: "purchase",
        sourceId: "orderId" in current ? current.orderId : current.id,
        actor: user.displayName,
      });
      await recordAuditLog(user, { action: "purchase_request_admin_cancelled", entityType: "purchase_request", entityId: `${sourceType}:${id}`, summary: `${current.productName} • Qty ${current.quantity} ${current.unit} • Before ${current.status} → Cancelled • Reason: ${reason}` });
      return Response.json({ request: updated, action, cancelled: true, warning: isOrdered ? "ordered_request_cancelled" : null });
    }

    if (!roleAllowed(user.role, ["purchase"])) {
      return Response.json({ error: "Purchase Team သာ Purchase Status ပြင်နိုင်ပါသည်" }, { status: 403 });
    }
    const status = cleanText(payload.status, 30);
    const supplierName = cleanText(payload.supplierName, 180);
    if (!PURCHASE_STATUSES.includes(status)) return Response.json({ error: "Invalid purchase status" }, { status: 400 });

    const updateValues = { status, ...(supplierName ? { supplierName } : {}), updatedBy: user.displayName, updatedAt: new Date().toISOString() };
    const [updated] = sourceType === "customer_request"
      ? await db.update(customerPurchaseRequests).set(updateValues).where(eq(customerPurchaseRequests.id, id)).returning()
      : await db.update(purchaseRequests).set(updateValues).where(eq(purchaseRequests.id, id)).returning();
    if (!updated) return Response.json({ error: "Purchase Request မတွေ့ပါ" }, { status: 404 });
    let directRecipientEmail = "";
    if (sourceType === "customer_request" && "requestedByEmail" in updated) {
      directRecipientEmail = String(updated.requestedByEmail || "");
      if (!directRecipientEmail) {
        const recipientName = String(updated.salesperson || updated.requestedBy || "");
        const [assignedUser] = await db.select({ email: appUsers.email }).from(appUsers).where(eq(appUsers.displayName, recipientName)).limit(1);
        directRecipientEmail = assignedUser?.email || "";
        if (directRecipientEmail) {
          await db.update(customerPurchaseRequests).set({ salesperson: updated.salesperson || recipientName, requestedByEmail: directRecipientEmail }).where(eq(customerPurchaseRequests.id, id));
        }
      }
    }
    await notifyDepartments({
      roles: sourceType === "customer_request" ? ["sale"] : ["warehouse", "sale"],
      title: status === "stock_out" ? "Purchase — ပစ္စည်းပြတ်" : status === "unavailable" ? "Purchase — မရပါ" : status === "ordered_mglz" ? "Purchase — မှာပြီး MGLZ" : "Purchase — မှာပြီး Company",
      message: `${updated.productName}${supplierName ? ` • ${supplierName}` : ""} • ${status}${sourceType === "customer_request" && "salesperson" in updated ? ` • Sale Man: ${updated.salesperson}` : ""}`,
      targetTab: sourceType === "customer_request" ? "sale" : "warehouse",
      sourceId: "orderId" in updated ? updated.orderId : updated.id,
      actor: user.displayName,
      recipientEmail: directRecipientEmail,
    });
    await recordAuditLog(user, { action: "purchase_status_updated", entityType: "purchase_request", entityId: id, summary: `${updated.productName} • ${status}` });
    return Response.json({ request: updated });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
