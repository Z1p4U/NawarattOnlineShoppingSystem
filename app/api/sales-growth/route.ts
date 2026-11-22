import { adjustmentTotals } from "../../../lib/balance-adjustments";
import { desc, eq, gte } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerOpeningBalances, orders, paymentTransactions, salesFollowUps } from "../../../db/schema";
import { canonicalSalesperson, getListedSaleTeamAssignment } from "../../../data/sale-team-customers";
import { getAppUser } from "../../../lib/app-user";
import { recordAuditLog } from "../../../lib/audit-log";
import { getOperationalPeriod } from "../../../lib/operational-period";
import { removeCustomersWithSaleFromPendingGrowth } from "../../../lib/sales-growth-reconciliation";
import { getCustomerDirectory, normalizeCustomerKey, normalizeCustomerValue, resolveCustomerSelection } from "../../../lib/customer-directory";

const STATUSES = ["planned", "pending", "due", "overdue", "completed", "rescheduled", "order_created", "no_answer"];
const STATUS_WHITELIST = new Set(STATUSES);
const RESULTS = ["planned", "order_received", "order_later", "stock_available", "price_not_match", "competitor", "no_answer", "phone_off", "unreachable", "follow_up_required", "payment_promised", "not_buying", "other"];
const PURPOSES = ["collect_order", "customer_follow_up", "collect_payment", "product_information", "complaint_follow_up", "new_customer", "other"];

function clean(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function allowed(role: string) {
  return role === "admin" || role === "sale";
}

function todayYangonKey() {
  return new Date(Date.now() + 6.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysBefore(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function daysSince(value: string) {
  if (!value) return 9999;
  const diff = new Date(`${todayYangonKey()}T00:00:00Z`).getTime() - new Date(`${value}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function isHlaingTharYar(value: string) {
  const normalized = value.toLocaleLowerCase().replace(/[^a-z]/g, "");
  return ["hlaingtharyar", "hlaingetar", "hlaingtar", "hty"].includes(normalized);
}

function loadFailed(operation: "GET" | "POST" | "PATCH", error: unknown) {
  console.error(`[sales-growth] ${operation} failed`, error);
  return Response.json({ error: "Load Failed" }, { status: 500 });
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowed(user.role)) return Response.json({ error: "Admin နှင့် Sales Team သာ Sales Growth ကိုကြည့်နိုင်ပါသည်" }, { status: 403 });
  try {
    const { officialStartDate } = await getOperationalPeriod();
    const [customerRows, openingRows, orderRows, paymentRows, allFollowUps] = await Promise.all([
      getCustomerDirectory().then((rows) => rows.map((row) => ({
        id: row.id, customerName: row.name, township: row.township, customerKey: row.customerKey,
        phone: row.phone, address: row.address, route: row.route, salesperson: row.salesperson, active: row.active,
      }))),
      getDb().select().from(customerOpeningBalances).where(gte(customerOpeningBalances.asOfDate, officialStartDate)),
      getDb().select({
        id: orders.id, orderNo: orders.orderNo, customerKey: orders.customerKey, customerName: orders.customerName, township: orders.township,
        salesperson: orders.salesperson, route: orders.route, orderDate: orders.orderDate, voucherAmount: orders.voucherAmount,
        voucherStatus: orders.voucherStatus, orderAmount: orders.orderAmount, paidAmount: orders.paidAmount, saleOrderCount: orders.saleOrderCount,
      }).from(orders).where(gte(orders.orderDate, officialStartDate)),
      getDb().select().from(paymentTransactions).where(gte(paymentTransactions.paymentDate, officialStartDate)),
      getDb().select().from(salesFollowUps).where(gte(salesFollowUps.createdAt, officialStartDate)).orderBy(desc(salesFollowUps.updatedAt), desc(salesFollowUps.id)).limit(1500),
    ]);
    const followUps = allFollowUps.filter((item) => item.opportunityType === "follow_up");
    const today = todayYangonKey();
    const start90Key = daysBefore(today, 89);
    const start7Key = daysBefore(today, 6);
    const customersByKey = new Map(customerRows.map((customer) => [customer.customerKey, customer]));
    const customersByPair = new Map(customerRows.map((customer) => [normalizeCustomerKey(customer.customerName, customer.township), customer]));
    const customersByName = new Map<string, typeof customerRows>();
    for (const customer of customerRows) {
      const name = normalizeCustomerValue(customer.customerName);
      customersByName.set(name, [...(customersByName.get(name) || []), customer]);
    }
    const matchCustomer = (input: { customerKey: string; customerName: string; township: string }) => {
      const exact = customersByKey.get(input.customerKey);
      if (exact) return { customer: exact, method: "exact_key" as const };
      const pair = customersByPair.get(normalizeCustomerKey(input.customerName, input.township));
      if (pair) return { customer: pair, method: "name_township" as const };
      const nameMatches = customersByName.get(normalizeCustomerValue(input.customerName)) || [];
      return nameMatches.length === 1 ? { customer: nameMatches[0], method: "unique_name" as const } : null;
    };
    const keyMismatches: Array<{ orderNo: string; customerName: string; township: string; orderKey: string; customerKey: string; method: string }> = [];
    const unmatchedOrders: Array<{ orderNo: string; customerName: string; township: string; orderKey: string }> = [];
    const map = new Map<string, {
      customerKey: string; customerName: string; township: string; route: string; salesperson: string; phone: string; address: string;
      lastOrderDate: string; orderCount90: number; voucher90: number; lifetimeOrders: number; lifetimeVoucher: number;
      voucher7: number; lastSaleVrDate: string; outstandingAmount: number; lastPaymentDate: string; saleTeam: "A" | "B" | ""; assignedByList: boolean;
    }>();
    for (const customer of customerRows) {
      const assignment = getListedSaleTeamAssignment(customer.customerName, customer.township);
      map.set(customer.customerKey, {
        customerKey: customer.customerKey, customerName: customer.customerName, township: customer.township,
        route: customer.route, salesperson: assignment?.salesperson || canonicalSalesperson(customer.salesperson), phone: customer.phone, address: customer.address,
        lastOrderDate: "", orderCount90: 0, voucher90: 0, lifetimeOrders: 0, lifetimeVoucher: 0,
        voucher7: 0, lastSaleVrDate: "", outstandingAmount: 0, lastPaymentDate: "", saleTeam: assignment?.team || "", assignedByList: Boolean(assignment),
      });
    }
    const totals = await adjustmentTotals(officialStartDate);
    for (const opening of openingRows) {
      const matched = matchCustomer(opening);
      const row = matched ? map.get(matched.customer.customerKey) : undefined;
      if (row) row.outstandingAmount += opening.openingOutstanding + (totals.get(opening.customerKey) || 0) - opening.paidAmount;
    }
    for (const order of orderRows) {
      const matched = matchCustomer(order);
      if (!matched) {
        unmatchedOrders.push({ orderNo: order.orderNo, customerName: order.customerName, township: order.township, orderKey: order.customerKey });
        continue;
      }
      const row = map.get(matched.customer.customerKey)!;
      if (order.customerKey !== matched.customer.customerKey) keyMismatches.push({
        orderNo: order.orderNo, customerName: order.customerName, township: order.township,
        orderKey: order.customerKey, customerKey: matched.customer.customerKey, method: matched.method,
      });
      const voucher = Math.max(0, order.voucherAmount || order.orderAmount);
      const saleVoucher = Math.max(0, order.voucherAmount);
      row.lifetimeOrders += Math.max(1, order.saleOrderCount || 1);
      row.lifetimeVoucher += voucher;
      row.outstandingAmount += Math.max(0, voucher - Math.max(0, order.paidAmount || 0));
      if (order.orderDate >= start90Key) {
        row.orderCount90 += Math.max(1, order.saleOrderCount || 1);
        row.voucher90 += voucher;
      }
      if (saleVoucher > 0 && (!row.lastSaleVrDate || order.orderDate > row.lastSaleVrDate)) row.lastSaleVrDate = order.orderDate;
      if (order.orderDate >= start7Key && order.orderDate <= today) row.voucher7 += saleVoucher;
      if (!row.lastOrderDate || order.orderDate > row.lastOrderDate) {
        row.lastOrderDate = order.orderDate;
        if (!row.assignedByList) row.salesperson = canonicalSalesperson(order.salesperson || row.salesperson);
        row.route = order.route || row.route;
      }
    }
    await removeCustomersWithSaleFromPendingGrowth({
      customers: [...map.values()].filter((row) => row.voucher7 > 0).map((row) => ({
        customerKey: row.customerKey,
        customerName: row.customerName,
        voucherAmount: row.voucher7,
      })),
      actor: "Sales Growth Auto Check",
    });
    for (const payment of paymentRows) {
      const matched = matchCustomer({ customerKey: "", customerName: payment.customerName, township: payment.township });
      const row = matched ? map.get(matched.customer.customerKey) : undefined;
      if (row && (!row.lastPaymentDate || payment.paymentDate > row.lastPaymentDate)) row.lastPaymentDate = payment.paymentDate;
    }
    const latestByCustomer = new Map<string, typeof followUps[number]>();
    for (const item of followUps) {
      const matched = matchCustomer(item);
      const key = matched?.customer.customerKey || item.customerKey;
      if (!latestByCustomer.has(key)) latestByCustomer.set(key, item);
    }
    const orderAmountById = new Map(orderRows.map((order) => [order.id, Math.max(0, order.voucherAmount || order.orderAmount)]));
    const currentSalesperson = canonicalSalesperson(user.displayName);
    const visible = [...map.values()].filter((row) => row.assignedByList && (user.role === "admin" || row.salesperson === currentSalesperson));
    const insights = visible.map((row) => ({
      ...row,
      inactiveDays: daysSince(row.lastOrderDate),
      recommendation: row.voucher7 > 0 ? "" : isHlaingTharYar(row.township) ? "route_call" : "follow_up",
      inclusionReason: row.voucher7 > 0 ? "Last 7 Days Sale VR ရှိ" : isHlaingTharYar(row.township) ? "Hlaing Thar Yar • Last 7 Days Sale VR = 0" : "Non-HTY • Last 7 Days Sale VR = 0",
      latestFollowUp: latestByCustomer.get(row.customerKey) || null,
    }))
      .sort((a, b) => b.inactiveDays - a.inactiveDays || b.voucher90 - a.voucher90);
    const visibleKeys = new Set(visible.map((row) => row.customerKey));
    const visibleFollowUps = followUps.filter((item) => user.role === "admin" || visibleKeys.has(item.customerKey)).map((item) => ({
      ...item, confirmedOrderAmount: item.confirmedOrderId ? orderAmountById.get(item.confirmedOrderId) || 0 : 0,
    }));
    const duplicateCustomers = [...customersByName.entries()].filter(([, rows]) => rows.length > 1).map(([name, rows]) => ({
      normalizedName: name, customers: rows.map((row) => ({ customerName: row.customerName, township: row.township, customerKey: row.customerKey })),
    }));
    const allListed = [...map.values()].filter((row) => row.assignedByList);
    const reconciliationSummary = (["A", "B"] as const).map((team) => {
      const rows = allListed.filter((row) => row.saleTeam === team);
      return {
        team, totalActiveCustomers: rows.length, saleVrExcluded: rows.filter((row) => row.voucher7 > 0).length,
        followUpCustomers: rows.filter((row) => row.voucher7 === 0 && !isHlaingTharYar(row.township)).length,
        routeSaleCustomers: rows.filter((row) => row.voucher7 === 0 && isHlaingTharYar(row.township)).length,
        unmatchedCustomers: unmatchedOrders.length, duplicateCustomers: duplicateCustomers.length,
      };
    });
    const qualityReport = user.role === "admin" ? {
      keyMismatches: keyMismatches.slice(0, 300), unmatchedOrders: unmatchedOrders.slice(0, 300), duplicateCustomers,
      saleVrCandidateLeaks: insights.filter((row) => row.voucher7 > 0 && row.recommendation).map((row) => ({ customerName: row.customerName, township: row.township, voucher7: row.voucher7 })),
    } : null;
    return Response.json({ insights, followUps: visibleFollowUps, reconciliationSummary, qualityReport, period: { start: start7Key, end: today }, canManage: true, role: user.role, currentUserName: user.displayName });
  } catch (error) {
    return loadFailed("GET", error);
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowed(user.role)) return Response.json({ error: "Admin နှင့် Sales Team သာ Sales Growth ကိုအသုံးပြုနိုင်ပါသည်" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const customerKey = clean(payload.customerKey, 300);
    const callDate = clean(payload.callDate, 10) || todayYangonKey();
    const callTime = clean(payload.callTime, 5);
    const callPurpose = clean(payload.callPurpose, 40) || "customer_follow_up";
    const callResult = clean(payload.callResult, 40) || "planned";
    const status = clean(payload.status, 30) || (callResult === "planned" ? "planned" : "completed");
    const nextFollowUpDate = clean(payload.nextFollowUpDate, 10);
    const paymentFollowUp = clean(payload.paymentFollowUp, 500);
    const customerRequest = clean(payload.customerRequest, 1000);
    const note = clean(payload.note, 1600);
    const expectedAmount = Math.max(0, Math.round(Number(payload.expectedAmount || 0)));
    const orderExpected = Boolean(payload.orderExpected || callResult === "order_received");
    if (!customerKey || !PURPOSES.includes(callPurpose) || !RESULTS.includes(callResult) || !STATUS_WHITELIST.has(status)) {
      return Response.json({ error: "Customer၊ Call Purpose၊ Result နှင့် Status ကိုစစ်ပါ" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(callDate)) return Response.json({ error: "Call Date မှားနေပါသည်" }, { status: 400 });
    if (nextFollowUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextFollowUpDate)) return Response.json({ error: "Next Follow-up Date မှားနေပါသည်" }, { status: 400 });
    if (["order_later", "follow_up_required"].includes(callResult) && !nextFollowUpDate) return Response.json({ error: "ဒီ Result အတွက် Next Follow-up Date ထည့်ပါ" }, { status: 400 });
    const directory = await getCustomerDirectory();
    const selected = directory.find((item) => item.customerKey === customerKey);
    const customer = selected ? await resolveCustomerSelection(selected.name, selected.township) : null;
    if (!customer) return Response.json({ error: "Customer Database ထဲတွင် မတွေ့ပါ" }, { status: 404 });
    const assignment = getListedSaleTeamAssignment(customer.customerName, customer.township);
    const assignedSalesperson = assignment?.salesperson || customer.salesperson;
    if (user.role !== "admin" && assignedSalesperson !== user.displayName) return Response.json({ error: "မိမိ Assign လုပ်ထားသော Customer ကိုသာ Follow-up လုပ်နိုင်ပါသည်" }, { status: 403 });
    const [saved] = await getDb().insert(salesFollowUps).values({
      customerKey, customerName: customer.customerName, township: customer.township, salesperson: assignedSalesperson,
      opportunityType: "follow_up", status, callDate, callTime, callPurpose, callResult, nextFollowUpDate,
      paymentFollowUp, customerRequest, note, expectedAmount, orderExpected,
      createdByEmail: user.email, createdByName: user.displayName, updatedBy: user.displayName, updatedAt: new Date().toISOString(),
    }).returning();
    await recordAuditLog(user, { action: "follow_up_call_created", entityType: "sales_follow_up", entityId: saved.id, summary: `${customer.customerName} • Follow Up Call မှတ်တမ်းထည့်ခဲ့သည်` });
    return Response.json({ followUp: saved }, { status: 201 });
  } catch (error) {
    return loadFailed("POST", error);
  }
}

export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowed(user.role)) return Response.json({ error: "Admin နှင့် Sales Team သာ Sales Growth ကိုပြင်နိုင်ပါသည်" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Follow-up Record မတွေ့ပါ" }, { status: 400 });
    const [existing] = await getDb().select().from(salesFollowUps).where(eq(salesFollowUps.id, id)).limit(1);
    if (!existing || existing.opportunityType !== "follow_up") return Response.json({ error: "Follow-up Record မတွေ့ပါ" }, { status: 404 });
    if (user.role !== "admin" && existing.salesperson !== user.displayName) return Response.json({ error: "မိမိ Follow-up Record ကိုသာ ပြင်နိုင်ပါသည်" }, { status: 403 });
    const confirmedOrderId = Number(payload.confirmedOrderId || 0);
    if (confirmedOrderId > 0) {
      const [order] = await getDb().select({ id: orders.id, customerKey: orders.customerKey }).from(orders).where(eq(orders.id, confirmedOrderId)).limit(1);
      if (!order || order.customerKey !== existing.customerKey) return Response.json({ error: "Customer နှင့် Sale Order မကိုက်ညီပါ" }, { status: 400 });
      const [saved] = await getDb().update(salesFollowUps).set({ confirmedOrderId, status: "order_created", callResult: "order_received", orderExpected: true, updatedBy: user.displayName, updatedAt: new Date().toISOString() }).where(eq(salesFollowUps.id, id)).returning();
      await recordAuditLog(user, { action: "follow_up_order_linked", entityType: "sales_follow_up", entityId: saved.id, summary: `${saved.customerName} • Sale Order #${confirmedOrderId} ချိတ်ခဲ့သည်` });
      return Response.json({ followUp: saved });
    }
    const status = clean(payload.status, 30) || existing.status;
    if (!STATUS_WHITELIST.has(status)) return Response.json({ error: "Follow-up Status ကိုစစ်ပါ" }, { status: 400 });
    const [saved] = await getDb().update(salesFollowUps).set({ status, updatedBy: user.displayName, updatedAt: new Date().toISOString() }).where(eq(salesFollowUps.id, id)).returning();
    await recordAuditLog(user, { action: "follow_up_call_updated", entityType: "sales_follow_up", entityId: saved.id, summary: `${saved.customerName} • ${status} ပြောင်းခဲ့သည်` });
    return Response.json({ followUp: saved });
  } catch (error) {
    return loadFailed("PATCH", error);
  }
}
