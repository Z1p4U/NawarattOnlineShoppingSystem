"use client";
import BalanceAdjustmentPanel from "./balance-adjustment-panel";

import {
  Banknote,
  Bell,
  BookOpenCheck,
  Box,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Database,
  Download,
  FileSpreadsheet,
  GraduationCap,
  MapPinned,
  LogOut,
  MessageCircle,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  Truck,
  Upload,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { FormEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CUSTOMERS } from "../data/customers";
import FinancePaymentImport from "./finance-payment-import";
import OpeningBalanceImport from "./opening-balance-import";
import BusinessModules, { type SalesOrderPrefill } from "./business-modules";
import TrialArchivePanel from "./trial-archive-panel";
import ProductMasterPage, { ProductSearchSelect, type MasterProduct } from "./product-master";
import DuplicateDetectionPanel from "./duplicate-detection-panel";
import ExaminationModule from "./examination-module";

type AppRole = "admin" | "sale" | "warehouse" | "purchase" | "delivery" | "finance" | "viewer";
type Tab = "dashboard" | "modules" | "products" | "orders" | "sale" | "warehouse" | "purchase" | "finance" | "chat" | "admin" | "settings" | "exam";
type DateMode = "all" | "today" | "yesterday" | "week" | "month" | "custom";
type DeliveryView = "pending" | "approval_pending" | "on_the_way" | "delivered";
type WarehouseView = "pending" | "completed" | "ready";
type FinanceView = "all" | "outstanding" | "today-payment" | "week-payment" | "unpaid-5" | "unpaid-10" | "unpaid-20";
type FinanceSort = "amount-desc" | "amount-asc" | "days-desc" | "days-asc" | "name-asc";
type DebtSort = "days-desc" | "outstanding-desc" | "voucher-desc";
type ReportPaymentFilter = "all" | "paid" | "partial" | "unpaid";
type ReportDeliveryFilter = "all" | "pending" | "out_for_delivery" | "delivered" | "partial" | "returned" | "rescheduled";
type ReportOutstandingFilter = "all" | "5_plus" | "10_plus" | "20_plus";
type ManagementReportView = "overview" | "sale-vouchers";

type StaffUser = {
  email: string;
  displayName: string;
  role: AppRole;
  updatedAt: string;
  hasPassword: boolean;
};

type AuditLog = {
  id: number;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
};

type DepartmentNotification = {
  id: number;
  recipientRole: string;
  title: string;
  message: string;
  targetTab: Tab;
  sourceId: number;
  actor: string;
  createdAt: string;
  isRead: boolean;
};

type DepartmentMessage = {
  id: number;
  senderEmail: string;
  senderName: string;
  senderRole: AppRole;
  recipientRole: AppRole;
  message: string;
  createdAt: string;
  isOwn: boolean;
  isRead: boolean;
};

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

type OrderEvent = {
  id: number;
  orderId: number;
  eventType: string;
  message: string;
  actor: string;
  createdAt: string;
};

type OrderItem = {
  id: number;
  orderId: number;
  batchSequence: number;
  originalRowNumber: number;
  originalProductCode: string;
  originalDescription: string;
  originalQuantity: string;
  quantity: number;
  originalUnit: string;
  checkedUnit: string;
  originalSalePrice: string;
  matchedProductCode: string;
  matchedProductName: string;
  matchStatus: "matched" | "unknown" | "new_product_requested" | "unavailable";
  fulfillmentStatus: "pending" | "picked" | "shortage" | "unavailable";
  pickedQuantity: number;
  checkedQuantity: number;
  shortageQuantity: number;
  resolutionNote: string;
  substituteProductCode: string;
  substituteProductName: string;
  substituteSku: string;
  substituteSalePrice: number;
  substituteQuantity: number;
  substitutionStatus: "none" | "proposed" | "confirmed" | "returned";
  substitutionReason: string;
  substitutionProposedBy: string;
  substitutionProposedAt: string;
  substitutionConfirmedBy: string;
  substitutionConfirmedAt: string;
  substitutionReturnedBy: string;
  substitutionReturnedAt: string;
  substitutionReturnReason: string;
  verifiedBy: string;
  verifiedAt: string;
};

type Order = {
  id: number;
  customerKey: string;
  orderNo: string;
  orderDate: string;
  customerName: string;
  township: string;
  salesperson: string;
  route: string;
  initialBoxes: number;
  initialBundles: number;
  addonBoxes: number;
  addonBundles: number;
  deliveredBoxes: number;
  deliveredBundles: number;
  orderAmount: number;
  voucherAmount: number;
  voucherStatus: string;
  voucherUpdatedBy: string;
  voucherUpdatedAt: string;
  saleApproved: boolean;
  saleApprovedBy: string;
  saleApprovedAt: string;
  paidAmount: number;
  saleOrderCount: number;
  warehouseStatus: string;
  warehouseBatches: WarehouseBatch[];
  orderItems: OrderItem[];
  warehouseConfirmedBy: string;
  warehouseConfirmedAt: string;
  dispatchStatus: string;
  deliveredAt: string;
  deliveryProofKey: string;
  deliveryProofName: string;
  deliveryProofType: string;
  deliveryProofUploadedBy: string;
  deliveryProofUploadedAt: string;
  paymentStatus: string;
  addonPending: boolean;
  remark: string;
  packageInstruction: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

type DeliveryIncident = {
  id: number;
  orderId: number;
  issueType: "return" | "wrong" | "extra" | "missing";
  itemDetails: string;
  deductionAmount: number;
  voucherBefore: number;
  voucherAfter: number;
  proofName: string;
  createdBy: string;
  createdAt: string;
  customerName?: string;
  orderNo?: string;
  route?: string;
};

type WarehouseReturn = {
  id: number;
  orderId: number;
  returnedBoxes: number;
  returnedBundles: number;
  financeStatus: "deducted" | "not_deducted";
  note: string;
  acceptedBy: string;
  acceptedAt: string;
  updatedBy: string;
  updatedAt: string;
};

type PurchaseRequest = {
  sourceType: "sale_order" | "customer_request";
  id: number;
  orderId: number;
  batchSequence: number;
  productName: string;
  productCode: string;
  quantity: number;
  unit: string;
  supplierName: string;
  note: string;
  status: "pending" | "ordered" | "ordered_company" | "ordered_mglz" | "stock_out" | "unavailable" | "received" | "cancelled";
  requestedBy: string;
  requestedByEmail?: string;
  salesperson?: string;
  requestedAt: string;
  updatedBy: string;
  updatedAt: string;
  orderNo: string;
  orderDate: string;
  requestDate?: string;
  customerName: string;
  township: string;
  route: string;
  sourceFileId?: string;
  sourceFileName?: string;
  aiConfidence?: number;
  incomingAvailable?: boolean;
  incomingQuantity?: number;
  allocatedIncomingQuantity?: number;
  remainingQuantity?: number;
  incomingSupplier?: string;
  incomingDate?: string;
  importedAt?: string;
  incomingSource?: string;
  incomingMatchedBy?: "code" | "alias" | "name" | "mixed" | "";
  incomingRecordCount?: number;
  arrivalStatus?: "full" | "partial" | "review" | "none";
  arrivalAllocationIds?: number[];
  reviewReason?: string;
};

type ArrivalState = "full" | "partial" | "review" | "none";

function purchaseGroupArrivalState(items: PurchaseRequest[]): ArrivalState {
  const states = items.map((item) => item.arrivalStatus || "none");
  const allocated = items.reduce((sum, item) => sum + (item.allocatedIncomingQuantity || 0), 0);
  const required = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  if (allocated >= required && required > 0) return "full";
  if (allocated > 0 || states.includes("partial") || states.includes("full")) return "partial";
  if (states.includes("review")) return "review";
  return "none";
}

function PurchaseArrivalBadge({ state }: { state: ArrivalState }) {
  if (state === "none") return null;
  const label = state === "full" ? "ပြန်ရောက်" : state === "partial" ? "တစ်စိတ်တစ်ပိုင်းပြန်ရောက်" : "Matching စစ်ဆေးရန်";
  return <span className={`purchase-arrival-status ${state}`}>{label}</span>;
}

function PurchaseArrivalSummary({ items, state }: { items: PurchaseRequest[]; state: ArrivalState }) {
  if (state === "none") return null;
  const allocated = items.reduce((sum, item) => sum + (item.allocatedIncomingQuantity || 0), 0);
  const remaining = items.reduce((sum, item) => sum + (item.remainingQuantity ?? item.quantity), 0);
  const suppliers = [...new Set(items.map((item) => item.incomingSupplier).filter(Boolean))].join(", ");
  const latest = [...items].filter((item) => item.importedAt).sort((a, b) => (b.importedAt || "").localeCompare(a.importedAt || ""))[0];
  return <div className={`purchase-arrival-summary ${state}`}><span><strong>{state === "full" ? "ပြန်ရောက်ရှိပါပြီ" : state === "partial" ? "တစ်စိတ်တစ်ပိုင်း ပြန်ရောက်ရှိပါပြီ" : "Matching စစ်ဆေးရန်လိုသည်"}</strong><small>{latest?.importedAt ? notificationTime(latest.importedAt) : "—"} • {suppliers || "Supplier မသတ်မှတ်ရသေး"}</small></span><b>{allocated} Qty</b><small>{state === "review" ? "Purchase Date သည် Request Date ထက် 7 ရက်ကျော်စောနေသောကြောင့် Green မပြပါ" : `Remaining ${remaining} Qty • Import completion time အရ FIFO ခွဲဝေထားသည်`}</small></div>;
}

function purchaseProductKey(request: PurchaseRequest) {
  const code = request.productCode.trim().toLocaleUpperCase();
  const name = request.productName.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const unit = (request.unit || "unit").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return `${code ? `code:${code}` : `name:${name}`}|||unit:${unit}`;
}

type PurchaseStatusBucket = "pending" | "ordered_company" | "ordered_mglz" | "stock_out" | "unavailable";
type PurchaseTimeBucket = "before_3pm" | "after_3pm";

function purchaseStatusBucket(status: PurchaseRequest["status"]): PurchaseStatusBucket {
  if (status === "ordered" || status === "received") return "ordered_company";
  if (status === "cancelled") return "unavailable";
  return status;
}

function purchaseGroupBucket(items: PurchaseRequest[]): PurchaseStatusBucket {
  const buckets = items.map((item) => purchaseStatusBucket(item.status));
  if (buckets.includes("pending")) return "pending";
  if (buckets.includes("ordered_company")) return "ordered_company";
  if (buckets.includes("ordered_mglz")) return "ordered_mglz";
  if (buckets.includes("stock_out")) return "stock_out";
  return "unavailable";
}

function purchaseStatusLabel(status: PurchaseStatusBucket) {
  return status === "pending" ? "ဝယ်ရန်" : status === "ordered_company" ? "မှာပြီး Company" : status === "ordered_mglz" ? "မှာပြီး MGLZ" : status === "stock_out" ? "ပစ္စည်းပြတ်" : "မရပါ";
}

function purchaseTimeBucket(requestedAt: string): PurchaseTimeBucket {
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(requestedAt) ? requestedAt : `${requestedAt.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "before_3pm";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yangon", hour: "2-digit", hourCycle: "h23" }).format(date));
  return hour < 15 ? "before_3pm" : "after_3pm";
}

type BulkPurchaseItem = { productName: string; quantity: number; unit: string };

function parseBulkPurchaseItems(value: string, customerName: string) {
  const items: BulkPurchaseItem[] = [];
  const invalid: string[] = [];
  const normalizedCustomer = customerName.trim().toLocaleLowerCase();
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(line)) continue;
    if (normalizedCustomer && line.toLocaleLowerCase() === normalizedCustomer) continue;
    const match = line.match(/^(.+?)\s+(\d+)\s*([A-Za-z\u1000-\u109F]+)$/);
    if (!match) { invalid.push(line); continue; }
    const quantity = Number(match[2]);
    if (!Number.isInteger(quantity) || quantity < 1) { invalid.push(line); continue; }
    items.push({ productName: match[1].trim(), quantity, unit: match[3].trim() });
  }
  return { items, invalid };
}

type LedgerStatusItem = { key: string; label: string; date: string; voucherAmount: number; paidAmount: number; balance: number };

type CustomerLedger = {
  key: string;
  customerName: string;
  township: string;
  route: string;
  salesperson: string;
  salespeople: string[];
  latestDate: string;
  currentVoucher: number;
  currentReceived: number;
  periodPayment: number;
  adjustmentAmount?: number;
  openingAmount: number;
  openingDate: string;
  openingBalance: number;
  previousBalance: number;
  totalVoucher: number;
  totalReceived: number;
  totalBalance: number;
  paidCount: number;
  unpaidCount: number;
  partialCount: number;
  paidItems: LedgerStatusItem[];
  unpaidItems: LedgerStatusItem[];
  partialItems: LedgerStatusItem[];
  oldestOutstandingDate: string;
  lastPaymentDate: string;
  noPaymentDays: number;
};

type PaymentTransaction = {
  id: number;
  orderId: number;
  customerName: string;
  township: string;
  amount: number;
  method: "cash" | "banking";
  paymentDate: string;
  enteredBy: string;
  createdAt: string;
};

type DebtCustomerRow = {
  key: string;
  customerName: string;
  township: string;
  route: string;
  salespeople: string;
  oldestOrder: Order;
  oldestUnpaidDate: string;
  unpaidSaleVr: number;
  outstanding: number;
  debtAgeDays: number;
};

type NoPaymentCustomerRow = {
  ledger: CustomerLedger;
  referenceDate: string;
  referenceType: "payment" | "opening" | "oldest-unpaid";
  noPaymentDays: number;
  oldestOrder?: Order;
};

type OpeningBalance = {
  id: number;
  customerKey: string;
  asOfDate: string;
  customerName: string;
  township: string;
  openingPackages: number;
  deliveredPackages: number;
  openingOutstanding: number;
  adjustmentAmount?: number;
  paidAmount: number;
  note: string;
  enteredBy: string;
  updatedAt: string;
};

type CustomerDirectoryItem = {
  id: number;
  customerKey?: string;
  name: string;
  township: string;
  phone: string;
  address: string;
  route: string;
  salesperson: string;
  active: boolean;
  source: "built_in" | "custom";
};

const ROUTES = ["HTY Ways", "Pick Up", "Aung Mingalar", "BayinNaung"];
const SALE_PEOPLE = ["Zaw Tun Kyaw", "Zin Mg Mg Lin", "Myo Min", "Htin Lin Kyaw Swar", "Aung Kyaw Zaw", "Admin"];
type SaleTeamKey = "A" | "B";
type SaleTeamFilter = "All" | SaleTeamKey;
const SALE_TEAM_MEMBERS: Record<SaleTeamKey, readonly string[]> = {
  A: ["Zin Mg Mg Lin", "Myo Min", "Htin Lin Kyaw Swar", "Aung Kyaw Zaw"],
  B: ["Admin", "Zaw Tun Kyaw"],
} as const;
function matchesSaleTeam(names: string[], team: SaleTeamFilter) {
  return team === "All" || names.some((name) => SALE_TEAM_MEMBERS[team].includes(name));
}
function salePeopleForTeam(team: SaleTeamFilter) {
  return team === "All" ? SALE_PEOPLE : [...SALE_TEAM_MEMBERS[team]];
}
const WAREHOUSE_STAFF = ["Han Htoo Aung", "Zin Wint Aung Htoo", "Ye Lwin Han", "Khant Ko Ko Htut", "Pyae Phyo Aung", "Naing Ko Win", "Thet Paing Htwe", "Aung Paing Phyo", "Kyaw Min Aung", "Myo Wai Tun", "Aye Min Soe", "Zar Ni", "Thet Zaw Ye"];
const INITIAL_CUSTOMERS: CustomerDirectoryItem[] = CUSTOMERS.map((customer) => ({ ...customer, id: 0, phone: "", address: "", route: ROUTES[0], salesperson: "Admin", active: true, source: "built_in" }));
const CHAT_ROLES: AppRole[] = ["admin", "sale", "warehouse", "purchase", "delivery", "finance"];
const roleLabel: Record<AppRole, string> = { admin: "Admin", sale: "Sale Team", warehouse: "Warehouse", purchase: "Purchase", delivery: "Delivery", finance: "Finance", viewer: "Viewer" };
const statusLabel: Record<string, string> = {
  awaiting_warehouse: "Warehouse Processing",
  packed: "Warehouse Finished",
  out_for_delivery: "On the way",
  delivered: "ပို့ပြီး",
  partial: "တစ်စိတ်တစ်ပိုင်းပို့ပြီး",
  returned: "ပြန်အပ်",
  rescheduled: "ပြန်ချိန်း",
};
const paymentLabel: Record<string, string> = { unpaid: "ငွေမဝင်သေး", partial: "တစ်စိတ်တစ်ပိုင်းဝင်", paid: "ငွေဝင်ပြီး", credit: "အကြွေး", pending: "စစ်ဆေးဆဲ" };
const deliveryIssueLabel: Record<DeliveryIncident["issueType"], string> = {
  return: "Return ပစ္စည်း",
  wrong: "ပစ္စည်းမှား",
  extra: "ပစ္စည်းပို",
  missing: "ပစ္စည်းလို",
};

function todayLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function localDateString(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function rangeForMode(mode: DateMode, customStart: string, customEnd: string) {
  const today = todayLocal();
  if (mode === "all") return { start: "", end: "" };
  if (mode === "today") return { start: today, end: today };
  const current = new Date(`${today}T12:00:00`);
  if (mode === "yesterday") {
    current.setDate(current.getDate() - 1);
    const yesterday = localDateString(current);
    return { start: yesterday, end: yesterday };
  }
  if (mode === "week") {
    const mondayOffset = (current.getDay() + 6) % 7;
    const start = new Date(current);
    start.setDate(current.getDate() - mondayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: localDateString(start), end: localDateString(end) };
  }
  if (mode === "month") {
    const start = new Date(current.getFullYear(), current.getMonth(), 1, 12);
    const end = new Date(current.getFullYear(), current.getMonth() + 1, 0, 12);
    return { start: localDateString(start), end: localDateString(end) };
  }
  return customStart <= customEnd
    ? { start: customStart, end: customEnd }
    : { start: customEnd, end: customStart };
}

function money(value: number) { return new Intl.NumberFormat("en-US").format(value || 0); }
function displayUnit(value: string) {
  const unit = value.trim();
  return unit && !/^[\d.,]+$/.test(unit) ? unit : "";
}
type WarehouseBatchDraft = { packageMode: "" | "original" | "new"; linkedOrderId: string; boxes: string; bundles: string; itemPackedBy: string; itemCheckedBy: string; boxClosedBy: string };
function makeBatchDrafts(batches: WarehouseBatch[]): Record<number, WarehouseBatchDraft> {
  return Object.fromEntries(batches.map((batch) => [batch.sequence, { packageMode: (batch.packageMode || "") as WarehouseBatchDraft["packageMode"], linkedOrderId: String(batch.linkedOrderId || ""), boxes: String(batch.boxes || ""), bundles: String(batch.bundles || ""), itemPackedBy: batch.itemPackedBy || "", itemCheckedBy: batch.itemCheckedBy || "", boxClosedBy: batch.boxClosedBy || "" }]));
}
function makeVoucherDrafts(order: Order): Record<number, string> {
  const hasBreakdown = order.warehouseBatches.some((batch) => batch.voucherAmount !== undefined);
  return Object.fromEntries(order.warehouseBatches.map((batch, index) => {
    const amount = batch.voucherAmount ?? (!hasBreakdown && index === 0 ? order.voucherAmount : 0);
    return [batch.sequence, amount > 0 || order.voucherStatus === "updated" ? String(amount) : ""];
  }));
}
function totals(order: Order) {
  const boxes = order.initialBoxes + order.addonBoxes;
  const bundles = order.initialBundles + order.addonBundles;
  return { boxes, bundles, total: boxes + bundles, delivered: order.deliveredBoxes + order.deliveredBundles, remaining: Math.max(0, boxes + bundles - order.deliveredBoxes - order.deliveredBundles) };
}
function voucherBalance(order: Order) {
  return order.voucherStatus === "updated" ? Math.max(0, order.voucherAmount - order.paidAmount) : 0;
}
function customerBalanceKey(customerName: string, township: string) {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  return `${normalize(customerName)}|||${normalize(township)}`;
}
function daysSince(date: string) {
  const start = Date.parse(`${date}T00:00:00Z`);
  const end = Date.parse(`${todayLocal()}T00:00:00Z`);
  return Number.isFinite(start) ? Math.max(0, Math.floor((end - start) / 86_400_000)) : 0;
}
function hoursSince(value: string) {
  const parsed = parseServerTimestamp(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, (Date.now() - parsed.getTime()) / 3_600_000);
}
function parseServerTimestamp(value: string) {
  const trimmed = value?.trim();
  if (!trimmed) return new Date(Number.NaN);
  // D1 CURRENT_TIMESTAMP values are UTC but arrive without an explicit zone.
  // ISO values already carrying Z or an offset must be left unchanged.
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)
    ? `${trimmed.replace(" ", "T")}Z`
    : trimmed;
  return new Date(normalized);
}
function localDateKey(value: string) {
  const parsed = parseServerTimestamp(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Yangon" }).format(parsed);
}
function deliveredDate(value: string) {
  const parsed = parseServerTimestamp(value);
  if (!value || Number.isNaN(parsed.getTime())) return value || "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Yangon",
  }).format(parsed);
}
function notificationTime(value: string) {
  const parsed = parseServerTimestamp(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Yangon",
  }).format(parsed);
}
function assignedSalePeople(order: Order) {
  const names = order.warehouseBatches.map((batch) => batch.salesperson).filter((name): name is string => Boolean(name));
  return [...new Set(names.length ? names : [order.salesperson || "Admin"])].join(", ");
}

async function loadImageForCompression(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch { /* Use the iPhone-compatible image element fallback below. */ }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("ပုံဖတ်မရပါ"));
    image.src = url;
  });
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

function compressedImageFile(blob: Blob, originalName: string) {
  const webp = blob.type === "image/webp";
  return new File([blob], originalName.replace(/\.[^.]+$/, webp ? ".webp" : ".jpg"), { type: webp ? "image/webp" : "image/jpeg", lastModified: Date.now() });
}

const INCIDENT_AUTO_DETAILS: Record<DeliveryIncident["issueType"], string> = {
  return: "Return ပစ္စည်း အထောက်အထားပုံ",
  wrong: "ပစ္စည်းမှား အထောက်အထားပုံ",
  extra: "ပစ္စည်းပို အထောက်အထားပုံ",
  missing: "ပစ္စည်းလို အထောက်အထားပုံ",
};

async function optimizeImageFile(file: File, maxDimension = 1280, targetBytes = 120 * 1024) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  let loaded: Awaited<ReturnType<typeof loadImageForCompression>> | null = null;
  try {
    loaded = await loadImageForCompression(file);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return file;
    let scale = Math.min(1, maxDimension / Math.max(loaded.width, loaded.height));
    let best: Blob | null = null;
    const qualities = [0.68, 0.56, 0.46, 0.38];
    for (let resizePass = 0; resizePass < 4; resizePass += 1) {
      canvas.width = Math.max(1, Math.round(loaded.width * scale));
      canvas.height = Math.max(1, Math.round(loaded.height * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(loaded.source, 0, 0, canvas.width, canvas.height);
      for (const quality of qualities) {
        let candidate = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
        if (!candidate) candidate = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (!candidate) continue;
        if (!best || candidate.size < best.size) best = candidate;
      }
      if (best && best.size <= targetBytes) {
        if (best.size >= file.size) return file;
        return compressedImageFile(best, file.name);
      }
      const nextLongestSide = Math.max(canvas.width, canvas.height) * 0.82;
      if (nextLongestSide < 820) break;
      scale *= 0.82;
    }
    if (!best || best.size >= file.size) return file;
    return compressedImageFile(best, file.name);
  } catch {
    return file;
  } finally {
    loaded?.release();
  }
}

export default function DashboardClient({ userName, initialRole }: { userName: string; initialRole: AppRole }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [role, setRole] = useState<AppRole>(initialRole);
  const [dateMode, setDateMode] = useState<DateMode>("today");
  const [customStart, setCustomStart] = useState(todayLocal);
  const [customEnd, setCustomEnd] = useState(todayLocal);
  const [orders, setOrders] = useState<Order[]>([]);
  const [financeOrders, setFinanceOrders] = useState<Order[]>([]);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeView, setFinanceView] = useState<FinanceView>("all");
  const [financeSort, setFinanceSort] = useState<FinanceSort>("amount-desc");
  const [debtSort, setDebtSort] = useState<DebtSort>("days-desc");
  const [financeCustomerQuery, setFinanceCustomerQuery] = useState("");
  const [financePage, setFinancePage] = useState(1);
  const [selectedPaymentDate, setSelectedPaymentDate] = useState("");
  const [paymentTransactions, setPaymentTransactions] = useState<PaymentTransaction[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [openingBalances, setOpeningBalances] = useState<OpeningBalance[]>([]);
  const [openingLoading, setOpeningLoading] = useState(true);
  const [customerDirectory, setCustomerDirectory] = useState<CustomerDirectoryItem[]>(INITIAL_CUSTOMERS);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState(true);
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [recentDeliveryIssues, setRecentDeliveryIssues] = useState<DeliveryIncident[]>([]);
  const [evidenceRouteFilter, setEvidenceRouteFilter] = useState("All");
  const [evidenceSalespersonFilter, setEvidenceSalespersonFilter] = useState("All");
  const [evidencePage, setEvidencePage] = useState(1);
  const [evidenceViewer, setEvidenceViewer] = useState<{ src: string; title: string; meta: string } | null>(null);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saleOrderPrefill, setSaleOrderPrefill] = useState<SalesOrderPrefill | null>(null);
  const [showCustomerRequest, setShowCustomerRequest] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [selectedWarehouseWorkflow, setSelectedWarehouseWorkflow] = useState(false);
  const [query, setQuery] = useState("");
  const [routeFilter, setRouteFilter] = useState("All");
  const [salesTeamFilter, setSalesTeamFilter] = useState<SaleTeamFilter>("All");
  const [salespersonFilter, setSalespersonFilter] = useState("All");
  const [reportSaleTeamFilter, setReportSaleTeamFilter] = useState<"All" | SaleTeamKey>("All");
  const [reportSalespersonFilter, setReportSalespersonFilter] = useState("All");
  const [reportRouteFilter, setReportRouteFilter] = useState("All");
  const [reportPaymentFilter, setReportPaymentFilter] = useState<ReportPaymentFilter>("all");
  const [reportDeliveryFilter, setReportDeliveryFilter] = useState<ReportDeliveryFilter>("all");
  const [reportOutstandingFilter, setReportOutstandingFilter] = useState<ReportOutstandingFilter>("all");
  const [managementReportView, setManagementReportView] = useState<ManagementReportView>("overview");
  const [voucherReportQuery, setVoucherReportQuery] = useState("");
  const [warehousePage, setWarehousePage] = useState(1);
  const [warehouseView, setWarehouseView] = useState<WarehouseView>("pending");
  const [deliveryView, setDeliveryView] = useState<DeliveryView>("pending");
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<number[]>([]);
  const [deliveryBulkBusy, setDeliveryBulkBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [notifications, setNotifications] = useState<DepartmentNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [chatMessages, setChatMessages] = useState<DepartmentMessage[]>([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatPeer, setChatPeer] = useState<AppRole>(initialRole === "warehouse" ? "sale" : "warehouse");
  const notificationReady = useRef(false);
  const previousUnread = useRef(0);
  const previousChatUnread = useRef(0);

  const isAdmin = role === "admin";
  const canSale = isAdmin || role === "sale";
  const canWarehouse = isAdmin || role === "warehouse";
  const canPurchase = isAdmin || role === "purchase";
  const canDelivery = isAdmin || role === "delivery";
  const canFinance = isAdmin || role === "finance";
  const canViewFinance = canFinance || role === "sale";
  const activeRange = useMemo(() => rangeForMode(dateMode, customStart, customEnd), [dateMode, customStart, customEnd]);
  const dateQuery = useMemo(() => {
    if (dateMode === "all") return "";
    const params = new URLSearchParams({ startDate: activeRange.start, endDate: activeRange.end });
    return `?${params.toString()}`;
  }, [activeRange.end, activeRange.start, dateMode]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const loadNotifications = useCallback(async (announce = false) => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Notification load failed");
      const items = data.notifications as DepartmentNotification[];
      const unread = Number(data.unread || 0);
      if (announce && notificationReady.current && unread > previousUnread.current) {
        const latest = items.find((item) => !item.isRead);
        if (latest) notify(`🔔 ${latest.title} — ${latest.message}`);
      }
      notificationReady.current = true;
      previousUnread.current = unread;
      setNotifications(items);
    } catch { /* Other page data remains usable if notification refresh is interrupted. */ }
  }, [notify]);

  const markNotification = useCallback(async (item: DepartmentNotification) => {
    if (!item.isRead) {
      setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
      previousUnread.current = Math.max(0, previousUnread.current - 1);
      await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    }
    if (item.sourceId > 0) {
      let relatedOrder = orders.find((order) => order.id === item.sourceId)
        ?? financeOrders.find((order) => order.id === item.sourceId);
      if (!relatedOrder) {
        try {
          const response = await fetch("/api/orders", { cache: "no-store" });
          const data = await response.json();
          if (response.ok) relatedOrder = (data.orders as Order[]).find((order) => order.id === item.sourceId);
        } catch { /* The notification can still open its target page. */ }
      }
      if (relatedOrder) setSelected(relatedOrder);
    }
    setTab(item.targetTab);
    setShowNotifications(false);
  }, [financeOrders, orders]);

  const markAllNotifications = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    previousUnread.current = 0;
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ all: true }) });
  }, []);

  const loadChat = useCallback(async (announce = false) => {
    try {
      const response = await fetch("/api/chat", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chat load failed");
      const unread = Number(data.unread || 0);
      if (announce && unread > previousChatUnread.current) {
        const latest = [...(data.messages as DepartmentMessage[])].reverse().find((item) => !item.isOwn && !item.isRead);
        if (latest) notify(`💬 ${roleLabel[latest.senderRole]} — ${latest.message}`);
      }
      previousChatUnread.current = unread;
      setChatUnread(unread);
      setChatMessages(data.messages);
    } catch { /* Keep the rest of the application available. */ }
    finally { setChatLoading(false); }
  }, [notify]);

  const markChatRead = useCallback(async (peerRole: AppRole) => {
    setChatMessages((current) => current.map((item) => item.recipientRole === role && item.senderRole === peerRole ? { ...item, isRead: true } : item));
    await fetch("/api/chat", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ peerRole }) });
    await loadChat(false);
  }, [loadChat, role]);

  const logOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/");
  }, []);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/orders${dateQuery}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Data load failed");
      setOrders(data.orders);
    } catch (error) {
      if (!silent) notify(error instanceof Error ? error.message : "Data load failed");
    } finally { if (!silent) setLoading(false); }
  }, [dateQuery, notify]);

  const loadPurchaseRequests = useCallback(async () => {
    setPurchaseLoading(true);
    try {
      const response = await fetch(`/api/purchase-requests${dateQuery}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Purchase data load failed");
      setPurchaseRequests(data.requests);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Purchase data load failed");
    } finally { setPurchaseLoading(false); }
  }, [dateQuery, notify]);

  const loadFinanceOrders = useCallback(async () => {
    setFinanceLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Finance data load failed");
      setFinanceOrders(data.orders);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Finance data load failed");
    } finally { setFinanceLoading(false); }
  }, [notify]);

  const loadRecentDeliveryIssues = useCallback(async () => {
    try {
      const response = await fetch("/api/delivery-incidents", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delivery အထောက်အထား ရယူမရပါ");
      setRecentDeliveryIssues(data.issues || []);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Delivery အထောက်အထား ရယူမရပါ");
    }
  }, [notify]);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const response = await fetch("/api/payments", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment report load failed");
      setPaymentTransactions(data.payments);
    } catch (error) { notify(error instanceof Error ? error.message : "Payment report load failed"); }
    finally { setPaymentsLoading(false); }
  }, [notify]);

  const loadOpeningBalances = useCallback(async () => {
    setOpeningLoading(true);
    try {
      const response = await fetch("/api/opening-balances", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Opening data load failed");
      setOpeningBalances(data.balances);
    } catch (error) { notify(error instanceof Error ? error.message : "Opening data load failed"); }
    finally { setOpeningLoading(false); }
  }, [notify]);

  const loadCustomers = useCallback(async () => {
    try {
      const response = await fetch("/api/customers", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Customer data load failed");
      setCustomerDirectory(data.customers);
    } catch (error) { notify(error instanceof Error ? error.message : "Customer data load failed"); }
  }, [notify]);

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      const data = await response.json() as { products?: MasterProduct[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Product Master load failed");
      setProducts(data.products || []);
    } catch (error) { notify(error instanceof Error ? error.message : "Product Master load failed"); }
  }, [notify]);

  const loadStaffUsers = useCallback(async () => {
    setStaffLoading(true);
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "User data load failed");
      setStaffUsers(data.users);
    } catch (error) {
      notify(error instanceof Error ? error.message : "User data load failed");
    } finally { setStaffLoading(false); }
  }, [notify]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/audit-logs", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setAuditLogs(data.logs || []);
    } catch { /* Audit history should not block the dashboard. */ }
  }, []);

  useEffect(() => {
    void fetch("/api/me", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Role load failed");
      setRole(data.user.role);
      if (data.user.role === "warehouse") setChatPeer("sale");
      else if (data.user.role !== "viewer") setChatPeer("warehouse");
      const homeByRole: Partial<Record<AppRole, Tab>> = { sale: "sale", delivery: "orders", warehouse: "warehouse", purchase: "purchase", finance: "finance" };
      if (homeByRole[data.user.role as AppRole]) setTab(homeByRole[data.user.role as AppRole]!);
    }).catch((error) => notify(error instanceof Error ? error.message : "Role load failed"));
  }, [notify]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);
  useEffect(() => {
    if (selected) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadOrders(true);
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [loadOrders, selected]);
  useEffect(() => { void loadPurchaseRequests(); }, [loadPurchaseRequests]);
  useEffect(() => { void loadFinanceOrders(); }, [loadFinanceOrders]);
  useEffect(() => { void loadRecentDeliveryIssues(); }, [loadRecentDeliveryIssues]);
  useEffect(() => { void loadOpeningBalances(); }, [loadOpeningBalances]);
  useEffect(() => { void loadCustomers(); }, [loadCustomers]);
  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => { if (canViewFinance) void loadPayments(); }, [canViewFinance, loadPayments]);
  useEffect(() => { if (isAdmin) void loadStaffUsers(); }, [isAdmin, loadStaffUsers]);
  useEffect(() => { void loadAuditLogs(); const timer = window.setInterval(() => void loadAuditLogs(), 15_000); return () => window.clearInterval(timer); }, [loadAuditLogs]);
  useEffect(() => {
    void loadNotifications(false);
    const timer = window.setInterval(() => void loadNotifications(true), 10_000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);
  useEffect(() => {
    void loadChat(false);
    const timer = window.setInterval(() => void loadChat(true), 6_000);
    return () => window.clearInterval(timer);
  }, [loadChat]);
  useEffect(() => {
    if (tab === "chat") void markChatRead(chatPeer);
  }, [chatPeer, markChatRead, tab]);

  const unreadNotifications = notifications.filter((item) => !item.isRead).length;
  const navNotificationCount = (targetTab: Tab) => notifications.filter((item) => !item.isRead && item.targetTab === targetTab).length;
  const openFinanceTab = useCallback(() => {
    setTab("finance");
    void Promise.all([loadFinanceOrders(), loadPayments(), loadOpeningBalances()]);
  }, [loadFinanceOrders, loadOpeningBalances, loadPayments]);

  const filtered = useMemo(() => {
    const needle = query.toLocaleLowerCase();
    return orders.filter((order) => {
      const routeMatch = routeFilter === "All" || order.route === routeFilter;
      const salespersonNames = assignedSalePeople(order);
      const teamMatch = matchesSaleTeam(salespersonNames.split(", "), salesTeamFilter);
      const salespersonMatch = salespersonFilter === "All" || salespersonNames.split(", ").includes(salespersonFilter);
      const textMatch = !needle || order.customerName.toLocaleLowerCase().includes(needle) || order.township.toLocaleLowerCase().includes(needle) || order.orderNo.toLocaleLowerCase().includes(needle) || salespersonNames.toLocaleLowerCase().includes(needle);
      return routeMatch && teamMatch && salespersonMatch && textMatch;
    });
  }, [orders, query, routeFilter, salesTeamFilter, salespersonFilter]);

  const summary = useMemo(() => orders.reduce((acc, order) => {
    const t = totals(order);
    const count = order.saleOrderCount || 1;
    acc.saleOrders += count;
    acc.boxes += t.boxes;
    acc.bundles += t.bundles;
    acc.total += t.total;
    acc.remaining += t.remaining;
    if (order.warehouseStatus !== "finished") acc.processing += count;
    else acc.finished += count;
    if (order.warehouseStatus === "finished" && order.voucherStatus === "pending") acc.voucherPending += 1;
    if (order.warehouseStatus === "finished" && order.voucherStatus === "updated" && !order.saleApproved && order.dispatchStatus !== "delivered") acc.approvalPending += 1;
    if (order.dispatchStatus === "delivered") acc.delivered += 1;
    if (order.paymentStatus === "paid") acc.paid += 1;
    return acc;
  }, { saleOrders: 0, processing: 0, finished: 0, voucherPending: 0, approvalPending: 0, boxes: 0, bundles: 0, total: 0, remaining: 0, delivered: 0, paid: 0 }), [orders]);
  const openingSummary = useMemo(() => openingBalances.reduce((acc, item) => {
    acc.packages += item.openingPackages;
    acc.delivered += item.deliveredPackages;
    acc.packageBalance += Math.max(0, item.openingPackages - item.deliveredPackages);
    acc.outstanding += item.openingOutstanding;
    acc.received += item.paidAmount;
    acc.moneyBalance += item.openingOutstanding + (item.adjustmentAmount || 0) - item.paidAmount;
    return acc;
  }, { packages: 0, delivered: 0, packageBalance: 0, outstanding: 0, received: 0, moneyBalance: 0 }), [openingBalances]);
  const customerPackageBalances = useMemo(() => {
    const rows = new Map<string, { key: string; customerName: string; township: string; opening: number; newPackages: number; delivered: number; balance: number }>();
    for (const item of openingBalances) {
      const key = customerBalanceKey(item.customerName, item.township);
      rows.set(key, { key, customerName: item.customerName, township: item.township, opening: item.openingPackages, newPackages: 0, delivered: item.deliveredPackages, balance: Math.max(0, item.openingPackages - item.deliveredPackages) });
    }
    for (const order of financeOrders) {
      const key = customerBalanceKey(order.customerName, order.township);
      const t = totals(order);
      const row = rows.get(key) ?? { key, customerName: order.customerName, township: order.township, opening: 0, newPackages: 0, delivered: 0, balance: 0 };
      row.newPackages += t.total;
      row.delivered += t.delivered;
      row.balance += t.remaining;
      rows.set(key, row);
    }
    return [...rows.values()].filter((row) => row.opening || row.newPackages || row.balance).sort((a, b) => b.balance - a.balance || a.customerName.localeCompare(b.customerName));
  }, [financeOrders, openingBalances]);
  const livePackageRemaining = useMemo(() => financeOrders.reduce((sum, order) => sum + totals(order).remaining, 0), [financeOrders]);
  const recentProofOrders = useMemo(() => financeOrders
    .filter((order) => Boolean(order.deliveryProofKey))
    .sort((a, b) => (b.deliveryProofUploadedAt || b.updatedAt).localeCompare(a.deliveryProofUploadedAt || a.updatedAt)), [financeOrders]);
  const recentDeliveryEvidence = useMemo(() => [
    ...recentProofOrders.map((order) => ({
      key: `proof-${order.id}`,
      orderId: order.id,
      customerName: order.customerName,
      orderNo: order.orderNo,
      route: order.route,
      salesperson: assignedSalePeople(order),
      label: "ကားဂိတ် / ငွေသိမ်းဘောင်ချာ",
      uploadedBy: order.deliveryProofUploadedBy || "Delivery",
      uploadedAt: order.deliveryProofUploadedAt || order.updatedAt,
      tone: "proof",
      photoUrl: `/api/delivery-proof?orderId=${order.id}&v=${encodeURIComponent(order.deliveryProofUploadedAt || order.updatedAt)}`,
    })),
    ...recentDeliveryIssues.map((issue) => {
      const order = financeOrders.find((item) => item.id === issue.orderId);
      return {
        key: `issue-${issue.id}`,
        orderId: issue.orderId,
        customerName: issue.customerName || order?.customerName || "Customer",
        orderNo: issue.orderNo || order?.orderNo || `Order #${issue.orderId}`,
        route: issue.route || order?.route || "",
        salesperson: order ? assignedSalePeople(order) : "Admin",
        label: deliveryIssueLabel[issue.issueType],
        uploadedBy: issue.createdBy,
        uploadedAt: issue.createdAt,
        tone: issue.issueType,
        photoUrl: `/api/delivery-incidents?issueId=${issue.id}`,
      };
    }),
  ].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)), [financeOrders, recentDeliveryIssues, recentProofOrders]);
  const evidenceRoutes = useMemo(() => [...new Set(recentDeliveryEvidence.map((item) => item.route).filter(Boolean))].sort(), [recentDeliveryEvidence]);
  const evidenceSalespeople = useMemo(() => [...new Set(recentDeliveryEvidence.flatMap((item) => item.salesperson.split(", ")).filter(Boolean))].sort(), [recentDeliveryEvidence]);
  const filteredDeliveryEvidence = useMemo(() => recentDeliveryEvidence.filter((item) => {
    const routeMatch = evidenceRouteFilter === "All" || item.route === evidenceRouteFilter;
    const salespersonMatch = evidenceSalespersonFilter === "All" || item.salesperson.split(", ").includes(evidenceSalespersonFilter);
    return routeMatch && salespersonMatch;
  }), [evidenceRouteFilter, evidenceSalespersonFilter, recentDeliveryEvidence]);
  const evidencePageSize = 10;
  const evidencePageCount = Math.max(1, Math.ceil(filteredDeliveryEvidence.length / evidencePageSize));
  const evidencePageItems = useMemo(() => filteredDeliveryEvidence.slice((evidencePage - 1) * evidencePageSize, evidencePage * evidencePageSize), [evidencePage, filteredDeliveryEvidence]);
  useEffect(() => { setEvidencePage(1); }, [evidenceRouteFilter, evidenceSalespersonFilter]);
  useEffect(() => { if (evidencePage > evidencePageCount) setEvidencePage(evidencePageCount); }, [evidencePage, evidencePageCount]);

  const warehousePendingOrders = useMemo(() => filtered.filter((order) => order.warehouseStatus !== "finished"), [filtered]);
  const warehouseCompletedOrders = useMemo(() => filtered.filter((order) => order.warehouseStatus === "finished" && !order.saleApproved), [filtered]);
  const warehouseReadyOrders = useMemo(() => filtered.filter((order) => order.warehouseStatus === "finished" && order.saleApproved), [filtered]);
  const warehouseOrders = useMemo(() => {
    const source = warehouseView === "pending" ? warehousePendingOrders : warehouseView === "completed" ? warehouseCompletedOrders : warehouseReadyOrders;
    return [...source].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [warehouseCompletedOrders, warehousePendingOrders, warehouseReadyOrders, warehouseView]);
  const warehousePageSize = 12;
  const warehousePageCount = Math.max(1, Math.ceil(warehouseOrders.length / warehousePageSize));
  const warehousePageOrders = useMemo(() => warehouseOrders.slice((warehousePage - 1) * warehousePageSize, warehousePage * warehousePageSize), [warehouseOrders, warehousePage]);
  useEffect(() => { setWarehousePage(1); }, [query, routeFilter, salesTeamFilter, salespersonFilter, dateMode, customStart, customEnd, warehouseView]);
  useEffect(() => { if (warehousePage > warehousePageCount) setWarehousePage(warehousePageCount); }, [warehousePage, warehousePageCount]);
  const warehouseUnfinishedOrders = useMemo(() => filtered.filter((order) => order.warehouseStatus !== "finished"), [filtered]);
  const pendingDeliveryOrders = useMemo(() => filtered
    .filter((order) => order.saleApproved && !["out_for_delivery", "partial", "delivered"].includes(order.dispatchStatus))
    .sort((a, b) => (a.saleApprovedAt || a.updatedAt).localeCompare(b.saleApprovedAt || b.updatedAt)), [filtered]);
  const approvalPendingDeliveryOrders = useMemo(() => filtered
    .filter((order) => !order.saleApproved && !["out_for_delivery", "partial", "delivered"].includes(order.dispatchStatus))
    .sort((a, b) => {
      const aPriority = a.warehouseStatus === "finished" ? 0 : 1;
      const bPriority = b.warehouseStatus === "finished" ? 0 : 1;
      return aPriority - bPriority || a.createdAt.localeCompare(b.createdAt);
    }), [filtered]);
  const onTheWayOrders = useMemo(() => filtered.filter((order) => ["out_for_delivery", "partial"].includes(order.dispatchStatus)), [filtered]);
  const deliveredOrders = useMemo(() => financeOrders
    .filter((order) => {
      if (order.dispatchStatus !== "delivered") return false;
      const deliveredDay = localDateKey(order.deliveredAt || order.updatedAt);
      const dateMatch = dateMode === "all" || (deliveredDay >= activeRange.start && deliveredDay <= activeRange.end);
      const routeMatch = routeFilter === "All" || order.route === routeFilter;
      const salespersonNames = assignedSalePeople(order);
      const teamMatch = matchesSaleTeam(salespersonNames.split(", "), salesTeamFilter);
      const salespersonMatch = salespersonFilter === "All" || salespersonNames.split(", ").includes(salespersonFilter);
      const needle = query.toLocaleLowerCase();
      const textMatch = !needle || order.customerName.toLocaleLowerCase().includes(needle) || order.township.toLocaleLowerCase().includes(needle) || order.orderNo.toLocaleLowerCase().includes(needle) || salespersonNames.toLocaleLowerCase().includes(needle);
      return dateMatch && routeMatch && teamMatch && salespersonMatch && textMatch;
    })
    .sort((a, b) => (b.deliveredAt || b.updatedAt).localeCompare(a.deliveredAt || a.updatedAt)),
  [activeRange.end, activeRange.start, dateMode, financeOrders, query, routeFilter, salesTeamFilter, salespersonFilter]);
  const carLoadReadyOrders = useMemo(() => pendingDeliveryOrders.filter((order) => order.warehouseStatus === "finished" && order.saleApproved && ["packed", "rescheduled"].includes(order.dispatchStatus)), [pendingDeliveryOrders]);
  const deliveryViewOrders = deliveryView === "pending" ? pendingDeliveryOrders : deliveryView === "approval_pending" ? approvalPendingDeliveryOrders : deliveryView === "on_the_way" ? onTheWayOrders : deliveredOrders;
  useEffect(() => { setSelectedDeliveryIds([]); }, [deliveryView, query, routeFilter, salesTeamFilter, salespersonFilter, dateMode, customStart, customEnd]);
  const saleOrders = useMemo(() => filtered
    .filter((order) => order.warehouseStatus === "finished")
    .sort((a, b) => {
      const aPriority = a.voucherStatus === "pending" ? 0 : !a.saleApproved ? 1 : 2;
      const bPriority = b.voucherStatus === "pending" ? 0 : !b.saleApproved ? 1 : 2;
      return aPriority - bPriority || (b.warehouseConfirmedAt || b.updatedAt).localeCompare(a.warehouseConfirmedAt || a.updatedAt);
    }), [filtered]);
  const reviewApprovalOrders = useMemo(() => saleOrders.filter((order) => !order.saleApproved && order.dispatchStatus !== "delivered"), [saleOrders]);
  const saleAmountSummary = useMemo(() => saleOrders.reduce((acc, order) => {
    acc.saleOrderCount += order.saleOrderCount || 1;
    acc.orderAmount += order.orderAmount;
    if (order.voucherStatus === "updated") acc.voucherAmount += order.voucherAmount;
    else acc.voucherPending += 1;
    return acc;
  }, { saleOrderCount: 0, orderAmount: 0, voucherAmount: 0, voucherPending: 0 }), [saleOrders]);
  const saleAmountBreakdown = useMemo(() => {
    const rows = new Map<string, { date: string; salesperson: string; orderCount: number; orderAmount: number; voucherAmount: number; voucherPending: number }>();
    for (const order of saleOrders) {
      const salesperson = assignedSalePeople(order);
      const key = `${order.orderDate}\u0000${salesperson}`;
      const row = rows.get(key) || { date: order.orderDate, salesperson, orderCount: 0, orderAmount: 0, voucherAmount: 0, voucherPending: 0 };
      row.orderCount += order.saleOrderCount || 1;
      row.orderAmount += order.orderAmount;
      if (order.voucherStatus === "updated") row.voucherAmount += order.voucherAmount;
      else row.voucherPending += 1;
      rows.set(key, row);
    }
    return [...rows.values()].sort((a, b) => b.date.localeCompare(a.date) || a.salesperson.localeCompare(b.salesperson));
  }, [saleOrders]);
  const resolveOutstandingCustomerKey = useMemo(() => {
    const exactCustomerKeys = new Map<string, string>();
    const normalizedNameAndTownship = new Map<string, string>();
    for (const customer of customerDirectory) {
      const normalizedKey = customerBalanceKey(customer.name, customer.township);
      const canonicalKey = customer.customerKey?.trim() || normalizedKey;
      exactCustomerKeys.set(canonicalKey, canonicalKey);
      normalizedNameAndTownship.set(normalizedKey, canonicalKey);
    }
    return (item: { customerKey?: string; customerName: string; township: string }) => {
      const exactMatch = item.customerKey?.trim();
      if (exactMatch && exactCustomerKeys.has(exactMatch)) return exactCustomerKeys.get(exactMatch)!;
      const normalizedKey = customerBalanceKey(item.customerName, item.township);
      return normalizedNameAndTownship.get(normalizedKey) || normalizedKey;
    };
  }, [customerDirectory]);
  const customerOutstandingTotals = useMemo(() => {
    const totalsByCustomer = new Map<string, number>();
    for (const item of openingBalances) {
      const key = resolveOutstandingCustomerKey(item);
      totalsByCustomer.set(key, (totalsByCustomer.get(key) || 0) + item.openingOutstanding + (item.adjustmentAmount || 0) - item.paidAmount);
    }
    for (const order of financeOrders) {
      const key = resolveOutstandingCustomerKey(order);
      totalsByCustomer.set(key, (totalsByCustomer.get(key) || 0) + voucherBalance(order));
    }
    return totalsByCustomer;
  }, [financeOrders, openingBalances, resolveOutstandingCustomerKey]);
  const customerOutstandingForOrder = useCallback((order: Order) => Math.max(0, customerOutstandingTotals.get(resolveOutstandingCustomerKey(order)) || 0), [customerOutstandingTotals, resolveOutstandingCustomerKey]);
  const previousBalanceForOrder = useCallback((order: Order) => {
    const customerOutstanding = customerOutstandingForOrder(order);
    return customerOutstanding - voucherBalance(order);
  }, [customerOutstandingForOrder]);
  const paymentDates = useMemo(() => {
    const byOrder = new Map<number, string>();
    const byCustomer = new Map<string, string>();
    for (const payment of paymentTransactions) {
      if (payment.orderId > 0 && payment.paymentDate > (byOrder.get(payment.orderId) || "")) byOrder.set(payment.orderId, payment.paymentDate);
      const key = customerBalanceKey(payment.customerName, payment.township);
      if (payment.paymentDate > (byCustomer.get(key) || "")) byCustomer.set(key, payment.paymentDate);
    }
    return { byOrder, byCustomer };
  }, [paymentTransactions]);
  const paymentDateForOrder = useCallback((order: Order) => {
    if (order.paidAmount <= 0) return "";
    return paymentDates.byOrder.get(order.id) || paymentDates.byCustomer.get(customerBalanceKey(order.customerName, order.township)) || "";
  }, [paymentDates]);
  const customerDirectoryByKey = useMemo(() => new Map(customerDirectory.map((customer) => [customerBalanceKey(customer.name, customer.township), customer])), [customerDirectory]);
  const financeSalespersonCustomerKeys = useMemo(() => {
    if (salesTeamFilter === "All" && salespersonFilter === "All") return null;
    const keys = new Set<string>();
    for (const customer of customerDirectory) {
      if (customer.source !== "custom") continue;
      const people = [customer.salesperson];
      if (matchesSaleTeam(people, salesTeamFilter) && (salespersonFilter === "All" || people.includes(salespersonFilter))) keys.add(customerBalanceKey(customer.name, customer.township));
    }
    for (const order of financeOrders) {
      if (customerDirectory.some(customer => customer.source === "custom" && customerBalanceKey(customer.name, customer.township) === customerBalanceKey(order.customerName, order.township))) continue;
      const people = assignedSalePeople(order).split(", ");
      if (matchesSaleTeam(people, salesTeamFilter) && (salespersonFilter === "All" || people.includes(salespersonFilter))) keys.add(customerBalanceKey(order.customerName, order.township));
    }
    return keys;
  }, [customerDirectory, financeOrders, salesTeamFilter, salespersonFilter]);
  const financeOpeningBalances = useMemo(() => openingBalances.filter((item) => !financeSalespersonCustomerKeys || financeSalespersonCustomerKeys.has(customerBalanceKey(item.customerName, item.township))), [financeSalespersonCustomerKeys, openingBalances]);
  const financePaymentTransactions = useMemo(() => paymentTransactions.filter((payment) => !financeSalespersonCustomerKeys || financeSalespersonCustomerKeys.has(customerBalanceKey(payment.customerName, payment.township))), [financeSalespersonCustomerKeys, paymentTransactions]);
  const financeScopeOrders = useMemo(() => financeOrders.filter((order) => {
    if (order.voucherStatus !== "updated") return false;
    if (financeSalespersonCustomerKeys && !financeSalespersonCustomerKeys.has(customerBalanceKey(order.customerName, order.township))) return false;
    if (dateMode === "all") return true;
    if (order.orderDate > activeRange.end) return false;
    return order.orderDate >= activeRange.start || voucherBalance(order) > 0;
  }), [activeRange.end, activeRange.start, dateMode, financeOrders, financeSalespersonCustomerKeys]);
  const financeSummary = useMemo(() => {
    const initial = { totalVoucher: 0, received: 0, outstanding: 0, paidCount: 0, paidAmount: 0, unpaidCount: 0, unpaidAmount: 0, partialCount: 0, partialBalance: 0 };
    for (const item of financeOpeningBalances) {
      const balance = item.openingOutstanding + (item.adjustmentAmount || 0) - item.paidAmount;
      initial.received += item.paidAmount;
      initial.outstanding += balance;
      if (balance < 0) { /* Customer Credit is included in net outstanding, not voucher counts. */ }
      else if (balance === 0) { initial.paidCount += 1; initial.paidAmount += item.openingOutstanding; }
      else if (item.paidAmount === 0) { initial.unpaidCount += 1; initial.unpaidAmount += balance; }
      else { initial.partialCount += 1; initial.partialBalance += balance; }
    }
    return financeScopeOrders.reduce((summary, order) => {
      const balance = voucherBalance(order);
      if (dateMode === "all" || (order.orderDate >= activeRange.start && order.orderDate <= activeRange.end)) summary.totalVoucher += order.voucherAmount;
      summary.received += order.paidAmount;
      summary.outstanding += balance;
      if (balance === 0) { summary.paidCount += 1; summary.paidAmount += order.voucherAmount; }
      else if (order.paidAmount === 0) { summary.unpaidCount += 1; summary.unpaidAmount += balance; }
      else { summary.partialCount += 1; summary.partialBalance += balance; }
      return summary;
    }, initial);
  }, [activeRange.end, activeRange.start, dateMode, financeOpeningBalances, financeScopeOrders]);
  const customerLedgers = useMemo(() => {
    const ledgers = new Map<string, CustomerLedger>();
    for (const item of financeOpeningBalances) {
      const key = customerBalanceKey(item.customerName, item.township);
      const balance = item.openingOutstanding + (item.adjustmentAmount || 0) - item.paidAmount;
      const hasOpening = item.openingOutstanding !== 0 || item.paidAmount !== 0;
      const openingItem = { key: `opening-${item.id}`, label: "Opening Amount", date: item.asOfDate, voucherAmount: item.openingOutstanding, paidAmount: item.paidAmount, balance };
      const openingSalesperson = customerDirectoryByKey.get(key)?.salesperson || "Admin";
      ledgers.set(key, {
        key, customerName: item.customerName, township: item.township, route: "Opening", salesperson: openingSalesperson, salespeople: [openingSalesperson], latestDate: item.asOfDate,
        adjustmentAmount: item.adjustmentAmount || 0, currentVoucher: 0, currentReceived: 0, periodPayment: 0, openingAmount: item.openingOutstanding, openingDate: item.asOfDate, openingBalance: balance, previousBalance: balance,
        totalVoucher: item.openingOutstanding, totalReceived: item.paidAmount, totalBalance: balance,
        paidCount: hasOpening && balance === 0 ? 1 : 0, unpaidCount: hasOpening && balance > 0 && item.paidAmount === 0 ? 1 : 0, partialCount: hasOpening && balance > 0 && item.paidAmount > 0 ? 1 : 0,
        paidItems: hasOpening && balance === 0 ? [openingItem] : [], unpaidItems: hasOpening && balance > 0 && item.paidAmount === 0 ? [openingItem] : [], partialItems: hasOpening && balance > 0 && item.paidAmount > 0 ? [openingItem] : [],
        oldestOutstandingDate: balance > 0 ? item.asOfDate : "", lastPaymentDate: "", noPaymentDays: 0,
      });
    }
    for (const order of financeScopeOrders) {
      const key = customerBalanceKey(order.customerName, order.township);
      const currentPeriod = dateMode === "all" || (order.orderDate >= activeRange.start && order.orderDate <= activeRange.end);
      const balance = voucherBalance(order);
      const ledger = ledgers.get(key) ?? {
        key,
        customerName: order.customerName,
        township: order.township,
        route: order.route,
        salesperson: assignedSalePeople(order),
        salespeople: assignedSalePeople(order).split(", "),
        latestDate: order.orderDate,
        currentVoucher: 0,
        currentReceived: 0,
        periodPayment: 0,
        openingAmount: 0,
        openingDate: "",
        openingBalance: 0,
        previousBalance: 0,
        totalVoucher: 0,
        totalReceived: 0,
        totalBalance: 0,
        paidCount: 0,
        unpaidCount: 0,
        partialCount: 0,
        paidItems: [],
        unpaidItems: [],
        partialItems: [],
        oldestOutstandingDate: "",
        lastPaymentDate: "",
        noPaymentDays: 0,
      };
      if (order.orderDate >= ledger.latestDate) {
        ledger.latestDate = order.orderDate;
        ledger.route = order.route;
        ledger.salesperson = customerDirectoryByKey.get(key)?.salesperson || assignedSalePeople(order);
      }
      ledger.salespeople = [...new Set([...ledger.salespeople, ...assignedSalePeople(order).split(", ")])];
      if (currentPeriod) {
        ledger.currentVoucher += order.voucherAmount;
        ledger.currentReceived += order.paidAmount;
      } else {
        ledger.previousBalance += balance;
      }
      ledger.totalVoucher += order.voucherAmount;
      ledger.totalReceived += order.paidAmount;
      ledger.totalBalance += balance;
      if (balance > 0 && (!ledger.oldestOutstandingDate || order.orderDate < ledger.oldestOutstandingDate)) ledger.oldestOutstandingDate = order.orderDate;
      const statusItem = { key: `order-${order.id}`, label: order.orderNo, date: order.orderDate, voucherAmount: order.voucherAmount, paidAmount: order.paidAmount, balance };
      if (balance === 0) { ledger.paidCount += 1; ledger.paidItems.push(statusItem); }
      else if (order.paidAmount === 0) { ledger.unpaidCount += 1; ledger.unpaidItems.push(statusItem); }
      else { ledger.partialCount += 1; ledger.partialItems.push(statusItem); }
      ledgers.set(key, ledger);
    }
    const latestPayments = new Map<string, string>();
    const periodPayments = new Map<string, number>();
    for (const payment of financePaymentTransactions) {
      if (payment.paymentDate > todayLocal()) continue;
      const key = customerBalanceKey(payment.customerName, payment.township);
      if (!latestPayments.get(key) || payment.paymentDate > latestPayments.get(key)!) latestPayments.set(key, payment.paymentDate);
      if (dateMode === "all" || (payment.paymentDate >= activeRange.start && payment.paymentDate <= activeRange.end)) periodPayments.set(key, (periodPayments.get(key) || 0) + payment.amount);
    }
    return [...ledgers.values()].map((ledger) => {
      const lastPaymentDate = latestPayments.get(ledger.key) || "";
      const unchangedSince = lastPaymentDate || ledger.oldestOutstandingDate || ledger.latestDate;
      return { ...ledger, periodPayment: periodPayments.get(ledger.key) || 0, lastPaymentDate, noPaymentDays: ledger.totalBalance > 0 ? daysSince(unchangedSince) : 0 };
    }).sort((a, b) => b.totalBalance - a.totalBalance || b.latestDate.localeCompare(a.latestDate));
  }, [activeRange.end, activeRange.start, customerDirectoryByKey, dateMode, financeOpeningBalances, financePaymentTransactions, financeScopeOrders]);
  const thisWeekRange = useMemo(() => rangeForMode("week", todayLocal(), todayLocal()), []);
  const todayPaymentCustomerKeys = useMemo(() => new Set(financePaymentTransactions.filter((payment) => payment.paymentDate === todayLocal()).map((payment) => customerBalanceKey(payment.customerName, payment.township))), [financePaymentTransactions]);
  const weekPaymentCustomerKeys = useMemo(() => new Set(financePaymentTransactions.filter((payment) => payment.paymentDate >= thisWeekRange.start && payment.paymentDate <= thisWeekRange.end).map((payment) => customerBalanceKey(payment.customerName, payment.township))), [financePaymentTransactions, thisWeekRange.end, thisWeekRange.start]);
  const outstandingCustomerCount = useMemo(() => customerLedgers.filter((ledger) => ledger.totalBalance > 0).length, [customerLedgers]);
  const todayPaymentCustomerCount = useMemo(() => customerLedgers.filter((ledger) => todayPaymentCustomerKeys.has(ledger.key)).length, [customerLedgers, todayPaymentCustomerKeys]);
  const weekPaymentCustomerCount = useMemo(() => customerLedgers.filter((ledger) => weekPaymentCustomerKeys.has(ledger.key)).length, [customerLedgers, weekPaymentCustomerKeys]);
  const unpaid5CustomerCount = useMemo(() => customerLedgers.filter((ledger) => ledger.totalBalance > 0 && ledger.noPaymentDays >= 5).length, [customerLedgers]);
  const unpaid10CustomerCount = useMemo(() => customerLedgers.filter((ledger) => ledger.totalBalance > 0 && ledger.noPaymentDays >= 10).length, [customerLedgers]);
  const unpaid20CustomerCount = useMemo(() => customerLedgers.filter((ledger) => ledger.totalBalance > 0 && ledger.noPaymentDays >= 20).length, [customerLedgers]);
  const warehouseDelayOrders = useMemo(() => financeOrders
    .filter((order) => order.warehouseStatus !== "finished" && hoursSince(order.createdAt) >= 2)
    .sort((a, b) => hoursSince(b.createdAt) - hoursSince(a.createdAt)), [financeOrders]);
  const deliveryWaitingOrders = useMemo(() => financeOrders
    .filter((order) => order.warehouseStatus === "finished" && order.saleApproved && !["out_for_delivery", "partial", "delivered"].includes(order.dispatchStatus))
    .sort((a, b) => (a.saleApprovedAt || a.updatedAt).localeCompare(b.saleApprovedAt || b.updatedAt)), [financeOrders]);
  const debtWarningCustomers = useMemo(() => customerLedgers.filter((ledger) => ledger.totalBalance > 0 && ledger.noPaymentDays >= 10 && ledger.noPaymentDays < 20), [customerLedgers]);
  const debtCriticalCustomers = useMemo(() => customerLedgers.filter((ledger) => ledger.totalBalance > 0 && ledger.noPaymentDays >= 20), [customerLedgers]);
  const reportTeamMembers = reportSaleTeamFilter === "All" ? SALE_PEOPLE : [...SALE_TEAM_MEMBERS[reportSaleTeamFilter]];
  const matchesReportTeam = (names: string[]) => reportSaleTeamFilter === "All" || names.some((name) => SALE_TEAM_MEMBERS[reportSaleTeamFilter].includes(name));
  const reportHasPeopleFilter = reportSaleTeamFilter !== "All" || reportSalespersonFilter !== "All";
  const reportHasOrderDimensionFilters = reportRouteFilter !== "All" || reportPaymentFilter !== "all" || reportDeliveryFilter !== "all";
  const reportDimensionOrders = useMemo(() => financeOrders.filter((order) => {
    if (dateMode !== "all" && (order.orderDate < activeRange.start || order.orderDate > activeRange.end)) return false;
    const assignedPeople = assignedSalePeople(order).split(", ");
    if (!matchesReportTeam(assignedPeople)) return false;
    if (reportSalespersonFilter !== "All" && !assignedPeople.includes(reportSalespersonFilter)) return false;
    if (reportRouteFilter !== "All" && order.route !== reportRouteFilter) return false;
    if (reportPaymentFilter === "paid" && !(order.paymentStatus === "paid" || (order.voucherStatus === "updated" && voucherBalance(order) <= 0))) return false;
    if (reportPaymentFilter === "partial" && !(order.paymentStatus === "partial" || (order.paidAmount > 0 && voucherBalance(order) > 0))) return false;
    if (reportPaymentFilter === "unpaid" && !(order.paymentStatus === "unpaid" || order.paymentStatus === "credit" || (order.paidAmount <= 0 && voucherBalance(order) > 0))) return false;
    if (reportDeliveryFilter === "pending" && ["out_for_delivery", "delivered", "partial", "returned", "rescheduled"].includes(order.dispatchStatus)) return false;
    if (reportDeliveryFilter !== "all" && reportDeliveryFilter !== "pending" && order.dispatchStatus !== reportDeliveryFilter) return false;
    return true;
  }), [activeRange.end, activeRange.start, dateMode, financeOrders, reportDeliveryFilter, reportPaymentFilter, reportRouteFilter, reportSaleTeamFilter, reportSalespersonFilter]);
  const reportDimensionCustomerKeys = useMemo(() => new Set(reportDimensionOrders.map((order) => customerBalanceKey(order.customerName, order.township))), [reportDimensionOrders]);
  const reportLedgers = useMemo(() => customerLedgers.filter((ledger) => {
    // Salesperson is a customer dimension: opening-only customers have no order
    // in the selected period, but still belong in their salesperson's balance.
    const assignedCustomer = customerDirectoryByKey.get(ledger.key);
    const ledgerSalespeople = assignedCustomer?.source === "custom" ? [assignedCustomer.salesperson] : ledger.salespeople;
    if (!matchesReportTeam(ledgerSalespeople)) return false;
    if (reportSalespersonFilter !== "All" &&
      !ledgerSalespeople.includes(reportSalespersonFilter)) return false;
    if (reportHasOrderDimensionFilters && !reportDimensionCustomerKeys.has(ledger.key)) return false;
    if (reportOutstandingFilter === "5_plus") return ledger.totalBalance > 0 && ledger.noPaymentDays >= 5;
    if (reportOutstandingFilter === "10_plus") return ledger.totalBalance > 0 && ledger.noPaymentDays >= 10;
    if (reportOutstandingFilter === "20_plus") return ledger.totalBalance > 0 && ledger.noPaymentDays >= 20;
    return true;
  }), [customerLedgers, customerDirectoryByKey, reportDimensionCustomerKeys, reportHasOrderDimensionFilters, reportOutstandingFilter, reportSaleTeamFilter, reportSalespersonFilter]);
  const reportLedgerKeys = useMemo(() => new Set(reportLedgers.map((ledger) => ledger.key)), [reportLedgers]);
  const reportOrders = useMemo(() => reportDimensionOrders.filter((order) => reportOutstandingFilter === "all" || reportLedgerKeys.has(customerBalanceKey(order.customerName, order.township))), [reportDimensionOrders, reportLedgerKeys, reportOutstandingFilter]);
  const customerLedgerByKey = useMemo(() => new Map(customerLedgers.map((ledger) => [ledger.key, ledger])), [customerLedgers]);
  const saleVoucherOrders = useMemo(() => financeOrders.filter((order) => {
    if (order.voucherStatus !== "updated" || order.voucherAmount <= 0) return false;
    const voucherDate = localDateKey(order.voucherUpdatedAt || order.saleApprovedAt || order.orderDate);
    if (dateMode !== "all" && (voucherDate < activeRange.start || voucherDate > activeRange.end)) return false;
    const assignedPeople = assignedSalePeople(order).split(", ");
    if (!matchesReportTeam(assignedPeople)) return false;
    if (reportSalespersonFilter !== "All" && !assignedPeople.includes(reportSalespersonFilter)) return false;
    if (reportRouteFilter !== "All" && order.route !== reportRouteFilter) return false;
    if (reportPaymentFilter === "paid" && !(order.paymentStatus === "paid" || voucherBalance(order) <= 0)) return false;
    if (reportPaymentFilter === "partial" && !(order.paymentStatus === "partial" || (order.paidAmount > 0 && voucherBalance(order) > 0))) return false;
    if (reportPaymentFilter === "unpaid" && !(order.paymentStatus === "unpaid" || order.paymentStatus === "credit" || (order.paidAmount <= 0 && voucherBalance(order) > 0))) return false;
    if (reportDeliveryFilter === "pending" && ["out_for_delivery", "delivered", "partial", "returned", "rescheduled"].includes(order.dispatchStatus)) return false;
    if (reportDeliveryFilter !== "all" && reportDeliveryFilter !== "pending" && order.dispatchStatus !== reportDeliveryFilter) return false;
    const ledger = customerLedgerByKey.get(customerBalanceKey(order.customerName, order.township));
    if (reportOutstandingFilter === "5_plus" && !(ledger && ledger.totalBalance > 0 && ledger.noPaymentDays >= 5)) return false;
    if (reportOutstandingFilter === "10_plus" && !(ledger && ledger.totalBalance > 0 && ledger.noPaymentDays >= 10)) return false;
    if (reportOutstandingFilter === "20_plus" && !(ledger && ledger.totalBalance > 0 && ledger.noPaymentDays >= 20)) return false;
    const needle = voucherReportQuery.trim().toLocaleLowerCase();
    if (needle && !`${order.orderNo} ${order.customerName} ${order.township} ${assignedSalePeople(order)} ${order.route}`.toLocaleLowerCase().includes(needle)) return false;
    return true;
  }).sort((a, b) => {
    const aDate = localDateKey(a.voucherUpdatedAt || a.saleApprovedAt || a.orderDate);
    const bDate = localDateKey(b.voucherUpdatedAt || b.saleApprovedAt || b.orderDate);
    return bDate.localeCompare(aDate) || b.id - a.id;
  }), [activeRange.end, activeRange.start, customerLedgerByKey, dateMode, financeOrders, reportDeliveryFilter, reportOutstandingFilter, reportPaymentFilter, reportRouteFilter, reportSaleTeamFilter, reportSalespersonFilter, voucherReportQuery]);
  const saleVoucherOrderIds = useMemo(() => new Set(saleVoucherOrders.map((order) => order.id)), [saleVoucherOrders]);
  const saleVoucherReturnByOrder = useMemo(() => {
    const rows = new Map<number, number>();
    for (const issue of recentDeliveryIssues) {
      if (issue.issueType !== "return" || !saleVoucherOrderIds.has(issue.orderId)) continue;
      rows.set(issue.orderId, (rows.get(issue.orderId) || 0) + Math.max(0, issue.deductionAmount));
    }
    return rows;
  }, [recentDeliveryIssues, saleVoucherOrderIds]);
  const saleVoucherCustomerKeys = useMemo(() => new Set(saleVoucherOrders.map((order) => customerBalanceKey(order.customerName, order.township))), [saleVoucherOrders]);
  const saleVoucherSummary = useMemo(() => {
    const net = saleVoucherOrders.reduce((sum, order) => sum + order.voucherAmount, 0);
    const returns = [...saleVoucherReturnByOrder.values()].reduce((sum, amount) => sum + amount, 0);
    return {
      count: saleVoucherOrders.length,
      customers: saleVoucherCustomerKeys.size,
      gross: net + returns,
      returns,
      net,
      payment: saleVoucherOrders.reduce((sum, order) => sum + order.paidAmount, 0),
      outstanding: [...saleVoucherCustomerKeys].reduce((sum, key) => sum + Math.max(0, customerLedgerByKey.get(key)?.totalBalance || 0), 0),
      average: saleVoucherOrders.length ? net / saleVoucherOrders.length : 0,
    };
  }, [customerLedgerByKey, saleVoucherCustomerKeys, saleVoucherOrders, saleVoucherReturnByOrder]);
  const reportOrderIds = useMemo(() => new Set(reportOrders.map((order) => order.id)), [reportOrders]);
  const reportCustomerKeys = useMemo(() => new Set(reportOrders.map((order) => customerBalanceKey(order.customerName, order.township))), [reportOrders]);
  const reportPayments = useMemo(() => paymentTransactions.filter((payment) => {
    if (dateMode !== "all" && (payment.paymentDate < activeRange.start || payment.paymentDate > activeRange.end)) return false;
    const customerKey = customerBalanceKey(payment.customerName, payment.township);
    if (reportHasOrderDimensionFilters && payment.orderId > 0 && !reportOrderIds.has(payment.orderId)) return false;
    if (reportHasOrderDimensionFilters && payment.orderId <= 0 && !reportCustomerKeys.has(customerKey)) return false;
    if (reportHasPeopleFilter && !reportLedgerKeys.has(customerKey)) return false;
    if (reportOutstandingFilter !== "all" && !reportLedgerKeys.has(customerKey)) return false;
    return true;
  }), [activeRange.end, activeRange.start, dateMode, paymentTransactions, reportCustomerKeys, reportHasOrderDimensionFilters, reportHasPeopleFilter, reportLedgerKeys, reportOrderIds, reportOutstandingFilter]);
  const reportIncidents = useMemo(() => recentDeliveryIssues.filter((issue) => {
    const date = localDateKey(issue.createdAt);
    if (dateMode !== "all" && (date < activeRange.start || date > activeRange.end)) return false;
    if ((reportHasPeopleFilter || reportHasOrderDimensionFilters || reportOutstandingFilter !== "all") && !reportOrderIds.has(issue.orderId)) return false;
    return true;
  }), [activeRange.end, activeRange.start, dateMode, recentDeliveryIssues, reportHasOrderDimensionFilters, reportHasPeopleFilter, reportOrderIds, reportOutstandingFilter]);
  const salespersonReport = useMemo(() => {
    const rows = new Map<string, { name: string; orders: number; vouchers: number; delivered: number; outstanding: number }>();
    for (const order of reportOrders) {
      const name = assignedSalePeople(order);
      const row = rows.get(name) || { name, orders: 0, vouchers: 0, delivered: 0, outstanding: 0 };
      row.orders += order.saleOrderCount || 1;
      if (order.voucherStatus === "updated") row.vouchers += order.voucherAmount;
      if (order.dispatchStatus === "delivered") row.delivered += 1;
      row.outstanding += voucherBalance(order);
      rows.set(name, row);
    }
    return [...rows.values()].sort((a, b) => b.vouchers - a.vouchers || b.orders - a.orders);
  }, [reportOrders]);
  const routeReport = useMemo(() => {
    const rows = new Map<string, { name: string; orders: number; packages: number; delivered: number; pending: number }>();
    for (const order of reportOrders) {
      const name = order.route || "မသတ်မှတ်ရသေး";
      const row = rows.get(name) || { name, orders: 0, packages: 0, delivered: 0, pending: 0 };
      row.orders += order.saleOrderCount || 1;
      row.packages += totals(order).total;
      if (order.dispatchStatus === "delivered") row.delivered += 1;
      else row.pending += 1;
      rows.set(name, row);
    }
    return [...rows.values()].sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name));
  }, [reportOrders]);
  const managementSummary = useMemo(() => ({
    orders: reportOrders.reduce((sum, order) => sum + (order.saleOrderCount || 1), 0),
    vouchers: reportOrders.reduce((sum, order) => sum + (order.voucherStatus === "updated" ? order.voucherAmount : 0), 0),
    payments: reportPayments.reduce((sum, payment) => sum + payment.amount, 0),
    delivered: reportOrders.filter((order) => order.dispatchStatus === "delivered").length,
    outstanding: reportLedgers.reduce((sum, ledger) => sum + Math.max(0, ledger.totalBalance), 0),
  }), [reportLedgers, reportOrders, reportPayments]);
  const filteredCustomerLedgers = useMemo(() => customerLedgers.filter((ledger) => {
    const needle = financeCustomerQuery.trim().toLocaleLowerCase();
    if (needle && !`${ledger.customerName} ${ledger.township} ${ledger.salespeople.join(" ")}`.toLocaleLowerCase().includes(needle)) return false;
    if (financeView === "outstanding") return ledger.totalBalance > 0;
    if (financeView === "today-payment") return todayPaymentCustomerKeys.has(ledger.key);
    if (financeView === "week-payment") return weekPaymentCustomerKeys.has(ledger.key);
    if (financeView === "unpaid-5") return ledger.totalBalance > 0 && ledger.noPaymentDays >= 5;
    if (financeView === "unpaid-10") return ledger.totalBalance > 0 && ledger.noPaymentDays >= 10;
    if (financeView === "unpaid-20") return ledger.totalBalance > 0 && ledger.noPaymentDays >= 20;
    return true;
  }).sort((a, b) => {
    if (financeSort === "amount-asc") return a.totalBalance - b.totalBalance || a.customerName.localeCompare(b.customerName);
    if (financeSort === "days-desc") return b.noPaymentDays - a.noPaymentDays || b.totalBalance - a.totalBalance;
    if (financeSort === "days-asc") return a.noPaymentDays - b.noPaymentDays || b.totalBalance - a.totalBalance;
    if (financeSort === "name-asc") return a.customerName.localeCompare(b.customerName, undefined, { sensitivity: "base" }) || a.township.localeCompare(b.township, undefined, { sensitivity: "base" });
    return b.totalBalance - a.totalBalance || b.noPaymentDays - a.noPaymentDays;
  }), [customerLedgers, financeCustomerQuery, financeSort, financeView, todayPaymentCustomerKeys, weekPaymentCustomerKeys]);
  const financePageSize = 10;
  const financePageCount = Math.max(1, Math.ceil(filteredCustomerLedgers.length / financePageSize));
  const financePageLedgers = useMemo(() => filteredCustomerLedgers.slice((financePage - 1) * financePageSize, financePage * financePageSize), [filteredCustomerLedgers, financePage]);
  useEffect(() => { setFinancePage(1); }, [financeCustomerQuery, financeSort, financeView, salespersonFilter]);
  useEffect(() => { if (financePage > financePageCount) setFinancePage(financePageCount); }, [financePage, financePageCount]);
  const financeCustomerOrders = useMemo(() => {
    const needle = financeCustomerQuery.trim().toLocaleLowerCase();
    if (!needle) return [];
    return financeOrders.filter((order) => { const people = assignedSalePeople(order).split(", "); return order.voucherStatus === "updated" && matchesSaleTeam(people, salesTeamFilter) && (salespersonFilter === "All" || people.includes(salespersonFilter)) && `${order.customerName} ${order.township}`.toLocaleLowerCase().includes(needle); });
  }, [financeCustomerQuery, financeOrders, salesTeamFilter, salespersonFilter]);
  const financeCustomerOpenings = useMemo(() => {
    const needle = financeCustomerQuery.trim().toLocaleLowerCase();
    if (!needle) return [];
    return financeOpeningBalances.filter((item) => `${item.customerName} ${item.township}`.toLocaleLowerCase().includes(needle));
  }, [financeCustomerQuery, financeOpeningBalances]);
  const financeCustomerTotals = useMemo(() => {
    const initial = financeCustomerOpenings.reduce((acc, item) => ({ voucher: acc.voucher + item.openingOutstanding, received: acc.received + item.paidAmount, outstanding: acc.outstanding + item.openingOutstanding + (item.adjustmentAmount || 0) - item.paidAmount }), { voucher: 0, received: 0, outstanding: 0 });
    return financeCustomerOrders.reduce((acc, order) => {
    acc.voucher += order.voucherAmount;
    acc.received += order.paidAmount;
    acc.outstanding += voucherBalance(order);
    return acc;
    }, initial);
  }, [financeCustomerOpenings, financeCustomerOrders]);
  const financeDailyRows = useMemo(() => {
    const rows = new Map<string, { key: string; date: string; customerName: string; township: string; voucher: number; received: number; outstanding: number; vouchers: number }>();
    for (const item of financeCustomerOpenings) {
      const key = `${item.customerName.toLocaleLowerCase()}|||${item.township.toLocaleLowerCase()}|||${item.asOfDate}`;
      rows.set(key, { key, date: item.asOfDate, customerName: item.customerName, township: item.township, voucher: item.openingOutstanding, received: item.paidAmount, outstanding: item.openingOutstanding + (item.adjustmentAmount || 0) - item.paidAmount, vouchers: 1 });
    }
    for (const order of financeCustomerOrders) {
      const key = `${order.customerName.toLocaleLowerCase()}|||${order.township.toLocaleLowerCase()}|||${order.orderDate}`;
      const row = rows.get(key) ?? { key, date: order.orderDate, customerName: order.customerName, township: order.township, voucher: 0, received: 0, outstanding: 0, vouchers: 0 };
      row.voucher += order.voucherAmount;
      row.received += order.paidAmount;
      row.outstanding += voucherBalance(order);
      row.vouchers += 1;
      rows.set(key, row);
    }
    return [...rows.values()].sort((a, b) => b.date.localeCompare(a.date) || a.customerName.localeCompare(b.customerName));
  }, [financeCustomerOpenings, financeCustomerOrders]);
  const dailyPaymentRows = useMemo(() => {
    const rows = new Map<string, { date: string; cash: number; banking: number; total: number; count: number }>();
    for (const payment of financePaymentTransactions) {
      if (dateMode !== "all" && (payment.paymentDate < activeRange.start || payment.paymentDate > activeRange.end)) continue;
      const row = rows.get(payment.paymentDate) ?? { date: payment.paymentDate, cash: 0, banking: 0, total: 0, count: 0 };
      if (payment.method === "cash") row.cash += payment.amount;
      if (payment.method === "banking") row.banking += payment.amount;
      row.total += payment.amount;
      row.count += 1;
      rows.set(payment.paymentDate, row);
    }
    return [...rows.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [activeRange.end, activeRange.start, dateMode, financePaymentTransactions]);
  const paymentMethodTotals = useMemo(() => dailyPaymentRows.reduce((acc, row) => ({ cash: acc.cash + row.cash, banking: acc.banking + row.banking, total: acc.total + row.total }), { cash: 0, banking: 0, total: 0 }), [dailyPaymentRows]);
  const selectedDatePayments = useMemo(() => financePaymentTransactions
    .filter((payment) => payment.paymentDate === selectedPaymentDate)
    .sort((a, b) => b.amount - a.amount || a.customerName.localeCompare(b.customerName)), [financePaymentTransactions, selectedPaymentDate]);
  const debtCustomerRows = useMemo(() => {
    const rows = new Map<string, DebtCustomerRow>();
    for (const order of financeOrders) {
      if (order.voucherStatus !== "updated" || voucherBalance(order) <= 0) continue;
      const people = assignedSalePeople(order).split(", ");
      if (!matchesSaleTeam(people, salesTeamFilter)) continue;
      if (salespersonFilter !== "All" && !people.includes(salespersonFilter)) continue;
      const key = resolveOutstandingCustomerKey(order);
      const existing = rows.get(key);
      if (!existing) {
        rows.set(key, {
          key,
          customerName: order.customerName,
          township: order.township,
          route: order.route,
          salespeople: assignedSalePeople(order),
          oldestOrder: order,
          oldestUnpaidDate: order.orderDate,
          unpaidSaleVr: order.voucherAmount,
          outstanding: customerOutstandingForOrder(order),
          debtAgeDays: daysSince(order.orderDate),
        });
        continue;
      }
      existing.unpaidSaleVr += order.voucherAmount;
      if (order.orderDate < existing.oldestUnpaidDate) {
        existing.oldestOrder = order;
        existing.oldestUnpaidDate = order.orderDate;
        existing.route = order.route;
        existing.salespeople = assignedSalePeople(order);
        existing.debtAgeDays = daysSince(order.orderDate);
      }
    }
    return [...rows.values()].filter((row) => row.outstanding > 0);
  }, [customerOutstandingForOrder, financeOrders, resolveOutstandingCustomerKey, salesTeamFilter, salespersonFilter]);
  const debtCustomerByKey = useMemo(() => new Map(debtCustomerRows.map((row) => [row.key, row])), [debtCustomerRows]);
  const overdueDebtCustomers = useMemo(() => debtCustomerRows
    .filter((row) => row.debtAgeDays > 10)
    .sort((a, b) => debtSort === "outstanding-desc"
      ? b.outstanding - a.outstanding || b.debtAgeDays - a.debtAgeDays
      : debtSort === "voucher-desc"
        ? b.unpaidSaleVr - a.unpaidSaleVr || b.debtAgeDays - a.debtAgeDays
        : b.debtAgeDays - a.debtAgeDays || b.outstanding - a.outstanding), [debtCustomerRows, debtSort]);
  const overdueDebtSummary = useMemo(() => overdueDebtCustomers.reduce((summary, row) => ({
    customers: summary.customers + 1,
    saleVr: summary.saleVr + row.unpaidSaleVr,
    outstanding: summary.outstanding + row.outstanding,
  }), { customers: 0, saleVr: 0, outstanding: 0 }), [overdueDebtCustomers]);
  const noPaymentCustomers = useMemo(() => customerLedgers
    .filter((ledger) => ledger.totalBalance > 0)
    .map((ledger): NoPaymentCustomerRow => {
      const referenceDate = ledger.lastPaymentDate || ledger.openingDate || ledger.oldestOutstandingDate || ledger.latestDate;
      const referenceType = ledger.lastPaymentDate ? "payment" : ledger.openingDate ? "opening" : "oldest-unpaid";
      const customerKey = resolveOutstandingCustomerKey({ customerName: ledger.customerName, township: ledger.township });
      return { ledger, referenceDate, referenceType, noPaymentDays: daysSince(referenceDate), oldestOrder: debtCustomerByKey.get(customerKey)?.oldestOrder };
    })
    .filter((row) => row.referenceDate && row.noPaymentDays > 10)
    .sort((a, b) => debtSort === "outstanding-desc"
      ? b.ledger.totalBalance - a.ledger.totalBalance || b.noPaymentDays - a.noPaymentDays
      : debtSort === "voucher-desc"
        ? b.ledger.totalVoucher - a.ledger.totalVoucher || b.noPaymentDays - a.noPaymentDays
        : b.noPaymentDays - a.noPaymentDays || b.ledger.totalBalance - a.ledger.totalBalance), [customerLedgers, debtCustomerByKey, debtSort, resolveOutstandingCustomerKey]);
  const noPaymentSummary = useMemo(() => noPaymentCustomers.reduce((summary, row) => ({
    customers: summary.customers + 1,
    outstanding: summary.outstanding + Math.max(0, row.ledger.totalBalance),
  }), { customers: 0, outstanding: 0 }), [noPaymentCustomers]);
  const purchaseSummary = useMemo(() => {
    const groups = new Map<string, PurchaseRequest[]>();
    for (const request of purchaseRequests) groups.set(purchaseProductKey(request), [...(groups.get(purchaseProductKey(request)) || []), request]);
    return [...groups.values()].reduce((acc, items) => {
      acc[purchaseGroupBucket(items)] += 1;
      return acc;
    }, { pending: 0, ordered_company: 0, ordered_mglz: 0, stock_out: 0, unavailable: 0 });
  }, [purchaseRequests]);
  const replaceOrder = (updated: Order) => {
    setOrders((current) => current.map((item) => item.id === updated.id ? updated : item));
    setFinanceOrders((current) => current.map((item) => item.id === updated.id ? updated : item));
    setSelected((current) => current?.id === updated.id ? updated : current);
  };

  async function patchOrder(payload: Record<string, unknown>) {
    const response = await fetch("/api/orders", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json() as { order: Order; error?: string };
    if (!response.ok) throw new Error(data.error || "Update failed");
    replaceOrder(data.order);
    if (payload.action === "customer") {
      setPurchaseRequests((current) => current.map((request) => request.orderId === data.order.id ? { ...request, customerName: data.order.customerName, township: data.order.township } : request));
      setRecentDeliveryIssues((current) => current.map((issue) => issue.orderId === data.order.id ? { ...issue, customerName: data.order.customerName } : issue));
    }
    if (payload.action === "payment" || payload.action === "customer") await loadPayments();
    return data.order as Order;
  }

  async function startPicking(order: Order) {
    try {
      const pendingBatch = order.warehouseBatches.find((batch) => batch.status === "pending");
      const updated = await patchOrder({ action: "start_picking", id: order.id, batchSequence: pendingBatch?.sequence });
      const active = updated.warehouseBatches.find((batch) => batch.status === "picking");
      notify(active?.pickingStartedBy ? `${active.pickingStartedBy} — Picking စတင်လုပ်နေပါပြီ` : "Picking စတင်လုပ်နေပါပြီ");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Picking စတင်၍မရပါ");
    }
  }

  async function markSelectedOnTheWay() {
    if (selectedDeliveryIds.length === 0) return;
    setDeliveryBulkBusy(true);
    try {
      const response = await fetch("/api/orders", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delivery_on_way_bulk", ids: selectedDeliveryIds }) });
      const data = await response.json() as { orders?: Order[]; error?: string };
      if (!response.ok) throw new Error(data.error || "On the way ပြောင်းမရပါ");
      for (const order of data.orders || []) replaceOrder(order);
      setSelectedDeliveryIds([]);
      notify(`${data.orders?.length || 0} Orders ကို ကားပေါ်တင်ပြီး On the way ပြောင်းပြီးပါပြီ`);
      void loadNotifications();
    } catch (error) { notify(error instanceof Error ? error.message : "On the way ပြောင်းမရပါ"); }
    finally { setDeliveryBulkBusy(false); }
  }

  async function markSelectedDelivered(ids = selectedDeliveryIds) {
    if (ids.length === 0) return;
    setDeliveryBulkBusy(true);
    try {
      const response = await fetch("/api/orders", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delivery_delivered_bulk", ids }) });
      const data = await response.json() as { orders?: Order[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Delivered ပြောင်းမရပါ");
      for (const order of data.orders || []) replaceOrder(order);
      setSelectedDeliveryIds([]);
      notify(`${data.orders?.length || 0} Orders ကို Delivered ပြောင်းပြီးပါပြီ`);
      void loadNotifications();
    } catch (error) { notify(error instanceof Error ? error.message : "Delivered ပြောင်းမရပါ"); }
    finally { setDeliveryBulkBusy(false); }
  }

  async function deleteOrder(id: number) {
    const response = await fetch("/api/orders", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, confirmation: "DELETE" }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Sale Order ဖျက်မရပါ");
    setOrders((current) => current.filter((order) => order.id !== id));
    setFinanceOrders((current) => current.filter((order) => order.id !== id));
    setPurchaseRequests((current) => current.filter((request) => request.orderId !== id));
    setSelected(null);
    await Promise.all([loadPayments(), loadNotifications(false)]);
  }

  async function patchPurchases(items: Array<Pick<PurchaseRequest, "id" | "sourceType">>, status: "ordered_company" | "ordered_mglz" | "stock_out" | "unavailable", supplierName: string) {
    const updates = await Promise.all(items.map(async ({ id, sourceType }) => {
      const response = await fetch("/api/purchase-requests", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, sourceType, status, supplierName }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Purchase update failed");
      return { id, sourceType, request: data.request as PurchaseRequest };
    }));
    setPurchaseRequests((current) => current.map((request) => {
      const update = updates.find((item) => item.id === request.id && item.sourceType === request.sourceType);
      return update ? { ...request, ...update.request } : request;
    }));
  }

  async function adminAdjustPurchase(item: PurchaseRequest, action: "edit" | "cancel", quantity: number, reason: string) {
    const response = await fetch("/api/purchase-requests", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        sourceType: item.sourceType,
        action: action === "edit" ? "admin_edit_quantity" : "admin_cancel_duplicate",
        quantity,
        reason,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Purchase Request ပြင်မရပါ");
    if (data.cancelled) {
      setPurchaseRequests((current) => current.filter((request) => !(request.id === item.id && request.sourceType === item.sourceType)));
    } else {
      setPurchaseRequests((current) => current.map((request) => request.id === item.id && request.sourceType === item.sourceType ? { ...request, ...data.request } : request));
    }
    await Promise.all([loadAuditLogs(), loadNotifications(false)]);
    return data as { cancelled?: boolean; warning?: string | null };
  }

  async function adminRejectPurchaseArrival(item: PurchaseRequest, reason: string) {
    const response = await fetch("/api/purchase-requests", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id, sourceType: item.sourceType, action: "reject_arrival", reason }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Arrival Matching Reject မလုပ်နိုင်ပါ");
    await Promise.all([loadPurchaseRequests(), loadAuditLogs()]);
  }

  const periodLabel: Record<DateMode, string> = { all: "All", today: "Today", yesterday: "Yesterday", week: "This week", month: "This month", custom: "Custom" };
  const title = tab === "dashboard" ? `${periodLabel[dateMode]} အကျဉ်းချုပ်` : tab === "modules" ? "Knowledge • Reporting • Growth" : tab === "products" ? "Product Master" : tab === "orders" ? "Delivery Orders" : tab === "sale" ? "Salesman Review & Approval" : tab === "warehouse" ? "Warehouse Processing" : tab === "purchase" ? "Purchase Requests" : tab === "chat" ? "Department Chat" : tab === "admin" ? "Customer, Opening & Role" : tab === "settings" ? "System Settings" : tab === "exam" ? "Examination Center" : "Finance Check";
  const managementPeriod = dateMode === "all" ? "All dates" : `${activeRange.start} to ${activeRange.end}`;
  const reportPaymentFilterLabel: Record<ReportPaymentFilter, string> = { all: "Payment All", paid: "Paid", partial: "Partial", unpaid: "Unpaid" };
  const reportDeliveryFilterLabel: Record<ReportDeliveryFilter, string> = { all: "Delivery All", pending: "ပို့ရန်ကျန်", out_for_delivery: "On the way", delivered: "ပို့ပြီး", partial: "တစ်စိတ်တစ်ပိုင်းပို့ပြီး", returned: "ပြန်အပ်", rescheduled: "ပြန်ချိန်း" };
  const reportOutstandingFilterLabel: Record<ReportOutstandingFilter, string> = { all: "Outstanding All", "5_plus": "ကြွေးကျန်ရှိ ငွေမပေး ၅ ရက်", "10_plus": "ကြွေးကျန်ရှိ ငွေမပေး ၁၀ ရက်", "20_plus": "ကြွေးကျန်ရှိ ငွေမပေး ၂၀ ရက်" };
  const managementFilterSummary = [
    reportSaleTeamFilter === "All" ? "Sale Teams All" : `Sale Team ${reportSaleTeamFilter}`,
    reportSalespersonFilter === "All" ? "Sale Men All" : reportSalespersonFilter,
    reportPaymentFilterLabel[reportPaymentFilter],
    reportRouteFilter === "All" ? "Routes All" : reportRouteFilter,
    reportDeliveryFilterLabel[reportDeliveryFilter],
    reportOutstandingFilterLabel[reportOutstandingFilter],
  ].join(" • ");

  function clearManagementFilters() {
    setReportSaleTeamFilter("All");
    setReportSalespersonFilter("All");
    setReportPaymentFilter("all");
    setReportRouteFilter("All");
    setReportDeliveryFilter("all");
    setReportOutstandingFilter("all");
  }

  async function downloadManagementExcel() {
    const incidentCounts = reportIncidents.reduce((counts, issue) => ({ ...counts, [issue.issueType]: (counts[issue.issueType] || 0) + 1 }), {} as Record<string, number>);
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const addSheet = (name: string, rows: Array<Array<string | number>>) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
    addSheet("Summary", [["Nawaratt Management Report"], ["Period", managementPeriod], ["Filters", managementFilterSummary], [], ["Metric", "Value"], ["Sale Orders", managementSummary.orders], ["Sale Voucher Amount", managementSummary.vouchers], ["Payment", managementSummary.payments], ["Delivered Orders", managementSummary.delivered], ["Outstanding", managementSummary.outstanding]]);
    addSheet("Orders", [["Date", "Order No", "Customer", "Township", "Sale Man", "Route", "Delivery Status", "Payment Status", "Voucher", "Payment", "Outstanding", "Packages"], ...reportOrders.map((order) => [order.orderDate, order.orderNo, order.customerName, order.township, assignedSalePeople(order), order.route, statusLabel[order.dispatchStatus] || order.dispatchStatus, paymentLabel[order.paymentStatus] || order.paymentStatus, order.voucherStatus === "updated" ? order.voucherAmount : 0, order.paidAmount, voucherBalance(order), totals(order).total])]);
    addSheet("Payments", [["Date", "Customer", "Township", "Method", "Amount", "Entered By"], ...reportPayments.map((payment) => [payment.paymentDate, payment.customerName, payment.township, payment.method === "cash" ? "Cash" : "Banking", payment.amount, payment.enteredBy])]);
    addSheet("Sale Men", [["Sale Man", "Orders", "Voucher Amount", "Delivered", "Outstanding"], ...salespersonReport.map((row) => [row.name, row.orders, row.vouchers, row.delivered, row.outstanding])]);
    addSheet("Routes", [["Route", "Orders", "Packages", "Delivered", "Pending"], ...routeReport.map((row) => [row.name, row.orders, row.packages, row.delivered, row.pending])]);
    addSheet("Customer Balances", [["Customer", "Township", "Sale Man", "Opening Amount", "Opening Remaining", "Adjustment", "Outstanding", "No Payment Days", "Last Payment"], ...[...reportLedgers].sort((a, b) => b.noPaymentDays - a.noPaymentDays || b.totalBalance - a.totalBalance).map((row) => [row.customerName, row.township, row.salesperson, row.openingAmount, row.openingBalance, row.adjustmentAmount || 0, row.totalBalance, row.noPaymentDays, row.lastPaymentDate || "—"])]);
    addSheet("Delivery Issues", [["Type", "Count"], ["Return", incidentCounts.return || 0], ["Wrong", incidentCounts.wrong || 0], ["Extra", incidentCounts.extra || 0], ["Missing", incidentCounts.missing || 0]]);
    XLSX.writeFile(workbook, `Nawaratt_Management_Report_${todayLocal()}.xlsx`);
    notify("Management Report Excel ထုတ်ပြီးပါပြီ");
  }

  async function downloadSaleVoucherExcel() {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const rows: Array<Array<string | number>> = [
      ["Nawaratt Sale Voucher Report"],
      ["Voucher Period", managementPeriod],
      ["Filters", managementFilterSummary],
      ["Search", voucherReportQuery.trim() || "All Customers / Vouchers"],
      [],
      ["Voucher Count", saleVoucherSummary.count],
      ["Customers", saleVoucherSummary.customers],
      ["Gross Sale VR", saleVoucherSummary.gross],
      ["Return Deduction", saleVoucherSummary.returns],
      ["Net Sale VR", saleVoucherSummary.net],
      ["Payment", saleVoucherSummary.payment],
      ["Current Outstanding", saleVoucherSummary.outstanding],
      ["Average Voucher", saleVoucherSummary.average],
      [],
      ["Sale Voucher Date", "Sale Voucher No.", "Customer", "Township", "Sale Team", "Sale Man", "Route", "Gross Sale VR", "Return / Adjustment", "Net Sale VR", "Payment", "Order Outstanding", "Current Customer Outstanding", "Delivery", "Payment Status", "Updated By"],
      ...saleVoucherOrders.map((order) => {
        const returnAmount = saleVoucherReturnByOrder.get(order.id) || 0;
        const people = assignedSalePeople(order).split(", ");
        const team = matchesSaleTeam(people, "A") && matchesSaleTeam(people, "B") ? "A + B" : matchesSaleTeam(people, "A") ? "A" : matchesSaleTeam(people, "B") ? "B" : "—";
        const currentOutstanding = customerLedgerByKey.get(customerBalanceKey(order.customerName, order.township))?.totalBalance || 0;
        return [localDateKey(order.voucherUpdatedAt || order.saleApprovedAt || order.orderDate), order.orderNo, order.customerName, order.township, team, assignedSalePeople(order), order.route, order.voucherAmount + returnAmount, returnAmount, order.voucherAmount, order.paidAmount, Math.max(0, voucherBalance(order)), currentOutstanding, statusLabel[order.dispatchStatus] || order.dispatchStatus, paymentLabel[order.paymentStatus] || order.paymentStatus, order.voucherUpdatedBy || "—"];
      }),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [14, 18, 28, 18, 12, 22, 18, 16, 18, 16, 16, 18, 22, 20, 18, 18].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, sheet, "Sale Vouchers");
    XLSX.writeFile(workbook, `Nawaratt_Sale_Voucher_Report_${todayLocal()}.xlsx`);
    notify("Sale Voucher Report Excel ထုတ်ပြီးပါပြီ");
  }

  function printManagementReport() {
    document.body.classList.add("printing-management-report");
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove("printing-management-report"), 500);
    }, 50);
  }

  function printSaleVoucherReport() {
    document.body.classList.add("printing-sale-voucher-report");
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove("printing-sale-voucher-report"), 500);
    }, 50);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><img src="/app-icon.svg" alt="Nawaratt Logo" /></div>
        <div className="brand-copy"><strong>Nawaratt</strong><span>Sale • Warehouse • Purchase • Delivery • Finance</span></div>
        <div className="role-pill"><UserRound size={15} /><span><b>{userName}</b><small>{roleLabel[role]}</small></span></div>
        <div className="notification-wrap">
          <button className={`notification-button ${unreadNotifications ? "has-unread" : ""}`} onClick={() => setShowNotifications((value) => !value)} aria-label="Notifications"><Bell size={18} />{unreadNotifications > 0 && <b>{unreadNotifications > 99 ? "99+" : unreadNotifications}</b>}</button>
          {showNotifications && <div className="notification-panel">
            <div className="notification-head"><div><strong>Notifications</strong><span>{unreadNotifications} မဖတ်ရသေး</span></div><button onClick={() => void markAllNotifications()} disabled={unreadNotifications === 0}>အားလုံးဖတ်ပြီး</button></div>
            <div className="notification-list">{notifications.length === 0 ? <div className="notification-empty"><Bell /><span>Notification မရှိသေးပါ</span></div> : notifications.map((item) => <button className={item.isRead ? "read" : "unread"} key={item.id} onClick={() => void markNotification(item)}><span className="notification-dot" /><span className="notification-copy"><strong>{item.title}</strong><small>{item.message}</small><i>{notificationTime(item.createdAt)} • {item.actor}</i></span><ChevronRight size={15} /></button>)}</div>
          </div>}
        </div>
        <button className={`exam-top-button ${tab === "exam" ? "active" : ""}`} onClick={() => setTab("exam")} aria-label="Open Examination"><GraduationCap size={18} /><span>Exam</span></button>
      </header>

      <section className="page-wrap">
        <div className="date-row">
          <div><p className="eyebrow">DAILY CONTROL</p><h1>{title}</h1></div>
          {tab !== "chat" && tab !== "admin" && tab !== "settings" && tab !== "modules" && tab !== "exam" && <label className="date-picker"><Clock3 size={16} /><select value={dateMode} onChange={(event) => setDateMode(event.target.value as DateMode)}><option value="all">All</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom</option></select></label>}
        </div>
        {tab !== "chat" && tab !== "admin" && tab !== "settings" && tab !== "modules" && tab !== "exam" && dateMode === "custom" && <div className="custom-date-range"><label><span>From</span><input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><span>→</span><label><span>To</span><input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></div>}

        {tab === "dashboard" && <>
          <div className="metrics-grid">
            <Metric icon={<ClipboardList />} label="Sale Order စုစုပေါင်း" value={summary.saleOrders} tone="green" />
            <Metric icon={<Clock3 />} label="Processing Sale Order" value={summary.processing} tone="amber" />
            <Metric icon={<CheckCircle2 />} label="Finished Sale Order" value={summary.finished} tone="blue" />
            <Metric icon={<Box />} label="Total Packages လက်ကျန်" value={openingSummary.packageBalance + livePackageRemaining} tone="purple" />
          </div>

          <section className="opening-dashboard-summary">
            <div><span>Opening ဖာလက်ကျန်</span><strong>{openingSummary.packageBalance}</strong><small>Customer Opening Date အလိုက်</small></div>
            <div><span>Opening နောက်ပိုင်း Order ဖာကျန်</span><strong>{livePackageRemaining}</strong><small>Order − Delivery</small></div>
            <div className="money"><span>Opening + VR ငွေလက်ကျန်</span><strong>{money(financeSummary.outstanding)}</strong><small>MMK</small></div>
          </section>
          <SalesProgressChart orders={financeOrders} />
          {customerPackageBalances.length > 0 && <details className="customer-package-ledger"><summary><span>Customers အလိုက် ပစ္စည်းလက်ကျန်</span><b>{customerPackageBalances.length} Customers</b></summary><div className="customer-package-table"><div className="head"><span>Customer</span><span>Opening</span><span>Order</span><span>ပို့ပြီး</span><span>လက်ကျန်</span></div>{customerPackageBalances.map((row) => <div key={row.key}><span><strong>{row.customerName}</strong><small>{row.township}</small></span><b>{row.opening}</b><b>{row.newPackages}</b><b>{row.delivered}</b><b className="balance">{row.balance}</b></div>)}</div></details>}

          {summary.processing > 0 && <button className="alert-banner" onClick={() => setTab("warehouse")}>
            <span className="alert-icon"><Clock3 size={18} /></span>
            <span><strong>Warehouse Processing {summary.processing} Sale Order</strong><small>ဘုံး / ဆွဲ / Total ဖြည့်ပြီး Finished လုပ်ရန်</small></span><ChevronRight size={20} />
          </button>}

          {canSale && summary.voucherPending > 0 && <button className="alert-banner voucher-alert" onClick={() => setTab("sale")}>
            <span className="alert-icon"><WalletCards size={18} /></span>
            <span><strong>Warehouse Finished {summary.voucherPending} Order</strong><small>Sale Team မှ Sale Voucher Amount Update လုပ်ရန်</small></span><ChevronRight size={20} />
          </button>}

          {canSale && summary.approvalPending > 0 && <button className="alert-banner approval-alert" onClick={() => setTab("sale")}>
            <span className="alert-icon"><CheckCircle2 size={18} /></span>
            <span><strong>Delivery Ready အတည်ပြုရန် {summary.approvalPending} Order</strong><small>Sale Voucher စစ်ပြီး Sale Team Approved လုပ်ရန်</small></span><ChevronRight size={20} />
          </button>}

          {canPurchase && purchaseSummary.pending > 0 && <button className="alert-banner purchase-alert" onClick={() => setTab("purchase")}>
            <span className="alert-icon"><ShoppingCart size={18} /></span>
            <span><strong>ဝယ်ရန်လိုသော ပစ္စည်း {purchaseSummary.pending} မျိုး</strong><small>Warehouse နှင့် Sale Team မှ Purchase Request ပို့ထားသည်</small></span><ChevronRight size={20} />
          </button>}

          <div className="section-heading"><div><h2>လမ်းကြောင်းအလိုက်</h2><p>Route တစ်ခုချင်းစီရဲ့ ပို့ဆောင်မှု</p></div></div>
          <div className="route-grid">{ROUTES.map((route) => {
            const routeOrders = orders.filter((order) => order.route === route);
            const packages = routeOrders.reduce((sum, order) => sum + totals(order).total, 0);
            const completed = routeOrders.filter((order) => order.dispatchStatus === "delivered").length;
            return <button className="route-card" key={route} onClick={() => { setRouteFilter(route); setTab("orders"); }}><span className="route-icon"><MapPinned size={21} /></span><span className="route-main"><strong>{route}</strong><small>{routeOrders.length} Customers • {packages} Packages</small></span><span className="route-progress"><b>{completed}/{routeOrders.length}</b><small>ပို့ပြီး</small></span></button>;
          })}</div>

          <div className="section-heading"><div><h2>လက်ရှိအခြေအနေ</h2><p>အမြန်စစ်ဆေးရန်</p></div></div>
          <div className="status-strip"><div><Truck /><strong>{summary.delivered}</strong><span>ပို့ပြီး</span></div><div><Clock3 /><strong>{orders.length - summary.delivered}</strong><span>ပို့ရန်ကျန်</span></div><div><WalletCards /><strong>{summary.paid}</strong><span>ငွေဝင်ပြီး</span></div><div><Box /><strong>{openingSummary.packageBalance + livePackageRemaining}</strong><span>Packages ကျန်</span></div></div>

          <section className="operations-alerts">
            <div className="operations-alerts-head"><div><Clock3 size={19} /><span><strong>အချိန်ကျော်လွန်မှု Alert</strong><small>လုပ်ဆောင်ရန်ကြာနေသော Order နှင့် Outstanding များ</small></span></div><b>{warehouseDelayOrders.length + deliveryWaitingOrders.length + debtWarningCustomers.length + debtCriticalCustomers.length}</b></div>
            <div className="operations-alert-grid">
              <button className="warning" onClick={() => setTab("warehouse")}><span><Box size={18} /></span><strong>{warehouseDelayOrders.length}</strong><b>Warehouse ၂ နာရီကျော်</b><small>{warehouseDelayOrders[0] ? `${warehouseDelayOrders[0].customerName} • ${Math.floor(hoursSince(warehouseDelayOrders[0].createdAt))} hrs` : "မရှိပါ"}</small></button>
              <button className="orange" onClick={() => { setDeliveryView("pending"); setTab("orders"); }}><span><Truck size={18} /></span><strong>{deliveryWaitingOrders.length}</strong><b>Delivery Ready • မပို့ရသေး</b><small>{deliveryWaitingOrders[0] ? `${deliveryWaitingOrders[0].customerName} • ${notificationTime(deliveryWaitingOrders[0].saleApprovedAt || deliveryWaitingOrders[0].updatedAt)}` : "မရှိပါ"}</small></button>
              <button className="warning" onClick={() => { if (canViewFinance) { setFinanceView("unpaid-10"); setTab("finance"); } }}><span><Banknote size={18} /></span><strong>{debtWarningCustomers.length}</strong><b>Outstanding ၁၀–၁၉ ရက်</b><small>{money(debtWarningCustomers.reduce((sum, item) => sum + item.totalBalance, 0))} MMK</small></button>
              <button className="critical" onClick={() => { if (canViewFinance) { setFinanceView("unpaid-20"); setFinanceSort("days-desc"); setTab("finance"); } }}><span><Banknote size={18} /></span><strong>{debtCriticalCustomers.length}</strong><b>Outstanding ၂၀ ရက်နှင့်အထက်</b><small>{money(debtCriticalCustomers.reduce((sum, item) => sum + item.totalBalance, 0))} MMK</small></button>
            </div>
          </section>

          {(canSale || role === "finance") && <section className="management-report" id="management-report">
            <div className="management-report-head"><div><FileSpreadsheet size={20} /><span><strong>{managementReportView === "overview" ? "Management Report" : "Sale Voucher Report"}</strong><small>{managementPeriod} • {managementReportView === "overview" ? "Sale, Payment, Route, Delivery & Outstanding" : "Sale Voucher Date အလိုက် အသေးစိတ်စာရင်း"}</small></span></div><div><button onClick={() => void (managementReportView === "overview" ? downloadManagementExcel() : downloadSaleVoucherExcel())}><FileSpreadsheet size={16} />Excel</button><button onClick={managementReportView === "overview" ? printManagementReport : printSaleVoucherReport}><Printer size={16} />PDF / Print</button></div></div>
            <div className="management-report-tabs"><button className={managementReportView === "overview" ? "active" : ""} onClick={() => setManagementReportView("overview")}>Management Summary</button><button className={managementReportView === "sale-vouchers" ? "active" : ""} onClick={() => setManagementReportView("sale-vouchers")}>Sale Voucher Report</button></div>
            <div className="management-report-filters">
              <label><span>Sale Team</span><select value={reportSaleTeamFilter} onChange={(event) => { const team = event.target.value as "All" | SaleTeamKey; setReportSaleTeamFilter(team); if (team !== "All" && !SALE_TEAM_MEMBERS[team].includes(reportSalespersonFilter)) setReportSalespersonFilter("All"); }}><option value="All">All Sale Teams</option><option value="A">Sale Team A</option><option value="B">Sale Team B</option></select></label>
              <label><span>Sale Men</span><select value={reportSalespersonFilter} onChange={(event) => setReportSalespersonFilter(event.target.value)}><option value="All">All Sale Men</option>{reportTeamMembers.map((person) => <option value={person} key={person}>{person}</option>)}</select></label>
              <label><span>Payment</span><select value={reportPaymentFilter} onChange={(event) => setReportPaymentFilter(event.target.value as ReportPaymentFilter)}><option value="all">All Payment</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option></select></label>
              <label><span>Route</span><select value={reportRouteFilter} onChange={(event) => setReportRouteFilter(event.target.value)}><option value="All">All Routes</option>{ROUTES.map((route) => <option value={route} key={route}>{route}</option>)}</select></label>
              <label><span>Delivery Status</span><select value={reportDeliveryFilter} onChange={(event) => setReportDeliveryFilter(event.target.value as ReportDeliveryFilter)}><option value="all">All Status</option><option value="pending">ပို့ရန်ကျန်</option><option value="out_for_delivery">On the way</option><option value="delivered">ပို့ပြီး</option><option value="partial">တစ်စိတ်တစ်ပိုင်းပို့ပြီး</option><option value="returned">ပြန်အပ်</option><option value="rescheduled">ပြန်ချိန်း</option></select></label>
              <label><span>Outstanding</span><select value={reportOutstandingFilter} onChange={(event) => setReportOutstandingFilter(event.target.value as ReportOutstandingFilter)}><option value="all">All Outstanding</option><option value="5_plus">ကြွေးကျန်ရှိ ငွေမပေး ၅ ရက်</option><option value="10_plus">ကြွေးကျန်ရှိ ငွေမပေး ၁၀ ရက်</option><option value="20_plus">ကြွေးကျန်ရှိ ငွေမပေး ၂၀ ရက်</option></select></label>
              {(reportHasPeopleFilter || reportHasOrderDimensionFilters || reportOutstandingFilter !== "all") && <button className="management-filter-clear" onClick={clearManagementFilters}><X size={14} />Clear</button>}
            </div>
            {managementReportView === "overview" ? <>
            <div className="management-filter-note"><span>{managementFilterSummary}</span><b>{reportOrders.length} Orders • {reportPayments.length} Payments • {reportLedgers.length} Customers</b></div>
            <div className="management-kpis"><div><span>Sale Orders</span><strong>{managementSummary.orders}</strong></div><div><span>Sale VR</span><strong>{money(managementSummary.vouchers)}</strong><small>MMK</small></div><div><span>Payment</span><strong>{money(managementSummary.payments)}</strong><small>MMK</small></div><div className="outstanding"><span>Outstanding</span><strong>{money(managementSummary.outstanding)}</strong><small>MMK</small></div></div>
            <div className="management-report-tables">
              <div><h3>Sale Man Performance</h3><div className="management-table"><div className="head"><span>Sale Man</span><span>Orders</span><span>Voucher</span><span>ပို့ပြီး</span></div>{salespersonReport.length === 0 ? <p>Data မရှိသေးပါ</p> : salespersonReport.map((row) => <div key={row.name}><span>{row.name}</span><b>{row.orders}</b><b>{money(row.vouchers)}</b><b>{row.delivered}</b></div>)}</div></div>
              <div><h3>Route Performance</h3><div className="management-table"><div className="head"><span>Route</span><span>Orders</span><span>Packages</span><span>Pending</span></div>{routeReport.length === 0 ? <p>Data မရှိသေးပါ</p> : routeReport.map((row) => <div key={row.name}><span>{row.name}</span><b>{row.orders}</b><b>{row.packages}</b><b>{row.pending}</b></div>)}</div></div>
            </div>
            <div className="management-issues"><span><b>{reportIncidents.filter((item) => item.issueType === "return").length}</b>Return</span><span><b>{reportIncidents.filter((item) => item.issueType === "wrong").length}</b>Wrong</span><span><b>{reportIncidents.filter((item) => item.issueType === "extra").length}</b>Extra</span><span><b>{reportIncidents.filter((item) => item.issueType === "missing").length}</b>Missing</span></div>
            <div className="management-print-details">
              <h3>Order Details</h3>
              <table><thead><tr><th>Date</th><th>Order</th><th>Customer</th><th>Sale Man</th><th>Route</th><th>Delivery</th><th>Payment</th><th>Voucher</th><th>Outstanding</th></tr></thead><tbody>{reportOrders.map((order) => <tr key={order.id}><td>{order.orderDate}</td><td>{order.orderNo}</td><td>{order.customerName}</td><td>{assignedSalePeople(order)}</td><td>{order.route}</td><td>{statusLabel[order.dispatchStatus] || order.dispatchStatus}</td><td>{paymentLabel[order.paymentStatus] || order.paymentStatus}</td><td>{money(order.voucherStatus === "updated" ? order.voucherAmount : 0)}</td><td>{money(voucherBalance(order))}</td></tr>)}</tbody></table>
              <h3>Payment Details</h3>
              <table><thead><tr><th>Date</th><th>Customer</th><th>Township</th><th>Method</th><th>Amount</th></tr></thead><tbody>{reportPayments.map((payment) => <tr key={payment.id}><td>{payment.paymentDate}</td><td>{payment.customerName}</td><td>{payment.township}</td><td>{payment.method === "cash" ? "Cash" : "Banking"}</td><td>{money(payment.amount)}</td></tr>)}</tbody></table>
              <h3>Customer Balances</h3>
              <table><thead><tr><th>Customer</th><th>Township</th><th>Sale Man</th><th>Outstanding</th><th>No Payment Days</th><th>Last Payment</th></tr></thead><tbody>{[...reportLedgers].sort((a, b) => b.totalBalance - a.totalBalance).map((ledger) => <tr key={ledger.key}><td>{ledger.customerName}</td><td>{ledger.township}</td><td>{ledger.salesperson}</td><td>{money(ledger.totalBalance)}</td><td>{ledger.noPaymentDays}</td><td>{ledger.lastPaymentDate || "—"}</td></tr>)}</tbody></table>
            </div>
            </> : <div className="sale-voucher-report-panel" id="sale-voucher-report">
              <div className="sale-voucher-report-tools"><label><Search size={17} /><input value={voucherReportQuery} onChange={(event) => setVoucherReportQuery(event.target.value)} placeholder="Customer / Voucher No. / Sale Man ရှာရန်" /></label>{voucherReportQuery && <button onClick={() => setVoucherReportQuery("")}><X size={15} />Clear Search</button>}<span>ရက်စွဲကို Sale Voucher Update Date ဖြင့်တွက်ထားသည်</span></div>
              <div className="management-filter-note"><span>{managementFilterSummary}</span><b>{saleVoucherSummary.count} Vouchers • {saleVoucherSummary.customers} Customers</b></div>
              <div className="sale-voucher-kpis"><div><span>Gross Sale VR</span><strong>{money(saleVoucherSummary.gross)}</strong><small>MMK</small></div><div className="deduction"><span>Return / Adjustment</span><strong>{money(saleVoucherSummary.returns)}</strong><small>MMK</small></div><div><span>Net Sale VR</span><strong>{money(saleVoucherSummary.net)}</strong><small>MMK</small></div><div><span>Payment</span><strong>{money(saleVoucherSummary.payment)}</strong><small>MMK</small></div><div className="outstanding"><span>Current Outstanding</span><strong>{money(saleVoucherSummary.outstanding)}</strong><small>MMK</small></div><div><span>Average Voucher</span><strong>{money(saleVoucherSummary.average)}</strong><small>MMK</small></div></div>
              <div className="sale-voucher-table-wrap"><table className="sale-voucher-table"><thead><tr><th>Sale VR Date</th><th>Voucher No.</th><th>Customer</th><th>Sale Team / Man</th><th>Route</th><th>Gross VR</th><th>Return / Adjustment</th><th>Net Sale VR</th><th>Payment</th><th>Order Outstanding</th><th>Current Outstanding</th><th>Delivery / Payment</th></tr></thead><tbody>{saleVoucherOrders.length === 0 ? <tr><td colSpan={12}>ရွေးထားသော Filter အတွက် Sale Voucher မရှိသေးပါ</td></tr> : saleVoucherOrders.map((order) => { const returnAmount = saleVoucherReturnByOrder.get(order.id) || 0; const people = assignedSalePeople(order).split(", "); const team = matchesSaleTeam(people, "A") && matchesSaleTeam(people, "B") ? "A + B" : matchesSaleTeam(people, "A") ? "A" : matchesSaleTeam(people, "B") ? "B" : "—"; const currentOutstanding = customerLedgerByKey.get(customerBalanceKey(order.customerName, order.township))?.totalBalance || 0; return <tr key={`voucher-report-${order.id}`}><td>{localDateKey(order.voucherUpdatedAt || order.saleApprovedAt || order.orderDate)}</td><td><b>{order.orderNo}</b><small>{order.voucherUpdatedBy || "—"}</small></td><td><b>{order.customerName}</b><small>{order.township}</small></td><td><b>Team {team}</b><small>{assignedSalePeople(order)}</small></td><td>{order.route || "—"}</td><td>{money(order.voucherAmount + returnAmount)}</td><td className="deduction">{returnAmount ? `− ${money(returnAmount)}` : "—"}</td><td><b>{money(order.voucherAmount)}</b></td><td>{money(order.paidAmount)}</td><td>{money(Math.max(0, voucherBalance(order)))}</td><td className="outstanding">{money(currentOutstanding)}</td><td><b>{statusLabel[order.dispatchStatus] || order.dispatchStatus}</b><small>{paymentLabel[order.paymentStatus] || order.paymentStatus}</small></td></tr>; })}</tbody></table></div>
            </div>}
          </section>}

          {recentDeliveryEvidence.length > 0 && <section className="proof-dashboard-section">
            <div className="proof-dashboard-heading"><div><Camera size={19} /><span><strong>Delivery အထောက်အထားဓာတ်ပုံများ</strong><small>ကားဂိတ် / ငွေသိမ်း • Return • ပစ္စည်းမှား / ပို / လို</small></span></div><b>{recentDeliveryEvidence.length}</b></div>
            <div className="proof-dashboard-filters"><label><span>Sale Man</span><select value={evidenceSalespersonFilter} onChange={(event) => setEvidenceSalespersonFilter(event.target.value)}><option value="All">All Sale Men</option>{evidenceSalespeople.map((person) => <option value={person} key={person}>{person}</option>)}</select></label><label><span>Route</span><select value={evidenceRouteFilter} onChange={(event) => setEvidenceRouteFilter(event.target.value)}><option value="All">All Routes</option>{evidenceRoutes.map((route) => <option value={route} key={route}>{route}</option>)}</select></label>{(evidenceRouteFilter !== "All" || evidenceSalespersonFilter !== "All") && <button onClick={() => { setEvidenceRouteFilter("All"); setEvidenceSalespersonFilter("All"); }}>Clear</button>}</div>
            {filteredDeliveryEvidence.length === 0 ? <div className="proof-dashboard-empty">ရွေးထားသော Sale Man / Route အတွက် အထောက်အထားပုံ မရှိသေးပါ</div> : <><div className="proof-dashboard-list">{evidencePageItems.map((item) => <button key={item.key} onClick={() => setEvidenceViewer({ src: item.photoUrl, title: `${item.customerName} — ${item.label}`, meta: `${item.orderNo}${item.route ? ` • ${item.route}` : ""} • ${item.salesperson} • ${item.uploadedBy} • ${notificationTime(item.uploadedAt)}` })}><span className={`proof-dashboard-icon ${item.tone}`}><Camera size={17} /></span><span className="proof-dashboard-copy"><strong>{item.customerName}</strong><small><b>{item.label}</b> • {item.orderNo}{item.route ? ` • ${item.route}` : ""}</small><i>{item.salesperson} • {item.uploadedBy} • {notificationTime(item.uploadedAt)}</i></span><span className="proof-dashboard-open">ကြည့်ရန် <ChevronRight size={15} /></span></button>)}</div>{filteredDeliveryEvidence.length > evidencePageSize && <div className="proof-dashboard-pagination"><WarehousePagination page={evidencePage} pageCount={evidencePageCount} total={filteredDeliveryEvidence.length} noun="Photos" onChange={setEvidencePage} /></div>}</>}
          </section>}
          <AuditLogPanel logs={auditLogs} />
        </>}

        {tab === "modules" && <BusinessModules role={role} userName={userName} notify={notify} onCreateSaleOrder={(prefill) => { setSaleOrderPrefill(prefill); setShowAdd(true); }} />}
        {tab === "products" && <ProductMasterPage products={products} canManage={isAdmin} reload={loadProducts} notify={notify} />}

        {tab === "orders" && <>
          <OrderToolbar query={query} setQuery={setQuery} routeFilter={routeFilter} setRouteFilter={setRouteFilter} salesTeamFilter={salesTeamFilter} setSalesTeamFilter={setSalesTeamFilter} salespersonFilter={salespersonFilter} setSalespersonFilter={setSalespersonFilter} reload={async () => { await Promise.all([loadOrders(), loadFinanceOrders()]); }} />
          <div className="delivery-workflow-note"><span>Delivery Pending List</span><i>→</i><span>ပို့ရန်ကျန်</span><i>→</i><span>On the Way</span><i>→</i><span>ပို့ပြီး</span></div>
          <div className="delivery-list-menu"><button className={deliveryView === "pending" ? "active" : ""} onClick={() => setDeliveryView("pending")}><Clock3 size={17} /><span>ပို့ရန်ကျန်</span><b>{pendingDeliveryOrders.length}</b></button><button className={deliveryView === "approval_pending" ? "active" : ""} onClick={() => setDeliveryView("approval_pending")}><ClipboardList size={17} /><span>Delivery Pending List</span><b>{approvalPendingDeliveryOrders.length}</b></button><button className={deliveryView === "on_the_way" ? "active" : ""} onClick={() => setDeliveryView("on_the_way")}><Truck size={17} /><span>On the Way</span><b>{onTheWayOrders.length}</b></button><button className={deliveryView === "delivered" ? "active" : ""} onClick={() => setDeliveryView("delivered")}><CheckCircle2 size={17} /><span>ပို့ပြီး</span><b>{deliveredOrders.length}</b></button></div>
          {deliveryView === "pending" && canDelivery && carLoadReadyOrders.length > 0 && <div className="car-load-actions"><label><input type="checkbox" checked={selectedDeliveryIds.length === carLoadReadyOrders.length} onChange={(event) => setSelectedDeliveryIds(event.target.checked ? carLoadReadyOrders.map((order) => order.id) : [])} /><span>Delivery Ready အားလုံးရွေးရန်</span></label><strong>{selectedDeliveryIds.length} Orders ရွေးထားသည်</strong><button disabled={deliveryBulkBusy || selectedDeliveryIds.length === 0} onClick={() => void markSelectedOnTheWay()}><Truck size={16} />{deliveryBulkBusy ? "ပြောင်းနေသည်…" : "ကားပေါ်တင်ပြီး • On the way"}</button></div>}
          {deliveryView === "on_the_way" && canDelivery && onTheWayOrders.length > 0 && <div className="car-load-actions delivered-actions"><label><input type="checkbox" checked={selectedDeliveryIds.length === onTheWayOrders.length} onChange={(event) => setSelectedDeliveryIds(event.target.checked ? onTheWayOrders.map((order) => order.id) : [])} /><span>On the way အားလုံးရွေးရန်</span></label><strong>{selectedDeliveryIds.length} Orders ရွေးထားသည်</strong><button disabled={deliveryBulkBusy || selectedDeliveryIds.length === 0} onClick={() => void markSelectedDelivered()}><CheckCircle2 size={16} />{deliveryBulkBusy ? "ပြောင်းနေသည်…" : "ရွေးထားသည်များ Delivered"}</button></div>}
          {deliveryView === "delivered" && <p className="delivery-date-filter-note">ပို့ပြီးစာရင်းကို Sale Order ရက်မဟုတ်ဘဲ အမှန်တကယ် Delivered ဖြစ်သည့် Myanmar ရက်စွဲအလိုက် ပြထားပါသည်။</p>}
          <div className="order-list-view">{loading || (deliveryView === "delivered" && financeLoading) ? <Loading /> : deliveryViewOrders.length === 0 ? <DeliveryEmpty view={deliveryView} /> : deliveryViewOrders.map((order) => {
            if (deliveryView === "delivered" || deliveryView === "approval_pending") return <OrderListRow order={order} key={order.id} previousBalance={previousBalanceForOrder(order)} latestPaymentDate={paymentDateForOrder(order)} onOpen={() => setSelected(order)} />;
            const selectable = canDelivery && (deliveryView === "on_the_way" || carLoadReadyOrders.some((item) => item.id === order.id));
            return <div className={`delivery-order-select-wrap ${deliveryView === "on_the_way" ? "on-the-way-row" : ""} ${selectable ? "selectable" : "locked"}`} key={order.id}>{canDelivery && <label className="delivery-order-check" title={selectable ? "Order ရွေးရန်" : "Delivery Ready ဖြစ်ရန် စောင့်နေသည်"}><input type="checkbox" disabled={!selectable} checked={selectedDeliveryIds.includes(order.id)} onChange={(event) => setSelectedDeliveryIds((current) => event.target.checked ? [...new Set([...current, order.id])] : current.filter((id) => id !== order.id))} /><span>{deliveryView === "on_the_way" ? "Delivered ရွေး" : selectable ? "ကားပေါ်တင်" : "မရွေးနိုင်"}</span></label>}<OrderListRow order={order} previousBalance={previousBalanceForOrder(order)} latestPaymentDate={paymentDateForOrder(order)} onOpen={() => setSelected(order)} />{deliveryView === "on_the_way" && canDelivery && <button className="quick-delivered-button" disabled={deliveryBulkBusy} onClick={() => void markSelectedDelivered([order.id])}><CheckCircle2 size={15} /><span>Delivered</span></button>}</div>;
          })}</div>
        </>}

        {tab === "warehouse" && <>
          <div className="workflow-note"><Box size={18} /><div><strong>Nawaratt Workflow V2 — Warehouse</strong><span>Excel Row အစဉ်အတိုင်း Verify → Pick → Shortage/Unavailable မှတ်တမ်း → Finished လုပ်ပါ။</span></div></div>
          <WarehouseProductReport orders={orders} period={managementPeriod} notify={notify} />
          <OrderToolbar query={query} setQuery={setQuery} routeFilter={routeFilter} setRouteFilter={setRouteFilter} salesTeamFilter={salesTeamFilter} setSalesTeamFilter={setSalesTeamFilter} salespersonFilter={salespersonFilter} setSalespersonFilter={setSalespersonFilter} reload={loadOrders} />
          <div className="warehouse-v2-tabs"><button className={warehouseView === "pending" ? "active" : ""} onClick={() => setWarehouseView("pending")}><Clock3 size={17} /><span>Pending Orders</span><b>{warehousePendingOrders.length}</b></button><button className={warehouseView === "completed" ? "active" : ""} onClick={() => setWarehouseView("completed")}><PackageCheck size={17} /><span>Completed Order</span><b>{warehouseCompletedOrders.length}</b></button><button className={warehouseView === "ready" ? "active" : ""} onClick={() => setWarehouseView("ready")}><Truck size={17} /><span>Ready to Deliver</span><b>{warehouseReadyOrders.length}</b></button></div>
          {warehouseView === "ready" && <p className="warehouse-ready-lock-note"><ShieldCheck size={16} />Ready to Deliver Orders ကို Warehouse မှ ပြင်၍မရပါ။ လျှော့ချရန်/ပြန်အပ်ရန် Return Workflow ကိုသာ အသုံးပြုပါ။</p>}
          {!loading && warehouseOrders.length > 0 && <WarehousePagination page={warehousePage} pageCount={warehousePageCount} total={warehouseOrders.length} onChange={setWarehousePage} />}
          <div className="warehouse-list-view">{loading ? <Loading /> : warehouseOrders.length === 0 ? <Empty canAdd={false} onAdd={() => undefined} /> : warehousePageOrders.map((order) => <WarehouseOrderListRow order={order} key={order.id} canStartPicking={canWarehouse} onStartPicking={() => void startPicking(order)} onOpen={() => { setSelectedWarehouseWorkflow(true); setSelected(order); }} />)}</div>
          {!loading && warehouseOrders.length > 0 && <WarehousePagination page={warehousePage} pageCount={warehousePageCount} total={warehouseOrders.length} onChange={setWarehousePage} />}
        </>}

        {tab === "sale" && <>
          <section className="sale-team-actions"><div className="sale-team-actions-head"><WalletCards size={18} /><span><strong>Warehouse Completed — Review & Delivery Approval</strong><small>Product နှင့် Quantity Changes ကိုစစ်ပြီး Sale Voucher အတည်ပြုကာ Delivery Approved ကို တစ်ဆင့်တည်းလုပ်ပါ။</small></span><b>{reviewApprovalOrders.length}</b></div><div className="sale-team-action-groups single"><div><div className="sale-action-title voucher"><span>Review Products & Approve for Delivery</span><b>{reviewApprovalOrders.length}</b></div>{reviewApprovalOrders.length === 0 ? <p>Review & Delivery Approved လုပ်ရန် Warehouse Completed Order မရှိပါ</p> : reviewApprovalOrders.map((order) => <button className="warehouse-review-order" key={`review-${order.id}`} onClick={() => setSelected(order)}><span><strong>{order.customerName}</strong><small>{assignedSalePeople(order)} • {order.orderNo} • {order.orderItems.length} Products</small></span><em>Review & Approve</em><ChevronRight size={16} /></button>)}</div></div></section>
          {warehouseUnfinishedOrders.length > 0 && <section className="warehouse-unfinished"><div className="warehouse-unfinished-head"><Clock3 size={18} /><span><strong>Warehouse — Unfinished</strong><small>Sale Team မှ Warehouse လုပ်ဆောင်နေဆဲ Orders ကို တစ်နေရာတည်း စောင့်ကြည့်နိုင်ပါသည်</small></span><b>{warehouseUnfinishedOrders.length}</b></div><div>{warehouseUnfinishedOrders.map((order) => { const active = order.warehouseBatches.find((batch) => batch.status === "picking"); return <button key={order.id} onClick={() => setSelected(order)}><span><strong>{order.customerName}</strong><small>{order.orderNo} • {assignedSalePeople(order)} • {notificationTime(order.createdAt)}</small></span><em>{active ? `Picking • ${active.pickingStartedBy || "Warehouse"}` : "Processing"}</em><ChevronRight size={16} /></button>; })}</div></section>}
          {overdueDebtCustomers.length > 0 && <section className="debt-collection-section debt-age-section">
            <div className="debt-heading"><span><Banknote size={19} /></span><div><strong>အကြွေးသက်တမ်း — ၁၀ ရက်ကျော်</strong><small>{overdueDebtSummary.customers} Customers • Oldest Unpaid Sale VR Date ဖြင့်တွက်ထားသည်</small></div><div className="debt-heading-totals"><span><small>Unpaid Sale VR Total</small><b>{money(overdueDebtSummary.saleVr)} MMK</b></span><span><small>Current Outstanding</small><b>{money(overdueDebtSummary.outstanding)} MMK</b></span></div></div>
            <div className="debt-toolbar"><span>Customer တစ်ယောက် တစ်ကြိမ် • Oldest Unpaid VR • Current Outstanding</span><label><SlidersHorizontal size={14} /><select aria-label="အကြွေးသက်တမ်းစာရင်း စီရန်" value={debtSort} onChange={(event) => setDebtSort(event.target.value as DebtSort)}><option value="days-desc">အကြွေးသက်တမ်း အကြာဆုံး</option><option value="outstanding-desc">Outstanding အများဆုံး</option><option value="voucher-desc">Sale VR အများဆုံး</option></select></label></div>
            <div className="debt-list">{overdueDebtCustomers.map((row) => { const risk = row.debtAgeDays >= 20 ? "critical" : "warning"; return <button className={risk} key={row.key} onClick={() => setSelected(row.oldestOrder)}><span className={`debt-days ${risk}`}>{row.debtAgeDays} Days</span><span className="debt-customer"><strong>{row.customerName}</strong><small>Oldest Unpaid VR: {row.oldestUnpaidDate} • {row.route} • {row.salespeople}</small></span><span className="debt-amounts"><span><small>Unpaid Sale VR</small><strong>{money(row.unpaidSaleVr)}</strong></span><span className="outstanding"><small>Outstanding</small><strong>{money(row.outstanding)}</strong></span></span><ChevronRight size={16} /></button>; })}</div>
          </section>}
          {noPaymentCustomers.length > 0 && <section className="debt-collection-section no-payment-section">
            <div className="debt-heading"><span><Clock3 size={19} /></span><div><strong>ငွေမပေးသည်မှာ — ၁၀ ရက်ကျော်</strong><small>{noPaymentSummary.customers} Customers • Last Payment Date ဖြင့်တွက်ထားသည်</small></div><div className="debt-heading-totals"><span><small>Customers</small><b>{noPaymentSummary.customers}</b></span><span><small>Current Outstanding</small><b>{money(noPaymentSummary.outstanding)} MMK</b></span></div></div>
            <div className="debt-toolbar"><span>Customer တစ်ယောက် တစ်ကြိမ် • Last Payment Date • Current Outstanding</span><label><SlidersHorizontal size={14} /><select aria-label="ငွေမပေးသည့်စာရင်း စီရန်" value={debtSort} onChange={(event) => setDebtSort(event.target.value as DebtSort)}><option value="days-desc">ငွေမပေးရက် အကြာဆုံး</option><option value="outstanding-desc">Outstanding အများဆုံး</option><option value="voucher-desc">Sale VR အများဆုံး</option></select></label></div>
            <div className="debt-list">{noPaymentCustomers.map((row) => { const risk = row.noPaymentDays >= 20 ? "critical" : "warning"; const dateLabel = row.referenceType === "payment" ? "Last Payment" : row.referenceType === "opening" ? "Opening Date" : "Payment မရှိသေး • Oldest Unpaid VR"; return <button className={risk} key={row.ledger.key} onClick={() => row.oldestOrder && setSelected(row.oldestOrder)}><span className={`debt-days ${risk}`}>{row.noPaymentDays} Days</span><span className="debt-customer"><strong>{row.ledger.customerName}</strong><small>{dateLabel}: {row.referenceDate} • {row.ledger.route} • {row.ledger.salesperson}</small></span><span className="debt-amounts"><span><small>Last Payment</small><strong>{row.referenceType === "payment" ? row.referenceDate : "မရှိသေး"}</strong></span><span className="outstanding"><small>Outstanding</small><strong>{money(row.ledger.totalBalance)}</strong></span></span>{row.oldestOrder ? <ChevronRight size={16} /> : <span />}</button>; })}</div>
          </section>}
          <button className="customer-request-cta" onClick={() => setShowCustomerRequest(true)}><span><Plus size={19} /></span><div><strong>Customer Request ပို့ရန်</strong><small>Sale Order မရှိသေးသော Customer မှာယူပစ္စည်းကို Purchase Team သို့ ပို့မည်</small></div><ChevronRight size={19} /></button>
          <SalePurchaseStatus requests={purchaseRequests} summary={purchaseSummary} loading={purchaseLoading} />
          <div className="section-heading"><div><h2>Salesman Reviewed Orders</h2><p>Warehouse Completed ဖြစ်ပြီး Review / Approval လုပ်ထားသော Orders</p></div></div>
          <OrderToolbar query={query} setQuery={setQuery} routeFilter={routeFilter} setRouteFilter={setRouteFilter} salesTeamFilter={salesTeamFilter} setSalesTeamFilter={setSalesTeamFilter} salespersonFilter={salespersonFilter} setSalespersonFilter={setSalespersonFilter} reload={loadOrders} />
          <section className="sale-amount-summary">
            <div className="sale-amount-context"><span><Clock3 size={14} /><b>{periodLabel[dateMode]}</b></span><span><UserRound size={14} /><b>{salesTeamFilter === "All" ? "All Sale Teams" : `Sale Team ${salesTeamFilter}`}</b></span><span><UserRound size={14} /><b>{salespersonFilter === "All" ? "All Sale Men" : salespersonFilter}</b></span><span>{saleAmountSummary.saleOrderCount} Sale Orders</span></div>
            <div className="sale-amount-cards"><article><span>Total Sale Order Amount</span><strong>{money(saleAmountSummary.orderAmount)} <small>MMK</small></strong></article><article><span>Total Sale VR Amount</span><strong>{money(saleAmountSummary.voucherAmount)} <small>MMK</small></strong>{saleAmountSummary.voucherPending > 0 && <i>{saleAmountSummary.voucherPending} VR Pending</i>}</article></div>
            {saleAmountBreakdown.length > 0 && <details className="sale-amount-breakdown"><summary><span>ရက်အလိုက် / Sale Men အလိုက်</span><b>{saleAmountBreakdown.length} စာရင်း</b></summary><div className="sale-amount-table"><div className="head"><span>Date / Sale Men</span><span>Sale Order</span><span>Sale VR</span></div>{saleAmountBreakdown.map((row) => <div key={`${row.date}-${row.salesperson}`}><span><strong>{row.date}</strong><small>{row.salesperson} • {row.orderCount} Orders{row.voucherPending ? ` • ${row.voucherPending} VR Pending` : ""}</small></span><b>{money(row.orderAmount)}</b><b>{money(row.voucherAmount)}</b></div>)}</div></details>}
          </section>
          <div className="order-list">{loading ? <Loading /> : saleOrders.length === 0 ? <Empty canAdd={false} onAdd={() => undefined} /> : saleOrders.map((order) => <OrderCard order={order} previousBalance={previousBalanceForOrder(order)} latestPaymentDate={paymentDateForOrder(order)} key={order.id} onOpen={() => setSelected(order)} />)}</div>
        </>}

        {tab === "purchase" && <PurchasePanel requests={purchaseRequests} loading={purchaseLoading} summary={purchaseSummary} notify={notify} isAdmin={isAdmin} onAdminAdjust={adminAdjustPurchase} onRejectArrival={adminRejectPurchaseArrival} onStatus={async (items, status, supplierName) => { try { await patchPurchases(items, status, supplierName); notify(status === "unavailable" ? `ပစ္စည်း ${items.length} ခုကို မရပါအဖြစ် ပြောင်းပြီး Sale Team ကို အသိပေးထားပါပြီ` : `ပစ္စည်း ${items.length} ခုကို ${purchaseStatusLabel(status)} အဖြစ် ပြောင်းထားပါပြီ`); } catch (error) { notify(error instanceof Error ? error.message : "Purchase update failed"); } }} />}

        {tab === "finance" && <div className="finance-ledger-page">
          <BalanceAdjustmentPanel customers={customerDirectory} balances={customerOutstandingTotals} isAdmin={isAdmin} notify={notify} onSaved={async () => { await Promise.all([loadOpeningBalances(), loadFinanceOrders(), loadAuditLogs()]); }} />
          {canFinance ? <>
            <FinancePaymentEntry ledgers={customerLedgers} onSaved={async () => { await Promise.all([loadFinanceOrders(), loadOrders(), loadPayments(), loadOpeningBalances()]); }} notify={notify} />
            <FinancePaymentImport onImported={async () => { await Promise.all([loadFinanceOrders(), loadOrders(), loadPayments(), loadOpeningBalances()]); }} notify={notify} />
          </> : <div className="finance-read-only-note"><ShieldCheck size={17} /><span><strong>Sale Team View</strong><small>Finance စာရင်းကို ကြည့်ရှုနိုင်ပြီး Payment ပြင်ဆင်ခြင်းကို Finance နှင့် Admin သာ လုပ်နိုင်ပါသည်</small></span></div>}
          <div className="finance-team-filters"><label className="salesperson-menu finance-salesperson-menu"><span><UserRound size={16} /><b>Sale Team</b></span><select value={salesTeamFilter} onChange={(event) => { const team = event.target.value as SaleTeamFilter; setSalesTeamFilter(team); if (team !== "All" && !SALE_TEAM_MEMBERS[team].includes(salespersonFilter)) setSalespersonFilter("All"); }}><option value="All">All Sale Teams</option><option value="A">Sale Team A</option><option value="B">Sale Team B</option></select></label><label className="salesperson-menu finance-salesperson-menu"><span><UserRound size={16} /><b>Sale Man</b></span><select value={salespersonFilter} onChange={(event) => setSalespersonFilter(event.target.value)}><option value="All">All Sale Men</option>{salePeopleForTeam(salesTeamFilter).map((person) => <option value={person} key={person}>{person}</option>)}</select></label></div>
          <div className="finance-customer-search"><Search size={18} /><div><input list="finance-customer-list" value={financeCustomerQuery} onChange={(event) => { setFinanceCustomerQuery(event.target.value); if (event.target.value.trim()) setDateMode("all"); }} placeholder="Customer အမည် / မြို့နယ်ဖြင့် ရှာရန်" /><datalist id="finance-customer-list">{customerDirectory.map((customer) => <option key={`${customer.name}-${customer.township}`} value={customer.name}>{customer.township}</option>)}</datalist><small>Customer Search သည် All Dates အတွင်း ရှာပေးပါမည်</small></div>{financeCustomerQuery && <button onClick={() => setFinanceCustomerQuery("")} aria-label="Clear customer search"><X size={16} /></button>}</div>
          <section className="daily-payment-report"><div className="daily-payment-title"><div><Banknote size={18} /><span><strong>ရက်အလိုက် Customers အလိုက် ငွေဝင်စာရင်းများ</strong><small>Payment အရေအတွက်ကို နှိပ်ပြီး Customer နှင့် Amount ကြည့်နိုင်ပါသည်</small></span></div><button onClick={() => void Promise.all([loadFinanceOrders(), loadPayments(), loadOpeningBalances()])} aria-label="Refresh all finance data"><RefreshCw size={16} /></button></div><div className="payment-method-totals"><div className="cash"><span>Cash In</span><strong>{money(paymentMethodTotals.cash)}</strong><small>MMK</small></div><div className="bank"><span>Bank In</span><strong>{money(paymentMethodTotals.banking)}</strong><small>MMK</small></div><div className="total"><span>Total In</span><strong>{money(paymentMethodTotals.total)}</strong><small>MMK</small></div></div>{paymentsLoading ? <Loading /> : dailyPaymentRows.length === 0 ? <div className="payment-report-empty">ရွေးထားသောကာလအတွက် Payment စာရင်းမရှိသေးပါ</div> : <div className="daily-payment-table"><div className="daily-payment-header"><span>ရက်စွဲ</span><span>Cash In</span><span>Bank In</span><span>Total</span></div>{dailyPaymentRows.map((row) => <div className="daily-payment-day" key={row.date}><button className={`daily-payment-row ${selectedPaymentDate === row.date ? "open" : ""}`} onClick={() => setSelectedPaymentDate((current) => current === row.date ? "" : row.date)}><span><strong>{row.date}</strong><small>{row.count} Payments • ကြည့်ရန်</small></span><b className="cash">{money(row.cash)}</b><b className="bank">{money(row.banking)}</b><b>{money(row.total)}</b></button>{selectedPaymentDate === row.date && <div className={`daily-payment-details ${isAdmin ? "admin-enabled" : ""}`}><div className="daily-payment-details-head"><span><strong>{row.date}</strong><small>{selectedDatePayments.length} Payments</small></span><b>Customer / Amount</b>{isAdmin && <b>Admin Action</b>}</div>{selectedDatePayments.map((payment) => <article key={payment.id}><span><strong>{payment.customerName}</strong><small>{payment.township || "—"} • Entered by {payment.enteredBy}</small></span><em className={payment.method}>{payment.method === "cash" ? "Cash" : "Bank"}</em><b>{money(payment.amount)} MMK</b>{isAdmin && <AdminPaymentActions payment={payment} onSaved={async () => { await Promise.all([loadFinanceOrders(), loadOrders(), loadPayments(), loadOpeningBalances()]); }} notify={notify} />}</article>)}</div>}</div>)}</div>}</section>
          {financeCustomerQuery.trim() && <section className="finance-customer-daily">
            <div className="finance-customer-title"><div><strong>Customer ရက်စွဲအလိုက် Finance စာရင်း</strong><span>{financeDailyRows.length} ရက် • {financeCustomerOrders.length} Sale VR</span></div></div>
            <div className="finance-customer-totals"><div><span>Sale VR Total</span><strong>{money(financeCustomerTotals.voucher)}</strong><small>MMK</small></div><div className="received"><span>ငွေဝင် Total</span><strong>{money(financeCustomerTotals.received)}</strong><small>MMK</small></div><div className="outstanding"><span>Outstanding Total</span><strong>{money(financeCustomerTotals.outstanding)}</strong><small>MMK</small></div></div>
            {financeDailyRows.length === 0 ? <div className="finance-search-empty">Customer Database တွင်ရှိနိုင်သော်လည်း Sale Voucher Amount Update မလုပ်ရသေးပါ သို့မဟုတ် Finance စာရင်းမရှိသေးပါ</div> : <div className="finance-daily-table"><div className="finance-daily-header"><span>ရက်စွဲ / Customer</span><span>Sale VR</span><span>ငွေဝင်</span><span>Outstanding</span></div>{financeDailyRows.map((row) => <div className="finance-daily-row" key={row.key}><span><strong>{row.date}</strong><small>{row.customerName} • {row.township} • {row.vouchers} VR</small></span><b>{money(row.voucher)}</b><b className="received">{money(row.received)}</b><b className="outstanding">{money(row.outstanding)}</b></div>)}</div>}
          </section>}
          <div className="finance-summary-grid">
            <div><span>Total Sale VR</span><strong>{money(financeSummary.totalVoucher)} MMK</strong><small>ရွေးထားသောကာလအတွင်း Sale VR Amount သာ</small></div>
            <div className="paid"><span>ငွေဝင်ပြီး Sale VR</span><strong>{financeSummary.paidCount} စောင်</strong><small>{money(financeSummary.paidAmount)} MMK</small></div>
            <div className="unpaid"><span>ငွေမဝင်သေး Sale VR</span><strong>{financeSummary.unpaidCount} စောင်</strong><small>{money(financeSummary.unpaidAmount)} MMK</small></div>
            <div className="partial"><span>လက်ကျန်ရှိ Sale VR</span><strong>{financeSummary.partialCount} စောင်</strong><small>{money(financeSummary.partialBalance)} MMK ကျန်</small></div>
          </div>
          <div className="finance-received-strip"><span>စုစုပေါင်း ငွေဝင်</span><strong>{money(financeSummary.received)} MMK</strong><span>စုစုပေါင်း ကျန်ငွေ</span><b>{money(financeSummary.outstanding)} MMK</b></div>
          <div className="finance-view-menu"><button className={financeView === "all" ? "active" : ""} onClick={() => setFinanceView("all")}>All <b>{customerLedgers.length}</b></button><button className={financeView === "outstanding" ? "active outstanding" : "outstanding"} onClick={() => setFinanceView("outstanding")}>လက်ကျန်ရှိ <b>{outstandingCustomerCount}</b></button><button className={financeView === "today-payment" ? "active today-payment" : "today-payment"} onClick={() => setFinanceView("today-payment")}>Today&apos;s Payment <b>{todayPaymentCustomerCount}</b></button><button className={financeView === "week-payment" ? "active week-payment" : "week-payment"} onClick={() => setFinanceView("week-payment")}>This Week Payment <b>{weekPaymentCustomerCount}</b></button><button className={financeView === "unpaid-5" ? "active stale" : "stale"} onClick={() => setFinanceView("unpaid-5")}>ကြွေးကျန်ရှိ ငွေမပေး ၅ ရက် <b>{unpaid5CustomerCount}</b></button><button className={financeView === "unpaid-10" ? "active stale" : "stale"} onClick={() => setFinanceView("unpaid-10")}>ကြွေးကျန်ရှိ ငွေမပေး ၁၀ ရက် <b>{unpaid10CustomerCount}</b></button><button className={financeView === "unpaid-20" ? "active stale" : "stale"} onClick={() => setFinanceView("unpaid-20")}>ကြွေးကျန်ရှိ ငွေမပေး ၂၀ ရက် <b>{unpaid20CustomerCount}</b></button></div>
          <label className="finance-sort-menu"><span><Clock3 size={15} /><b>စီရန်</b></span><select value={financeSort} onChange={(event) => setFinanceSort(event.target.value as FinanceSort)}><option value="amount-desc">လက်ကျန် အများ → အနည်း</option><option value="amount-asc">လက်ကျန် အနည်း → အများ</option><option value="days-desc">ရက်ကြာ အများ → အနည်း</option><option value="days-asc">ရက်ကြာ အနည်း → အများ</option><option value="name-asc">Customer A → Z</option></select></label>
          {financeView === "outstanding" && <div className="outstanding-finance-note"><Banknote size={17} /><div><strong>လက်ကျန် Amount 0 ထက်များသော Customers</strong><span>Outstanding Amount သို့မဟုတ် မပြောင်းလဲသည့် ရက်ကြာချိန်အလိုက် စီကြည့်နိုင်ပါသည်</span></div></div>}
          {(["unpaid-5", "unpaid-10", "unpaid-20"] as FinanceView[]).includes(financeView) && <div className="stale-finance-note"><Clock3 size={17} /><div><strong>ကြွေးကျန်ရှိပြီး ငွေမပေးထားသော Customers</strong><span>နောက်ဆုံး Payment Date မှစ၍ တွက်ထားပြီး ငွေမဝင်ဖူးပါက အဟောင်းဆုံး Outstanding VR Date မှ စတွက်ထားသည်</span></div></div>}
          {!financeLoading && filteredCustomerLedgers.length > 0 && <WarehousePagination page={financePage} pageCount={financePageCount} total={filteredCustomerLedgers.length} noun="Customers" onChange={setFinancePage} />}
          <div className="customer-ledger-list">{financeLoading ? <Loading /> : filteredCustomerLedgers.length === 0 ? <Empty canAdd={false} onAdd={() => undefined} /> : financePageLedgers.map((ledger) => <CustomerLedgerCard key={ledger.key} ledger={ledger} periodText={periodLabel[dateMode]} canEdit={canFinance} onSaved={async () => { await Promise.all([loadFinanceOrders(), loadOrders(), loadPayments(), loadOpeningBalances()]); }} notify={notify} />)}</div>
          {!financeLoading && filteredCustomerLedgers.length > 0 && <WarehousePagination page={financePage} pageCount={financePageCount} total={filteredCustomerLedgers.length} noun="Customers" onChange={setFinancePage} />}
        </div>}

        {tab === "admin" && isAdmin && <div className="admin-page"><TrialArchivePanel notify={notify} /><CustomerManagementPanel customers={customerDirectory} reload={loadCustomers} notify={notify} /><OpeningBalancePanel customers={customerDirectory} balances={openingBalances} loading={openingLoading} reload={loadOpeningBalances} reloadCustomers={loadCustomers} notify={notify} /><AdminPanel users={staffUsers} loading={staffLoading} reload={loadStaffUsers} notify={notify} /></div>}
        {tab === "settings" && <SettingsPanel notify={notify} isAdmin={isAdmin} openAdmin={() => setTab("admin")} logOut={logOut} />}
        {tab === "exam" && <ExaminationModule role={role} userName={userName} notify={notify} />}
        {tab === "chat" && role !== "viewer" && <DepartmentChat messages={chatMessages} loading={chatLoading} role={role} peer={chatPeer} setPeer={setChatPeer} onSent={() => loadChat(false)} onRead={() => markChatRead(chatPeer)} notify={notify} />}
      </section>

      {canSale && tab === "sale" && <button className="fab" onClick={() => { setSaleOrderPrefill(null); setShowAdd(true); }}><Plus size={24} /><span>Sale Order တင်ရန်</span></button>}

      <nav className="bottom-nav">
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}><span className="nav-icon"><ClipboardList />{navNotificationCount("dashboard") > 0 && <b>{navNotificationCount("dashboard") > 99 ? "99+" : navNotificationCount("dashboard")}</b>}</span><span>Dashboard</span></button>
        <button className={tab === "modules" ? "active" : ""} onClick={() => setTab("modules")}><span className="nav-icon"><BookOpenCheck />{navNotificationCount("modules") > 0 && <b>{navNotificationCount("modules") > 99 ? "99+" : navNotificationCount("modules")}</b>}</span><span>Modules</span></button>
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}><span className="nav-icon"><PackageCheck />{navNotificationCount("products") > 0 && <b>{navNotificationCount("products") > 99 ? "99+" : navNotificationCount("products")}</b>}</span><span>Products</span></button>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><span className="nav-icon"><Truck />{navNotificationCount("orders") > 0 && <b>{navNotificationCount("orders") > 99 ? "99+" : navNotificationCount("orders")}</b>}</span><span>Orders</span></button>
        {canSale && <button className={tab === "sale" ? "active" : ""} onClick={() => setTab("sale")}><span className="nav-icon"><WalletCards />{navNotificationCount("sale") > 0 && <b>{navNotificationCount("sale") > 99 ? "99+" : navNotificationCount("sale")}</b>}</span><span>Sale</span></button>}
        {canWarehouse && <button className={tab === "warehouse" ? "active" : ""} onClick={() => setTab("warehouse")}><span className="nav-icon"><Box />{navNotificationCount("warehouse") > 0 && <b>{navNotificationCount("warehouse") > 99 ? "99+" : navNotificationCount("warehouse")}</b>}</span><span>Warehouse</span></button>}
        {canPurchase && <button className={tab === "purchase" ? "active" : ""} onClick={() => setTab("purchase")}><span className="nav-icon"><ShoppingCart />{navNotificationCount("purchase") > 0 && <b>{navNotificationCount("purchase") > 99 ? "99+" : navNotificationCount("purchase")}</b>}</span><span>Purchase</span></button>}
        {canViewFinance && <button className={tab === "finance" ? "active" : ""} onClick={openFinanceTab}><span className="nav-icon"><Banknote />{navNotificationCount("finance") > 0 && <b>{navNotificationCount("finance") > 99 ? "99+" : navNotificationCount("finance")}</b>}</span><span>Finance</span></button>}
        {role !== "viewer" && <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}><span className="nav-icon"><MessageCircle />{chatUnread > 0 && <b>{chatUnread > 99 ? "99+" : chatUnread}</b>}</span><span>Chat</span></button>}
        {isAdmin && <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}><span className="nav-icon"><ShieldCheck />{navNotificationCount("admin") > 0 && <b>{navNotificationCount("admin") > 99 ? "99+" : navNotificationCount("admin")}</b>}</span><span>Admin</span></button>}
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><span className="nav-icon"><Settings /></span><span>Settings</span></button>
      </nav>

      {showAdd && <AddOrderModal customers={customerDirectory} products={products} orders={financeOrders} date={todayLocal()} prefill={saleOrderPrefill} onClose={() => { setShowAdd(false); setSaleOrderPrefill(null); }} onCreated={(order, merged) => {
        if (saleOrderPrefill) {
          const endpoint = saleOrderPrefill.sourceType === "follow_up" ? "/api/sales-growth" : "/api/sales-routes";
          const body = saleOrderPrefill.sourceType === "follow_up"
            ? { id: saleOrderPrefill.sourceId, confirmedOrderId: order.id }
            : { action: "link_order", id: saleOrderPrefill.sourceId, confirmedOrderId: order.id };
          void fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        }
        void Promise.all([loadOrders(), loadFinanceOrders()]); setShowAdd(false); setSaleOrderPrefill(null); notify(merged ? "နောက်တိုး Sale Order ကို မူလ Order နှင့် ပေါင်းပြီးပါပြီ" : "Sale Order တင်ပြီးပါပြီ");
      }} />}
      {showCustomerRequest && <CustomerRequestModal customers={customerDirectory} date={todayLocal()} onClose={() => setShowCustomerRequest(false)} onCreated={(_request) => { void loadPurchaseRequests(); setShowCustomerRequest(false); notify("Customer Request ကို Purchase Team သို့ ပို့ပြီးပါပြီ"); }} />}
      {evidenceViewer && <div className="evidence-lightbox" role="dialog" aria-modal="true" aria-label={evidenceViewer.title} onClick={() => setEvidenceViewer(null)}><div className="evidence-lightbox-card" onClick={(event) => event.stopPropagation()}><button className="evidence-lightbox-close" onClick={() => setEvidenceViewer(null)} aria-label="ပုံပိတ်ရန်"><X size={24} /></button><img src={evidenceViewer.src} alt={evidenceViewer.title} /><div><strong>{evidenceViewer.title}</strong><small>{evidenceViewer.meta}</small></div></div></div>}
      {selected && selectedWarehouseWorkflow ? <WarehouseWorkflowPage order={selected} allOrders={orders} role={role} products={products} onClose={() => { setSelectedWarehouseWorkflow(false); setSelected(null); }} onPatch={patchOrder} notify={notify} /> : selected && <OrderDetail order={selected} role={role} products={products} customerDirectory={customerDirectory} onClose={() => setSelected(null)} onPatch={patchOrder} onDelete={deleteOrder} onProofUploaded={(proof) => replaceOrder({ ...selected, ...proof })} onIncidentUploaded={(issue) => setRecentDeliveryIssues((current) => [{ ...issue, customerName: selected.customerName, orderNo: selected.orderNo, route: selected.route }, ...current.filter((item) => item.id !== issue.id)])} onPurchaseCreated={(request) => setPurchaseRequests((current) => [request, ...current])} notify={notify} />}
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </main>
  );
}

function AdminPaymentActions({ payment, onSaved, notify }: { payment: PaymentTransaction; onSaved: () => Promise<void>; notify: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [method, setMethod] = useState<"cash" | "banking">(payment.method);
  const [paymentDate, setPaymentDate] = useState(payment.paymentDate);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  function cancel() {
    setEditing(false);
    setAmount(String(payment.amount));
    setMethod(payment.method);
    setPaymentDate(payment.paymentDate);
    setReason("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const nextAmount = Math.round(Number(amount));
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) return notify("Payment Amount မှန်ကန်စွာ ထည့်ပါ");
    if (!reason.trim()) return notify("ပြင်ဆင်ရသည့်အကြောင်းရင်း ထည့်ပါ");
    setBusy(true);
    try {
      const response = await fetch("/api/payments", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: payment.id, amount: nextAmount, method, paymentDate, reason }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Payment ပြင်မရပါ");
      await onSaved();
      notify(`${payment.customerName} — Payment ပြင်ပြီး Outstanding ကို ပြန်တွက်ပြီးပါပြီ`);
      cancel();
    } catch (error) { notify(error instanceof Error ? error.message : "Payment ပြင်မရပါ"); }
    finally { setBusy(false); }
  }

  async function remove() {
    const deleteReason = window.prompt("Payment ဖျက်ရသည့်အကြောင်းရင်း ထည့်ပါ");
    if (!deleteReason?.trim()) return;
    if (!window.confirm(`${payment.customerName} — ${money(payment.amount)} MMK Payment ကို အပြီးဖျက်မည်။ ဆက်လုပ်မလား?`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/payments", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: payment.id, confirmation: "DELETE", reason: deleteReason }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Payment ဖျက်မရပါ");
      await onSaved();
      notify(`${payment.customerName} — Payment ဖျက်ပြီး Outstanding ကို ပြန်တွက်ပြီးပါပြီ`);
    } catch (error) { notify(error instanceof Error ? error.message : "Payment ဖျက်မရပါ"); }
    finally { setBusy(false); }
  }

  return <div className={`admin-payment-actions ${editing ? "editing" : ""}`}>
    {!editing ? <><button type="button" disabled={busy} onClick={() => setEditing(true)}><Pencil size={13} />Edit</button><button type="button" className="delete" disabled={busy} onClick={() => void remove()}><Trash2 size={13} />Delete</button></> : <form className="admin-payment-edit-form" onSubmit={save}>
      <div className="admin-payment-edit-title"><span><ShieldCheck size={15} /><strong>Admin Only — Payment Edit</strong></span><small>ပြင်ပြီးပါက Customer Opening / Sale VR Outstanding ကို အလိုအလျောက် ပြန်တွက်မည်</small></div>
      <label><span>Date</span><input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
      <label><span>Amount</span><input required min="1" step="1" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label><span>Cash / Bank</span><select value={method} onChange={(event) => setMethod(event.target.value as "cash" | "banking")}><option value="cash">Cash</option><option value="banking">Banking</option></select></label>
      <label className="reason"><span>ပြင်ဆင်ရသည့်အကြောင်းရင်း</span><input required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" /></label>
      <div className="admin-payment-edit-buttons"><button type="button" disabled={busy} onClick={cancel}>မပြင်တော့ပါ</button><button type="submit" disabled={busy}>{busy ? "သိမ်းနေသည်…" : "ပြင်ပြီး သိမ်းမည်"}</button></div>
    </form>}
  </div>;
}

function FinancePaymentEntry({ ledgers, onSaved, notify }: { ledgers: CustomerLedger[]; onSaved: () => Promise<void>; notify: (message: string) => void }) {
  const payableLedgers = useMemo(() => ledgers.filter((ledger) => ledger.totalBalance > 0).sort((a, b) => a.customerName.localeCompare(b.customerName, undefined, { sensitivity: "base" })), [ledgers]);
  const [customerKey, setCustomerKey] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "banking">("cash");
  const [paymentMode, setPaymentMode] = useState<"full" | "partial">("partial");
  const [paymentDate, setPaymentDate] = useState(todayLocal);
  const [busy, setBusy] = useState(false);
  const selectedLedger = payableLedgers.find((ledger) => ledger.key === customerKey);

  useEffect(() => {
    if (!selectedLedger) return setAmount("");
    setAmount(paymentMode === "full" ? String(Math.round(selectedLedger.totalBalance)) : "");
  }, [customerKey, paymentMode, selectedLedger]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selectedLedger) return notify("Customer Name ရွေးပါ");
    const paymentAmount = paymentMode === "full" ? Math.round(selectedLedger.totalBalance) : Math.round(Number(amount));
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return notify("Payment Amount ထည့်ပါ");
    if (paymentAmount > selectedLedger.totalBalance) return notify(`Outstanding ${money(selectedLedger.totalBalance)} MMK ထက် မကျော်ရပါ`);
    if (paymentMode === "partial" && paymentAmount >= selectedLedger.totalBalance) return notify("Full Payment ဖြစ်ပါက Full ကို ရွေးပါ။ Partial Amount သည် လက်ကျန်ထက် နည်းရပါမည်။");
    setBusy(true);
    try {
      const response = await fetch("/api/orders", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "customer_payment", customerName: selectedLedger.customerName, township: selectedLedger.township, amount: paymentAmount, paymentMethod: method, paymentDate }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment save failed");
      await onSaved();
      notify(`${selectedLedger.customerName} — ${money(paymentAmount)} MMK ${method === "cash" ? "Cash" : "Bank"} Payment ထည့်ပြီးပါပြီ`);
      setCustomerKey("");
      setAmount("");
      setPaymentMode("partial");
    } catch (error) { notify(error instanceof Error ? error.message : "Payment save failed"); }
    finally { setBusy(false); }
  }

  return <section className="finance-payment-entry">
    <div className="finance-payment-entry-head"><span className="icon"><Banknote size={20} /></span><div><strong>Payment ထည့်ရန်</strong><small>Customer ရွေးပြီး Cash / Bank Payment ကို တိုက်ရိုက်သွင်းနိုင်ပါသည်</small></div></div>
    <form onSubmit={save}>
      <label className="payment-customer-field"><span>Customers Name</span><select required value={customerKey} onChange={(event) => setCustomerKey(event.target.value)}><option value="">Customer ရွေးပါ</option>{payableLedgers.map((ledger) => <option value={ledger.key} key={ledger.key}>{ledger.customerName} — {ledger.township} — {money(ledger.totalBalance)} MMK</option>)}</select></label>
      <label><span>Full / Partial</span><select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as "full" | "partial")}><option value="partial">Partial Payment</option><option value="full">Full Payment</option></select></label>
      <label><span>Amount</span><input required type="number" inputMode="numeric" min="1" max={selectedLedger?.totalBalance || undefined} disabled={!selectedLedger || paymentMode === "full"} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Payment Amount" /></label>
      <label><span>Cash / Bank</span><select value={method} onChange={(event) => setMethod(event.target.value as "cash" | "banking")}><option value="cash">Cash</option><option value="banking">Bank</option></select></label>
      <label><span>Date</span><input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
      <button disabled={busy || !selectedLedger || !amount}>{busy ? "Payment သိမ်းနေသည်…" : "Payment ထည့်မည်"}</button>
    </form>
    {selectedLedger && <div className="finance-payment-balance"><span>ရွေးထားသော Customer လက်ကျန်</span><strong>{money(selectedLedger.totalBalance)} MMK</strong></div>}
  </section>;
}

function CustomerLedgerCard({ ledger, periodText, canEdit, onSaved, notify }: { ledger: CustomerLedger; periodText: string; canEdit: boolean; onSaved: () => Promise<void>; notify: (message: string) => void }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "banking">("cash");
  const [paymentDate, setPaymentDate] = useState(todayLocal);
  const [busy, setBusy] = useState(false);
  const [expandedStatus, setExpandedStatus] = useState<"paid" | "unpaid" | "partial" | "">("");
  const status = ledger.totalBalance < 0 ? "credit" : ledger.totalBalance === 0 ? "paid" : ledger.totalReceived === 0 ? "unpaid" : "partial";
  const expandedItems = expandedStatus === "paid" ? ledger.paidItems : expandedStatus === "unpaid" ? ledger.unpaidItems : expandedStatus === "partial" ? ledger.partialItems : [];
  const expandedHelp = expandedStatus === "paid" ? "ငွေအပြည့်ဝင်ပြီးသော Opening / Sale VR" : expandedStatus === "unpaid" ? "ငွေလုံးဝမဝင်သေးသော Opening / Sale VR" : "ငွေတစ်စိတ်တစ်ပိုင်းဝင်ပြီး လက်ကျန်ရှိသော Opening / Sale VR";

  async function savePayment(event: FormEvent) {
    event.preventDefault();
    const payment = Math.round(Number(amount));
    if (!Number.isFinite(payment) || payment <= 0) return notify("Payment Amount ထည့်ပါ");
    if (payment > ledger.totalBalance) return notify(`Outstanding ${money(ledger.totalBalance)} MMK ထက် မကျော်ရပါ`);
    setBusy(true);
    try {
      const response = await fetch("/api/orders", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "customer_payment", customerName: ledger.customerName, township: ledger.township, amount: payment, paymentMethod, paymentDate }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment save failed");
      setAmount("");
      await onSaved();
      notify(`${ledger.customerName} — ${money(payment)} MMK ${paymentMethod === "cash" ? "Cash" : "Banking"} ဝင်ပြီးပါပြီ`);
    } catch (error) { notify(error instanceof Error ? error.message : "Payment save failed"); }
    finally { setBusy(false); }
  }

  return <article className={`customer-ledger-card ${status}`}>
    <div className="ledger-head"><span className={`payment-dot ${status}`} /><div><strong>{ledger.customerName}</strong><small>{ledger.township} • {ledger.route} • Sale Man: {ledger.salespeople.join(", ")}</small></div><span className="ledger-status">{status === "credit" ? "Customer Credit" : status === "paid" ? "ငွေဝင်ပြီး" : status === "unpaid" ? "ငွေမဝင်သေး" : "လက်ကျန်ရှိ"}</span></div>
    {ledger.totalBalance > 0 && ledger.noPaymentDays >= 10 && <div className="stale-payment-chip"><Clock3 size={14} /><span><strong>{ledger.noPaymentDays} ရက် မပြောင်း</strong><small>{ledger.lastPaymentDate ? `နောက်ဆုံး Payment: ${ledger.lastPaymentDate}` : `Payment မဝင်သေး • အဟောင်းဆုံး VR: ${ledger.oldestOutstandingDate}`}</small></span></div>}
    <div className="ledger-period-summary"><div className="opening"><span>Opening Amount</span><small>Adjustment: {money(ledger.adjustmentAmount || 0)} MMK</small><small>{ledger.openingDate ? `Date: ${ledger.openingDate}` : "Opening မရှိပါ"}</small><strong>{money(ledger.openingAmount)} <i>MMK</i></strong></div><div className="voucher"><span>Sale VR Amount</span><small>{periodText}</small><strong>{money(ledger.currentVoucher)} <i>MMK</i></strong></div><div className="payment"><span>Payment</span><small>{periodText}</small><strong>{money(ledger.periodPayment)} <i>MMK</i></strong></div><div className="total"><span>Total ကျန်ငွေ</span><small>လက်ရှိ Outstanding</small><strong>{money(ledger.totalBalance)} <i>MMK</i></strong></div></div>
    <div className="ledger-meta ledger-status-buttons"><button type="button" className={expandedStatus === "paid" ? "active paid" : "paid"} onClick={() => setExpandedStatus((current) => current === "paid" ? "" : "paid")}>Paid <b>{ledger.paidCount}</b></button><button type="button" className={expandedStatus === "unpaid" ? "active unpaid" : "unpaid"} onClick={() => setExpandedStatus((current) => current === "unpaid" ? "" : "unpaid")}>Unpaid <b>{ledger.unpaidCount}</b></button><button type="button" className={expandedStatus === "partial" ? "active partial" : "partial"} onClick={() => setExpandedStatus((current) => current === "partial" ? "" : "partial")}>Partial <b>{ledger.partialCount}</b></button></div>
    {expandedStatus && <div className={`ledger-status-detail ${expandedStatus}`}><div className="ledger-status-detail-head"><strong>{expandedStatus === "paid" ? "Paid" : expandedStatus === "unpaid" ? "Unpaid" : "Partial"} — {expandedItems.length} စောင်</strong><small>{expandedHelp}</small></div>{expandedItems.length === 0 ? <p>သက်ဆိုင်သော Sale VR မရှိပါ</p> : expandedItems.map((item) => <article key={item.key}><span><strong>{item.label}</strong><small>{item.date}</small></span><span><small>Sale VR</small><b>{money(item.voucherAmount)}</b></span><span><small>ငွေဝင်</small><b>{money(item.paidAmount)}</b></span><span><small>ကျန်ငွေ</small><b>{money(item.balance)}</b></span></article>)}</div>}
    {canEdit && ledger.totalBalance > 0 && <form className="quick-payment" onSubmit={savePayment}><div className="quick-payment-amount"><label><Banknote size={15} /><input type="number" min="1" max={ledger.totalBalance} step="1" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Payment Amount" /></label><button type="button" onClick={() => setAmount(String(ledger.totalBalance))}>အပြည့်</button></div><div className="quick-payment-options"><label><span>Payment Type</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "cash" | "banking")}><option value="cash">Cash</option><option value="banking">Banking</option></select></label><label><span>Payment Date</span><input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label></div><small>အဟောင်းဆုံး Outstanding VR မှစ၍ အလိုအလျောက် ဖြည့်သွင်းပါမည်</small><button className="quick-payment-save" disabled={busy || !amount}>{busy ? "သိမ်းနေသည်…" : "Payment ထည့်မည်"}</button></form>}
  </article>;
}

function DepartmentChat({ messages, loading, role, peer, setPeer, onSent, onRead, notify }: { messages: DepartmentMessage[]; loading: boolean; role: AppRole; peer: AppRole; setPeer: (role: AppRole) => void; onSent: () => Promise<void>; onRead: () => Promise<void>; notify: (message: string) => void }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const peers = CHAT_ROLES.filter((item) => item !== role);
  const roomMessages = useMemo(() => role === "admin"
    ? messages.filter((item) => item.senderRole === peer || item.recipientRole === peer)
    : messages.filter((item) => (item.senderRole === role && item.recipientRole === peer) || (item.senderRole === peer && item.recipientRole === role)), [messages, peer, role]);
  const unreadByRole = useMemo(() => messages.reduce((counts, item) => {
    if (!item.isOwn && !item.isRead && item.recipientRole === role) counts[item.senderRole] = (counts[item.senderRole] || 0) + 1;
    return counts;
  }, {} as Partial<Record<AppRole, number>>), [messages, role]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [roomMessages.length, peer]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientRole: peer, message: draft }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Message send failed");
      setDraft("");
      await onSent();
      await onRead();
    } catch (error) { notify(error instanceof Error ? error.message : "Message send failed"); }
    finally { setSending(false); }
  }

  return <section className="department-chat">
    <div className="chat-room-bar"><div><MessageCircle size={18} /><span><strong>{roleLabel[role]} Chat</strong><small>Department တစ်ခုရွေးပြီး စကားပြောနိုင်ပါသည်</small></span></div><label><span>To</span><select value={peer} onChange={(event) => setPeer(event.target.value as AppRole)}>{peers.map((item) => <option key={item} value={item}>{roleLabel[item]}{unreadByRole[item] ? ` (${unreadByRole[item]})` : ""}</option>)}</select></label></div>
    <div className="chat-messages">{loading ? <Loading /> : roomMessages.length === 0 ? <div className="chat-empty"><MessageCircle /><strong>{roleLabel[peer]} နှင့် Chat စတင်ပါ</strong><span>ပထမဆုံး Message ကို အောက်ကနေ ပို့နိုင်ပါသည်</span></div> : roomMessages.map((item) => <article className={item.isOwn ? "chat-bubble own" : "chat-bubble received"} key={item.id}><div><strong>{item.senderName}</strong><span>{roleLabel[item.senderRole]} → {roleLabel[item.recipientRole]}</span></div><p>{item.message}</p><time>{notificationTime(item.createdAt)}</time></article>)}<div ref={bottomRef} /></div>
    <form className="chat-composer" onSubmit={sendMessage}><textarea rows={2} maxLength={1000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`${roleLabel[peer]} သို့ Message ရိုက်ပါ…`} onFocus={() => void onRead()} /><button disabled={sending || !draft.trim()} aria-label="Send message"><Send size={18} /><span>{sending ? "ပို့နေသည်…" : "ပို့မည်"}</span></button></form>
  </section>;
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <div className={`metric-card ${tone}`}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>;
}

function OrderToolbar({ query, setQuery, routeFilter, setRouteFilter, salesTeamFilter, setSalesTeamFilter, salespersonFilter, setSalespersonFilter, reload }: { query: string; setQuery: (value: string) => void; routeFilter: string; setRouteFilter: (value: string) => void; salesTeamFilter: SaleTeamFilter; setSalesTeamFilter: (value: SaleTeamFilter) => void; salespersonFilter: string; setSalespersonFilter: (value: string) => void; reload: () => Promise<void> }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = Number(routeFilter !== "All") + Number(salesTeamFilter !== "All") + Number(salespersonFilter !== "All");
  return <div className="compact-order-toolbar"><div className="toolbar"><label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer / Sale Man ရှာရန်" /></label><button className={filtersOpen || filterCount ? "filter-icon-button active" : "filter-icon-button"} onClick={() => setFiltersOpen((current) => !current)} aria-label="Filters" aria-expanded={filtersOpen}><SlidersHorizontal size={19} />{filterCount > 0 && <b>{filterCount}</b>}</button></div>{filtersOpen && <div className="compact-filter-panel"><label><span>Sale Team</span><select value={salesTeamFilter} onChange={(event) => { const team = event.target.value as SaleTeamFilter; setSalesTeamFilter(team); if (team !== "All" && !SALE_TEAM_MEMBERS[team].includes(salespersonFilter)) setSalespersonFilter("All"); }}><option value="All">All Sale Teams</option><option value="A">Sale Team A</option><option value="B">Sale Team B</option></select></label><label><span>Sale Man</span><select value={salespersonFilter} onChange={(event) => setSalespersonFilter(event.target.value)}><option value="All">All Sale Men</option>{salePeopleForTeam(salesTeamFilter).map((person) => <option value={person} key={person}>{person}</option>)}</select></label><label><span>Route</span><select value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)}><option value="All">All Routes</option>{ROUTES.map((route) => <option value={route} key={route}>{route}</option>)}</select></label><div><button onClick={() => { setRouteFilter("All"); setSalesTeamFilter("All"); setSalespersonFilter("All"); }}>Clear</button><button onClick={() => void reload()}><RefreshCw size={14} />Refresh</button></div></div>}</div>;
}

function CustomerManagementPanel({ customers, reload, notify }: { customers: CustomerDirectoryItem[]; reload: () => Promise<void>; notify: (message: string) => void }) {
  const emptyForm = { id: 0, customerName: "", township: "", phone: "", address: "", route: ROUTES[0], salesperson: "Admin" };
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const customCustomers = useMemo(() => customers.filter((customer) => customer.source === "custom"), [customers]);
  const visible = useMemo(() => {
    const needle = query.toLocaleLowerCase().trim();
    return customers.filter((customer) => !needle || `${customer.name} ${customer.township} ${customer.phone} ${customer.salesperson}`.toLocaleLowerCase().includes(needle)).slice(0, 100);
  }, [customers, query]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/customers", { method: form.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Customer save failed");
      setForm(emptyForm);
      await reload();
      notify(form.id ? "Customer အချက်အလက် ပြင်ပြီးပါပြီ" : "New Customer ထည့်ပြီးပါပြီ — Sale Order နှင့် Finance တွင် ချက်ချင်းရွေးနိုင်ပါပြီ");
    } catch (error) { notify(error instanceof Error ? error.message : "Customer save failed"); }
    finally { setBusy(false); }
  }

  function edit(customer: CustomerDirectoryItem) {
    if (customer.source !== "custom") return;
    setForm({ id: customer.id, customerName: customer.name, township: customer.township, phone: customer.phone, address: customer.address, route: customer.route, salesperson: customer.salesperson });
  }

  return <section className="customer-management-panel">
    <div className="workflow-note admin-note"><UserRound size={18} /><div><strong>Customer Management — Admin Only</strong><span>New Customer ထည့်ပြီးတာနဲ့ Sale Order၊ Customer Request၊ Finance နဲ့ Opening မှာ ချက်ချင်း ရွေးနိုင်ပါမယ်။</span></div></div>
    <form className="customer-management-form" onSubmit={save}>
      <div className="section-heading wide"><div><h2>{form.id ? "Customer ပြင်ရန်" : "New Customer ထည့်ရန်"}</h2><p>Name နှင့် Township ကို မဖြစ်မနေထည့်ပါ</p></div>{form.id > 0 && <button type="button" className="customer-cancel-edit" onClick={() => setForm(emptyForm)}>အသစ်ထည့်မည်</button>}</div>
      <label><span>Customer Name</span><input required value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} placeholder="ဥပမာ Pan Pan Pharmacy" /></label>
      <label><span>Township</span><input required value={form.township} onChange={(event) => setForm({ ...form, township: event.target.value })} placeholder="မြို့နယ်" /></label>
      <label><span>Phone</span><input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="09..." /></label>
      <label><span>Address</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="လိပ်စာ" /></label>
      <label><span>Route</span><select value={form.route} onChange={(event) => setForm({ ...form, route: event.target.value })}>{ROUTES.map((route) => <option key={route}>{route}</option>)}</select></label>
      <label><span>Sale Man</span><select value={form.salesperson} onChange={(event) => setForm({ ...form, salesperson: event.target.value })}>{SALE_PEOPLE.map((person) => <option key={person}>{person}</option>)}</select></label>
      <button className="wide customer-save-button" disabled={busy}>{busy ? "သိမ်းနေသည်…" : form.id ? "Customer ပြင်မည်" : "+ New Customer သိမ်းမည်"}</button>
    </form>
    <div className="customer-directory-head"><div><strong>Customer Directory</strong><small>{customers.length} Customers • Admin ထည့်ထားသော {customCustomers.length}</small></div><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer ရှာရန်" /></label></div>
    <div className="customer-directory-list">{visible.map((customer) => <article key={`${customer.name}-${customer.township}`}><div><strong>{customer.name}</strong><small>{customer.township} • {customer.route} • {customer.salesperson}</small>{(customer.phone || customer.address) && <small>{[customer.phone, customer.address].filter(Boolean).join(" • ")}</small>}</div><span className={customer.source}>{customer.source === "custom" ? "Admin Added" : "ရှိပြီးသား"}</span>{customer.source === "custom" && <button onClick={() => edit(customer)}>ပြင်မည်</button>}</article>)}</div>
  </section>;
}

function OpeningBalancePanel({ customers, balances, loading, reload, reloadCustomers, notify }: { customers: CustomerDirectoryItem[]; balances: OpeningBalance[]; loading: boolean; reload: () => Promise<void>; reloadCustomers: () => Promise<void>; notify: (message: string) => void }) {
  const emptyForm = { id: 0, asOfDate: "2026-10-26", customerName: "", township: "", openingPackages: "", deliveredPackages: "", openingOutstanding: "", paidAmount: "", note: "", salesperson: "Admin" };
  const [form, setForm] = useState(emptyForm);
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [listQuery, setListQuery] = useState("");
  const [listPage, setListPage] = useState(1);
  const total = useMemo(() => balances.reduce((acc, item) => ({ packages: acc.packages + Math.max(0, item.openingPackages - item.deliveredPackages), money: acc.money + item.openingOutstanding + (item.adjustmentAmount || 0) - item.paidAmount }), { packages: 0, money: 0 }), [balances]);
  const filteredBalances = useMemo(() => {
    const needle = listQuery.trim().toLocaleLowerCase();
    if (!needle) return balances;
    return balances.filter((item) => `${item.customerName} ${item.township} ${item.asOfDate}`.toLocaleLowerCase().includes(needle));
  }, [balances, listQuery]);
  const openingPageSize = 10;
  const openingPageCount = Math.max(1, Math.ceil(filteredBalances.length / openingPageSize));
  const openingPageBalances = useMemo(() => filteredBalances.slice((listPage - 1) * openingPageSize, listPage * openingPageSize), [filteredBalances, listPage]);
  useEffect(() => { setListPage(1); }, [listQuery]);
  useEffect(() => { if (listPage > openingPageCount) setListPage(openingPageCount); }, [listPage, openingPageCount]);

  function chooseCustomer(name: string) {
    const customer = customers.find((item) => item.name === name);
    setForm((current) => ({ ...current, customerName: name, township: customer?.township || current.township, salesperson: customer?.salesperson || current.salesperson }));
  }

  async function saveEntries(entries: Array<Record<string, unknown>>) {
    setBusy(true);
    try {
      const response = await fetch("/api/opening-balances", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entries }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Opening save failed");
      await Promise.all([reload(), reloadCustomers()]);
      notify(`${data.saved} Customers Opening စာရင်း သိမ်းပြီးပါပြီ`);
      return true;
    } catch (error) { notify(error instanceof Error ? error.message : "Opening save failed"); return false; }
    finally { setBusy(false); }
  }

  async function saveSingle(event: FormEvent) {
    event.preventDefault();
    if (!form.customerName || !form.township) return notify("Customer ကို ရွေးပါ");
    if (form.id) {
      setBusy(true);
      try {
        const response = await fetch("/api/opening-balances", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...form, openingPackages: Number(form.openingPackages || 0), deliveredPackages: Number(form.deliveredPackages || 0), openingOutstanding: Number(form.openingOutstanding || 0), paidAmount: Number(form.paidAmount || 0) }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Opening ပြင်မရပါ");
        await Promise.all([reload(), reloadCustomers()]);
        setForm(emptyForm);
        notify(`${form.customerName} — Opening စာရင်း ပြင်ပြီးပါပြီ`);
      } catch (error) { notify(error instanceof Error ? error.message : "Opening ပြင်မရပါ"); }
      finally { setBusy(false); }
      return;
    }
    const saved = await saveEntries([{ ...form, openingPackages: Number(form.openingPackages || 0), deliveredPackages: Number(form.deliveredPackages || 0), openingOutstanding: Number(form.openingOutstanding || 0), paidAmount: Number(form.paidAmount || 0) }]);
    if (saved) setForm(emptyForm);
  }

  async function saveBulk(event: FormEvent) {
    event.preventDefault();
    const entries: Array<Record<string, unknown>> = [];
    const invalid: string[] = [];
    for (const rawLine of bulk.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const parts = line.split(/\t|\|/).map((part) => part.trim());
      if (parts.length < 5) { invalid.push(line); continue; }
      const [customerName, township, asOfDate, packages, outstanding] = parts;
      entries.push({ customerName, township, asOfDate, openingPackages: Number(packages.replaceAll(",", "")), openingOutstanding: Number(outstanding.replaceAll(",", "")), deliveredPackages: 0, paidAmount: 0, note: parts[5] || "" });
    }
    if (invalid.length) return notify(`Format မမှန်သော ${invalid.length} လိုင်းရှိသည်`);
    if (!entries.length) return notify("Opening Data ထည့်ပါ");
    const saved = await saveEntries(entries);
    if (saved) setBulk("");
  }

  function edit(item: OpeningBalance) {
    setMode("single");
    setForm({ id: item.id, asOfDate: item.asOfDate, customerName: item.customerName, township: item.township, openingPackages: String(item.openingPackages), deliveredPackages: String(item.deliveredPackages), openingOutstanding: String(item.openingOutstanding), paidAmount: String(item.paidAmount), note: item.note, salesperson: customers.find(c => customerBalanceKey(c.name, c.township) === customerBalanceKey(item.customerName, item.township))?.salesperson || "Admin" });
    window.requestAnimationFrame(() => document.querySelector(".opening-edit-banner")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  return <section className="opening-panel">
    <div className="workflow-note admin-note"><WalletCards size={18} /><div><strong>Customer Opening စာရင်း</strong><span>Customer အလိုက် Date၊ ပစ္စည်းလက်ကျန်ဖာနှင့် ငွေလက်ကျန်ကို Admin သာ ထည့်/ပြင်နိုင်သည်။ Opening Date နောက်ပိုင်း Order, Delivery, Payment များ အလိုအလျောက်ပေါင်း/နုတ်မည်။</span></div></div>
    <div className="opening-total-cards"><div><span>Opening ပစ္စည်းလက်ကျန်</span><strong>{total.packages} ဖာ</strong></div><div><span>Opening Net ငွေလက်ကျန်</span><strong>{money(total.money)} MMK</strong></div></div>
    <OpeningBalanceImport onImported={async () => { await Promise.all([reload(), reloadCustomers()]); }} notify={notify} />
    <div className="opening-mode"><button className={mode === "single" ? "active" : ""} onClick={() => setMode("single")}>တစ်ယောက်ချင်း</button><button className={mode === "bulk" ? "active" : ""} onClick={() => setMode("bulk")}>အများကြီး Paste</button></div>
    {mode === "single" ? <>{form.id > 0 && <div className="opening-edit-banner"><span><strong>Edit Mode</strong><small>{form.customerName} • {form.township}</small></span><button type="button" onClick={() => setForm(emptyForm)}>မပြင်တော့ပါ</button></div>}<form className={form.id ? "opening-form edit-mode" : "opening-form"} onSubmit={saveSingle}>
      <label className="wide"><span>Customer</span><input list="opening-customer-list" value={form.customerName} onChange={(event) => chooseCustomer(event.target.value)} placeholder="Customer အမည် ရွေးပါ" /><datalist id="opening-customer-list">{customers.map((customer) => <option key={`${customer.name}-${customer.township}`} value={customer.name}>{customer.township}</option>)}</datalist></label>
      <label><span>မြို့နယ်</span><input value={form.township} readOnly /></label>
      <label><span>Opening Date</span><input type="date" value={form.asOfDate} onChange={(event) => setForm({ ...form, asOfDate: event.target.value })} required /></label>
      <label><span>Sale Man — Admin Only</span><select value={form.salesperson} onChange={e => setForm({ ...form, salesperson: e.target.value })}>{SALE_PEOPLE.map(person => <option key={person}>{person}</option>)}</select></label><label><span>Opening ဖာ</span><input type="number" min="0" value={form.openingPackages} onChange={(event) => setForm({ ...form, openingPackages: event.target.value })} /></label>
      <label><span>Opening မှ ပို့ပြီးဖာ</span><input type="number" min="0" value={form.deliveredPackages} onChange={(event) => setForm({ ...form, deliveredPackages: event.target.value })} /></label>
      <label><span>Opening ငွေလက်ကျန် / Credit (−)</span><input type="number" value={form.openingOutstanding} onChange={(event) => setForm({ ...form, openingOutstanding: event.target.value })} /></label>
      <label><span>Opening မှ ငွေဝင်ပြီး</span><input type="number" min="0" value={form.paidAmount} onChange={(event) => setForm({ ...form, paidAmount: event.target.value })} /></label>
      <label className="wide"><span>မှတ်ချက်</span><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
      <button className="wide" disabled={busy}>{busy ? "သိမ်းနေသည်…" : form.id ? "Opening ပြင်ပြီး သိမ်းမည်" : "Opening သိမ်းမည်"}</button>
    </form></> : <form className="opening-bulk" onSubmit={saveBulk}><p>တစ်ကြောင်းစီကို <b>Customer | Township | Date | ဖာလက်ကျန် | ငွေလက်ကျန်</b> ပုံစံဖြင့် Paste လုပ်ပါ။ Excel မှ Column 5 ခုကိုလည်း တိုက်ရိုက် Paste လုပ်နိုင်သည်။ Date ကို YYYY-MM-DD ပုံစံသုံးပါ။</p><textarea rows={10} value={bulk} onChange={(event) => setBulk(event.target.value)} placeholder={"Pan Pan Pharmacy | Pyuntasa | 2026-10-26 | 12 | 350000\nDaw Wai Wai Lwin | Hlaing Thar Yar | 2026-10-26 | 5 | 120000"} /><button disabled={busy}>{busy ? "သိမ်းနေသည်…" : "Opening အားလုံး သိမ်းမည်"}</button></form>}
    <div className="section-heading"><div><h2>Opening Customers</h2><p>{balances.length} Customers • Date အလိုက်</p></div><button className="icon-button" onClick={() => void reload()} aria-label="Refresh Opening"><RefreshCw size={17} /></button></div>
    <label className="opening-list-search"><Search size={17} /><input value={listQuery} onChange={(event) => setListQuery(event.target.value)} placeholder="Customer / Township / Date ရှာရန်" />{listQuery && <button type="button" onClick={() => setListQuery("")} aria-label="Clear Opening search"><X size={15} /></button>}</label>
    {!loading && filteredBalances.length > openingPageSize && <WarehousePagination page={listPage} pageCount={openingPageCount} total={filteredBalances.length} noun="Customers" onChange={setListPage} />}
    <div className="opening-list">{loading ? <Loading /> : filteredBalances.length === 0 ? <div className="finance-search-empty">{listQuery ? "ရှာဖွေထားသော Opening Customer မတွေ့ပါ" : "Opening စာရင်း မထည့်ရသေးပါ"}</div> : openingPageBalances.map((item) => { const balance = item.openingOutstanding + (item.adjustmentAmount || 0) - item.paidAmount; return <article className={`${balance < 0 ? "credit " : ""}${form.id === item.id ? "editing" : ""}`} key={item.id}><div><strong>{item.customerName}</strong><small>{item.township} • {item.asOfDate}</small></div><span><small>ဖာလက်ကျန်</small><b>{Math.max(0, item.openingPackages - item.deliveredPackages)}</b></span><span><small>{balance < 0 ? "Customer Credit" : "ငွေလက်ကျန်"}</small><b>{money(balance)}</b></span><button onClick={() => edit(item)}>{form.id === item.id ? "ပြင်နေသည်" : "ပြင်မည်"}</button></article>; })}</div>
    {!loading && filteredBalances.length > openingPageSize && <WarehousePagination page={listPage} pageCount={openingPageCount} total={filteredBalances.length} noun="Customers" onChange={setListPage} />}
  </section>;
}

function SettingsPanel({ notify, isAdmin, openAdmin, logOut }: { notify: (message: string) => void; isAdmin: boolean; openAdmin: () => void; logOut: () => Promise<void> }) {
  const [exporting, setExporting] = useState(false);

  async function exportFullDatabase() {
    if (!window.confirm("Full DB Backup တွင် Staff Login Data အပါအဝင် System Data အားလုံး ပါဝင်ပါမည်။ လုံခြုံသောနေရာတွင် သိမ်းထားရန် အတည်ပြုပါသလား?")) return;
    setExporting(true);
    try {
      const response = await fetch("/api/admin/db-export", { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Database export failed" }));
        throw new Error(data.error || "Database export failed");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `Nawaratt_Full_DB_Backup_${todayLocal()}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify("Full Database Backup Download စတင်ပြီးပါပြီ");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Database export failed");
    } finally {
      setExporting(false);
    }
  }

  return <div className="settings-page">
    <div className="workflow-note admin-note"><Settings size={18} /><div><strong>{isAdmin ? "Admin Settings" : "Account Settings"}</strong><span>{isAdmin ? "System Backup နှင့် Security ဆိုင်ရာလုပ်ဆောင်ချက်များကို Admin Role မှသာ အသုံးပြုနိုင်ပါသည်။" : "Account နှင့် Application Session ကို ဒီနေရာမှ စီမံနိုင်ပါသည်။"}</span></div></div>
    {isAdmin && <><section className="settings-card database-backup-card">
      <div className="settings-card-icon"><Database size={24} /></div>
      <div className="settings-card-copy"><span className="settings-kicker">DATABASE BACKUP</span><h2>Full DB Export</h2><p>Application Table အားလုံး၊ Database Schema၊ Row Counts၊ Export Date/Time နှင့် Audit Records များကို JSON Backup File တစ်ခုအဖြစ် Download လုပ်ပါမည်။</p><div className="settings-meta"><span><ShieldCheck size={14} />Admin only</span><span><Clock3 size={14} />Download လုပ်တိုင်း Audit Log သိမ်းမည်</span></div></div>
      <button className="database-export-button" type="button" disabled={exporting} onClick={() => void exportFullDatabase()}>{exporting ? <RefreshCw className="spin" size={18} /> : <Download size={18} />}<span>{exporting ? "Backup ပြင်ဆင်နေသည်…" : "Download Full DB Backup"}</span></button>
      <div className="settings-warning"><ShieldCheck size={16} /><span><strong>Confidential Backup</strong><small>ဒီ File ထဲတွင် Customer၊ Finance၊ Staff Login နှင့် Audit Data ပါဝင်သောကြောင့် မသက်ဆိုင်သူထံ မမျှဝေပါနှင့်။</small></span></div>
    </section>
    <section className="settings-card settings-access-card">
      <div className="settings-card-icon secondary"><UserRound size={23} /></div>
      <div className="settings-card-copy"><span className="settings-kicker">SECURITY & ACCESS</span><h2>User & Role Management</h2><p>Staff Account၊ Role Permission နှင့် Password များကို Admin Management မှ ဆက်လက်စီမံနိုင်ပါသည်။</p></div>
      <button className="settings-secondary-button" type="button" onClick={openAdmin}><ShieldCheck size={17} /><span>Open Admin Management</span></button>
    </section>
    <DuplicateDetectionPanel notify={notify} /></>}
    <section className="settings-card settings-logout-card">
      <div className="settings-card-icon logout"><LogOut size={23} /></div>
      <div className="settings-card-copy"><span className="settings-kicker">ACCOUNT SESSION</span><h2>Log out</h2><p>ဤ Device မှ Nawaratt Application Session ကို ပိတ်ပြီး Login စာမျက်နှာသို့ ပြန်သွားပါမည်။</p></div>
      <button className="settings-logout-button" type="button" onClick={() => void logOut()}><LogOut size={17} /><span>Log out of Nawaratt</span></button>
    </section>
  </div>;
}

function AdminPanel({ users, loading, reload, notify }: { users: StaffUser[]; loading: boolean; reload: () => Promise<void>; notify: (message: string) => void }) {
  const assignableRoles: AppRole[] = ["admin", "sale", "delivery", "warehouse", "purchase", "finance"];
  const [form, setForm] = useState({ email: "", displayName: "", role: "sale" as AppRole, password: "" });
  const [busy, setBusy] = useState("");

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    setBusy("new");
    try {
      const response = await fetch("/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "User save failed");
      setForm({ email: "", displayName: "", role: "sale", password: "" });
      await reload();
      notify("Staff User နှင့် Role သိမ်းပြီးပါပြီ");
    } catch (error) { notify(error instanceof Error ? error.message : "User save failed"); }
    finally { setBusy(""); }
  }

  async function changeRole(email: string, role: AppRole) {
    setBusy(email);
    try {
      const response = await fetch("/api/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, role }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Role update failed");
      await reload();
      notify(`${email} ကို ${roleLabel[role]} Role သတ်မှတ်ပြီးပါပြီ`);
    } catch (error) { notify(error instanceof Error ? error.message : "Role update failed"); }
    finally { setBusy(""); }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>, email: string) {
    event.preventDefault();
    const passwordForm = event.currentTarget;
    const password = String(new FormData(passwordForm).get("password") || "");
    if (password.length < 8) {
      notify("Password ကို အနည်းဆုံး 8 လုံး ထည့်ပါ");
      return;
    }
    setBusy(email);
    try {
      const response = await fetch("/api/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json().catch(() => ({ error: `Password update မအောင်မြင်ပါ (${response.status})` }));
      if (!response.ok) throw new Error(data.error || "Password update failed");
      passwordForm.reset();
      await reload();
      notify(`${email} Password ပြန်သတ်မှတ်ပြီးပါပြီ`);
    } catch (error) { notify(error instanceof Error ? error.message : "Password update failed"); }
    finally { setBusy(""); }
  }

  return <div className="admin-panel">
    <div className="workflow-note admin-note"><ShieldCheck size={18} /><div><strong>Admin Only</strong><span>Staff Email တစ်ဦးချင်းစီကို လုပ်ငန်းတာဝန်အလိုက် Role သတ်မှတ်ပါ။</span></div></div>
    <form className="staff-add-form" onSubmit={saveUser}>
      <div className="section-heading"><div><h2>Staff အသစ်ထည့်ရန်</h2><p>ChatGPT သို့ဝင်သော Email ကို အသုံးပြုပါ</p></div></div>
      <label><span>Staff Name</span><input required placeholder="Name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
      <label><span>Staff Email</span><input type="email" required placeholder="name@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label><span>Role</span><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}>{assignableRoles.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></label>
      <label><span>Password</span><input type="password" minLength={8} required placeholder="အနည်းဆုံး 8 လုံး" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      <button disabled={busy === "new"}>{busy === "new" ? "သိမ်းနေသည်…" : "Staff & Role သိမ်းမည်"}</button>
    </form>

    <div className="section-heading"><div><h2>Current Users</h2><p>{users.length} Users</p></div><button className="icon-button" onClick={() => void reload()} aria-label="Refresh Users"><RefreshCw size={17} /></button></div>
    <div className="staff-list">{loading ? <Loading /> : users.map((user) => <article className="staff-card" key={user.email}>
      <span className={`staff-role-icon ${user.role}`}><UserRound size={18} /></span>
      <div className="staff-identity"><strong>{user.displayName || user.email.split("@")[0]}</strong><small>{user.email}</small></div>
      <label><span>Role</span><select disabled={busy === user.email} value={user.role} onChange={(e) => void changeRole(user.email, e.target.value as AppRole)}>{user.role === "viewer" && <option value="viewer">Access Pending</option>}{assignableRoles.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></label>
      <form className="staff-password" onSubmit={(event) => void resetPassword(event, user.email)}><span className={user.hasPassword ? "ready" : "missing"}>{user.hasPassword ? "Password Ready" : "Password မရှိသေး"}</span><label><span>New Password</span><input name="password" type="password" minLength={8} autoComplete="new-password" required placeholder="အနည်းဆုံး 8 လုံး" /></label><button type="submit" disabled={busy === user.email}>{busy === user.email ? "Updating…" : "Update Password"}</button></form>
    </article>)}</div>
    <div className="role-guide"><h3>Role Permissions</h3><div><b>Admin</b><span>အားလုံး + Role Management</span></div><div><b>Sale</b><span>Sale Order၊ Voucher၊ Customer Request၊ Delivery Approval၊ Management Report View/Download</span></div><div><b>Delivery</b><span>ပို့ရန်ကျန်/ပို့ပြီးနှင့် Delivery Update</span></div><div><b>Warehouse</b><span>ဘုံး/ဆွဲ၊ Finished၊ Purchase Request</span></div><div><b>Purchase</b><span>Purchase Request Status</span></div><div><b>Finance</b><span>Payment Status နှင့် Amount</span></div></div>
  </div>;
}

type WarehouseReportCategory = "all" | "picked" | "checked" | "stock_out" | "similar" | "quantity_changed";
type WarehouseReportProductCategory = Exclude<WarehouseReportCategory, "all">;
type WarehouseReportRow = {
  key: string;
  date: string;
  orderNo: string;
  customerName: string;
  township: string;
  saleTeam: string;
  saleMen: string;
  route: string;
  categories: WarehouseReportProductCategory[];
  productCode: string;
  productName: string;
  orderedQty: number;
  pickedQty: number;
  checkedQty: number | null;
  actualQty: number;
  unit: string;
  substituteCode: string;
  substituteProduct: string;
  substituteQty: number;
  quantityDifference: number;
};

const warehouseReportCategoryLabel: Record<WarehouseReportCategory, string> = {
  all: "Products အားလုံး",
  picked: "Picked Products",
  checked: "Checked Products",
  stock_out: "Stock Out Products",
  similar: "Similar Products",
  quantity_changed: "အရေအတွက် ပြင် Products",
};

function WarehouseProductReport({ orders, period, notify }: { orders: Order[]; period: string; notify: (message: string) => void }) {
  const [categoryFilter, setCategoryFilter] = useState<WarehouseReportCategory>("all");
  const [saleTeamFilter, setSaleTeamFilter] = useState<SaleTeamFilter>("All");
  const [salePersonFilter, setSalePersonFilter] = useState("All");
  const [routeFilter, setRouteFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [page, setPage] = useState(1);
  const routeOptions = useMemo(() => [...new Set(orders.map((order) => order.route).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [orders]);
  const customerOptions = useMemo(() => [...new Set(orders.map((order) => order.customerName).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [orders]);
  const reportRows = useMemo(() => {
    const rows: WarehouseReportRow[] = [];
    for (const order of orders) {
      const salePeople = assignedSalePeople(order).split(", ").map((name) => name.trim()).filter(Boolean);
      if (!matchesSaleTeam(salePeople, saleTeamFilter)) continue;
      if (salePersonFilter !== "All" && !salePeople.includes(salePersonFilter)) continue;
      if (routeFilter !== "All" && order.route !== routeFilter) continue;
      if (customerFilter !== "All" && order.customerName !== customerFilter) continue;
      const saleTeam = matchesSaleTeam(salePeople, "A") && matchesSaleTeam(salePeople, "B") ? "A + B" : matchesSaleTeam(salePeople, "A") ? "A" : matchesSaleTeam(salePeople, "B") ? "B" : "—";
      for (const item of order.orderItems || []) {
        const actualQty = item.checkedQuantity >= 0 ? item.checkedQuantity : item.pickedQuantity;
        const processed = item.checkedQuantity >= 0 || item.fulfillmentStatus !== "pending";
        const categories: WarehouseReportProductCategory[] = [];
        if (item.pickedQuantity > 0 || item.fulfillmentStatus === "picked" || item.fulfillmentStatus === "shortage") categories.push("picked");
        if (item.checkedQuantity >= 0) categories.push("checked");
        if (processed && actualQty === 0) categories.push("stock_out");
        if (item.substitutionStatus !== "none" && Boolean(item.substituteProductCode || item.substituteProductName)) categories.push("similar");
        if (processed && actualQty !== item.quantity) categories.push("quantity_changed");
        if (categories.length === 0) continue;
        rows.push({
          key: `${order.id}-${item.id}`,
          date: order.orderDate,
          orderNo: order.orderNo,
          customerName: order.customerName,
          township: order.township,
          saleTeam,
          saleMen: salePeople.join(", ") || "—",
          route: order.route,
          categories,
          productCode: item.originalProductCode || item.matchedProductCode || "",
          productName: item.originalDescription || item.matchedProductName,
          orderedQty: item.quantity,
          pickedQty: item.pickedQuantity,
          checkedQty: item.checkedQuantity >= 0 ? item.checkedQuantity : null,
          actualQty,
          unit: displayUnit(item.originalUnit),
          substituteCode: item.substituteProductCode,
          substituteProduct: item.substituteProductName,
          substituteQty: item.substituteQuantity,
          quantityDifference: actualQty - item.quantity,
        });
      }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date) || a.customerName.localeCompare(b.customerName) || a.productName.localeCompare(b.productName));
  }, [customerFilter, orders, routeFilter, salePersonFilter, saleTeamFilter]);
  const categoryCounts = useMemo(() => reportRows.reduce((counts, row) => {
    for (const category of row.categories) counts[category] += 1;
    return counts;
  }, { picked: 0, checked: 0, stock_out: 0, similar: 0, quantity_changed: 0 }), [reportRows]);
  const visibleRows = useMemo(() => categoryFilter === "all" ? reportRows : reportRows.filter((row) => row.categories.includes(categoryFilter)), [categoryFilter, reportRows]);
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / 10));
  const safePage = Math.min(page, pageCount);
  const pageRows = visibleRows.slice((safePage - 1) * 10, safePage * 10);
  useEffect(() => { setPage(1); }, [categoryFilter, customerFilter, routeFilter, salePersonFilter, saleTeamFilter]);
  const filterSummary = `${period} • ${saleTeamFilter === "All" ? "All Sale Teams" : `Sale Team ${saleTeamFilter}`} • ${salePersonFilter === "All" ? "All Sale Men" : salePersonFilter} • ${routeFilter === "All" ? "All Routes" : routeFilter} • ${customerFilter === "All" ? "All Customers" : customerFilter} • ${warehouseReportCategoryLabel[categoryFilter]}`;

  async function downloadExcel() {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const rows = [["Nawaratt Warehouse Product Report"], ["Period", period], ["Filters", filterSummary], [], ["Date", "Sale Team", "Sale Men", "Route", "Customer", "Township", "Order No", "Categories", "Product Code", "Product Name", "Ordered Qty", "Picked Qty", "Checked Qty", "Actual Qty", "Unit", "Similar Code", "Similar Product", "Similar Qty", "Qty Difference"], ...visibleRows.map((row) => [row.date, row.saleTeam, row.saleMen, row.route, row.customerName, row.township, row.orderNo, row.categories.map((category) => warehouseReportCategoryLabel[category]).join(", "), row.productCode, row.productName, row.orderedQty, row.pickedQty, row.checkedQty ?? "", row.actualQty, row.unit, row.substituteCode, row.substituteProduct, row.substituteQty || "", row.quantityDifference])];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 12 }, { wch: 11 }, { wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 38 }, { wch: 16 }, { wch: 34 }, ...Array.from({ length: 9 }, () => ({ wch: 13 }))];
    XLSX.utils.book_append_sheet(workbook, sheet, "Warehouse Products");
    XLSX.writeFile(workbook, `Nawaratt_Warehouse_Product_Report_${todayLocal()}.xlsx`);
    notify(`Warehouse Product Report Excel • ${visibleRows.length} Products ထုတ်ပြီးပါပြီ`);
  }

  function printPdf() {
    document.body.classList.add("printing-warehouse-report");
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove("printing-warehouse-report"), 500);
    }, 50);
  }

  function clearFilters() {
    setCategoryFilter("all");
    setSaleTeamFilter("All");
    setSalePersonFilter("All");
    setRouteFilter("All");
    setCustomerFilter("All");
  }

  return <section className="warehouse-product-report" id="warehouse-product-report">
    <div className="warehouse-report-head"><div><FileSpreadsheet size={19} /><span><strong>Warehouse Product Report</strong><small>Picked / Checked / Stock Out / Similar / Quantity Changed Products</small></span></div><div><button type="button" disabled={visibleRows.length === 0} onClick={() => void downloadExcel()}><FileSpreadsheet size={15} />Excel</button><button type="button" disabled={visibleRows.length === 0} onClick={printPdf}><Printer size={15} />PDF / Print</button></div></div>
    <div className="warehouse-report-filters"><label><span>Report Type</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as WarehouseReportCategory)}>{(Object.keys(warehouseReportCategoryLabel) as WarehouseReportCategory[]).map((category) => <option value={category} key={category}>{warehouseReportCategoryLabel[category]}</option>)}</select></label><label><span>Sale Team</span><select value={saleTeamFilter} onChange={(event) => { const team = event.target.value as SaleTeamFilter; setSaleTeamFilter(team); if (team !== "All" && !SALE_TEAM_MEMBERS[team].includes(salePersonFilter)) setSalePersonFilter("All"); }}><option value="All">All Sale Teams</option><option value="A">Sale Team A</option><option value="B">Sale Team B</option></select></label><label><span>Sale Men</span><select value={salePersonFilter} onChange={(event) => setSalePersonFilter(event.target.value)}><option value="All">All Sale Men</option>{salePeopleForTeam(saleTeamFilter).map((person) => <option value={person} key={person}>{person}</option>)}</select></label><label><span>Route</span><select value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)}><option value="All">All Routes</option>{routeOptions.map((route) => <option value={route} key={route}>{route}</option>)}</select></label><label><span>Customers</span><select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value="All">All Customers</option>{customerOptions.map((customer) => <option value={customer} key={customer}>{customer}</option>)}</select></label><button type="button" onClick={clearFilters}>Clear Filters</button></div>
    <div className="warehouse-report-cards">{(["picked", "checked", "stock_out", "similar", "quantity_changed"] as WarehouseReportProductCategory[]).map((category) => <button type="button" className={categoryFilter === category ? "active" : ""} onClick={() => setCategoryFilter((current) => current === category ? "all" : category)} key={category}><span>{warehouseReportCategoryLabel[category]}</span><strong>{categoryCounts[category]}</strong></button>)}</div>
    <div className="warehouse-report-note"><span>{filterSummary}</span><b>{visibleRows.length} Products</b></div>
    {visibleRows.length > 10 && <WarehousePagination page={safePage} pageCount={pageCount} total={visibleRows.length} noun="Products" onChange={setPage} />}
    <div className="warehouse-report-table"><div className="head"><span>Customer / Order</span><span>Product</span><span>Result</span><span>Qty</span></div>{pageRows.length === 0 ? <p>ရွေးထားသော Filter အတွက် Product မရှိပါ</p> : pageRows.map((row) => <div key={row.key}><span><strong>{row.customerName}</strong><small>{row.orderNo} • {row.saleMen} • {row.route}</small></span><span><strong>{row.productName}</strong><small>{row.productCode || "No Code"}{row.substituteProduct ? ` → ${row.substituteProduct}` : ""}</small></span><span>{row.categories.map((category) => <i className={category} key={category}>{warehouseReportCategoryLabel[category]}</i>)}</span><span><b>{row.actualQty}/{row.orderedQty}</b><small>{row.unit || "Unit"}</small></span></div>)}</div>
    {visibleRows.length > 10 && <WarehousePagination page={safePage} pageCount={pageCount} total={visibleRows.length} noun="Products" onChange={setPage} />}
    <div className="warehouse-report-print-table"><h2>Nawaratt Warehouse Product Report</h2><p>{filterSummary} • {visibleRows.length} Products</p><table><thead><tr><th>Date</th><th>Customer / Order</th><th>Sale Team / Men</th><th>Route</th><th>Category</th><th>Code / Product</th><th>Ordered</th><th>Picked</th><th>Checked</th><th>Actual</th><th>Similar Product</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={`print-${row.key}`}><td>{row.date}</td><td>{row.customerName}<br />{row.orderNo}</td><td>{row.saleTeam}<br />{row.saleMen}</td><td>{row.route}</td><td>{row.categories.map((category) => warehouseReportCategoryLabel[category]).join(", ")}</td><td>{row.productCode || "—"}<br />{row.productName}</td><td>{row.orderedQty} {row.unit}</td><td>{row.pickedQty}</td><td>{row.checkedQty ?? "—"}</td><td>{row.actualQty}</td><td>{row.substituteProduct || "—"}{row.substituteQty ? ` (${row.substituteQty})` : ""}</td></tr>)}</tbody></table></div>
  </section>;
}

function PurchasePanel({ requests, loading, summary, notify, isAdmin, onAdminAdjust, onRejectArrival, onStatus }: { requests: PurchaseRequest[]; loading: boolean; summary: Record<PurchaseStatusBucket, number>; notify: (message: string) => void; isAdmin: boolean; onAdminAdjust: (item: PurchaseRequest, action: "edit" | "cancel", quantity: number, reason: string) => Promise<{ cancelled?: boolean; warning?: string | null }>; onRejectArrival: (item: PurchaseRequest, reason: string) => Promise<void>; onStatus: (items: Array<Pick<PurchaseRequest, "id" | "sourceType">>, status: "ordered_company" | "ordered_mglz" | "stock_out" | "unavailable", supplierName: string) => Promise<void> }) {
  const [statusFilter, setStatusFilter] = useState<"all" | PurchaseStatusBucket>("all");
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [saleTeamFilter, setSaleTeamFilter] = useState<SaleTeamFilter>("All");
  const [salePersonFilter, setSalePersonFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [openProduct, setOpenProduct] = useState("");
  const [supplierDrafts, setSupplierDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, boolean>>({});
  const [bulkAction, setBulkAction] = useState<"" | "ordered_company" | "ordered_mglz" | "stock_out" | "unavailable">("");
  const [purchasePages, setPurchasePages] = useState<Record<PurchaseTimeBucket, number>>({ before_3pm: 1, after_3pm: 1 });
  const [adminDraft, setAdminDraft] = useState<{ item: PurchaseRequest; action: "edit" | "cancel"; quantity: string; reason: string } | null>(null);
  const [adminSaving, setAdminSaving] = useState(false);
  const allStatusCount = summary.pending + summary.ordered_company + summary.ordered_mglz + summary.unavailable + summary.stock_out;
  const customerOptions = useMemo(() => [...new Set(requests.map((item) => item.customerName).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [requests]);
  const productGroups = useMemo(() => {
    const grouped = new Map<string, { key: string; timeBucket: PurchaseTimeBucket; productCode: string; productName: string; unit: string; quantity: number; items: PurchaseRequest[] }>();
    for (const request of requests) {
      const salePeople = (request.salesperson || request.requestedBy || "").split(",").map((name) => name.trim()).filter(Boolean);
      if (!matchesSaleTeam(salePeople, saleTeamFilter)) continue;
      if (salePersonFilter !== "All" && !salePeople.includes(salePersonFilter)) continue;
      if (customerFilter !== "All" && request.customerName !== customerFilter) continue;
      const timeBucket = purchaseTimeBucket(request.requestedAt);
      const key = `${timeBucket}|||${purchaseProductKey(request)}`;
      const group = grouped.get(key) || { key, timeBucket, productCode: request.productCode, productName: request.productName, unit: request.unit || "Unit", quantity: 0, items: [] };
      group.quantity += Number(request.quantity) || 0;
      group.items.push(request);
      if (!group.productCode && request.productCode) group.productCode = request.productCode;
      grouped.set(key, group);
    }
    return [...grouped.values()].sort((a, b) => {
      if (a.timeBucket !== b.timeBucket) return a.timeBucket === "before_3pm" ? -1 : 1;
      const aPending = a.items.some((item) => purchaseStatusBucket(item.status) === "pending");
      const bPending = b.items.some((item) => purchaseStatusBucket(item.status) === "pending");
      return Number(bPending) - Number(aPending) || a.productName.localeCompare(b.productName);
    });
  }, [customerFilter, requests, salePersonFilter, saleTeamFilter]);
  const visibleProducts = useMemo(() => {
    const needle = purchaseSearch.trim().toLocaleLowerCase();
    return productGroups.filter((group) => {
      const matchesStatus = statusFilter === "all" || purchaseGroupBucket(group.items) === statusFilter;
      const searchable = `${group.productCode} ${group.productName} ${group.unit} ${group.items.map((item) => `${item.orderNo} ${item.customerName} ${item.township} ${item.supplierName}`).join(" ")}`.toLocaleLowerCase();
      return matchesStatus && (!needle || searchable.includes(needle));
    });
  }, [productGroups, purchaseSearch, statusFilter]);
  const timeSections = useMemo(() => ([
    { key: "before_3pm" as const, label: "Before 3 PM", sublabel: "နေ့လယ် ၃ နာရီမတိုင်မီ ရောက်ရှိ" },
    { key: "after_3pm" as const, label: "After 3 PM", sublabel: "နေ့လယ် ၃ နာရီနှင့် နောက်ပိုင်း ရောက်ရှိ" },
  ]).map((section) => {
    const products = visibleProducts.filter((group) => group.timeBucket === section.key);
    const pageCount = Math.max(1, Math.ceil(products.length / 10));
    const page = Math.min(purchasePages[section.key], pageCount);
    return { ...section, products, page, pageCount, pageProducts: products.slice((page - 1) * 10, page * 10) };
  }), [purchasePages, visibleProducts]);
  useEffect(() => {
    setPurchasePages({ before_3pm: 1, after_3pm: 1 });
    setOpenProduct("");
  }, [customerFilter, purchaseSearch, salePersonFilter, saleTeamFilter, statusFilter]);
  const selectableProducts = useMemo(() => visibleProducts.filter((group) => group.items.some((item) => purchaseStatusBucket(item.status) === "pending")), [visibleProducts]);
  const selectedGroups = useMemo(() => selectableProducts.filter((group) => selectedProducts[group.key]), [selectableProducts, selectedProducts]);
  const selectedPendingItems = useMemo(() => selectedGroups.flatMap((group) => group.items.filter((item) => purchaseStatusBucket(item.status) === "pending")), [selectedGroups]);
  const purchaseFilterSummary = [
    statusFilter === "all" ? "Status အားလုံး" : purchaseStatusLabel(statusFilter),
    saleTeamFilter === "All" ? "Sale Teams အားလုံး" : `Sale Team ${saleTeamFilter}`,
    salePersonFilter === "All" ? "Sale Men အားလုံး" : salePersonFilter,
    customerFilter === "All" ? "Customers အားလုံး" : customerFilter,
    purchaseSearch.trim() ? `Search: ${purchaseSearch.trim()}` : "Products အားလုံး",
  ].join(" • ");

  async function downloadPurchaseExcel() {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const summaryRows: Array<Array<string | number>> = [
      ["Nawaratt Purchase Report"],
      ["Export Date", todayLocal()],
      ["Filters", purchaseFilterSummary],
      ["Products", visibleProducts.length],
      ["Source Requests", visibleProducts.reduce((sum, group) => sum + group.items.length, 0)],
      [],
      ["Time", "Status", "Product Code", "Product Name", "Total Qty", "Unit", "Sources", "Suppliers"],
      ...visibleProducts.map((group) => [
        group.timeBucket === "before_3pm" ? "Before 3 PM" : "After 3 PM",
        purchaseStatusLabel(purchaseGroupBucket(group.items)),
        group.productCode || "",
        group.productName,
        group.quantity,
        group.unit,
        group.items.length,
        [...new Set(group.items.map((item) => item.supplierName).filter(Boolean))].join(", "),
      ]),
    ];
    const detailRows: Array<Array<string | number>> = [["Requested At", "Time", "Status", "Order No", "Customer", "Township", "Sale Men", "Route", "Product Code", "Product Name", "Qty", "Unit", "Supplier", "Requested By"]];
    for (const group of visibleProducts) for (const item of group.items) detailRows.push([
      item.requestedAt,
      group.timeBucket === "before_3pm" ? "Before 3 PM" : "After 3 PM",
      purchaseStatusLabel(purchaseStatusBucket(item.status)),
      item.orderNo || "Customer Request",
      item.customerName,
      item.township,
      item.salesperson || item.requestedBy,
      item.route,
      item.productCode,
      item.productName,
      item.quantity,
      item.unit,
      item.supplierName,
      item.requestedBy,
    ]);
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [{ wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 34 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];
    const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
    detailSheet["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 34 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Product Summary");
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Request Details");
    XLSX.writeFile(workbook, `Nawaratt_Purchase_Report_${todayLocal()}.xlsx`);
    notify(`Purchase Excel Report — ${visibleProducts.length} Products ထုတ်ပြီးပါပြီ`);
  }

  function printPurchaseReport() {
    document.body.classList.add("printing-purchase-report");
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove("printing-purchase-report"), 500);
    }, 50);
  }

  async function applyBulkAction() {
    if (!bulkAction || selectedGroups.length === 0 || savingKey) return;
    if (bulkAction === "unavailable" && !window.confirm(`ရွေးထားသော Product ${selectedGroups.length} မျိုးကို ဝယ်လို့မရအဖြစ် ပြောင်းမည်။ ဆက်လုပ်မလား?`)) return;
    setSavingKey("__bulk__");
    try {
      await onStatus(selectedPendingItems.map((item) => ({ id: item.id, sourceType: item.sourceType })), bulkAction, "");
      setSelectedProducts({});
      setBulkAction("");
    } finally { setSavingKey(""); }
  }

  function clearFilters() {
    setPurchaseSearch("");
    setStatusFilter("all");
    setSaleTeamFilter("All");
    setSalePersonFilter("All");
    setCustomerFilter("All");
    setOpenProduct("");
    setSelectedProducts({});
    setAdminDraft(null);
  }

  async function submitAdminAdjustment() {
    if (!adminDraft || adminSaving) return;
    const reason = adminDraft.reason.trim();
    if (!reason) { notify("ပြင်ဆင်ရသည့် Reason ကို မဖြစ်မနေရွေးပါ"); return; }
    const quantity = Number(adminDraft.quantity);
    if (adminDraft.action === "edit" && (!Number.isInteger(quantity) || quantity < 1)) {
      notify("Quantity သည် 1 နှင့်အထက် ကိန်းပြည့်ဖြစ်ရပါမည်");
      return;
    }
    const ordered = ["ordered", "ordered_company", "ordered_mglz"].includes(adminDraft.item.status);
    if (ordered && !window.confirm(`ဒီ Request က ${purchaseStatusLabel(purchaseStatusBucket(adminDraft.item.status))} ဖြစ်ပြီးပါပြီ။ ပြင်ဆင်မှုကို Purchase Team ထံ Notification ပို့ပါမည်။ ဆက်လုပ်မလား?`)) return;
    if (adminDraft.action === "cancel" && !window.confirm(`${adminDraft.item.orderNo || "Customer Request"} မှ ${adminDraft.item.productName} ${adminDraft.item.quantity} ${adminDraft.item.unit} ကို Cancel Duplicate လုပ်မည်။ ဆက်လုပ်မလား?`)) return;
    setAdminSaving(true);
    try {
      const result = await onAdminAdjust(adminDraft.item, adminDraft.action, adminDraft.action === "edit" ? quantity : adminDraft.item.quantity, reason);
      notify(adminDraft.action === "edit" ? `Quantity ${adminDraft.item.quantity} → ${quantity} ပြင်ပြီးပါပြီ${result.warning ? " • Purchase Team ကိုအသိပေးထားသည်" : ""}` : `Duplicate Purchase Request ကို Cancel လုပ်ပြီး Active စာရင်းမှဖယ်ပြီးပါပြီ${result.warning ? " • Purchase Team ကိုအသိပေးထားသည်" : ""}`);
      setAdminDraft(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Purchase Request ပြင်မရပါ");
    } finally { setAdminSaving(false); }
  }

  function renderProduct(group: (typeof productGroups)[number]) {
    const pendingItems = group.items.filter((item) => purchaseStatusBucket(item.status) === "pending");
    const buckets = group.items.map((item) => purchaseStatusBucket(item.status));
    const groupStatus: PurchaseStatusBucket | "mixed" = pendingItems.length ? "pending" : buckets.every((status) => status === "ordered_company") ? "ordered_company" : buckets.every((status) => status === "ordered_mglz") ? "ordered_mglz" : buckets.every((status) => status === "stock_out") ? "stock_out" : buckets.every((status) => status === "unavailable") ? "unavailable" : "mixed";
    const statusText = groupStatus === "mixed" ? "Mixed" : purchaseStatusLabel(groupStatus);
    const sourceCount = new Set(group.items.map((item) => item.orderId > 0 ? `order-${item.orderId}` : `${item.sourceType}-${item.id}`)).size;
    const existingSuppliers = [...new Set(group.items.map((item) => item.supplierName.trim()).filter(Boolean))];
    const supplierName = supplierDrafts[group.key] ?? (existingSuppliers.length === 1 ? existingSuppliers[0] : "");
    const isOpen = openProduct === group.key;
    const isSelected = Boolean(selectedProducts[group.key]);
    const customerSourceCounts = new Map<string, number>();
    for (const item of group.items) {
      const customerKey = `${item.customerName.trim().toLocaleLowerCase()}|||${item.township.trim().toLocaleLowerCase()}`;
      customerSourceCounts.set(customerKey, (customerSourceCounts.get(customerKey) || 0) + 1);
    }
    const hasDuplicateSources = [...customerSourceCounts.values()].some((count) => count > 1);
    const draftIsInGroup = Boolean(adminDraft && group.items.some((item) => item.id === adminDraft.item.id && item.sourceType === adminDraft.item.sourceType));
    const arrivalState = purchaseGroupArrivalState(group.items);
    async function applyStatus(status: "ordered_company" | "ordered_mglz" | "stock_out" | "unavailable") {
      if (savingKey || pendingItems.length === 0) return;
      setSavingKey(group.key);
      try { await onStatus(pendingItems.map((item) => ({ id: item.id, sourceType: item.sourceType })), status, supplierName.trim()); }
      finally { setSavingKey(""); }
    }
    return <article className={`purchase-product-row ${groupStatus} arrival-${arrivalState} ${isOpen ? "open" : ""} ${isSelected ? "selected" : ""}`} key={group.key}>
      <div className="purchase-product-line"><label className="purchase-product-select"><input aria-label={`${group.productName} ရွေးရန်`} type="checkbox" disabled={pendingItems.length === 0 || Boolean(savingKey)} checked={isSelected} onChange={(event) => setSelectedProducts((current) => ({ ...current, [group.key]: event.target.checked }))} /></label><button className="purchase-product-main" type="button" onClick={() => setOpenProduct(isOpen ? "" : group.key)} aria-expanded={isOpen}>
        <span className="purchase-product-code">{group.productCode || "—"}</span><span className="purchase-product-name"><strong>{group.productName}</strong><small>{sourceCount} source {sourceCount === 1 ? "order" : "orders"}</small></span><b className="purchase-product-qty">{group.quantity}</b><span className="purchase-product-unit">{group.unit}</span><span className="purchase-status-stack"><span className={`purchase-product-status ${groupStatus}`}>{statusText}</span><PurchaseArrivalBadge state={arrivalState} /></span><ChevronRight className={isOpen ? "open" : ""} size={17} />
      </button></div>
      {isOpen && <div className="purchase-product-detail"><PurchaseArrivalSummary items={group.items} state={arrivalState} /><div className="purchase-source-list"><strong>Related Orders / Customer Requests</strong>{hasDuplicateSources && <div className="purchase-duplicate-warning"><ShieldCheck size={15} /><span><b>Duplicate ဖြစ်နိုင်သော Source Requests ရှိသည်</b><small>Customer တူ၊ Product တူသော Request ကို Admin မှ Quantity ပြင်နိုင်သည် သို့မဟုတ် Cancel Duplicate လုပ်နိုင်သည်</small></span></div>}{group.items.map((item) => {
        const customerKey = `${item.customerName.trim().toLocaleLowerCase()}|||${item.township.trim().toLocaleLowerCase()}`;
        const isDuplicate = (customerSourceCounts.get(customerKey) || 0) > 1;
        const itemArrivalState = item.arrivalStatus || "none";
        return <div className={`purchase-source-row ${isDuplicate ? "possible-duplicate" : ""}`} key={`${item.sourceType}-${item.id}`}><span><b>{item.orderNo || "Customer Request"}</b><small>{item.customerName} • {item.township}{item.salesperson ? ` • ${item.salesperson}` : ""}</small></span><div className="purchase-source-admin"><b>{item.quantity} {item.unit || group.unit} • {purchaseStatusLabel(purchaseStatusBucket(item.status))}<PurchaseArrivalBadge state={itemArrivalState} /></b>{isDuplicate && <em>Duplicate?</em>}{isAdmin && <span className="purchase-source-admin-actions"><button type="button" disabled={adminSaving} onClick={() => setAdminDraft({ item, action: "edit", quantity: String(item.quantity), reason: "Wrong Quantity" })}><Pencil size={12} />Edit Qty</button><button type="button" disabled={adminSaving} onClick={() => setAdminDraft({ item, action: "cancel", quantity: String(item.quantity), reason: "Duplicate Request" })}><Trash2 size={12} />Cancel Duplicate</button>{itemArrivalState !== "none" && <button type="button" className="arrival-reject" disabled={adminSaving} onClick={() => { const reason = window.prompt("Arrival Matching Reject Reason", "Incorrect arrival match"); if (reason?.trim()) void onRejectArrival(item, reason.trim()).then(() => notify("Arrival Matching ကို Reject လုပ်ပြီး Audit Log တွင်သိမ်းထားပါပြီ")).catch((error) => notify(error instanceof Error ? error.message : "Arrival Reject မလုပ်နိုင်ပါ")); }}><X size={12} />Arrival Reject</button>}</span>}</div></div>;
      })}</div>{isAdmin && draftIsInGroup && adminDraft && <div className={`purchase-admin-adjustment ${adminDraft.action}`}><div className="purchase-admin-adjustment-head"><ShieldCheck size={16} /><span><strong>{adminDraft.action === "edit" ? "Admin — Purchase Quantity Edit" : "Admin — Cancel Duplicate Request"}</strong><small>{adminDraft.item.orderNo || "Customer Request"} • {adminDraft.item.customerName} • {adminDraft.item.productName}</small></span></div>{["ordered", "ordered_company", "ordered_mglz"].includes(adminDraft.item.status) && <p className="purchase-admin-ordered-warning">ဒီ Request က မှာပြီးသားဖြစ်သောကြောင့် Save လုပ်ပါက Purchase Team ကို Notification ပို့ပါမည်။</p>}{adminDraft.action === "edit" && <label><span>New Quantity</span><input type="number" inputMode="numeric" min="1" step="1" value={adminDraft.quantity} onChange={(event) => setAdminDraft({ ...adminDraft, quantity: event.target.value })} /></label>}<label><span>Reason *</span><input list="purchase-admin-reasons" value={adminDraft.reason} onChange={(event) => setAdminDraft({ ...adminDraft, reason: event.target.value })} placeholder="Reason ရွေးရန် သို့မဟုတ် ရေးရန်" /></label><datalist id="purchase-admin-reasons"><option value="Duplicate Request" /><option value="Wrong Quantity" /><option value="Customer Changed Quantity" /><option value="Already Purchased" /><option value="Other" /></datalist><div className="purchase-admin-adjustment-actions"><button type="button" className="cancel" disabled={adminSaving} onClick={() => setAdminDraft(null)}>မလုပ်တော့ပါ</button><button type="button" className={adminDraft.action === "cancel" ? "danger" : "save"} disabled={adminSaving} onClick={() => void submitAdminAdjustment()}>{adminSaving ? "သိမ်းနေသည်…" : adminDraft.action === "edit" ? "Quantity ပြင်မည်" : "Cancel Duplicate"}</button></div><small className="purchase-admin-audit-note">Before / After၊ Edited By၊ Date/Time နှင့် Reason ကို Audit Log တွင်သိမ်းပါမည်။</small></div>}<label className="purchase-supplier"><span>Supplier Name (Optional)</span><input value={supplierName} onChange={(event) => setSupplierDrafts((current) => ({ ...current, [group.key]: event.target.value }))} placeholder="သိရှိပါက Supplier ထည့်ရန်" /></label>{pendingItems.length > 0 ? <><small className="purchase-supplier-help">Pending source {pendingItems.length} ခုကို တစ်ခါတည်း Update လုပ်မည်</small><div className="purchase-actions purchase-actions-three"><button disabled={savingKey === group.key} onClick={() => void applyStatus("ordered_company")}>{savingKey === group.key ? "သိမ်းနေသည်…" : "မှာပြီး Company"}</button><button className="mglz" disabled={savingKey === group.key} onClick={() => void applyStatus("ordered_mglz")}>{savingKey === group.key ? "သိမ်းနေသည်…" : "မှာပြီး MGLZ"}</button><button className="stock-out" disabled={savingKey === group.key} onClick={() => void applyStatus("stock_out")}>{savingKey === group.key ? "သိမ်းနေသည်…" : "ပစ္စည်းပြတ်"}</button><button className="unavailable" disabled={savingKey === group.key} onClick={() => void applyStatus("unavailable")}>{savingKey === group.key ? "သိမ်းနေသည်…" : "မရပါ"}</button></div></> : <small className="purchase-product-finished">ဒီ Product အတွက် Pending source မရှိတော့ပါ</small>}</div>}
    </article>;
  }

  return <div className="purchase-panel" id="purchase-report">
    <div className="workflow-note purchase-note"><ShoppingCart size={18} /><div><strong>To Purchase — Product List</strong><span>Order အားလုံးမှ တူညီသော Product နှင့် Unit ကို စုပေါင်းပြီး ဝယ်ရန် Final Quantity ကို ပြထားသည်။ မူလ Order ချိတ်ဆက်မှုများကို ဆက်လက်သိမ်းထားသည်။</span></div></div>
    <div className="purchase-report-head"><div><FileSpreadsheet size={19} /><span><strong>Purchase Report</strong><small>လက်ရှိ Search / Filter ရလဒ်အတိုင်း ထုတ်ပေးမည်</small></span></div><div><button type="button" disabled={visibleProducts.length === 0} onClick={() => void downloadPurchaseExcel()}><FileSpreadsheet size={16} />Excel</button><button type="button" disabled={visibleProducts.length === 0} onClick={printPurchaseReport}><Printer size={16} />PDF / Print</button></div></div>
    <div className="purchase-summary purchase-summary-four interactive"><button type="button" className={`all-status ${statusFilter === "all" ? "active" : ""}`} aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")}><span>All Status</span><strong>{allStatusCount}</strong></button><button type="button" className={statusFilter === "pending" ? "active" : ""} aria-pressed={statusFilter === "pending"} onClick={() => setStatusFilter("pending")}><span>ဝယ်ရန် Products</span><strong>{summary.pending}</strong></button><button type="button" className={`ordered-company ${statusFilter === "ordered_company" ? "active" : ""}`} aria-pressed={statusFilter === "ordered_company"} onClick={() => setStatusFilter("ordered_company")}><span>မှာပြီး Company</span><strong>{summary.ordered_company}</strong></button><button type="button" className={`ordered-mglz ${statusFilter === "ordered_mglz" ? "active" : ""}`} aria-pressed={statusFilter === "ordered_mglz"} onClick={() => setStatusFilter("ordered_mglz")}><span>မှာပြီး MGLZ</span><strong>{summary.ordered_mglz}</strong></button><button type="button" className={`unavailable ${statusFilter === "unavailable" ? "active" : ""}`} aria-pressed={statusFilter === "unavailable"} onClick={() => setStatusFilter("unavailable")}><span>မရပါ</span><strong>{summary.unavailable}</strong></button><button type="button" className={`stock-out ${statusFilter === "stock_out" ? "active" : ""}`} aria-pressed={statusFilter === "stock_out"} onClick={() => setStatusFilter("stock_out")}><span>ပစ္စည်းပြတ်</span><strong>{summary.stock_out}</strong></button></div>
    {!loading && requests.length > 0 && <div className="purchase-role-tools"><label className="purchase-role-search"><Search size={16} /><input value={purchaseSearch} onChange={(event) => setPurchaseSearch(event.target.value)} placeholder="Code / Product Name ရှာရန်" /></label><label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">Status အားလုံး</option><option value="pending">ဝယ်ရန်</option><option value="ordered_company">မှာပြီး Company</option><option value="ordered_mglz">မှာပြီး MGLZ</option><option value="stock_out">ပစ္စည်းပြတ်</option><option value="unavailable">မရပါ</option></select></label><label><span>Sale Team</span><select value={saleTeamFilter} onChange={(event) => { const team = event.target.value as SaleTeamFilter; setSaleTeamFilter(team); if (team !== "All" && !SALE_TEAM_MEMBERS[team].includes(salePersonFilter)) setSalePersonFilter("All"); }}><option value="All">All Sale Teams</option><option value="A">Sale Team A</option><option value="B">Sale Team B</option></select></label><label><span>Sale Men</span><select value={salePersonFilter} onChange={(event) => setSalePersonFilter(event.target.value)}><option value="All">All Sale Men</option>{salePeopleForTeam(saleTeamFilter).map((person) => <option value={person} key={person}>{person}</option>)}</select></label><label><span>Customers</span><select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value="All">All Customers</option>{customerOptions.map((customer) => <option value={customer} key={customer}>{customer}</option>)}</select></label><button type="button" onClick={clearFilters}>Clear Filters</button></div>}
    {!loading && selectableProducts.length > 0 && <div className={`purchase-bulk-bar ${selectedGroups.length > 0 ? "active" : ""}`}>
      <div className="purchase-bulk-count"><strong>{selectedGroups.length}</strong><span>Products selected</span><small>{selectedPendingItems.length} source requests</small></div>
      <label><span>Bulk Action</span><select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as typeof bulkAction)}><option value="">Action ရွေးရန်</option><option value="ordered_company">မှာပြီး Company</option><option value="ordered_mglz">မှာပြီး MGLZ</option><option value="stock_out">ပစ္စည်းပြတ်</option><option value="unavailable">မရပါ</option></select></label>
      <button type="button" disabled={selectedGroups.length === 0 || !bulkAction || savingKey === "__bulk__"} onClick={() => void applyBulkAction()}>{savingKey === "__bulk__" ? "Updating…" : "Apply Action"}</button>
    </div>}
    {loading ? <div className="purchase-product-list"><Loading /></div> : requests.length === 0 ? <div className="purchase-product-list"><div className="empty-state"><span><ShoppingCart /></span><h3>ဝယ်ရန် Product မရှိသေးပါ</h3><p>Warehouse သို့မဟုတ် Sale Team မှ ပို့လာသော Products ကို ဒီနေရာမှာ စုပေါင်းပြပါမယ်။</p></div></div> : visibleProducts.length === 0 ? <div className="purchase-product-list"><div className="empty-state"><span><Search /></span><h3>Product မတွေ့ပါ</h3><p>Search သို့မဟုတ် Filter များကို ပြန်စစ်ပါ။</p></div></div> : <div className="purchase-time-groups">{timeSections.map((section) => <section className={`purchase-time-section ${section.key}`} key={section.key}><div className="purchase-time-heading"><span><strong>{section.label}</strong><small>{section.sublabel}</small></span><b>{section.products.length} Products</b></div>{section.products.length === 0 ? <div className="purchase-time-empty">ဒီအချိန်ပိုင်းအတွက် Product မရှိပါ</div> : <>{section.products.length > 10 && <WarehousePagination page={section.page} pageCount={section.pageCount} total={section.products.length} noun="Products" onChange={(nextPage) => { setPurchasePages((current) => ({ ...current, [section.key]: nextPage })); setOpenProduct(""); }} />}<div className="purchase-product-list"><div className="purchase-product-head"><label className="purchase-product-select"><input aria-label={`${section.label} ယခု Page ရှိ Pending Products အားလုံးရွေးရန်`} type="checkbox" disabled={Boolean(savingKey) || !section.pageProducts.some((group) => group.items.some((item) => purchaseStatusBucket(item.status) === "pending"))} checked={section.pageProducts.some((group) => group.items.some((item) => purchaseStatusBucket(item.status) === "pending")) && section.pageProducts.filter((group) => group.items.some((item) => purchaseStatusBucket(item.status) === "pending")).every((group) => selectedProducts[group.key])} onChange={(event) => setSelectedProducts((current) => ({ ...current, ...Object.fromEntries(section.pageProducts.filter((group) => group.items.some((item) => purchaseStatusBucket(item.status) === "pending")).map((group) => [group.key, event.target.checked])) }))} /></label><span>Code</span><span>Product Name</span><span>Qty</span><span>Unit</span><span>Status</span><span /></div>{section.pageProducts.map(renderProduct)}</div>{section.products.length > 10 && <WarehousePagination page={section.page} pageCount={section.pageCount} total={section.products.length} noun="Products" onChange={(nextPage) => { setPurchasePages((current) => ({ ...current, [section.key]: nextPage })); setOpenProduct(""); }} />}</>}</section>)}</div>}
    <div className="purchase-report-print-table"><h2>Nawaratt Purchase Report</h2><p>{purchaseFilterSummary} • {visibleProducts.length} Products</p><table><thead><tr><th>Time</th><th>Status</th><th>Code / Product</th><th>Total Qty</th><th>Related Orders / Customers</th><th>Sale Men / Route</th><th>Supplier</th></tr></thead><tbody>{visibleProducts.map((group) => <tr key={`purchase-print-${group.key}`}><td>{group.timeBucket === "before_3pm" ? "Before 3 PM" : "After 3 PM"}</td><td>{purchaseStatusLabel(purchaseGroupBucket(group.items))}</td><td>{group.productCode || "—"}<br />{group.productName}</td><td>{group.quantity} {group.unit}</td><td>{group.items.map((item) => `${item.orderNo || "Customer Request"} — ${item.customerName}`).join("; ")}</td><td>{[...new Set(group.items.map((item) => `${item.salesperson || item.requestedBy}${item.route ? ` / ${item.route}` : ""}`))].join("; ")}</td><td>{[...new Set(group.items.map((item) => item.supplierName).filter(Boolean))].join(", ") || "—"}</td></tr>)}</tbody></table></div>
  </div>;
}

function SalePurchaseStatus({ requests, loading }: { requests: PurchaseRequest[]; summary: Record<PurchaseStatusBucket, number>; loading: boolean }) {
  const [statusFilter, setStatusFilter] = useState<PurchaseStatusBucket | "all" | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [saleTeamFilter, setSaleTeamFilter] = useState<SaleTeamFilter>("All");
  const [salePersonFilter, setSalePersonFilter] = useState("All");
  const [purchaseCustomerFilter, setPurchaseCustomerFilter] = useState("All");
  const [purchaseRouteFilter, setPurchaseRouteFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [openProduct, setOpenProduct] = useState("");
  const productGroups = useMemo(() => {
    const grouped = new Map<string, { key: string; productCode: string; productName: string; unit: string; quantity: number; items: PurchaseRequest[] }>();
    for (const request of requests) {
      const salePeople = (request.salesperson || request.requestedBy || "").split(",").map((name) => name.trim()).filter(Boolean);
      if (!matchesSaleTeam(salePeople, saleTeamFilter)) continue;
      if (salePersonFilter !== "All" && !salePeople.includes(salePersonFilter)) continue;
      if (purchaseCustomerFilter !== "All" && request.customerName !== purchaseCustomerFilter) continue;
      if (purchaseRouteFilter !== "All" && request.route !== purchaseRouteFilter) continue;
      const key = purchaseProductKey(request);
      const group = grouped.get(key) || { key, productCode: request.productCode, productName: request.productName, unit: request.unit || "Unit", quantity: 0, items: [] };
      group.quantity += Number(request.quantity) || 0;
      group.items.push(request);
      if (!group.productCode && request.productCode) group.productCode = request.productCode;
      grouped.set(key, group);
    }
    return [...grouped.values()].sort((a, b) => a.productName.localeCompare(b.productName));
  }, [purchaseCustomerFilter, purchaseRouteFilter, requests, salePersonFilter, saleTeamFilter]);
  const searchedProducts = useMemo(() => {
    const needle = productSearch.trim().toLocaleLowerCase();
    return productGroups.filter((group) => !needle || `${group.productCode} ${group.productName}`.toLocaleLowerCase().includes(needle));
  }, [productGroups, productSearch]);
  const summary = useMemo(() => {
    const counts: Record<PurchaseStatusBucket, number> = { pending: 0, ordered_company: 0, ordered_mglz: 0, stock_out: 0, unavailable: 0 };
    for (const group of searchedProducts) counts[purchaseGroupBucket(group.items)] += 1;
    return counts;
  }, [searchedProducts]);
  const visibleProducts = useMemo(() => {
    if (!statusFilter) return [];
    return searchedProducts.filter((group) => statusFilter === "all" || purchaseGroupBucket(group.items) === statusFilter);
  }, [searchedProducts, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(visibleProducts.length / 10));
  const safePage = Math.min(page, pageCount);
  const pageProducts = visibleProducts.slice((safePage - 1) * 10, safePage * 10);
  const statusLabel = statusFilter === "all" ? "All Status — အားလုံး" : statusFilter ? purchaseStatusLabel(statusFilter) : "";
  const filteredCustomerOptions = [...new Set(requests.map((item) => item.customerName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filteredRouteOptions = [...new Set(requests.map((item) => item.route).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  function selectStatus(status: PurchaseStatusBucket | "all") {
    setStatusFilter((current) => current === status ? null : status);
    setOpenProduct("");
    setPage(1);
  }

  function resetResultPage() {
    setPage(1);
    setOpenProduct("");
  }

  return <section className="customer-request-status sale-purchase-status">
    <div className="section-heading sale-purchase-heading"><div><h2>Purchase Product Status</h2><p>ကြည့်လိုသော Status card ကိုနှိပ်မှ Product စာရင်းဖွင့်ပါမည်</p></div></div>
    <div className="purchase-summary purchase-summary-four interactive"><button type="button" className={`all-status ${statusFilter === "all" ? "active" : ""}`} aria-pressed={statusFilter === "all"} onClick={() => selectStatus("all")}><span>All Status — အားလုံး</span><strong>{searchedProducts.length}</strong></button><button type="button" className={statusFilter === "pending" ? "active" : ""} aria-pressed={statusFilter === "pending"} onClick={() => selectStatus("pending")}><span>ဝယ်ရန် Products</span><strong>{summary.pending}</strong></button><button type="button" className={`ordered-company ${statusFilter === "ordered_company" ? "active" : ""}`} aria-pressed={statusFilter === "ordered_company"} onClick={() => selectStatus("ordered_company")}><span>မှာပြီး Company</span><strong>{summary.ordered_company}</strong></button><button type="button" className={`ordered-mglz ${statusFilter === "ordered_mglz" ? "active" : ""}`} aria-pressed={statusFilter === "ordered_mglz"} onClick={() => selectStatus("ordered_mglz")}><span>မှာပြီး MGLZ</span><strong>{summary.ordered_mglz}</strong></button><button type="button" className={`unavailable ${statusFilter === "unavailable" ? "active" : ""}`} aria-pressed={statusFilter === "unavailable"} onClick={() => selectStatus("unavailable")}><span>မရပါ</span><strong>{summary.unavailable}</strong></button><button type="button" className={`stock-out ${statusFilter === "stock_out" ? "active" : ""}`} onClick={() => selectStatus("stock_out")}><span>ပစ္စည်းပြတ်</span><strong>{summary.stock_out}</strong></button></div>
    {!statusFilter && <button type="button" className="sale-purchase-closed" onClick={() => selectStatus("pending")}><ShoppingCart size={16} /><span>Product စာရင်းကြည့်ရန် အပေါ်က Card ကိုနှိပ်ပါ</span><ChevronRight size={16} /></button>}
    {statusFilter && <div className="sale-purchase-results">
      <div className="sale-purchase-filter-label"><span>{statusLabel} Products</span><b>{visibleProducts.length}</b></div>
      <div className="sale-purchase-tools"><label className="sale-purchase-search"><Search size={16} /><input value={productSearch} onChange={(event) => { setProductSearch(event.target.value); resetResultPage(); }} placeholder="Code / Product Name ရှာရန်" /></label><div className="sale-purchase-filter-grid"><label><span>Status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as PurchaseStatusBucket | "all"); resetResultPage(); }}><option value="all">All Status — အားလုံး</option>{(["pending", "ordered_company", "ordered_mglz", "unavailable", "stock_out"] as PurchaseStatusBucket[]).map((status) => <option key={status} value={status}>{purchaseStatusLabel(status)}</option>)}</select></label><label><span>Sale Team</span><select value={saleTeamFilter} onChange={(event) => { const team = event.target.value as SaleTeamFilter; setSaleTeamFilter(team); if (team !== "All" && !SALE_TEAM_MEMBERS[team].includes(salePersonFilter)) setSalePersonFilter("All"); resetResultPage(); }}><option value="All">All Sale Teams</option><option value="A">Sale Team A</option><option value="B">Sale Team B</option></select></label><label><span>Sale Men</span><select value={salePersonFilter} onChange={(event) => { setSalePersonFilter(event.target.value); resetResultPage(); }}><option value="All">All Sale Men</option>{salePeopleForTeam(saleTeamFilter).map((person) => <option value={person} key={person}>{person}</option>)}</select></label><label><span>Customer</span><select value={purchaseCustomerFilter} onChange={(event) => { setPurchaseCustomerFilter(event.target.value); resetResultPage(); }}><option value="All">All Customers</option>{filteredCustomerOptions.map((customer) => <option value={customer} key={customer}>{customer}</option>)}</select></label><label><span>Route</span><select value={purchaseRouteFilter} onChange={(event) => { setPurchaseRouteFilter(event.target.value); resetResultPage(); }}><option value="All">All Routes</option>{filteredRouteOptions.map((route) => <option value={route} key={route}>{route}</option>)}</select></label><button type="button" onClick={() => { setProductSearch(""); setSaleTeamFilter("All"); setSalePersonFilter("All"); setPurchaseCustomerFilter("All"); setPurchaseRouteFilter("All"); resetResultPage(); }}>Clear Filters</button></div></div>
      {!loading && visibleProducts.length > 10 && <WarehousePagination page={safePage} pageCount={pageCount} total={visibleProducts.length} noun="Products" onChange={(nextPage) => { setPage(nextPage); setOpenProduct(""); }} />}
      <div className="purchase-product-list sale-purchase-product-list">{loading ? <Loading /> : visibleProducts.length === 0 ? <div className="empty-state"><span><ShoppingCart /></span><h3>{statusLabel} Product မတွေ့ပါ</h3><p>Search သို့မဟုတ် Sale Team / Sale Men / Customer / Route Filter ကို ပြန်စစ်ပါ။</p></div> : <>{pageProducts.map((group) => {
      const orderedCompanyCount = group.items.filter((item) => purchaseStatusBucket(item.status) === "ordered_company").length;
      const orderedMglzCount = group.items.filter((item) => purchaseStatusBucket(item.status) === "ordered_mglz").length;
      const unavailableCount = group.items.filter((item) => purchaseStatusBucket(item.status) === "unavailable").length;
      const groupStatus = group.items.some((item) => purchaseStatusBucket(item.status) === "pending") ? "pending" : orderedCompanyCount === group.items.length ? "ordered_company" : orderedMglzCount === group.items.length ? "ordered_mglz" : group.items.every((item) => purchaseStatusBucket(item.status) === "stock_out") ? "stock_out" : unavailableCount === group.items.length ? "unavailable" : "mixed";
      const groupStatusText = groupStatus === "mixed" ? "Mixed" : purchaseStatusLabel(groupStatus);
      const sourceCount = new Set(group.items.map((item) => item.orderId > 0 ? `order-${item.orderId}` : `${item.sourceType}-${item.id}`)).size;
      const arrivalState = purchaseGroupArrivalState(group.items);
      const isOpen = openProduct === group.key;
      return <article className={`purchase-product-row ${groupStatus} arrival-${arrivalState} ${isOpen ? "open" : ""}`} key={group.key}>
        <button className="purchase-product-main" type="button" onClick={() => setOpenProduct(isOpen ? "" : group.key)} aria-expanded={isOpen}>
          <span className="purchase-product-code">{group.productCode || "—"}</span><span className="purchase-product-name"><strong>{group.productName}</strong><small>{sourceCount} source {sourceCount === 1 ? "order" : "orders"} • နှိပ်၍အသေးစိတ်ကြည့်ရန်</small></span><b className="purchase-product-qty">{group.quantity}</b><span className="purchase-product-unit">{group.unit}</span><span className="purchase-status-stack"><span className={`purchase-product-status ${groupStatus}`}>{groupStatusText}</span><PurchaseArrivalBadge state={arrivalState} /></span><ChevronRight className={isOpen ? "open" : ""} size={17} />
        </button>
        {isOpen && <div className="purchase-product-detail sale-purchase-detail"><PurchaseArrivalSummary items={group.items} state={arrivalState} /><div className="purchase-source-list"><strong>Related Orders / Customers</strong>{group.items.map((item) => <div key={`${item.sourceType}-${item.id}`}><span><b>{item.orderNo || "Customer Request"}</b><small>{item.customerName} • {item.township}{item.salesperson ? ` • ${item.salesperson}` : ""}{item.route ? ` • ${item.route}` : ""}</small></span><b>{item.quantity} {item.unit || group.unit} • {purchaseStatusLabel(purchaseStatusBucket(item.status))}<PurchaseArrivalBadge state={item.arrivalStatus || "none"} /></b></div>)}</div>{group.items.some((item) => item.supplierName) && <p className="sale-purchase-supplier"><ShoppingCart size={15} />Supplier: <b>{[...new Set(group.items.map((item) => item.supplierName).filter(Boolean))].join(", ")}</b></p>}</div>}
      </article>;
    })}</>}</div>
      {!loading && visibleProducts.length > 10 && <WarehousePagination page={safePage} pageCount={pageCount} total={visibleProducts.length} noun="Products" onChange={(nextPage) => { setPage(nextPage); setOpenProduct(""); }} />}
    </div>}
  </section>;
}

function SalesProgressChart({ orders }: { orders: Order[] }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const data = useMemo(() => {
    const today = new Date(`${todayLocal()}T00:00:00Z`);
    const bucketSize = days === 90 ? 7 : days === 30 ? 3 : 1;
    const bucketCount = Math.ceil(days / bucketSize);
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const startOffset = days - (index + 1) * bucketSize;
      const endOffset = days - index * bucketSize - 1;
      const start = new Date(today); start.setUTCDate(today.getUTCDate() - Math.max(0, endOffset));
      const end = new Date(today); end.setUTCDate(today.getUTCDate() - Math.max(0, startOffset));
      return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), order: 0, voucher: 0 };
    });
    for (const order of orders) {
      const bucket = buckets.find((item) => order.orderDate >= item.start && order.orderDate <= item.end);
      if (bucket) { bucket.order += order.orderAmount; bucket.voucher += order.voucherAmount; }
    }
    const currentStart = new Date(today); currentStart.setUTCDate(today.getUTCDate() - days + 1);
    const previousStart = new Date(currentStart); previousStart.setUTCDate(currentStart.getUTCDate() - days);
    const previousEnd = new Date(currentStart); previousEnd.setUTCDate(currentStart.getUTCDate() - 1);
    const currentTotal = orders.filter((order) => order.orderDate >= currentStart.toISOString().slice(0, 10) && order.orderDate <= today.toISOString().slice(0, 10)).reduce((sum, order) => sum + order.voucherAmount, 0);
    const previousTotal = orders.filter((order) => order.orderDate >= previousStart.toISOString().slice(0, 10) && order.orderDate <= previousEnd.toISOString().slice(0, 10)).reduce((sum, order) => sum + order.voucherAmount, 0);
    const max = Math.max(1, ...buckets.flatMap((item) => [item.order, item.voucher]));
    const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : currentTotal > 0 ? 100 : 0;
    return { buckets, max, currentTotal, growth };
  }, [days, orders]);
  return <section className="sales-progress"><div className="sales-progress-head"><div><strong>Sales Progress</strong><small>Sale Order နှင့် Sale Voucher တိုးတက်မှု နှိုင်းယှဉ်ချက်</small></div><div>{([7, 30, 90] as const).map((value) => <button className={days === value ? "active" : ""} onClick={() => setDays(value)} key={value}>{value === 7 ? "1 Week" : value === 30 ? "1 Month" : "3 Months"}</button>)}</div></div><div className="sales-progress-summary"><span><small>Sale VR Total</small><strong>{money(data.currentTotal)} MMK</strong></span><b className={data.growth < 0 ? "negative" : "positive"}>{data.growth >= 0 ? "+" : ""}{data.growth.toFixed(1)}%</b></div><div className="sales-chart" aria-label="Sales progress chart">{data.buckets.map((item) => <div className="sales-chart-column" key={item.start}><span className="bars"><i style={{ height: `${Math.max(3, (item.order / data.max) * 100)}%` }} title={`Order ${money(item.order)}`} /><b style={{ height: `${Math.max(3, (item.voucher / data.max) * 100)}%` }} title={`Voucher ${money(item.voucher)}`} /></span><small>{item.start.slice(5)}</small></div>)}</div><div className="sales-chart-legend"><span><i />Sale Order</span><span><i />Sale Voucher</span></div></section>;
}

function AuditLogPanel({ logs }: { logs: AuditLog[] }) {
  return <section className="audit-panel"><div className="audit-head"><div><ShieldCheck size={18} /><span><strong>Audit Log</strong><small>System updates အားလုံး၏ နောက်ဆုံးမှတ်တမ်း</small></span></div><b>{logs.length}</b></div><div className="audit-list">{logs.length === 0 ? <p>Update မှတ်တမ်း မရှိသေးပါ</p> : logs.slice(0, 30).map((log) => <article key={log.id}><span className="audit-dot" /><div><strong>{log.summary}</strong><small>{log.actorName || "System"} • {roleLabel[log.actorRole as AppRole] || log.actorRole || "System"}</small></div><time>{notificationTime(log.createdAt)}</time></article>)}</div></section>;
}

function WarehousePagination({ page, pageCount, total, noun = "Orders", onChange }: { page: number; pageCount: number; total: number; noun?: string; onChange: (page: number) => void }) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1).filter((value) => value === 1 || value === pageCount || Math.abs(value - page) <= 1);
  return <nav className="warehouse-pagination" aria-label={`${noun} pages`}><span>Page <b>{page}</b> / {pageCount} • {total} {noun}</span><div><button disabled={page === 1} onClick={() => onChange(page - 1)}>‹</button>{pages.map((value, index) => <span key={value}>{index > 0 && value - pages[index - 1] > 1 && <i>…</i>}<button className={value === page ? "active" : ""} onClick={() => onChange(value)}>{value}</button></span>)}<button disabled={page === pageCount} onClick={() => onChange(page + 1)}>›</button></div></nav>;
}

function OrderProductReviewTable({ order, canReturnSubstitution = false, busy = false, onReturnSubstitution }: { order: Order; canReturnSubstitution?: boolean; busy?: boolean; onReturnSubstitution?: (itemId: number, reason: string) => void | Promise<void> }) {
  const rows = [...(order.orderItems || [])].sort((a, b) => a.batchSequence - b.batchSequence || a.originalRowNumber - b.originalRowNumber || a.id - b.id);
  const [returnReasons, setReturnReasons] = useState<Record<number, string>>({});
  const confirmedSubstitutions = rows.filter((item) => item.substitutionStatus === "confirmed" && item.substituteProductCode);
  if (rows.length === 0) return null;
  return <section className="detail-section order-product-review">
    <div className="order-product-review-head"><div><h3><ClipboardList size={18} />Sale Order Products</h3><p>မူလ Excel Row အစဉ်မပြောင်းဘဲ Ordered Qty နှင့် Warehouse Qty ကို နှိုင်းယှဉ်ပြထားသည်။</p></div><span>{order.warehouseStatus === "finished" ? "Warehouse Completed" : order.warehouseStatus === "picked" ? "Picked • Checking" : order.warehouseBatches.some((batch) => batch.status === "picking") ? "Processing • Picking" : "Warehouse Processing"}</span></div>
    <div className="order-product-review-legend"><span className="changed">Quantity ပြောင်းထား</span><span className="unavailable">Unavailable</span><span className="substitute">Similar Product</span></div>
    <div className="order-product-review-table"><div className="head"><span>No.</span><span className="code">Code</span><span>Product</span><span>Ordered</span><span>Actual</span><span>Result</span></div>{rows.map((item) => { const orderedUnit = displayUnit(item.originalUnit); const actualUnit = displayUnit(item.checkedUnit || item.originalUnit); const processed = item.checkedQuantity >= 0 || item.fulfillmentStatus !== "pending"; const actualQuantity = item.checkedQuantity >= 0 ? item.checkedQuantity : item.pickedQuantity; const unavailable = item.matchStatus === "unavailable"; const stockOut = processed && actualQuantity === 0 && !unavailable; const changed = processed && !unavailable && !stockOut && (actualQuantity !== item.quantity || actualUnit !== orderedUnit); const result = unavailable ? "Unavailable" : stockOut ? "Stock Out" : changed ? "Qty / Unit Changed" : item.fulfillmentStatus === "shortage" ? "Shortage" : item.fulfillmentStatus === "picked" ? "Picked" : "Pending"; const hasSubstitute = item.substitutionStatus !== "none" && item.substituteProductCode; return <Fragment key={item.id}><div className={unavailable || stockOut ? "unavailable" : changed ? "changed" : ""}><b>{order.warehouseBatches.length > 1 ? `${item.batchSequence}.${item.originalRowNumber}` : item.originalRowNumber}</b><span className="code">{item.originalProductCode || "—"}</span><strong><small>{item.originalProductCode || "No Code"}</small><span>{item.originalDescription}</span>{item.matchedProductName && item.matchedProductName !== item.originalDescription && <em>Matched: {item.matchedProductName}</em>}</strong><span><b>{item.originalQuantity}</b>{orderedUnit ? ` ${orderedUnit}` : ""}</span><span><b>{processed ? actualQuantity : "—"}</b>{processed && actualUnit ? ` ${actualUnit}` : ""}</span><span className="result">{result}</span></div>{hasSubstitute && <div className={`substitute-row ${item.substitutionStatus}`}><b>↳</b><span className="code">{item.substituteProductCode}</span><strong><small>{item.substituteProductCode}</small><span>{item.substituteProductName}</span><em>{item.substituteSku ? `SKU ${item.substituteSku} • ` : ""}{money(item.substituteSalePrice)} MMK • {item.substitutionReason}</em></strong><span><b>—</b></span><span><b>{item.substituteQuantity}</b>{actualUnit ? ` ${actualUnit}` : ""}</span><span className="result">{item.substitutionStatus === "confirmed" ? "Substitute" : item.substitutionStatus === "returned" ? "Returned" : "Checker Pending"}</span></div>}</Fragment>; })}</div>
    {canReturnSubstitution && confirmedSubstitutions.length > 0 && <div className="salesman-substitution-review"><div><strong>Similar Product Review</strong><small>Approve for Delivery မလုပ်ခင် မသင့်တော်သော Similar Product ကို Warehouse သို့ ပြန်ပို့နိုင်ပါသည်။</small></div>{confirmedSubstitutions.map((item) => <article key={`return-${item.id}`}><div><b>{item.originalDescription}</b><span>→</span><strong>{item.substituteProductName} • {item.substituteQuantity} {displayUnit(item.originalUnit)}</strong></div><label><span>Return Reason</span><input placeholder="Warehouse သို့ ပြန်ပို့ရသည့်အကြောင်းရင်း" value={returnReasons[item.id] || ""} onChange={(event) => setReturnReasons((current) => ({ ...current, [item.id]: event.target.value }))} /></label><button type="button" disabled={busy || !(returnReasons[item.id] || "").trim()} onClick={() => void onReturnSubstitution?.(item.id, (returnReasons[item.id] || "").trim())}><RefreshCw size={15} />Return Substitute to Warehouse</button></article>)}</div>}
  </section>;
}

function WarehouseOrderListRow({ order, canStartPicking, onStartPicking, onOpen }: { order: Order; canStartPicking: boolean; onStartPicking: () => void; onOpen: () => void }) {
  const t = totals(order);
  const pendingBatches = order.warehouseBatches.filter((batch) => batch.status !== "finished").length;
  const activePicking = order.warehouseBatches.find((batch) => batch.status === "picking");
  const canStart = canStartPicking && order.warehouseStatus === "processing" && !activePicking && order.warehouseBatches.some((batch) => batch.status === "pending");
  const correctionPending = (order.orderItems || []).some((item) => item.substitutionStatus === "returned");
  const statusText = correctionPending ? "Correction Pending" : order.warehouseStatus === "finished" ? "Finished" : order.warehouseStatus === "picked" ? "Picked" : activePicking ? "Picking လုပ်နေပါပြီ" : "Processing";
  const statusHint = correctionPending ? "Salesman Returned" : order.warehouseStatus === "finished" ? "Warehouse" : order.warehouseStatus === "picked" ? "Checker စစ်ရန်" : activePicking ? `${activePicking.pickingStartedBy || "Warehouse"} • ${activePicking.pickingStartedAt ? notificationTime(activePicking.pickingStartedAt) : "ယခု"}` : `${pendingBatches} Pending`;
  return <div className={`warehouse-list-row-wrap ${activePicking ? "is-picking" : ""}`}><button className="warehouse-list-row" onClick={onOpen}><span className={`warehouse-row-icon ${order.warehouseStatus}`}><Box size={17} /></span><span className="warehouse-row-customer"><strong>{order.customerName}</strong><small>{order.township} • {order.orderNo}</small></span><span><small>Sale Man</small><b>{assignedSalePeople(order)}</b></span><span><small>Route</small><b>{order.route}</b></span><span><small>Sale Orders</small><b>{order.saleOrderCount || 1}</b></span><span><small>Packages</small><b>{t.total}</b></span><span className={`warehouse-row-status ${order.warehouseStatus} ${activePicking ? "picking" : ""}`}><small>{statusHint}</small><b>{statusText}</b></span><ChevronRight size={18} /></button>{canStart && <button type="button" className="start-picking-button" onClick={onStartPicking}><Box size={16} /><span>Picking စတင်လုပ်နေပါပြီ</span></button>}</div>;
}

function OrderListRow({ order, previousBalance, latestPaymentDate, onOpen }: { order: Order; previousBalance: number; latestPaymentDate: string; onOpen: () => void }) {
  const t = totals(order);
  void previousBalance;
  void latestPaymentDate;
  return <button className="order-list-row compact" onClick={onOpen}><span className="order-list-customer"><strong>{order.customerName}</strong></span><span className="order-list-packages"><b>{t.boxes}</b><small>ဘုံး</small><i>•</i><b>{t.bundles}</b><small>ဆွဲ</small></span><ChevronRight size={18} /></button>;
}

function OrderCard({ order, previousBalance, latestPaymentDate, onOpen }: { order: Order; previousBalance: number; latestPaymentDate: string; onOpen: () => void }) {
  const t = totals(order);
  const processing = order.warehouseStatus !== "finished";
  const totalAmount = previousBalance + order.voucherAmount;
  const paymentState = order.paidAmount <= 0 ? "unpaid" : order.paidAmount >= order.voucherAmount ? "paid" : "partial";
  const paymentStateText = paymentState === "paid" ? "ငွေဝင်ပြီး" : paymentState === "partial" ? "ငွေတစ်စိတ်တစ်ပိုင်းဝင်" : "ငွေမဝင်သေး";
  return <button className={`order-card ${processing ? "warehouse-processing" : ""}`} onClick={onOpen}>
    <div className="order-card-top"><div><strong>{order.customerName}</strong><span>{order.township} • {order.route}</span><span>{order.orderNo} • {order.saleOrderCount || 1} Sale Order</span><span>Sale Man: {assignedSalePeople(order)}</span></div><span className={`status-badge ${processing ? "processing" : order.dispatchStatus}`}>{order.warehouseStatus === "picked" ? "Picked • Checker စစ်ရန်" : processing ? "Processing" : statusLabel[order.dispatchStatus]}</span></div>
    <div className="order-time-row"><span><Clock3 size={13} /><i>Sale Order စဖွင့်ချိန်</i><b>{notificationTime(order.createdAt)}</b></span><span className={order.warehouseStatus === "finished" ? "finished" : "pending"}><CheckCircle2 size={13} /><i>Warehouse Finished</i><b>{order.warehouseStatus === "finished" && order.warehouseConfirmedAt ? notificationTime(order.warehouseConfirmedAt) : "စောင့်နေသည်"}</b></span></div>
    {(order.packageInstruction || order.remark) && <div className="order-instructions">{order.packageInstruction && <span><Box size={14} /><i>Package</i><b>{order.packageInstruction}</b></span>}{order.remark && <span><ClipboardList size={14} /><i>Additional Remark</i><b>{order.remark}</b></span>}</div>}
    {order.addonPending && <div className="addon-chip">နောက်တိုး Sale Order ရှိသည် • စုစုပေါင်း {order.saleOrderCount} Orders</div>}
    {!processing && order.voucherStatus === "pending" && <div className="voucher-chip">Warehouse Finished • Sale Voucher Amount ဖြည့်ရန်</div>}
    {["out_for_delivery", "partial"].includes(order.dispatchStatus) ? <div className="delivery-ready-chip"><Truck size={15} />Delivery စတင်ပြီး • On the Way</div> : order.saleApproved && order.dispatchStatus !== "delivered" && <div className="delivery-ready-chip"><CheckCircle2 size={15} />Sale Team Approved • Delivery Ready</div>}
    {order.dispatchStatus === "delivered" && <div className="delivered-date-chip"><CheckCircle2 size={15} /><span>ပို့ပြီးရက်</span><strong>{deliveredDate(order.deliveredAt || order.updatedAt)}</strong></div>}
    {order.deliveryProofKey && <div className="delivery-proof-chip"><Camera size={14} />ကားဂိတ် / ငွေသိမ်းဘောင်ချာ တင်ပြီး</div>}
    {!processing && order.voucherStatus === "updated" && !order.saleApproved && <div className="approval-pending-chip"><Clock3 size={15} />Sale Team Approval စောင့်နေသည်</div>}
    {order.voucherStatus === "updated" && <div className="order-finance-row"><span><i>Sale VR Amount</i><b>{money(order.voucherAmount)}</b><small>MMK</small></span><span><i>ယခင်လက်ကျန်</i><b>{money(previousBalance)}</b><small>MMK</small></span><span className="total"><i>Total Amount</i><b>{money(totalAmount)}</b><small>MMK</small></span></div>}
    {order.voucherStatus === "updated" && <div className={`order-payment-status ${paymentState}`}><span className="payment-state"><Banknote size={15} /><strong>{paymentStateText}</strong></span><span><small>ဝင်ပြီး Amount</small><b>{money(order.paidAmount)} MMK</b></span><span><small>နောက်ဆုံးငွေဝင်ရက်</small><b>{latestPaymentDate ? deliveredDate(latestPaymentDate) : "—"}</b></span></div>}
    {processing ? <div className="warehouse-placeholder"><Clock3 size={16} />{order.warehouseStatus === "picked" ? "Picker ပြီး • Checker စစ်ရန်" : "Warehouse Pickup လုပ်ဆောင်နေသည်"}</div> : <div className="package-row"><span><b>{t.boxes}</b> ဘုံး</span><span><b>{t.bundles}</b> ဆွဲ</span><span><b>{t.total}</b> Total</span><span className="remaining"><b>{t.remaining}</b> ကျန်</span></div>}
  </button>;
}

function AddOrderModal({ customers, products, orders, date, prefill, onClose, onCreated }: { customers: CustomerDirectoryItem[]; products: MasterProduct[]; orders: Order[]; date: string; prefill?: SalesOrderPrefill | null; onClose: () => void; onCreated: (order: Order, merged: boolean) => void }) {
  type ImportedRow = { rowNumber: number; productCode: string; description: string; quantity: string; unit: string };
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [excelMeta, setExcelMeta] = useState({ invoiceNo: "", customerName: "" });
  const [orderItems, setOrderItems] = useState<ImportedRow[]>([]);
  const [productPickerKey, setProductPickerKey] = useState(0);
  const [form, setForm] = useState({ orderDate: date, customerName: prefill?.customerName || "", township: prefill?.township || "", salesperson: prefill?.salesperson || SALE_PEOPLE[0], route: prefill?.route || ROUTES[0], orderAmount: prefill?.orderAmount || "", packageInstruction: "အဆင်ပြေသလိုထည့်ပေးပါ", orderRelation: "separate", originalOrderId: "", remark: prefill ? `${prefill.sourceType === "follow_up" ? "Follow Up Call" : "Sale Route Call"} မှ ဖန်တီးထားသည်` : "" });
  const [customerSearch, setCustomerSearch] = useState(prefill?.customerName || "");
  const [customerOpen, setCustomerOpen] = useState(false);
  const customerMatches = useMemo(() => {
    const needle = customerSearch.toLocaleLowerCase().trim();
    if (!needle) return customers.slice(0, 12);
    return customers.filter((customer) => `${customer.name} ${customer.township}`.toLocaleLowerCase().includes(needle)).slice(0, 15);
  }, [customerSearch, customers]);
  const selectedCustomer = customers.find((customer) => customer.name === form.customerName && customer.township === form.township);
  const matchingCustomerOrders = useMemo(() => orders.filter((order) => selectedCustomer?.customerKey
    ? order.customerKey === selectedCustomer.customerKey
    : order.customerName.trim().toLocaleLowerCase() === form.customerName.trim().toLocaleLowerCase() && order.township.trim().toLocaleLowerCase() === form.township.trim().toLocaleLowerCase()), [form.customerName, form.township, orders, selectedCustomer?.customerKey]);
  const addonEligibleOrders = useMemo(() => matchingCustomerOrders
    .filter((order) => order.route === form.route
      && order.saleApproved
      && order.warehouseStatus === "finished"
      && ["packed", "rescheduled"].includes(order.dispatchStatus)
      && order.warehouseBatches.some((batch) => batch.status === "finished" && (batch.packageMode === "original" || batch.boxes + batch.bundles > 0)))
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.id - a.id), [matchingCustomerOrders, form.route]);
  const orderAmount = 0;

  function addMasterProduct(product: MasterProduct) {
    setOrderItems((current) => [...current, { rowNumber: Math.max(1, ...current.map((row) => row.rowNumber)) + 1, productCode: product.productCode, description: product.productName, quantity: "1", unit: "" }]);
    setProductPickerKey((current) => current + 1);
  }

  function addManualProductRow() {
    setOrderItems((current) => [...current, { rowNumber: Math.max(1, ...current.map((row) => row.rowNumber)) + 1, productCode: "", description: "", quantity: "1", unit: "" }]);
  }

  function updateOrderItem(index: number, field: keyof ImportedRow, value: string) {
    setOrderItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  async function readExcel(file: File | null) {
    if (!file) return;
    setParsing(true); setError(""); setFileName(""); setExcelMeta({ invoiceNo: "", customerName: "" }); setOrderItems([]);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, { header: 1, raw: false, defval: "" });
      const normalizedRows = rows.map((row) => row.map((cell) => String(cell).toLocaleLowerCase().replace(/[^a-z0-9]/g, "")));
      const headerIndex = normalizedRows.findIndex((row) => row.some((cell) => ["code", "productcode", "itemcode"].includes(cell)) && row.some((cell) => ["description", "productname", "itemname", "product"].includes(cell)) && row.some((cell) => ["qty", "quantity", "orderqty"].includes(cell)));
      if (headerIndex < 0) throw new Error("Excel file အလွတ်ဖြစ်နေပါသည်");
      const headers = normalizedRows[headerIndex];
      const findColumn = (...names: string[]) => headers.findIndex((header) => names.includes(header));
      const codeCol = findColumn("code", "productcode", "itemcode");
      const descriptionCol = findColumn("description", "productname", "itemname", "product");
      const qtyCol = findColumn("qty", "quantity", "orderqty");
      const priceCol = findColumn("saleprice", "price", "unitprice");
      const explicitUnitCol = findColumn("unit", "uom");
      const inferredUnitCol = explicitUnitCol < 0 && qtyCol >= 0 && priceCol > qtyCol + 1 ? qtyCol + 1 : -1;
      const unitCol = explicitUnitCol >= 0 ? explicitUnitCol : inferredUnitCol;
      const amountCol = findColumn("amount", "totalamount");
      if (descriptionCol < 0 || qtyCol < 0) throw new Error("Excel Header မှာ Description/Product Name နှင့် Qty/Quantity လိုအပ်ပါသည်");
      const parsed: ImportedRow[] = [];
      for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const values = row.map((cell) => String(cell ?? "").trim());
        const summaryLabel = `${values[codeCol] || ""} ${values[descriptionCol] || ""}`.toLocaleLowerCase();
        if (["invoice total", "net total", "total amount"].some((label) => summaryLabel.includes(label))) break;
        const description = values[descriptionCol] || "";
        const productCode = codeCol >= 0 ? values[codeCol] || "" : "";
        if (!description && !productCode && values.every((value) => !value)) continue;
        const quantity = values[qtyCol] || "";
        if (!description || !quantity || Number(quantity.replaceAll(",", "")) <= 0) throw new Error(`Excel Row ${rowIndex + 1}: Description နှင့် Qty ကို စစ်ပါ`);
        parsed.push({ rowNumber: rowIndex + 1, productCode, description, quantity, unit: unitCol >= 0 ? values[unitCol] || "" : "" });
      }
      if (!parsed.length) throw new Error("Excel file ထဲတွင် Product Row မတွေ့ပါ");
      const metaRow = rows[Math.max(0, headerIndex - 1)] || [];
      setExcelMeta({ invoiceNo: codeCol >= 0 ? String(metaRow[codeCol] || "").trim() : "", customerName: amountCol >= 0 ? String(metaRow[amountCol + 1] || "").trim() : "" });
      setOrderItems(parsed); setFileName(file.name);
    } catch (err) { setError(err instanceof Error ? err.message : "Excel file ဖတ်မရပါ"); }
    finally { setParsing(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.customerName || !form.township) return setError("Customers Database ထဲက Customer ကို ရွေးချယ်ပါ");
    if (!orderItems.length) return setError("Sale Order Excel file ကို Upload လုပ်ပါ");
    if (form.orderRelation === "addon" && !form.originalOrderId) return setError("နောက်တိုး Order အတွက် Original Order ကို ရွေးပါ");
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, orderAmount, orderItems }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed");
      onCreated(data.order, data.merged);
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><section className="sheet sale-order-v2-sheet" onMouseDown={(event) => event.stopPropagation()}>
    <div className="sheet-handle" /><div className="sheet-title"><div><p className="eyebrow">NAWARATT WORKFLOW V2</p><h2>Sale Order • Excel Upload</h2><small>Customer ရွေးပြီး Excel တင်ပါ — အခြား Customer အချက်အလက်များ Auto ဖြည့်ပါမည်</small></div><button onClick={onClose}><X /></button></div>
    <form onSubmit={submit} className="order-form sale-order-v2-form">
      <label className="customer-picker"><span>1. Customer ရွေးရန်</span><div className={form.customerName ? "customer-search selected" : "customer-search"}><Search size={17} /><input autoFocus required placeholder="Customer Name သို့မဟုတ် Township ရှာရန်" value={customerSearch} onFocus={() => setCustomerOpen(true)} onChange={(e) => { setCustomerSearch(e.target.value); setForm({ ...form, customerName: "", township: "", orderRelation: "separate", originalOrderId: "" }); setCustomerOpen(true); }} />{form.customerName && <CheckCircle2 size={17} className="selected-check" />}</div>{customerOpen && <div className="customer-options">{customerMatches.length === 0 ? <p>Customer မတွေ့ပါ</p> : customerMatches.map((customer) => <button type="button" key={`${customer.name}-${customer.township}`} onClick={() => { setForm({ ...form, customerName: customer.name, township: customer.township, route: customer.route || ROUTES[0], salesperson: customer.salesperson || SALE_PEOPLE[0], orderRelation: "separate", originalOrderId: "" }); setCustomerSearch(customer.name); setCustomerOpen(false); }}><strong>{customer.name}</strong><small>{customer.township}</small></button>)}</div>}</label>
      {selectedCustomer && <div className="v2-customer-auto"><div><span>Customer</span><strong>{selectedCustomer.name}</strong></div><div><span>Township</span><strong>{selectedCustomer.township}</strong></div><label className="editable"><span>Sale Man • ပြင်နိုင်သည်</span><select aria-label="Sale Man" required value={form.salesperson} onChange={(event) => setForm({ ...form, salesperson: event.target.value })}>{SALE_PEOPLE.map((person) => <option value={person} key={person}>{person}</option>)}</select></label><label className="editable"><span>Route • ပြင်နိုင်သည်</span><select aria-label="Route" required value={form.route} onChange={(event) => setForm({ ...form, route: event.target.value, orderRelation: "separate", originalOrderId: "" })}>{ROUTES.map((route) => <option value={route} key={route}>{route}</option>)}</select></label>{selectedCustomer.phone && <div><span>Phone</span><strong>{selectedCustomer.phone}</strong></div>}{selectedCustomer.address && <div className="wide"><span>Address</span><strong>{selectedCustomer.address}</strong></div>}<small className="v2-order-meta-help">ရွေးထားသော Sale Man နှင့် Route ကို ဒီ Order တစ်စောင်အတွက်သာ သိမ်းပါမည်။ Customer Database မပြောင်းပါ။</small></div>}
      <label className="v2-excel-upload"><span>2. Sale Order Excel Upload</span><input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void readExcel(event.target.files?.[0] || null)} /><div><Upload size={20} /><strong>{parsing ? "Excel ဖတ်နေသည်…" : fileName || "Excel file ရွေးရန်"}</strong><small>Code • Product Name • Qty • Unit</small></div></label>
      {excelMeta.invoiceNo && <div className="excel-source-meta"><span>Excel Invoice</span><strong>{excelMeta.invoiceNo}</strong>{excelMeta.customerName && <><span>Excel Customer</span><strong className={form.customerName && excelMeta.customerName.toLocaleLowerCase() !== form.customerName.toLocaleLowerCase() ? "mismatch" : ""}>{excelMeta.customerName}</strong></>}</div>}
      <div className="sale-product-add"><div><span>3. Product တစ်မျိုးချင်း ထပ်ထည့်ရန်</span><button type="button" onClick={addManualProductRow}><Plus size={15} />Manual Row</button></div><ProductSearchSelect key={productPickerKey} products={products} onSelect={addMasterProduct} /></div>
      {orderItems.length > 0 && <div className="v2-excel-preview"><div className="v2-preview-head"><span><CheckCircle2 size={16} />Product List • Table ထဲတွင် တိုက်ရိုက်ပြင်နိုင်သည်</span><b>{orderItems.length} Products</b></div><div className="v2-preview-table editable"><div className="head"><span>No.</span><span>Code</span><span>Product Name</span><span>Qty</span><span>Unit</span><span /></div>{orderItems.map((row, index) => <div key={`${row.rowNumber}-${index}`}><b>{index + 1}</b><input aria-label="Product Code" value={row.productCode} onChange={(event) => updateOrderItem(index, "productCode", event.target.value)} /><input aria-label="Product Name" value={row.description} onChange={(event) => updateOrderItem(index, "description", event.target.value)} /><input aria-label="Quantity" type="number" min="1" value={row.quantity} onChange={(event) => updateOrderItem(index, "quantity", event.target.value)} /><input aria-label="Unit" value={row.unit} onChange={(event) => updateOrderItem(index, "unit", event.target.value)} /><button type="button" aria-label="Product Row ဖျက်ရန်" onClick={() => setOrderItems((current) => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={15} /></button></div>)}</div><p className="v2-unknown-policy">Product Master ထဲမတွေ့သော Product Rows ကို မဖျက်ဘဲ Unknown အဖြစ် Warehouse Verification သို့ပို့ပါမည်။ Resolve မလုပ်မချင်း Picking ပိတ်ထားပါမည်။</p></div>}
      {form.customerName && addonEligibleOrders.length > 0 && <fieldset className="addon-package-choice order-relation-choice"><legend>ဒီ Customer အတွက် Order အမျိုးအစား</legend><label><input type="radio" name="orderRelation" value="separate" checked={form.orderRelation === "separate"} onChange={() => setForm({ ...form, orderRelation: "separate", originalOrderId: "" })} /><span><b>Separate Order</b><small>သီးခြား Sale Order အသစ်</small></span></label><label><input type="radio" name="orderRelation" value="addon" checked={form.orderRelation === "addon"} onChange={() => setForm({ ...form, orderRelation: "addon", originalOrderId: String(addonEligibleOrders[0]?.id || "") })} /><span><b>နောက်တိုး Order</b><small>Delivery Approved • ပို့ရန်ကျန် Original Order နှင့် ချိတ်ထားမည်</small></span></label>{form.orderRelation === "addon" && <label className="addon-original-select"><span><b>Original Order</b><select required value={form.originalOrderId} onChange={(event) => setForm({ ...form, originalOrderId: event.target.value })}>{addonEligibleOrders.map((order, index) => <option value={order.id} key={order.id}>{index === 0 ? "အနီးဆုံး • " : ""}{order.orderNo} • {order.orderDate} • Package {totals(order).total}</option>)}</select><small>မူလ Package ထဲပေါင်းလျှင် Package Count မတိုးပါ</small></span></label>}</fieldset>}
      {error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={saving || parsing || !form.customerName || !orderItems.length}>{saving ? "Order တင်နေသည်…" : `Pending Order တင်မည် • ${orderItems.length || 0} Products`}</button>
    </form>
  </section></div>;
}

function CustomerRequestModal({ customers, date, onClose, onCreated }: { customers: CustomerDirectoryItem[]; date: string; onClose: () => void; onCreated: (requests: PurchaseRequest[]) => void }) {
  type RequestRow = { productName: string; quantity: string; unit: string; note: string };
  const emptyRow = (): RequestRow => ({ productName: "", quantity: "", unit: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ sourceType: "customer_request", requestDate: date, customerName: "", township: "", salesperson: SALE_PEOPLE[0] });
  const [rows, setRows] = useState<RequestRow[]>([emptyRow()]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const customerMatches = useMemo(() => {
    const needle = customerSearch.toLocaleLowerCase().trim();
    if (!needle) return customers.slice(0, 12);
    return customers.filter((customer) => `${customer.name} ${customer.township}`.toLocaleLowerCase().includes(needle)).slice(0, 15);
  }, [customerSearch, customers]);
  function updateRow(index: number, field: keyof RequestRow, value: string) { setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row)); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.customerName || !form.township) { setError("Customers Database ထဲက Customer ကို ရွေးချယ်ပါ"); return; }
    if (rows.some((row) => !row.productName.trim() || Number(row.quantity) < 1 || !row.unit.trim())) { setError("Row တိုင်းမှာ Product Name, Qty နှင့် Unit ဖြည့်ပါ"); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/purchase-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, items: rows }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Customer Request ပို့မရပါ");
      onCreated(data.requests || [data.request]);
    } catch (err) { setError(err instanceof Error ? err.message : "Customer Request ပို့မရပါ"); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><section className="sheet customer-request-sheet" onMouseDown={(event) => event.stopPropagation()}>
    <div className="sheet-handle" /><div className="sheet-title"><div><p className="eyebrow">SALE TEAM</p><h2>Customer Request ပို့ရန်</h2><small>Customer တစ်ဦးအတွက် ပစ္စည်းများစွာ တစ်ခါတည်းထည့်နိုင်ပါသည်</small></div><button onClick={onClose}><X /></button></div>
    <p className="merge-note">ပစ္စည်း Row ကို လိုသလိုတိုးပြီး Purchase Team သို့ တစ်ကြိမ်တည်း ပို့နိုင်ပါသည်။</p>
    <form onSubmit={submit} className="order-form">
      <label><span>Request Date</span><input type="date" required value={form.requestDate} onChange={(e) => setForm({ ...form, requestDate: e.target.value })} /></label>
      <label className="customer-picker"><span>Customer Name / Township</span><div className={form.customerName ? "customer-search selected" : "customer-search"}><Search size={17} /><input autoFocus required placeholder="Customer Name သို့မဟုတ် Township ရှာရန်" value={customerSearch} onFocus={() => setCustomerOpen(true)} onChange={(e) => { setCustomerSearch(e.target.value); setForm({ ...form, customerName: "", township: "" }); setCustomerOpen(true); }} />{form.customerName && <CheckCircle2 size={17} className="selected-check" />}</div>{customerOpen && <div className="customer-options">{customerMatches.length === 0 ? <p>Customer မတွေ့ပါ</p> : customerMatches.map((customer) => <button type="button" key={`${customer.name}-${customer.township}`} onClick={() => { setForm({ ...form, customerName: customer.name, township: customer.township, salesperson: customer.salesperson || form.salesperson }); setCustomerSearch(customer.name); setCustomerOpen(false); }}><strong>{customer.name}</strong><small>{customer.township}</small></button>)}</div>}{form.customerName && <div className="selected-customer"><span>ရွေးထားသော Customer</span><strong>{form.customerName}</strong><small>{form.township}</small></div>}</label>
      <label><span>မှာယူသော Sale Man</span><select required value={form.salesperson} onChange={(e) => setForm({ ...form, salesperson: e.target.value })}>{SALE_PEOPLE.map((person) => <option value={person} key={person}>{person}</option>)}</select></label>
      <div className="request-repeater"><div className="request-repeater-head"><div><strong>ပစ္စည်းစာရင်း</strong><small>{rows.length} Rows</small></div><button type="button" onClick={() => setRows((current) => [...current, emptyRow()])}><Plus size={16} />Row ထပ်ထည့်ရန်</button></div><div className="request-row-labels"><span>No.</span><span>Product Name</span><span>Qty</span><span>Unit</span><span>Remark</span><span /></div>{rows.map((row, index) => <div className="request-repeater-row" key={index}><b>{index + 1}</b><label><span>Product Name</span><input required placeholder="Product Name" value={row.productName} onChange={(e) => updateRow(index, "productName", e.target.value)} /></label><label><span>Qty</span><input type="number" min="1" required placeholder="0" value={row.quantity} onChange={(e) => updateRow(index, "quantity", e.target.value)} /></label><label><span>Unit</span><input required placeholder="Box / Strip / Pcs" value={row.unit} onChange={(e) => updateRow(index, "unit", e.target.value)} /></label><label><span>Remark</span><input placeholder="Brand / Strength" value={row.note} onChange={(e) => updateRow(index, "note", e.target.value)} /></label><button type="button" aria-label="Row ဖျက်ရန်" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}><X size={15} /></button></div>)}</div>
      {error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={saving}>{saving ? "ပို့နေသည်…" : `ပစ္စည်း ${rows.length} မျိုး Purchase Team သို့ ပို့မည်`}</button>
    </form>
  </section></div>;
}

function WarehouseWorkflowPage({ order, allOrders, role, products, onClose, onPatch, notify }: { order: Order; allOrders: Order[]; role: AppRole; products: MasterProduct[]; onClose: () => void; onPatch: (payload: Record<string, unknown>) => Promise<Order>; notify: (message: string) => void }) {
  const firstBatch = order.warehouseBatches.find((batch) => batch.status !== "finished") || order.warehouseBatches[0];
  const [batchSequence, setBatchSequence] = useState(firstBatch?.sequence || 1);
  const [stage, setStage] = useState<"pickup" | "checking" | "completed">(firstBatch?.status === "finished" ? "completed" : firstBatch?.status === "picked" ? "checking" : "pickup");
  const [busy, setBusy] = useState(false);
  const [batchDrafts, setBatchDrafts] = useState<Record<number, WarehouseBatchDraft>>(() => makeBatchDrafts(order.warehouseBatches));
  const [pickedMap, setPickedMap] = useState<Record<number, boolean>>(() => Object.fromEntries((order.orderItems || []).map((item) => [item.id, item.fulfillmentStatus === "picked"])));
  const [pickedQtyMap, setPickedQtyMap] = useState<Record<number, string>>(() => Object.fromEntries((order.orderItems || []).map((item) => [item.id, String(item.pickedQuantity > 0 ? item.pickedQuantity : item.quantity)])));
  const [checkedQtyMap, setCheckedQtyMap] = useState<Record<number, string>>(() => Object.fromEntries((order.orderItems || []).map((item) => [item.id, String(item.checkedQuantity >= 0 ? item.checkedQuantity : item.pickedQuantity)])));
  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>({});
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<number, { productId: number; code: string; name: string; note: string }>>(() => Object.fromEntries((order.orderItems || []).map((item) => { const product = products.find((entry) => entry.productCode.toLocaleLowerCase() === (item.matchedProductCode || item.originalProductCode).toLocaleLowerCase()); return [item.id, { productId: product?.id || 0, code: item.matchedProductCode || item.originalProductCode, name: item.matchedProductName || item.originalDescription, note: item.resolutionNote || "" }]; })));
  const [substitutionEditorItemId, setSubstitutionEditorItemId] = useState<number | null>(null);
  const [substitutionDrafts, setSubstitutionDrafts] = useState<Record<number, { productId: number; quantity: string; reason: string }>>(() => Object.fromEntries((order.orderItems || []).map((item) => { const product = products.find((entry) => entry.productCode.toLocaleLowerCase() === item.substituteProductCode.toLocaleLowerCase()); return [item.id, { productId: product?.id || 0, quantity: String(item.substituteQuantity || Math.max(1, item.quantity - item.pickedQuantity)), reason: item.substitutionReason || "" }]; })));

  const batch = order.warehouseBatches.find((item) => item.sequence === batchSequence) || firstBatch;
  const items = (order.orderItems || []).filter((item) => item.batchSequence === batchSequence).sort((a, b) => a.originalRowNumber - b.originalRowNumber || a.id - b.id);
  const pickableItems = items.filter((item) => !["unknown", "new_product_requested", "unavailable"].includes(item.matchStatus));
  const checkableItems = items.filter((item) => !["unknown", "new_product_requested"].includes(item.matchStatus));
  const unresolvedItems = items.filter((item) => ["unknown", "new_product_requested"].includes(item.matchStatus));
  const productRowsBlocked = items.some((item) => ["unknown", "new_product_requested"].includes(item.matchStatus) || item.fulfillmentStatus === "pending" || item.substitutionStatus === "returned");
  const packageLinkCandidates = useMemo(() => allOrders
    .filter((candidate) => candidate.id !== order.id && candidate.customerName.trim().toLocaleLowerCase() === order.customerName.trim().toLocaleLowerCase() && candidate.township.trim().toLocaleLowerCase() === order.township.trim().toLocaleLowerCase() && candidate.route === order.route && !["out_for_delivery", "delivered", "partial", "returned"].includes(candidate.dispatchStatus))
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.id - a.id), [allOrders, order.id, order.customerName, order.township, order.route]);
  const draft = batchDrafts[batchSequence] || { packageMode: batch?.packageMode || "", linkedOrderId: String(batch?.linkedOrderId || ""), boxes: "", bundles: "", itemPackedBy: "", itemCheckedBy: "", boxClosedBy: "" };
  const usesOriginalPackage = draft.packageMode === "original";
  const separatePackageLinkRequired = batchSequence === 1 && usesOriginalPackage;
  const packageUndecided = !draft.packageMode;
  const packageTotal = usesOriginalPackage ? 0 : Number(draft.boxes || 0) + Number(draft.bundles || 0);
  const allPickableChecked = items.length > 0 && pickableItems.every((item) => pickedMap[item.id]);
  const allChecked = items.length > 0 && checkableItems.every((item) => checkedMap[item.id]);
  const selectedSubstitutionItem = items.find((item) => item.id === substitutionEditorItemId);

  useEffect(() => {
    setBatchDrafts((current) => {
      const serverDrafts = makeBatchDrafts(order.warehouseBatches);
      return Object.fromEntries(Object.entries(serverDrafts).map(([sequence, serverDraft]) => {
        const currentDraft = current[Number(sequence)];
        return [Number(sequence), currentDraft ? { ...serverDraft, ...currentDraft } : serverDraft];
      }));
    });
  }, [order.warehouseBatches]);
  useEffect(() => {
    setPickedMap((current) => ({ ...Object.fromEntries((order.orderItems || []).map((item) => [item.id, item.fulfillmentStatus === "picked"])), ...current }));
    setPickedQtyMap((current) => ({ ...Object.fromEntries((order.orderItems || []).map((item) => [item.id, String(item.pickedQuantity > 0 ? item.pickedQuantity : item.quantity)])), ...current }));
    setCheckedQtyMap((current) => ({ ...Object.fromEntries((order.orderItems || []).map((item) => [item.id, String(item.checkedQuantity >= 0 ? item.checkedQuantity : item.pickedQuantity)])), ...current }));
    setSubstitutionDrafts(Object.fromEntries((order.orderItems || []).map((item) => { const product = products.find((entry) => entry.productCode.toLocaleLowerCase() === item.substituteProductCode.toLocaleLowerCase()); return [item.id, { productId: product?.id || 0, quantity: String(item.substituteQuantity || Math.max(1, item.quantity - item.pickedQuantity)), reason: item.substitutionReason || "" }]; })));
  }, [order.orderItems, products]);

  function selectBatch(sequence: number) {
    const selectedBatch = order.warehouseBatches.find((item) => item.sequence === sequence);
    setBatchSequence(sequence);
    setStage(selectedBatch?.status === "finished" ? "completed" : selectedBatch?.status === "picked" ? "checking" : "pickup");
  }

  function setBatchValue(field: keyof WarehouseBatchDraft, value: string) {
    setBatchDrafts((current) => {
      const currentDraft = current[batchSequence] || draft;
      if (field === "packageMode") {
        const packageMode = value === "original" || value === "new" ? value : "";
        return { ...current, [batchSequence]: { ...currentDraft, packageMode, linkedOrderId: packageMode === "original" && batchSequence === 1 ? String(packageLinkCandidates[0]?.id || "") : "", boxes: packageMode === "original" ? "" : currentDraft.boxes, bundles: packageMode === "original" ? "" : currentDraft.bundles } };
      }
      return { ...current, [batchSequence]: { ...currentDraft, [field]: value } };
    });
  }

  async function confirmPickup() {
    if (!batch) return;
    setBusy(true);
    try {
      await onPatch({ action: "confirm_pickup_items", id: order.id, batchSequence, pickedItemIds: pickableItems.filter((item) => pickedMap[item.id]).map((item) => item.id), pickedQuantities: pickableItems.map((item) => ({ itemId: item.id, quantity: pickedQtyMap[item.id] ?? item.quantity })) });
      notify(`Sale Order #${batchSequence} • ပစ္စည်းထည့်ခြင်း ပြီးဆုံးပါပြီ • Status: Picked`);
      onClose();
    } catch (error) { notify(error instanceof Error ? error.message : "Product Pickup Confirm မလုပ်နိုင်ပါ"); }
    finally { setBusy(false); }
  }

  async function resolveItem(item: OrderItem, resolution: "match" | "new_product_requested" | "unavailable") {
    const resolutionDraft = resolutionDrafts[item.id] || { productId: 0, code: "", name: "", note: "" };
    setBusy(true);
    try {
      await onPatch({ action: "resolve_order_item", id: order.id, itemId: item.id, resolution, matchedProductId: resolutionDraft.productId, matchedProductCode: resolutionDraft.code, matchedProductName: resolutionDraft.name, resolutionNote: resolutionDraft.note });
      notify(resolution === "match" ? "Inventory Product နှင့် Match လုပ်ပြီးပါပြီ — Pickup အဆင့်တွင် checkbox ပြန်ရွေးပါ" : resolution === "unavailable" ? "Unavailable အဖြစ် အတည်ပြုပြီးပါပြီ" : "New Product Request အဖြစ်ထားပြီးပါပြီ");
    } catch (error) { notify(error instanceof Error ? error.message : "Product Resolution မလုပ်နိုင်ပါ"); }
    finally { setBusy(false); }
  }

  async function adminSubstituteUnmatchedItem(item: OrderItem) {
    const value = resolutionDrafts[item.id] || { productId: 0, code: "", name: "", note: "" };
    if (!value.productId) return notify("Product Master မှ Similar Product ရွေးပါ");
    setBusy(true);
    try {
      await onPatch({ action: "admin_substitute_unmatched_item", id: order.id, itemId: item.id, substituteProductId: value.productId, substitutionReason: value.note });
      notify(`${item.originalDescription} ကို ${value.name} ဖြင့် Substitute လုပ်ပြီးပါပြီ`);
    } catch (error) { notify(error instanceof Error ? error.message : "Similar Product Substitute မလုပ်နိုင်ပါ"); }
    finally { setBusy(false); }
  }

  async function adminDeleteUnmatchedItem(item: OrderItem) {
    if (!window.confirm(`${item.originalDescription} ကို Sale Order Product စာရင်းမှ ဖျက်မည်လား? ဒီလုပ်ဆောင်ချက်ကို Audit Log တွင် မှတ်တမ်းတင်ပါမည်။`)) return;
    setBusy(true);
    try {
      await onPatch({ action: "admin_delete_unmatched_item", id: order.id, itemId: item.id });
      notify(`${item.originalDescription} ကို Sale Order မှ ဖျက်ပြီးပါပြီ`);
    } catch (error) { notify(error instanceof Error ? error.message : "Product Row ဖျက်မရပါ"); }
    finally { setBusy(false); }
  }

  async function saveSubstitution(item: OrderItem) {
    const value = substitutionDrafts[item.id] || { productId: 0, quantity: "", reason: "" };
    setBusy(true);
    try {
      await onPatch({ action: "set_substitute_product", id: order.id, itemId: item.id, substituteProductId: value.productId, substituteQuantity: value.quantity, substitutionReason: value.reason });
      notify("Similar Product ကို Picker Proposal အဖြစ် သိမ်းပြီးပါပြီ • Checker မှ Confirm လုပ်ရပါမည်");
      setSubstitutionEditorItemId(null);
    } catch (error) { notify(error instanceof Error ? error.message : "Similar Product သိမ်းမရပါ"); }
    finally { setBusy(false); }
  }

  async function removeSubstitution(item: OrderItem) {
    setBusy(true);
    try {
      await onPatch({ action: "remove_substitute_product", id: order.id, itemId: item.id });
      notify("Similar Product ကို ဖြုတ်ပြီးပါပြီ");
      setSubstitutionEditorItemId(null);
    } catch (error) { notify(error instanceof Error ? error.message : "Similar Product ဖြုတ်မရပါ"); }
    finally { setBusy(false); }
  }

  async function completeBatch() {
    if (!batch) return;
    setBusy(true);
    try {
      await onPatch({ action: "warehouse", id: order.id, batchSequence, packageMode: draft.packageMode, linkedOrderId: separatePackageLinkRequired ? draft.linkedOrderId : 0, boxes: usesOriginalPackage ? 0 : draft.boxes, bundles: usesOriginalPackage ? 0 : draft.bundles, checkedItemIds: checkableItems.filter((item) => checkedMap[item.id]).map((item) => item.id), checkedQuantities: checkableItems.map((item) => ({ itemId: item.id, quantity: checkedQtyMap[item.id] ?? item.pickedQuantity })), boxClosedBy: draft.boxClosedBy });
      setStage("completed");
      notify(`Sale Order #${batchSequence} • Warehouse Completed ဖြစ်ပါပြီ`);
    } catch (error) { notify(error instanceof Error ? error.message : "Warehouse Completed မလုပ်နိုင်ပါ"); }
    finally { setBusy(false); }
  }

  const nextPendingBatch = order.warehouseBatches.find((item) => item.status !== "finished" && item.sequence !== batchSequence);
  const substitutionEditor = selectedSubstitutionItem ? (() => {
    const value = substitutionDrafts[selectedSubstitutionItem.id] || { productId: 0, quantity: "", reason: "" };
    const isReturned = selectedSubstitutionItem.substitutionStatus === "returned";
    return <section className={`warehouse-substitution-editor ${isReturned ? "returned" : ""}`}>
      <div className="warehouse-substitution-heading"><div><strong>Similar Product / Substitute</strong><small>{selectedSubstitutionItem.originalProductCode || "No Code"} • {selectedSubstitutionItem.originalDescription}</small></div><button type="button" onClick={() => setSubstitutionEditorItemId(null)}><X size={16} /></button></div>
      {isReturned && <div className="substitution-return-notice"><RefreshCw size={16} /><span><b>Salesman Returned • Correction Required</b><small>{selectedSubstitutionItem.substitutionReturnReason}</small></span></div>}
      <label><span>Product Master မှ Similar Product ရွေးပါ</span><ProductSearchSelect products={products} selectedId={value.productId || undefined} onClear={() => setSubstitutionDrafts((current) => ({ ...current, [selectedSubstitutionItem.id]: { ...value, productId: 0 } }))} onSelect={(product) => setSubstitutionDrafts((current) => ({ ...current, [selectedSubstitutionItem.id]: { ...value, productId: product.id } }))} /></label>
      <div className="warehouse-substitution-fields"><label><span>Substitute Qty</span><input type="number" inputMode="numeric" min="1" max={selectedSubstitutionItem.quantity} value={value.quantity} onChange={(event) => setSubstitutionDrafts((current) => ({ ...current, [selectedSubstitutionItem.id]: { ...value, quantity: event.target.value } }))} /></label><label><span>Reason</span><input placeholder="ဥပမာ — မူလ Product Stock Out" value={value.reason} onChange={(event) => setSubstitutionDrafts((current) => ({ ...current, [selectedSubstitutionItem.id]: { ...value, reason: event.target.value } }))} /></label></div>
      <div className="warehouse-substitution-actions">{selectedSubstitutionItem.substitutionStatus !== "none" && <button type="button" className="remove" disabled={busy} onClick={() => void removeSubstitution(selectedSubstitutionItem)}>Similar Product မသုံးတော့ပါ</button>}<button type="button" className="save" disabled={busy || !value.productId || !value.quantity || !value.reason.trim()} onClick={() => void saveSubstitution(selectedSubstitutionItem)}>{busy ? "သိမ်းနေသည်…" : isReturned ? "Similar Product အသစ်ပြောင်းမည်" : "Similar Product Proposal သိမ်းမည်"}</button></div>
    </section>;
  })() : null;

  const adminResolutionPanel = role === "admin" && unresolvedItems.length > 0 ? <div className="warehouse-resolution-panel admin-unmatched-panel">
    <h3><ShieldCheck size={16} /> Admin • Inventory Matching မဖြစ်သော Products</h3>
    <p>Product Master မှ ရွေးပြီး Inventory Match သို့မဟုတ် Similar Product Substitute လုပ်နိုင်ပါသည်။ မလိုအပ်သော Row ကို Delete လုပ်နိုင်ပြီး လုပ်ဆောင်ချက်အားလုံး Audit Log တွင် မှတ်တမ်းတင်ပါမည်။</p>
    {unresolvedItems.map((item) => { const value = resolutionDrafts[item.id] || { productId: 0, code: "", name: "", note: "" }; return <div className="warehouse-resolution-row" key={item.id}><div><small>Row {item.originalRowNumber} • {item.originalProductCode || "No Code"}</small><strong>{item.originalDescription}</strong></div><div className="warehouse-product-match"><ProductSearchSelect products={products} selectedId={value.productId || undefined} onClear={() => setResolutionDrafts((current) => ({ ...current, [item.id]: { ...value, productId: 0, code: "", name: "" } }))} onSelect={(product) => setResolutionDrafts((current) => ({ ...current, [item.id]: { ...value, productId: product.id, code: product.productCode, name: product.productName } }))} /><small>{value.productId ? `${value.code} • ${value.name}` : "Product Master မှ ရွေးရန်"}</small></div><input placeholder="Reason / Note (optional)" value={value.note} onChange={(event) => setResolutionDrafts((current) => ({ ...current, [item.id]: { ...value, note: event.target.value } }))} /><div className="admin-unmatched-actions"><button type="button" className="match" disabled={busy || !value.productId} onClick={() => void resolveItem(item, "match")}>Inventory Match</button><button type="button" className="substitute" disabled={busy || !value.productId} onClick={() => void adminSubstituteUnmatchedItem(item)}>Similar Substitute</button><button type="button" className="delete" disabled={busy} onClick={() => void adminDeleteUnmatchedItem(item)}><Trash2 size={13} />Delete</button></div></div>; })}
  </div> : null;

  return <div className="warehouse-workflow-page">
    <header className="warehouse-workflow-header"><button onClick={onClose} aria-label="Warehouse စာရင်းသို့ ပြန်သွားရန်"><X size={20} /></button><div><p>NAWARATT WORKFLOW V2</p><h1>Warehouse Product Processing</h1></div><span>{order.orderNo}</span></header>
    <main className="warehouse-workflow-main">
      <nav className="warehouse-stepper"><div className={stage === "pickup" ? "active" : "done"}><b>1</b><span>Pickup</span><small>Confirm → Next</small></div><i /><div className={stage === "checking" ? "active" : stage === "completed" ? "done" : ""}><b>2</b><span>Checking</span><small>Check → Completed</small></div></nav>
      <section className="warehouse-customer-info"><div><small>Customer</small><strong>{order.customerName}</strong><span>{order.township || "Township မရှိ"}</span></div><div><small>Route</small><strong>{order.route}</strong></div><div><small>Sale Man</small><strong>{assignedSalePeople(order)}</strong></div><div><small>Order</small><strong>{order.orderNo}</strong><span>{order.orderDate}</span></div></section>
      {order.warehouseBatches.length > 1 && <div className="warehouse-batch-tabs">{order.warehouseBatches.map((item) => <button className={item.sequence === batchSequence ? "active" : ""} key={item.sequence} onClick={() => selectBatch(item.sequence)}>Order #{item.sequence}<span>{item.status === "finished" ? "Completed" : item.status === "picked" ? "Picked" : item.status === "picking" ? "Picking" : "Pending"}</span></button>)}</div>}

      {stage === "pickup" && <section className="warehouse-stage-card pickup-stage"><div className="warehouse-stage-title"><div><p>STEP 1</p><h2>Product Pickup</h2><small>Checkbox ကိုရွေးထားသော်လည်း Confirm မနှိပ်မချင်း Order ကို Update မလုပ်ပါ</small></div><b>{items.length} Products</b></div>
        <div className="compact-product-table"><div className="head"><span>No.</span><span className="product-code-column">Code</span><span>Product</span><span>Ordered Qty</span><label><input aria-label="Product အားလုံး Picked အဖြစ်ရွေးရန်" type="checkbox" checked={allPickableChecked} onChange={(event) => setPickedMap((current) => ({ ...current, ...Object.fromEntries(pickableItems.map((item) => [item.id, event.target.checked])) }))} /><span>Picked Qty</span></label></div>{items.map((item, index) => { const blocked = ["unknown", "new_product_requested"].includes(item.matchStatus); const unavailable = item.matchStatus === "unavailable"; const unit = displayUnit(item.originalUnit); return <div className={blocked ? "blocked" : unavailable ? "unavailable" : item.substitutionStatus === "returned" ? "substitution-returned" : ""} key={item.id}><b>{index + 1}</b><span className="product-code-column">{item.originalProductCode || "—"}</span><strong className="mobile-product-cell"><small>{item.originalProductCode || "No Code"}</small><span>{item.originalDescription}</span><button type="button" className={`substitute-trigger ${item.substitutionStatus}`} disabled={blocked} onClick={() => setSubstitutionEditorItemId(item.id)}>{item.substitutionStatus === "returned" ? "Correction Required" : item.substituteProductCode ? `Substitute: ${item.substituteProductCode}` : "+ Similar Product"}</button></strong><span><b>{item.originalQuantity}</b>{unit ? ` ${unit}` : ""}</span><div className="pickup-qty-control"><input aria-label={`${item.originalDescription} Picked Quantity`} type="number" inputMode="numeric" min="0" max={item.quantity} disabled={blocked || unavailable} value={pickedQtyMap[item.id] ?? String(item.quantity)} onChange={(event) => setPickedQtyMap((current) => ({ ...current, [item.id]: event.target.value }))} /><label className="pickup-checkbox"><input aria-label={`${item.originalDescription} Picked Up`} type="checkbox" disabled={blocked || unavailable} checked={Boolean(pickedMap[item.id])} onChange={(event) => setPickedMap((current) => ({ ...current, [item.id]: event.target.checked }))} /><span>{blocked ? "Resolve First" : unavailable ? "Unavailable" : pickedMap[item.id] ? "Picked" : "Not Picked"}</span></label></div></div>; })}</div>
        {substitutionEditor}
        {adminResolutionPanel}
        <p className="pickup-quantity-note">Warehouse Qty ပြောင်းရန် Picked Qty ကိုပြင်ပါ။ ပစ္စည်းမရရှိပါက 0 ထည့်ပါ။</p>
        <div className="warehouse-stage-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy || !allPickableChecked || unresolvedItems.length > 0} onClick={() => void confirmPickup()}>{busy ? "သိမ်းနေသည်…" : "ပစ္စည်းထည့်ခြင်း ပြီးဆုံးပါပြီ"}<CheckCircle2 size={18} /></button></div>
      </section>}

      {stage === "checking" && <section className="warehouse-stage-card checking-stage"><div className="warehouse-stage-title"><div><p>STEP 2</p><h2>Check & Packaging</h2><small>Product result စစ်ပြီး Packaging နှင့် တာဝန်ခံအချက်အလက်ကို ဖြည့်ပါ</small></div><b>{items.filter((item) => item.fulfillmentStatus === "picked").length}/{items.length} Picked</b></div>
        <div className="compact-product-table checking"><div className="head"><span>No.</span><span className="product-code-column">Code</span><span>Product</span><span>Actual Qty</span><label><input aria-label="Products အားလုံး စစ်ပြီး" type="checkbox" checked={allChecked} onChange={(event) => setCheckedMap((current) => ({ ...current, ...Object.fromEntries(checkableItems.map((item) => [item.id, event.target.checked])) }))} /><span>Checked</span></label></div>{items.map((item, index) => { const unit = displayUnit(item.originalUnit); const checkable = checkableItems.some((entry) => entry.id === item.id); return <div className={`${item.fulfillmentStatus} ${item.substitutionStatus === "returned" ? "substitution-returned" : ""}`} key={item.id}><b>{index + 1}</b><span className="product-code-column">{item.originalProductCode || "—"}</span><strong className="mobile-product-cell"><small>{item.originalProductCode || "No Code"}</small><span>{item.originalDescription}</span><button type="button" className={`substitute-trigger ${item.substitutionStatus}`} onClick={() => setSubstitutionEditorItemId(item.id)}>{item.substitutionStatus === "returned" ? "Correction Required" : item.substituteProductCode ? `Substitute: ${item.substituteProductCode}` : "+ Similar Product"}</button></strong><div className="checker-qty-control"><small>Picker {item.pickedQuantity}{unit ? ` ${unit}` : ""}</small><input aria-label={`${item.originalDescription} Actual Quantity`} type="number" inputMode="numeric" min="0" max={item.quantity} disabled={!checkable} value={checkedQtyMap[item.id] ?? String(item.pickedQuantity)} onChange={(event) => setCheckedQtyMap((current) => ({ ...current, [item.id]: event.target.value }))} /></div><label className="pickup-checkbox"><input aria-label={`${item.originalDescription} Checked`} type="checkbox" disabled={!checkable} checked={Boolean(checkedMap[item.id])} onChange={(event) => setCheckedMap((current) => ({ ...current, [item.id]: event.target.checked }))} /><span>{checkable ? checkedMap[item.id] ? "Checked" : "Check" : "Resolve First"}</span></label></div>; })}</div>
        {substitutionEditor}
        {adminResolutionPanel}

        {unresolvedItems.length > 0 && role !== "admin" && <div className="warehouse-resolution-panel"><h3>Product Resolution</h3><p>Product Master ထဲက Product ကို Search & Select လုပ်ပြီး Match လုပ်ပါ။ Product မရှိသေးပါက New Product သို့မဟုတ် Unavailable ကိုရွေးပါ။</p>{unresolvedItems.map((item) => { const value = resolutionDrafts[item.id] || { productId: 0, code: "", name: "", note: "" }; return <div className="warehouse-resolution-row" key={item.id}><div><small>Row {item.originalRowNumber} • {item.originalProductCode || "No Code"}</small><strong>{item.originalDescription}</strong></div><div className="warehouse-product-match"><ProductSearchSelect products={products} selectedId={value.productId || undefined} onClear={() => setResolutionDrafts((current) => ({ ...current, [item.id]: { ...value, productId: 0, code: "", name: "" } }))} onSelect={(product) => setResolutionDrafts((current) => ({ ...current, [item.id]: { ...value, productId: product.id, code: product.productCode, name: product.productName } }))} /><small>{value.productId ? `${value.code} • ${value.name}` : "Product Master မှ ရွေးရန်"}</small></div><input placeholder="Note (optional)" value={value.note} onChange={(event) => setResolutionDrafts((current) => ({ ...current, [item.id]: { ...value, note: event.target.value } }))} /><div><button type="button" className="match" disabled={busy || !value.productId} onClick={() => void resolveItem(item, "match")}>Inventory Match</button><button type="button" className="new-product" disabled={busy} onClick={() => void resolveItem(item, "new_product_requested")}>New Product</button><button type="button" className="danger" disabled={busy} onClick={() => void resolveItem(item, "unavailable")}>Unavailable</button></div></div>; })}</div>}

        <div className="warehouse-packaging-panel"><div className="warehouse-panel-heading"><Box size={18} /><div><h3>Packaging Info • Warehouse ဆုံးဖြတ်ရန်</h3><small>Picked / Checked ပြီးမှ Package ပုံစံကို ရွေးပါ • {order.packageInstruction || "အဆင်ပြေသလိုထည့်ပေးပါ"}{order.remark ? ` • ${order.remark}` : ""}</small></div></div><div className="packaging-auto-staff"><span><b>Picker</b><strong>{batch?.itemPackedBy || "Pickup မှတ်တမ်းမရှိ"}</strong></span><span><b>Checker</b><strong>လက်ရှိ Login ဝင်ထားသူကို Auto Record လုပ်မည်</strong></span></div><div className="packaging-mode-options"><label><input type="radio" name={`workflow-package-${batchSequence}`} checked={draft.packageMode === "new"} onChange={() => setBatchValue("packageMode", "new")} /><span><strong>Package အသစ်လုပ်မည်</strong><small>ဘုံး / ဆွဲ အရေအတွက် ထည့်ပါ • Package Count တိုးမည်</small></span></label><label className={batchSequence === 1 && packageLinkCandidates.length === 0 ? "disabled" : ""}><input type="radio" name={`workflow-package-${batchSequence}`} disabled={batchSequence === 1 && packageLinkCandidates.length === 0} checked={draft.packageMode === "original"} onChange={() => setBatchValue("packageMode", "original")} /><span><strong>{batchSequence === 1 ? "အနီးဆုံး Order ၏ မူလ Package ထဲပေါင်းမည်" : "မူလ Package ထဲ ထည့်ပေါင်းမည်"}</strong><small>{batchSequence === 1 && packageLinkCandidates.length === 0 ? "ပေါင်းနိုင်သော Order မရှိပါ" : "Package Count မတိုးပါ • မူလအရေအတွက်အတိုင်း"}</small></span></label></div>{separatePackageLinkRequired && packageLinkCandidates.length > 0 && <label className="packaging-link-select"><span>Package ချိတ်မည့် Order</span><select required value={draft.linkedOrderId} onChange={(event) => setBatchDrafts((current) => ({ ...current, [batchSequence]: { ...draft, linkedOrderId: event.target.value } }))}>{packageLinkCandidates.map((candidate, index) => <option value={candidate.id} key={`warehouse-package-link-${candidate.id}`}>{index === 0 ? "အနီးဆုံး • " : ""}{candidate.orderNo} • {candidate.orderDate}</option>)}</select><small>Customer နှင့် Route တူပြီး Delivery မစသေးသော Order များသာ ပြထားပါသည်</small></label>}{usesOriginalPackage && batchSequence > 1 && <div className="original-package-count"><span>Package Count</span><strong>မတိုးပါ</strong></div>}{!usesOriginalPackage && <div className="packaging-counts"><label><span>ဘုံး</span><input type="number" min="0" value={draft.boxes} onChange={(event) => setBatchValue("boxes", event.target.value)} /></label><label><span>ဆွဲ</span><input type="number" min="0" value={draft.bundles} onChange={(event) => setBatchValue("bundles", event.target.value)} /></label><div><span>Package Total</span><strong>{packageTotal}</strong></div></div>}<div className="packaging-staff single"><label><span>ပုံးပိတ်သူ</span><select value={draft.boxClosedBy} onChange={(event) => setBatchValue("boxClosedBy", event.target.value)}><option value="">ဝန်ထမ်းရွေးပါ</option>{WAREHOUSE_STAFF.map((name) => <option value={name} key={`workflow-close-${name}`}>{name}</option>)}</select></label></div></div>
        {productRowsBlocked && <div className="warehouse-complete-blocked"><Clock3 size={16} />Product Rows အားလုံး Pickup / Resolution ပြီးမှ Completed လုပ်နိုင်ပါသည်</div>}
        <div className="warehouse-stage-actions"><button className="secondary" onClick={onClose}>Warehouse List</button><button className="primary complete" disabled={busy || !allChecked || productRowsBlocked || packageUndecided || (separatePackageLinkRequired && !draft.linkedOrderId) || (!usesOriginalPackage && packageTotal === 0) || !draft.boxClosedBy} onClick={() => void completeBatch()}>{busy ? "Completed လုပ်နေသည်…" : "စစ်ဆေးပြီး • Packaging Completed"}<CheckCircle2 size={18} /></button></div>
      </section>}

      {stage === "completed" && <section className="warehouse-stage-card completed-stage"><CheckCircle2 size={54} /><h2>Warehouse Completed</h2><p>Sale Order #{batchSequence} ရဲ့ Product Check နှင့် Packaging မှတ်တမ်း သိမ်းပြီးပါပြီ။</p><div><button className="secondary" onClick={onClose}>Warehouse List သို့ပြန်မည်</button>{nextPendingBatch && <button className="primary" onClick={() => selectBatch(nextPendingBatch.sequence)}>Next Sale Order <ChevronRight size={18} /></button>}</div></section>}
    </main>
  </div>;
}

function OrderDetail({ order, role, products, customerDirectory, onClose, onPatch, onDelete, onProofUploaded, onIncidentUploaded, onPurchaseCreated, notify }: { order: Order; role: AppRole; products: MasterProduct[]; customerDirectory: CustomerDirectoryItem[]; onClose: () => void; onPatch: (payload: Record<string, unknown>) => Promise<Order>; onDelete: (id: number) => Promise<void>; onProofUploaded: (proof: Partial<Order>) => void; onIncidentUploaded: (issue: DeliveryIncident) => void; onPurchaseCreated: (request: PurchaseRequest) => void; notify: (message: string) => void }) {
  const t = totals(order);
  const canSale = role === "admin" || role === "sale";
  const canWarehouse = role === "admin" || role === "warehouse";
  const canDelivery = role === "admin" || role === "delivery";
  const canFinance = role === "admin" || role === "finance";
  const [batchDrafts, setBatchDrafts] = useState<Record<number, WarehouseBatchDraft>>(() => makeBatchDrafts(order.warehouseBatches));
  const [voucherAmount, setVoucherAmount] = useState(order.voucherAmount ? String(order.voucherAmount) : "");
  const [voucherAmounts, setVoucherAmounts] = useState<Record<number, string>>(() => makeVoucherDrafts(order));
  const [voucherEditing, setVoucherEditing] = useState(false);
  const voucherDraftDirtyRef = useRef(false);
  const voucherDraftOrderIdRef = useRef(order.id);
  const [toBuyQtyMap, setToBuyQtyMap] = useState<Record<number, string>>(() => Object.fromEntries((order.orderItems || []).filter((item) => item.shortageQuantity > 0).map((item) => [item.id, String(item.shortageQuantity)])));
  const toBuyQtyDirtyRef = useRef(false);
  const toBuyQtyOrderIdRef = useRef(order.id);
  const [deliveredBoxes, setDeliveredBoxes] = useState(String(order.deliveredBoxes));
  const [deliveredBundles, setDeliveredBundles] = useState(String(order.deliveredBundles));
  const [paid, setPaid] = useState(String(order.paidAmount));
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "banking">("cash");
  const [paymentDate, setPaymentDate] = useState(todayLocal);
  const [busy, setBusy] = useState(false);
  const [customerEditing, setCustomerEditing] = useState(false);
  const [customerEditKey, setCustomerEditKey] = useState(() => customerBalanceKey(order.customerName, order.township));
  const [customerSaving, setCustomerSaving] = useState(false);
  const [orderMetaEditing, setOrderMetaEditing] = useState(false);
  const [routeDraft, setRouteDraft] = useState(order.route);
  const [salespersonDraft, setSalespersonDraft] = useState(order.salesperson || "Admin");
  const [editRemark, setEditRemark] = useState("");
  const [orderMetaSaving, setOrderMetaSaving] = useState(false);
  const [reviewItemsEditing, setReviewItemsEditing] = useState(false);
  const [reviewItemsSaving, setReviewItemsSaving] = useState(false);
  const [reviewItemsRemark, setReviewItemsRemark] = useState("");
  const [reviewItemDrafts, setReviewItemDrafts] = useState<Record<number, { productName: string; quantity: string; unit: string; deleted: boolean }>>(() => Object.fromEntries((order.orderItems || []).map((item) => [item.id, { productName: item.substitutionStatus === "confirmed" && item.substituteProductName ? item.substituteProductName : item.matchedProductName || item.originalDescription, quantity: String(item.substitutionStatus === "confirmed" && item.substituteProductName ? item.substituteQuantity : item.checkedQuantity >= 0 ? item.checkedQuantity : item.pickedQuantity), unit: item.checkedUnit || item.originalUnit || "Unit", deleted: false }])));
  const [reviewAddedItems, setReviewAddedItems] = useState<Array<{ key: string; productId: number; quantity: string; unit: string; batchSequence: number }>>([]);
  const [orderEvents, setOrderEvents] = useState<OrderEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState("");
  const [proofBusy, setProofBusy] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [deliveryIssues, setDeliveryIssues] = useState<DeliveryIncident[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [incidentBusy, setIncidentBusy] = useState(false);
  const [incidentFile, setIncidentFile] = useState<File | null>(null);
  const [incidentForm, setIncidentForm] = useState({ issueType: "return" as DeliveryIncident["issueType"], itemDetails: "", deductionAmount: "" });
  const [warehouseReturns, setWarehouseReturns] = useState<WarehouseReturn[]>([]);
  const [warehouseReturnsLoading, setWarehouseReturnsLoading] = useState(true);
  const [warehouseReturnBusy, setWarehouseReturnBusy] = useState(false);
  const [warehouseReturnForm, setWarehouseReturnForm] = useState({ returnedBoxes: "", returnedBundles: "", financeStatus: "not_deducted" as WarehouseReturn["financeStatus"], note: "" });
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ batchSequence: String(order.warehouseBatches[0]?.sequence || 1), bulkText: "", note: "" });
  const [saleOrderPhoto, setSaleOrderPhoto] = useState<File | null>(null);
  const [saleOrderPhotoPreview, setSaleOrderPhotoPreview] = useState("");
  const [saleOrderPhotoPreparing, setSaleOrderPhotoPreparing] = useState(false);
  const [saleOrderPhotoBusy, setSaleOrderPhotoBusy] = useState(false);
  const [saleOrderPhotoSaved, setSaleOrderPhotoSaved] = useState<{ fileName: string; size: number; driveUrl: string; folderUrl: string } | null>(null);
  const saleOrderCameraRef = useRef<HTMLInputElement>(null);
  const saleOrderGalleryRef = useRef<HTMLInputElement>(null);
  const parsedPurchaseItems = useMemo(() => parseBulkPurchaseItems(purchaseForm.bulkText, order.customerName), [purchaseForm.bulkText, order.customerName]);

  useEffect(() => { setBatchDrafts(makeBatchDrafts(order.warehouseBatches)); }, [order.warehouseBatches]);
  useEffect(() => {
    if (!incidentFile) return;
    setIncidentForm((current) => {
      const details = current.itemDetails.trim();
      if (details && !Object.values(INCIDENT_AUTO_DETAILS).includes(details)) return current;
      const nextDetails = INCIDENT_AUTO_DETAILS[current.issueType];
      return current.itemDetails === nextDetails ? current : { ...current, itemDetails: nextDetails };
    });
  }, [incidentFile, incidentForm.issueType]);
  useEffect(() => {
    const fileInputs = document.querySelectorAll<HTMLInputElement>(".delivery-proof-input input[type='file']");
    fileInputs.forEach((input) => input.removeAttribute("capture"));
    const incidentInput = document.querySelector<HTMLInputElement>(".delivery-incident-form .delivery-proof-input input[type='file']");
    const picker = incidentInput?.closest<HTMLLabelElement>(".delivery-proof-input");
    if (!picker) return;
    if (!incidentFile) {
      picker.classList.remove("has-local-preview");
      picker.style.removeProperty("background-image");
      return;
    }
    const previewUrl = URL.createObjectURL(incidentFile);
    picker.classList.add("has-local-preview");
    picker.style.backgroundImage = `url(${JSON.stringify(previewUrl)})`;
    return () => {
      URL.revokeObjectURL(previewUrl);
      picker.classList.remove("has-local-preview");
      picker.style.removeProperty("background-image");
    };
  }, [incidentFile, order.id]);
  useEffect(() => {
    const orderChanged = voucherDraftOrderIdRef.current !== order.id;
    if (orderChanged || !voucherDraftDirtyRef.current) {
      setVoucherAmount(order.voucherAmount ? String(order.voucherAmount) : "");
      setVoucherAmounts(makeVoucherDrafts(order));
      voucherDraftDirtyRef.current = false;
    }
    voucherDraftOrderIdRef.current = order.id;
  }, [order.id, order.voucherAmount, order.warehouseBatches]);
  useEffect(() => {
    const orderChanged = toBuyQtyOrderIdRef.current !== order.id;
    if (orderChanged || !toBuyQtyDirtyRef.current) {
      setToBuyQtyMap(Object.fromEntries((order.orderItems || []).filter((item) => item.shortageQuantity > 0).map((item) => [item.id, String(item.shortageQuantity)])));
      toBuyQtyDirtyRef.current = false;
    }
    toBuyQtyOrderIdRef.current = order.id;
  }, [order.id, order.orderItems]);
  useEffect(() => {
    if (!reviewItemsEditing) setReviewItemDrafts(Object.fromEntries((order.orderItems || []).map((item) => [item.id, { productName: item.substitutionStatus === "confirmed" && item.substituteProductName ? item.substituteProductName : item.matchedProductName || item.originalDescription, quantity: String(item.substitutionStatus === "confirmed" && item.substituteProductName ? item.substituteQuantity : item.checkedQuantity >= 0 ? item.checkedQuantity : item.pickedQuantity), unit: item.checkedUnit || item.originalUnit || "Unit", deleted: false }])));
  }, [order.orderItems, reviewItemsEditing]);
  useEffect(() => { if (!customerEditing) setCustomerEditKey(customerBalanceKey(order.customerName, order.township)); }, [customerEditing, order.customerName, order.township]);
  useEffect(() => () => { if (saleOrderPhotoPreview) URL.revokeObjectURL(saleOrderPhotoPreview); }, [saleOrderPhotoPreview]);
  useEffect(() => {
    if (!orderMetaEditing) {
      setRouteDraft(order.route);
      setSalespersonDraft(order.salesperson || "Admin");
    }
  }, [order.route, order.salesperson, orderMetaEditing]);
  useEffect(() => {
    let cancelled = false;
    setIssuesLoading(true);
    fetch(`/api/delivery-incidents?orderId=${order.id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Delivery မှတ်တမ်း ရယူမရပါ");
        if (!cancelled) setDeliveryIssues(data.issues || []);
      })
      .catch((error) => { if (!cancelled) notify(error instanceof Error ? error.message : "Delivery မှတ်တမ်း ရယူမရပါ"); })
      .finally(() => { if (!cancelled) setIssuesLoading(false); });
    return () => { cancelled = true; };
  }, [order.id, notify]);

  const loadOrderEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const response = await fetch(`/api/order-events?orderId=${order.id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Order Audit Log ရယူမရပါ");
      setOrderEvents(data.events || []);
    } catch (error) { notify(error instanceof Error ? error.message : "Order Audit Log ရယူမရပါ"); }
    finally { setEventsLoading(false); }
  }, [order.id, notify]);
  useEffect(() => { void loadOrderEvents(); }, [loadOrderEvents]);

  useEffect(() => {
    let cancelled = false;
    setWarehouseReturnsLoading(true);
    fetch(`/api/warehouse-returns?orderId=${order.id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Warehouse Return မှတ်တမ်း ရယူမရပါ");
        if (!cancelled) setWarehouseReturns(data.returns || []);
      })
      .catch((error) => { if (!cancelled) notify(error instanceof Error ? error.message : "Warehouse Return မှတ်တမ်း ရယူမရပါ"); })
      .finally(() => { if (!cancelled) setWarehouseReturnsLoading(false); });
    return () => { cancelled = true; };
  }, [order.id, notify]);

  const warehouseDraftTotal = order.warehouseBatches.reduce((acc, batch) => {
    const draft = batchDrafts[batch.sequence];
    if (draft?.packageMode !== "original") {
      acc.boxes += Number(draft?.boxes || 0);
      acc.bundles += Number(draft?.bundles || 0);
    }
    return acc;
  }, { boxes: 0, bundles: 0 });
  const warehouseReturnTotal = warehouseReturns.reduce((acc, item) => {
    acc.boxes += item.returnedBoxes;
    acc.bundles += item.returnedBundles;
    return acc;
  }, { boxes: 0, bundles: 0 });
  const availableReturnBoxes = Math.max(0, order.deliveredBoxes - warehouseReturnTotal.boxes);
  const availableReturnBundles = Math.max(0, order.deliveredBundles - warehouseReturnTotal.bundles);
  const voucherTotal = order.warehouseBatches.reduce((sum, batch) => sum + Math.max(0, Number(voucherAmounts[batch.sequence] || 0)), 0);
  const toBuyItems = (order.orderItems || []).filter((item) => item.shortageQuantity > 0);
  const reviewItemsEditable = order.warehouseStatus === "finished" && order.dispatchStatus !== "returned" && (role === "admin" || (role === "warehouse" && !order.saleApproved && !["out_for_delivery", "partial", "delivered"].includes(order.dispatchStatus)));
  const canEditRouteSalesperson = canSale && (
    (!order.saleApproved && !["out_for_delivery", "partial", "delivered", "returned"].includes(order.dispatchStatus))
    || (order.saleApproved && ["packed", "rescheduled", "out_for_delivery", "partial"].includes(order.dispatchStatus))
  );
  const canEditSaleVoucher = canSale && order.warehouseStatus === "finished" && (role === "admin" || order.dispatchStatus !== "delivered");
  const voucherAmountFields = order.warehouseBatches.length > 1 ? <div className="voucher-order-breakdown"><div className="voucher-order-summary"><span>Sale Order Amount</span><strong>{money(order.orderAmount)} MMK</strong><small>{order.warehouseBatches.length} Sale Orders</small></div><div className="voucher-order-inputs">{order.warehouseBatches.map((batch) => <label key={batch.sequence}><span>Order {batch.sequence} Sale VR Amount</span><input type="number" inputMode="numeric" min="0" required placeholder="0" value={voucherAmounts[batch.sequence] || ""} onChange={(event) => { voucherDraftDirtyRef.current = true; setVoucherAmounts((current) => ({ ...current, [batch.sequence]: event.target.value })); }} /></label>)}</div><div className="voucher-order-total"><span>Total Sale VR Amount</span><strong>{money(voucherTotal)} <small>MMK</small></strong></div></div> : <div className="amount-compare"><div><span>Sale Order Amount</span><strong>{money(order.orderAmount)} MMK</strong></div><label><span>Sale Voucher Amount</span><input type="number" inputMode="numeric" min="0" required placeholder="0" value={voucherAmount} onChange={(event) => { voucherDraftDirtyRef.current = true; setVoucherAmount(event.target.value); }} /></label></div>;

  async function run(payload: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      const updated = await onPatch({ id: order.id, ...payload });
      if (["salesman_review_approve", "voucher_edit"].includes(String(payload.action))) {
        voucherDraftDirtyRef.current = false;
        setVoucherAmount(updated.voucherAmount ? String(updated.voucherAmount) : "");
        setVoucherAmounts(makeVoucherDrafts(updated));
        setVoucherEditing(false);
      }
      await loadOrderEvents();
      notify(message);
    }
    catch (error) { notify(error instanceof Error ? error.message : "Update failed"); }
    finally { setBusy(false); }
  }

  async function saveCustomerName() {
    if (!editRemark.trim()) return notify("ပြင်ဆင်ရသည့်အကြောင်းရင်း Remark ထည့်ပါ");
    const customer = customerDirectory.find((item) => customerBalanceKey(item.name, item.township) === customerEditKey);
    if (!customer) return notify("Customers Database ထဲက Customer ကို ရွေးပါ");
    if (customer.name === order.customerName && customer.township === order.township) {
      setCustomerEditing(false);
      return;
    }
    setCustomerSaving(true);
    try {
      await onPatch({ id: order.id, action: "customer", customerName: customer.name, township: customer.township, editRemark });
      setCustomerEditing(false);
      setEditRemark("");
      await loadOrderEvents();
      notify("Sale Order Customer Name ပြင်ပြီးပါပြီ");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Customer Name ပြင်မရပါ");
    } finally {
      setCustomerSaving(false);
    }
  }

  async function saveRouteAndSalesperson() {
    if (!canEditRouteSalesperson) return notify("ပို့ရန်ကျန် / On the Way Sale Order များကို Admin / Sale Team သာ Route နှင့် Sale Man ပြင်နိုင်ပါသည်");
    if (!editRemark.trim()) return notify("ပြင်ဆင်ရသည့်အကြောင်းရင်း Remark ထည့်ပါ");
    setOrderMetaSaving(true);
    try {
      await onPatch({ id: order.id, action: "route_salesperson", route: routeDraft, salesperson: salespersonDraft, editRemark });
      setOrderMetaEditing(false);
      setEditRemark("");
      await loadOrderEvents();
      notify("Route နှင့် Sale Man ပြင်ပြီးပါပြီ");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Route / Sale Man ပြင်မရပါ");
    } finally {
      setOrderMetaSaving(false);
    }
  }

  async function saveReviewOrderItems() {
    if (!reviewItemsEditable) return notify("ဒီ Order Status မှာ Checked Products ပြင်ခွင့်မရှိပါ");
    if (!reviewItemsRemark.trim()) return notify("ပြင်ဆင်ရသည့်အကြောင်းရင်း Remark ထည့်ပါ");
    const items = [...(order.orderItems || [])]
      .sort((a, b) => a.batchSequence - b.batchSequence || a.originalRowNumber - b.originalRowNumber || a.id - b.id)
      .map((item) => ({ itemId: item.id, productName: (reviewItemDrafts[item.id]?.productName || "").trim(), quantityText: reviewItemDrafts[item.id]?.quantity ?? "", quantity: Number(reviewItemDrafts[item.id]?.quantity), unit: (reviewItemDrafts[item.id]?.unit || "").trim(), deleted: Boolean(reviewItemDrafts[item.id]?.deleted) }));
    if (items.some((item) => !item.deleted && (!item.productName || !item.unit || item.quantityText.trim() === "" || !Number.isInteger(item.quantity) || item.quantity < 0))) return notify("Checked Product၊ Quantity နှင့် Unit ကို ပြန်စစ်ပါ");
    const addedItems = reviewAddedItems.map((item) => ({ productId: item.productId, quantity: Number(item.quantity), unit: item.unit.trim(), batchSequence: item.batchSequence }));
    if (addedItems.some((item) => !item.productId || !item.unit || !Number.isInteger(item.quantity) || item.quantity <= 0)) return notify("Add Product၊ Quantity နှင့် Unit ကို ပြန်စစ်ပါ");
    setReviewItemsSaving(true);
    try {
      const updated = await onPatch({ id: order.id, action: "review_order_items_edit", items: items.map(({ itemId, productName, quantity, unit, deleted }) => ({ itemId, productName, quantity, unit, deleted })), addedItems, editRemark: reviewItemsRemark });
      setReviewItemsEditing(false);
      setReviewItemsRemark("");
      setReviewAddedItems([]);
      setReviewItemDrafts(Object.fromEntries((updated.orderItems || []).map((item) => [item.id, { productName: item.substitutionStatus === "confirmed" && item.substituteProductName ? item.substituteProductName : item.matchedProductName || item.originalDescription, quantity: String(item.substitutionStatus === "confirmed" && item.substituteProductName ? item.substituteQuantity : item.checkedQuantity >= 0 ? item.checkedQuantity : item.pickedQuantity), unit: item.checkedUnit || item.originalUnit || "Unit", deleted: false }])));
      await loadOrderEvents();
      notify(order.saleApproved && ["packed", "rescheduled"].includes(order.dispatchStatus) ? "Checked Products ပြင်ပြီးပါပြီ • Warehouse Recheck သို့ ပြန်ပို့ပြီး" : order.dispatchStatus === "delivered" ? "ပို့ပြီး Order Checked Products ပြင်ပြီး • Delivered Status မပျက်ပါ" : ["out_for_delivery", "partial"].includes(order.dispatchStatus) ? "On the Way Order Checked Products ပြင်ပြီး • Delivery Team ကို အသိပေးပြီး" : "Checked Products ပြင်ပြီးပါပြီ");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Products / Quantity ပြင်မရပါ");
    } finally {
      setReviewItemsSaving(false);
    }
  }

  async function sendPurchaseRequest(event: FormEvent) {
    event.preventDefault();
    if (parsedPurchaseItems.invalid.length) return notify(`မခွဲနိုင်သော စာကြောင်း ${parsedPurchaseItems.invalid.length} ကြောင်းရှိပါတယ်။ Product Name + Qty + Unit ပုံစံ ပြန်စစ်ပါ။`);
    if (!parsedPurchaseItems.items.length) return notify("မရရှိသော ပစ္စည်းစာရင်း ထည့်ပါ");
    setPurchaseSaving(true);
    try {
      const response = await fetch("/api/purchase-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: order.id, batchSequence: purchaseForm.batchSequence, note: purchaseForm.note, items: parsedPurchaseItems.items }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Purchase Request ပို့မရပါ");
      (data.requests || [data.request]).filter(Boolean).forEach((request: PurchaseRequest) => onPurchaseCreated(request));
      setPurchaseForm((current) => ({ ...current, bulkText: "", note: "" }));
      notify(`Purchase Team သို့ ပစ္စည်း ${parsedPurchaseItems.items.length} မျိုး ပို့ပြီးပါပြီ`);
    } catch (error) { notify(error instanceof Error ? error.message : "Purchase Request ပို့မရပါ"); }
    finally { setPurchaseSaving(false); }
  }

  async function prepareSaleOrderPhoto(file: File | null) {
    if (!file) return;
    setSaleOrderPhotoPreparing(true);
    setSaleOrderPhotoSaved(null);
    try {
      const optimizedFile = await optimizeImageFile(file, 1600, 180 * 1024);
      setSaleOrderPhoto(optimizedFile);
      setSaleOrderPhotoPreview(URL.createObjectURL(optimizedFile));
      notify(`Sale Order Photo Size လျှော့ပြီး • ${Math.ceil(optimizedFile.size / 1024).toLocaleString()} KB`);
    } catch {
      setSaleOrderPhoto(file);
      setSaleOrderPhotoPreview(URL.createObjectURL(file));
    } finally {
      setSaleOrderPhotoPreparing(false);
      if (saleOrderCameraRef.current) saleOrderCameraRef.current.value = "";
      if (saleOrderGalleryRef.current) saleOrderGalleryRef.current.value = "";
    }
  }

  async function uploadSaleOrderPhoto() {
    if (!saleOrderPhoto) return notify("Sale Order Photo ရိုက်ပါ သို့မဟုတ် Gallery မှရွေးပါ");
    setSaleOrderPhotoBusy(true);
    try {
      const body = new FormData();
      body.append("orderId", String(order.id));
      body.append("batchSequence", purchaseForm.batchSequence);
      body.append("file", saleOrderPhoto);
      const response = await fetch("/api/sale-order-photo", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sale Order Photo မသိမ်းနိုင်ပါ");
      setSaleOrderPhotoSaved({ fileName: data.fileName, size: data.size, driveUrl: data.driveUrl || "", folderUrl: data.folderUrl });
      notify(`Sale Order Photo သိမ်းပြီး • Google Drive Auto Sync စောင့်နေသည် • ${Math.ceil(Number(data.size) / 1024).toLocaleString()} KB`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sale Order Photo မသိမ်းနိုင်ပါ");
    } finally {
      setSaleOrderPhotoBusy(false);
    }
  }

  async function uploadDeliveryProof() {
    if (!proofFile) return notify("ကားဂိတ်ဘောင်ချာ သို့မဟုတ် ငွေသိမ်းဘောင်ချာပုံ ရိုက်ပါ / ရွေးပါ");
    setProofBusy(true);
    try {
      const body = new FormData();
      body.append("orderId", String(order.id));
      const optimizedFile = await optimizeImageFile(proofFile);
      body.append("file", optimizedFile);
      const response = await fetch("/api/delivery-proof", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ဘောင်ချာပုံ တင်မရပါ");
      onProofUploaded(data.proof);
      setProofPreview(data.proofUrl);
      setProofFile(null);
      notify(`ကားဂိတ်ဘောင်ချာ တင်ပြီးပါပြီ • သိမ်းထားသော Size ${Math.ceil(optimizedFile.size / 1024).toLocaleString()} KB`);
    } catch (error) { notify(error instanceof Error ? error.message : "ဘောင်ချာပုံ တင်မရပါ"); }
    finally { setProofBusy(false); }
  }

  async function uploadDeliveryIncident(event: FormEvent) {
    event.preventDefault();
    if (!incidentFile) return notify("အထောက်အထားပုံ ရိုက်ပါ / ရွေးပါ");
    if (!incidentForm.itemDetails.trim()) return notify("ပစ္စည်းအမည်၊ အရေအတွက်နှင့် အကြောင်းအရာ ရေးပါ");
    if (incidentForm.issueType === "return" && Number(incidentForm.deductionAmount) <= 0) return notify("Return ပစ္စည်းတန်ဖိုး ထည့်ပါ");
    setIncidentBusy(true);
    try {
      const body = new FormData();
      body.append("orderId", String(order.id));
      body.append("issueType", incidentForm.issueType);
      body.append("itemDetails", incidentForm.itemDetails);
      body.append("deductionAmount", incidentForm.issueType === "return" ? incidentForm.deductionAmount : "0");
      const optimizedFile = await optimizeImageFile(incidentFile);
      body.append("file", optimizedFile);
      const response = await fetch("/api/delivery-incidents", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delivery အထောက်အထား တင်မရပါ");
      if (data.order) onProofUploaded(data.order);
      if (data.issue) {
        setDeliveryIssues((current) => [data.issue, ...current]);
        onIncidentUploaded(data.issue);
      }
      setIncidentFile(null);
      setIncidentForm({ issueType: "return", itemDetails: "", deductionAmount: "" });
      notify(`${data.issue?.deductionAmount > 0 ? `Return ပစ္စည်းတန်ဖိုး ${money(data.issue.deductionAmount)} MMK နှုတ်ပြီးပါပြီ` : "Delivery အထောက်အထား တင်ပြီးပါပြီ — ငွေမနှုတ်ပါ"} • ပုံ ${Math.ceil(optimizedFile.size / 1024).toLocaleString()} KB`);
    } catch (error) { notify(error instanceof Error ? error.message : "Delivery အထောက်အထား တင်မရပါ"); }
    finally { setIncidentBusy(false); }
  }

  async function saveWarehouseReturn(event: FormEvent) {
    event.preventDefault();
    const returnedBoxes = Number(warehouseReturnForm.returnedBoxes || 0);
    const returnedBundles = Number(warehouseReturnForm.returnedBundles || 0);
    if (returnedBoxes + returnedBundles <= 0) return notify("Return လက်ခံမည့် ဘုံး သို့မဟုတ် ဆွဲ အရေအတွက် ထည့်ပါ");
    if (!warehouseReturnForm.note.trim()) return notify("ငွေစာရင်းအတွက် မှတ်ချက် ရေးပါ");
    setWarehouseReturnBusy(true);
    try {
      const response = await fetch("/api/warehouse-returns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.id, returnedBoxes, returnedBundles, financeStatus: warehouseReturnForm.financeStatus, note: warehouseReturnForm.note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Warehouse Return လက်ခံမှတ်တမ်း သိမ်းမရပါ");
      setWarehouseReturns((current) => [data.return, ...current]);
      setWarehouseReturnForm({ returnedBoxes: "", returnedBundles: "", financeStatus: "not_deducted", note: "" });
      notify("Warehouse Return လက်ခံမှတ်တမ်း သိမ်းပြီးပါပြီ");
    } catch (error) { notify(error instanceof Error ? error.message : "Warehouse Return လက်ခံမှတ်တမ်း သိမ်းမရပါ"); }
    finally { setWarehouseReturnBusy(false); }
  }

  async function markWarehouseReturnDeducted(id: number) {
    setWarehouseReturnBusy(true);
    try {
      const response = await fetch("/api/warehouse-returns", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, financeStatus: "deducted" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ငွေစာရင်း status ပြောင်းမရပါ");
      setWarehouseReturns((current) => current.map((item) => item.id === id ? data.return : item));
      notify("ငွေစာရင်း နှုတ်ပြီးအဖြစ် ပြောင်းပြီးပါပြီ");
    } catch (error) { notify(error instanceof Error ? error.message : "ငွေစာရင်း status ပြောင်းမရပါ"); }
    finally { setWarehouseReturnBusy(false); }
  }

  async function removeSaleOrder() {
    const confirmed = window.confirm(`${order.customerName} • ${order.orderNo}\n\nဒီ Sale Order နှင့် သက်ဆိုင်သော Voucher၊ Payment၊ Purchase Request၊ ပုံများနှင့် မှတ်တမ်းများကို အပြီးဖျက်မည်။ ပြန်လည်ရယူ၍မရပါ။ ဆက်လုပ်မလား?`);
    if (!confirmed) return;
    setDeleteBusy(true);
    try {
      await onDelete(order.id);
      notify("Sale Order ဖျက်ပြီးပါပြီ");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sale Order ဖျက်မရပါ");
      setDeleteBusy(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><section className="sheet detail-sheet" onMouseDown={(event) => event.stopPropagation()}>
    <div className="sheet-handle" />
    <div className="sheet-title">
      <div className="detail-customer-title">
        <p className="eyebrow">{order.orderNo}</p>
        <div className="detail-customer-name-row"><h2>{order.customerName}</h2>{canSale && !customerEditing && <button type="button" className="customer-edit-trigger" onClick={() => setCustomerEditing(true)}><Pencil size={14} />Customer ပြင်မည်</button>}</div>
        <small>{order.township} • {order.route} • {order.saleOrderCount || 1} Sale Order</small>
        <small>Sale Man: {assignedSalePeople(order)}</small>
        {canEditRouteSalesperson && !orderMetaEditing && <button type="button" className="order-meta-edit-trigger" onClick={() => setOrderMetaEditing(true)}><Pencil size={14} />Route / Sale Man ပြင်မည်</button>}
        {canSale && customerEditing && <div className="customer-edit-panel"><label><span>Customer Name</span><select value={customerEditKey} onChange={(event) => setCustomerEditKey(event.target.value)}>{customerDirectory.map((customer) => { const key = customerBalanceKey(customer.name, customer.township); return <option value={key} key={`${customer.source}-${customer.id}-${key}`}>{customer.name} — {customer.township}</option>; })}</select></label><label><span>ပြင်ဆင်ရသည့် Remark</span><textarea rows={2} required placeholder="ပြင်ဆင်ရသည့်အကြောင်းရင်း" value={editRemark} onChange={(event) => setEditRemark(event.target.value)} /></label><div><button type="button" className="customer-edit-cancel" disabled={customerSaving} onClick={() => { setCustomerEditKey(customerBalanceKey(order.customerName, order.township)); setEditRemark(""); setCustomerEditing(false); }}>မပြင်တော့ပါ</button><button type="button" className="customer-edit-save" disabled={customerSaving || !editRemark.trim()} onClick={() => void saveCustomerName()}>{customerSaving ? "သိမ်းနေသည်…" : "Customer သိမ်းမည်"}</button></div></div>}
        {canEditRouteSalesperson && orderMetaEditing && <div className="order-meta-edit-panel"><div className="order-meta-edit-fields"><label><span>Route</span><select value={routeDraft} onChange={(event) => setRouteDraft(event.target.value)}>{ROUTES.map((route) => <option value={route} key={route}>{route}</option>)}</select></label><label><span>Sale Man</span><select value={salespersonDraft} onChange={(event) => setSalespersonDraft(event.target.value)}>{SALE_PEOPLE.map((name) => <option value={name} key={name}>{name}</option>)}</select></label></div><label className="order-edit-remark"><span>ပြင်ဆင်ရသည့် Remark</span><textarea rows={2} required placeholder="Route / Sale Man ပြင်ဆင်ရသည့်အကြောင်းရင်း" value={editRemark} onChange={(event) => setEditRemark(event.target.value)} /></label><p><ShieldCheck size={14} />Admin / Sale Team • ပို့ရန်ကျန် / On the Way တွင် ပြင်နိုင်သည်</p><div><button type="button" className="customer-edit-cancel" disabled={orderMetaSaving} onClick={() => { setRouteDraft(order.route); setSalespersonDraft(order.salesperson || "Admin"); setEditRemark(""); setOrderMetaEditing(false); }}>မပြင်တော့ပါ</button><button type="button" className="customer-edit-save" disabled={orderMetaSaving || !editRemark.trim()} onClick={() => void saveRouteAndSalesperson()}>{orderMetaSaving ? "သိမ်းနေသည်…" : "Route / Sale Man သိမ်းမည်"}</button></div></div>}
      </div>
      <button onClick={onClose} aria-label="ပိတ်မည်"><X /></button>
    </div>
    <div className={`workflow-status ${order.warehouseStatus}`}><span>{order.warehouseStatus === "finished" ? "Finished Sale Order" : order.warehouseStatus === "picked" ? "Picked • Checker စစ်ရန်" : order.warehouseBatches.some((batch) => batch.status === "picking") ? `Processing • Picking — ${order.warehouseBatches.find((batch) => batch.status === "picking")?.pickingStartedBy || "Warehouse"}` : "Processing Sale Order"}</span>{order.addonPending && <b>နောက်တိုးရှိသည်</b>}</div>
    <div className="order-time-summary"><div><Clock3 size={16} /><span><small>Sale Order စဖွင့်ချိန်</small><strong>{notificationTime(order.createdAt)}</strong></span></div><div className={order.warehouseStatus === "finished" ? "finished" : "pending"}><CheckCircle2 size={16} /><span><small>Warehouse Finished ဖြစ်ချိန်</small><strong>{order.warehouseStatus === "finished" && order.warehouseConfirmedAt ? notificationTime(order.warehouseConfirmedAt) : "Warehouse လုပ်ဆောင်နေသည်"}</strong></span></div>{order.dispatchStatus === "delivered" && order.deliveredAt && <div className="delivered"><Truck size={16} /><span><small>Delivered ဖြစ်ချိန် (Myanmar Time)</small><strong>{notificationTime(order.deliveredAt)}</strong></span></div>}</div>
    {(order.packageInstruction || order.remark) && <div className="detail-section order-instruction-detail"><h3><Box size={18} /> Package & Remark</h3>{order.packageInstruction && <div><span>Package ထည့်သွင်းပုံ</span><strong>{order.packageInstruction}</strong></div>}{order.remark && <div><span>Additional Remark</span><strong>{order.remark}</strong></div>}</div>}
    <OrderProductReviewTable order={order} canReturnSubstitution={canSale && order.warehouseStatus === "finished" && !order.saleApproved} busy={busy} onReturnSubstitution={(itemId, returnReason) => run({ action: "salesman_return_substitution", itemId, returnReason }, "Similar Product ကို Warehouse Correction Pending သို့ ပြန်ပို့ပြီးပါပြီ")} />
    {reviewItemsEditable && <section className="detail-section review-items-editor">
      <div className="review-items-editor-head"><span><Pencil size={17} /><strong>{role === "admin" ? "Edit Checked Products" : "Picked / Checked Result Edit"}</strong><small>{role === "admin" ? "Actual Product၊ Quantity၊ Unit၊ Add / Delete / Substitute" : "Review & Approve မလုပ်မီ Final Result ပြင်ရန်"}</small></span>{!reviewItemsEditing && <button type="button" onClick={() => setReviewItemsEditing(true)}><Pencil size={14} />ပြင်မည်</button>}</div>
      <div className="review-items-permission"><ShieldCheck size={15} /><span><strong>{role === "admin" ? "Admin Role Permission" : "Admin / Warehouse Role Permission"}</strong><small>Before / After၊ Edited By၊ Date/Time နှင့် Reason ကို Audit Log တွင် မှတ်တမ်းတင်ပါမည်</small></span></div>
      {role === "admin" && <div className={`review-adjustment-warning ${order.dispatchStatus === "delivered" ? "delivered" : ["out_for_delivery", "partial"].includes(order.dispatchStatus) ? "on-way" : order.saleApproved ? "recheck" : "normal"}`}><strong>{order.dispatchStatus === "delivered" ? "ပို့ပြီး Order — Delivered Status မပျက်ပါ" : ["out_for_delivery", "partial"].includes(order.dispatchStatus) ? "On the Way — Delivery Team ကို Notification ပို့ပါမည်" : order.saleApproved ? "Delivery Approved / ပို့ရန်ကျန် — Warehouse Recheck သို့ ပြန်ပို့ပါမည်" : "Warehouse Completed — Final Checked Result ပြင်နိုင်ပါသည်"}</strong><small>Stock၊ Package၊ Finance နှင့် Sale VR Adjustment Record ကို အလိုအလျောက်ဖန်တီးပါမည်။</small></div>}
      {reviewItemsEditing && <div className="review-items-edit-body">
        <datalist id={`review-product-master-${order.id}`}>{products.filter((product) => product.active).map((product) => <option value={product.productName} key={product.id}>{product.productCode}</option>)}</datalist>
        <div className="review-items-edit-list">{[...(order.orderItems || [])].sort((a, b) => a.batchSequence - b.batchSequence || a.originalRowNumber - b.originalRowNumber || a.id - b.id).map((item) => {
          const draft = reviewItemDrafts[item.id] || { productName: item.substitutionStatus === "confirmed" && item.substituteProductName ? item.substituteProductName : item.matchedProductName || item.originalDescription, quantity: String(item.substitutionStatus === "confirmed" && item.substituteProductName ? item.substituteQuantity : item.checkedQuantity >= 0 ? item.checkedQuantity : item.pickedQuantity), unit: item.checkedUnit || item.originalUnit || "Unit", deleted: false };
          return <article className={draft.deleted ? "marked-delete" : ""} key={`review-edit-${item.id}`}><b>{order.warehouseBatches.length > 1 ? `${item.batchSequence}.${item.originalRowNumber}` : item.originalRowNumber}</b><div className="review-original"><span>Original Sale Order</span><strong>{item.originalDescription}</strong><small>Ordered Qty: {item.quantity} {displayUnit(item.originalUnit)}</small></div><label><span>Checked / Substitute Product</span><input disabled={draft.deleted} list={`review-product-master-${order.id}`} value={draft.productName} onChange={(event) => setReviewItemDrafts((current) => ({ ...current, [item.id]: { ...draft, productName: event.target.value } }))} /></label><label className="qty"><span>Actual Qty</span><input disabled={draft.deleted} type="number" inputMode="numeric" min="0" max="999999" step="1" value={draft.quantity} onChange={(event) => setReviewItemDrafts((current) => ({ ...current, [item.id]: { ...draft, quantity: event.target.value } }))} /></label><label className="unit"><span>Unit</span><input disabled={draft.deleted} value={draft.unit} placeholder="Bx / Pcs" onChange={(event) => setReviewItemDrafts((current) => ({ ...current, [item.id]: { ...draft, unit: event.target.value } }))} /></label>{role === "admin" && <button type="button" className={draft.deleted ? "restore-product" : "delete-product"} onClick={() => setReviewItemDrafts((current) => ({ ...current, [item.id]: { ...draft, deleted: !draft.deleted } }))}>{draft.deleted ? <><RefreshCw size={14} />ပြန်ထားမည်</> : <><Trash2 size={14} />Delete</>}</button>}</article>;
        })}</div>
        {role === "admin" && <div className="review-added-products"><div className="review-added-products-head"><span><strong>Add Checked Product</strong><small>Product Master မှရွေးပြီး Actual Quantity နှင့် Unit ထည့်ပါ</small></span><button type="button" onClick={() => setReviewAddedItems((current) => [...current, { key: `${Date.now()}-${current.length}`, productId: 0, quantity: "1", unit: "", batchSequence: order.warehouseBatches[0]?.sequence || 1 }])}><Plus size={14} />Add Product</button></div>{reviewAddedItems.map((added) => <article key={added.key}><ProductSearchSelect products={products.filter((product) => product.active)} selectedId={added.productId || undefined} onSelect={(product) => setReviewAddedItems((current) => current.map((entry) => entry.key === added.key ? { ...entry, productId: product.id } : entry))} onClear={() => setReviewAddedItems((current) => current.map((entry) => entry.key === added.key ? { ...entry, productId: 0 } : entry))} placeholder="Product Code / Name ရှာရန်" /><label><span>Actual Qty</span><input type="number" min="1" step="1" value={added.quantity} onChange={(event) => setReviewAddedItems((current) => current.map((entry) => entry.key === added.key ? { ...entry, quantity: event.target.value } : entry))} /></label><label><span>Unit</span><input value={added.unit} placeholder="Bx / Pcs" onChange={(event) => setReviewAddedItems((current) => current.map((entry) => entry.key === added.key ? { ...entry, unit: event.target.value } : entry))} /></label>{order.warehouseBatches.length > 1 && <label><span>Sale Order</span><select value={added.batchSequence} onChange={(event) => setReviewAddedItems((current) => current.map((entry) => entry.key === added.key ? { ...entry, batchSequence: Number(event.target.value) } : entry))}>{order.warehouseBatches.map((batch) => <option value={batch.sequence} key={batch.sequence}>Order {batch.sequence}</option>)}</select></label>}<button type="button" className="remove-added-product" aria-label="Add Product ဖယ်ရန်" onClick={() => setReviewAddedItems((current) => current.filter((entry) => entry.key !== added.key))}><X size={15} /></button></article>)}</div>}
        <label className="review-items-remark"><span>ပြင်ဆင်ရသည့်အကြောင်းရင်း</span><textarea rows={2} required placeholder="ဥပမာ — Warehouse final checking အရ Product / Quantity / Unit ပြင်ခြင်း" value={reviewItemsRemark} onChange={(event) => setReviewItemsRemark(event.target.value)} /></label>
        <div className="review-items-edit-actions"><button type="button" className="cancel" disabled={reviewItemsSaving} onClick={() => { setReviewItemsEditing(false); setReviewItemsRemark(""); setReviewAddedItems([]); setReviewItemDrafts(Object.fromEntries((order.orderItems || []).map((item) => [item.id, { productName: item.substitutionStatus === "confirmed" && item.substituteProductName ? item.substituteProductName : item.matchedProductName || item.originalDescription, quantity: String(item.substitutionStatus === "confirmed" && item.substituteProductName ? item.substituteQuantity : item.checkedQuantity >= 0 ? item.checkedQuantity : item.pickedQuantity), unit: item.checkedUnit || item.originalUnit || "Unit", deleted: false }]))); }}>မပြင်တော့ပါ</button><button type="button" className="save" disabled={reviewItemsSaving || !reviewItemsRemark.trim()} onClick={() => void saveReviewOrderItems()}>{reviewItemsSaving ? "သိမ်းနေသည်…" : "Checked Products သိမ်းမည်"}</button></div>
      </div>}
    </section>}

    {order.deliveryProofKey && !canDelivery && <div className="detail-section shared-proof-section"><h3><Camera size={18} /> ကားဂိတ် / ငွေသိမ်းဘောင်ချာ</h3><p className="section-help">Department အားလုံးအတွက် ကြည့်ရှုခွင့်ရှိပါသည်။ ပုံကိုနှိပ်၍ အကြီးချဲ့ကြည့်နိုင်ပါသည်။</p><a className="shared-proof-viewer" href={`/api/delivery-proof?orderId=${order.id}&v=${encodeURIComponent(order.deliveryProofUploadedAt)}`} target="_blank" rel="noreferrer"><img src={`/api/delivery-proof?orderId=${order.id}&v=${encodeURIComponent(order.deliveryProofUploadedAt)}`} alt="ကားဂိတ်ဘောင်ချာ သို့မဟုတ် ငွေသိမ်းဘောင်ချာ" /><span><CheckCircle2 size={16} /><strong>ဘောင်ချာပုံ ကြည့်ရန်</strong><small>{order.deliveryProofUploadedBy || "Delivery"} • {order.deliveryProofUploadedAt ? notificationTime(order.deliveryProofUploadedAt) : "တင်ပြီး"}</small></span><ChevronRight size={18} /></a></div>}

    {(issuesLoading || deliveryIssues.length > 0) && <div className="detail-section delivery-incident-history"><h3><Camera size={18} /> Delivery ပစ္စည်းပြဿနာ မှတ်တမ်း</h3><p className="section-help">Department အားလုံး ကြည့်နိုင်ပါသည်။ အထောက်အထားပုံကို နှိပ်၍ အကြီးချဲ့ကြည့်နိုင်ပါသည်။</p>{issuesLoading ? <Loading /> : <div className="delivery-incident-list">{deliveryIssues.map((issue) => <article className={`delivery-incident-card ${issue.issueType}`} key={issue.id}><a href={`/api/delivery-incidents?issueId=${issue.id}`} target="_blank" rel="noreferrer"><img src={`/api/delivery-incidents?issueId=${issue.id}`} alt={`${deliveryIssueLabel[issue.issueType]} အထောက်အထား`} /></a><div><span className="incident-type">{deliveryIssueLabel[issue.issueType]}</span><strong>{issue.itemDetails}</strong>{issue.issueType === "return" ? <p className="incident-deduction">− {money(issue.deductionAmount)} MMK <small>Voucher {money(issue.voucherBefore)} → {money(issue.voucherAfter)}</small></p> : <p className="incident-no-deduction">ငွေမနှုတ်ပါ</p>}<small>{issue.createdBy} • {notificationTime(issue.createdAt)}</small></div><a className="incident-open" href={`/api/delivery-incidents?issueId=${issue.id}`} target="_blank" rel="noreferrer">ပုံကြည့်ရန် <ChevronRight size={15} /></a></article>)}</div>}</div>}

    {(warehouseReturnsLoading || warehouseReturns.length > 0) && <div className="detail-section warehouse-return-history"><h3><RefreshCw size={18} /> Warehouse Return လက်ခံမှတ်တမ်း</h3><p className="section-help">Department အားလုံး ကြည့်နိုင်ပါသည်။ Return အရေအတွက်၊ ငွေစာရင်းအခြေအနေနှင့် မှတ်ချက်ကို ပြထားပါသည်။</p>{warehouseReturnsLoading ? <Loading /> : <div className="warehouse-return-list">{warehouseReturns.map((item) => <article className="warehouse-return-card" key={item.id}><div className="warehouse-return-card-top"><div><strong>Return • ဘုံး {item.returnedBoxes} / ဆွဲ {item.returnedBundles}</strong><small>{item.acceptedBy} • {notificationTime(item.acceptedAt)}</small></div><span className={`warehouse-return-status ${item.financeStatus === "deducted" ? "deducted" : "not-deducted"}`}>{item.financeStatus === "deducted" ? "ငွေစာရင်း နှုတ်ပြီး" : "ငွေစာရင်း မနှုတ်ရသေး"}</span></div><p>{item.note}</p>{item.financeStatus === "deducted" && item.updatedBy && <small>နောက်ဆုံးပြင်ဆင်သူ: {item.updatedBy} • {notificationTime(item.updatedAt)}</small>}{canWarehouse && item.financeStatus === "not_deducted" && <button type="button" disabled={warehouseReturnBusy} onClick={() => void markWarehouseReturnDeducted(item.id)}><CheckCircle2 size={15} />ငွေစာရင်း နှုတ်ပြီးအဖြစ် ပြောင်းမည်</button>}</article>)}</div>}</div>}

    {canWarehouse && <div className="detail-section warehouse-section">
      <h3>Warehouse အရေအတွက်</h3>
      <p className="section-help">Package အသစ်ဖြစ်မှ အရေအတွက်တိုးပါမယ်။ မူလ Package ထဲပေါင်းသော နောက်တိုး Order နှင့် Separate Order သည် Package count မတိုးပါ။</p>
      <div className="warehouse-batches">{order.warehouseBatches.map((batch) => {
        const draft = batchDrafts[batch.sequence] || { packageMode: batch.packageMode || "", linkedOrderId: String(batch.linkedOrderId || ""), boxes: "", bundles: "", itemPackedBy: "", itemCheckedBy: "", boxClosedBy: "" };
        const batchOrderItems = (order.orderItems || []).filter((item) => item.batchSequence === batch.sequence);
        const productRowsBlocked = batchOrderItems.some((item) => ["unknown", "new_product_requested"].includes(item.matchStatus) || item.fulfillmentStatus === "pending" || item.substitutionStatus === "returned");
        const usesOriginalPackage = draft.packageMode === "original";
        const packageUndecided = !draft.packageMode;
        const batchTotal = usesOriginalPackage ? 0 : Number(draft.boxes || 0) + Number(draft.bundles || 0);
        return <div className={`warehouse-batch ${batch.status} ${packageUndecided ? "package-undecided" : usesOriginalPackage ? "original-package" : "new-package"}`} key={batch.sequence}>
          <div className="batch-heading"><div><strong>{batch.label || (batch.sequence === 1 ? "အရင် Sale Order #1" : `နောက်တိုး Sale Order #${batch.sequence}`)}</strong><small>Sale Man: {batch.salesperson || order.salesperson || "Admin"}</small><small>{batch.status === "finished" ? "Warehouse လုပ်ငန်းစဉ် ပြီး" : batch.status === "picked" ? "Picker ပြီး • Checker စစ်ရန်" : "Pickup လုပ်ဆောင်ရန်"}</small></div><span>{batch.status === "finished" ? "ပြီး" : batch.status === "picked" ? "Picked" : "Pending"}</span></div>
          {packageUndecided ? <div className="package-decision-required"><Clock3 size={16} />Picked / Checked ပြီးချိန်တွင် Warehouse မှ Packaging ကို ဆုံးဖြတ်ပါမည်။</div> : <div className={`batch-package-mode ${usesOriginalPackage ? "original" : "new"}`}><Box size={16} /><span><strong>{usesOriginalPackage ? batch.sequence === 1 ? "Separate Order • အနီးဆုံး Order ၏ မူလ Package ထဲပေါင်းမည်" : "နောက်တိုး Order • မူလ Package ထဲပေါင်းမည်" : "Package အသစ်လုပ်မည်"}</strong><small>{usesOriginalPackage ? batch.sequence === 1 ? `${batch.linkedOrderNo || "အနီးဆုံး Order"} • ${batch.linkedOrderDate || ""} • Extra 0` : "Package count မတိုးပါ • Extra 0" : `${draft.boxes || 0} ဘုံး • ${draft.bundles || 0} ဆွဲ`}</small></span></div>}
          <div className="packaging-auto-staff"><span><b>Picker</b><strong>{batch.itemPackedBy || "မပြီးသေး"}</strong></span><span><b>Checker</b><strong>{batch.itemCheckedBy || "စောင့်နေသည်"}</strong></span></div>
          {batch.status === "finished" && batch.itemPackedBy && batch.boxClosedBy && <div className="warehouse-duty-complete"><span><CheckCircle2 size={14} /><b>ပစ္စည်းထည့်</b>{batch.itemPackedBy}</span><span><CheckCircle2 size={14} /><b>ပစ္စည်းစစ်</b>{batch.itemCheckedBy || "မသတ်မှတ်ထား"}</span><span><CheckCircle2 size={14} /><b>ပုံးပိတ်</b>{batch.boxClosedBy}</span></div>}
          {!packageUndecided && <div className="batch-total"><span>ဒီ Order Package Total</span><strong>{batchTotal}</strong></div>}
          {productRowsBlocked && <div className="product-row-blocked"><Clock3 size={15} />Product Rows အားလုံး Resolve နှင့် Picked Qty အတည်ပြုပြီးမှ Finished လုပ်နိုင်ပါသည်</div>}
          {batch.status !== "finished" && <div className="locked-note"><Clock3 />Warehouse Processing စာမျက်နှာတွင် Pickup / Checking ဆက်လုပ်ပါ။</div>}
        </div>;
      })}</div>
      <div className="warehouse-grand-total"><div><span>စုစုပေါင်း ဘုံး</span><strong>{warehouseDraftTotal.boxes}</strong></div><div><span>စုစုပေါင်း ဆွဲ</span><strong>{warehouseDraftTotal.bundles}</strong></div><div><span>အားလုံး Total</span><strong>{warehouseDraftTotal.boxes + warehouseDraftTotal.bundles}</strong></div></div>
    </div>}

    {canWarehouse && <form className="detail-section warehouse-return-form" onSubmit={saveWarehouseReturn}><h3><RefreshCw size={18} /> ဖာ Return ပြန်အပ်လက်ခံ Mode</h3><div className="warehouse-return-permission"><ShieldCheck size={16} /><span><strong>Admin / Warehouse Role Permission</strong><small>Return ပစ္စည်းကို လက်ခံပြီး ငွေစာရင်းအခြေအနေနှင့် မှတ်ချက် ထည့်ပါ။</small></span></div><div className="warehouse-return-available"><div><span>Return လက်ခံနိုင်သေးသော ဘုံး</span><strong>{availableReturnBoxes}</strong></div><div><span>Return လက်ခံနိုင်သေးသော ဆွဲ</span><strong>{availableReturnBundles}</strong></div></div><div className="two-fields compact"><label><span>Return ဘုံး</span><input type="number" inputMode="numeric" min="0" max={availableReturnBoxes} value={warehouseReturnForm.returnedBoxes} onChange={(event) => setWarehouseReturnForm((current) => ({ ...current, returnedBoxes: event.target.value }))} /></label><label><span>Return ဆွဲ</span><input type="number" inputMode="numeric" min="0" max={availableReturnBundles} value={warehouseReturnForm.returnedBundles} onChange={(event) => setWarehouseReturnForm((current) => ({ ...current, returnedBundles: event.target.value }))} /></label></div><label><span>ငွေစာရင်းအခြေအနေ</span><select value={warehouseReturnForm.financeStatus} onChange={(event) => setWarehouseReturnForm((current) => ({ ...current, financeStatus: event.target.value as WarehouseReturn["financeStatus"] }))}><option value="not_deducted">ငွေစာရင်း မနှုတ်ရသေး</option><option value="deducted">ငွေစာရင်း နှုတ်ပြီး</option></select></label><label><span>ငွေစာရင်း မှတ်ချက်</span><textarea required rows={3} placeholder="ဥပမာ — Finance ကို အသိပေးပြီး၊ ငွေစာရင်း မနှုတ်ရသေးပါ" value={warehouseReturnForm.note} onChange={(event) => setWarehouseReturnForm((current) => ({ ...current, note: event.target.value }))} /></label><button disabled={warehouseReturnBusy || availableReturnBoxes + availableReturnBundles <= 0}>{warehouseReturnBusy ? "သိမ်းနေသည်…" : "Warehouse Return လက်ခံမည်"}</button></form>}

    {canWarehouse && <form className="detail-section purchase-request-form" onSubmit={sendPurchaseRequest}><h3><ShoppingCart size={18} /> မရရှိသောပစ္စည်း — Purchase ပို့ရန်</h3><p className="section-help">ပစ္စည်းတစ်မျိုးကို တစ်ကြောင်းစီ ရေးပါ။ Date နဲ့ Customer Name ကို ထိပ်မှာ Paste လုပ်ထားလည်း အလိုအလျောက်ကျော်ပေးပါမယ်။</p><label><span>Sale Order</span><select value={purchaseForm.batchSequence} onChange={(e) => { setPurchaseForm({ ...purchaseForm, batchSequence: e.target.value }); setSaleOrderPhotoSaved(null); }}>{order.warehouseBatches.map((batch) => <option value={batch.sequence} key={batch.sequence}>{batch.label || `Sale Order #${batch.sequence}`}</option>)}</select></label><div className="sale-order-photo-box"><div className="sale-order-photo-heading"><Camera size={18} /><span><strong>Sale Order Photo</strong><small>Camera ဖြင့်ရိုက်ပါ သို့မဟုတ် Gallery မှရွေးပါ • Google Drive သို့ Auto Sync လုပ်မည်</small></span></div><input ref={saleOrderCameraRef} className="sale-order-photo-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void prepareSaleOrderPhoto(event.target.files?.[0] || null)} /><input ref={saleOrderGalleryRef} className="sale-order-photo-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void prepareSaleOrderPhoto(event.target.files?.[0] || null)} />{saleOrderPhotoPreview && <div className="sale-order-photo-preview"><img src={saleOrderPhotoPreview} alt="ရွေးထားသော Sale Order" /><span><b>{saleOrderPhoto?.name}</b><small>{saleOrderPhoto ? `${Math.ceil(saleOrderPhoto.size / 1024).toLocaleString()} KB • Storage Size လျှော့ပြီး` : ""}</small></span></div>}<div className="sale-order-photo-pickers"><button type="button" disabled={saleOrderPhotoPreparing || saleOrderPhotoBusy} onClick={() => saleOrderCameraRef.current?.click()}><Camera size={17} />ဓာတ်ပုံရိုက်ရန်</button><button type="button" disabled={saleOrderPhotoPreparing || saleOrderPhotoBusy} onClick={() => saleOrderGalleryRef.current?.click()}><Upload size={17} />Gallery မှရွေးရန်</button></div>{saleOrderPhotoPreparing && <div className="sale-order-photo-progress"><RefreshCw className="spin" size={15} />Photo Size လျှော့နေသည်…</div>}{saleOrderPhotoSaved ? <div className="sale-order-photo-saved"><CheckCircle2 size={17} /><span><strong>Drive Auto Sync Queue ထဲ ထည့်ပြီးပါပြီ</strong><small>{saleOrderPhotoSaved.fileName} • {Math.ceil(saleOrderPhotoSaved.size / 1024).toLocaleString()} KB</small></span><a href={saleOrderPhotoSaved.folderUrl} target="_blank" rel="noreferrer">Drive Folder</a></div> : <button className="sale-order-photo-upload" type="button" disabled={!saleOrderPhoto || saleOrderPhotoPreparing || saleOrderPhotoBusy} onClick={() => void uploadSaleOrderPhoto()}><Upload size={17} />{saleOrderPhotoBusy ? "Photo သိမ်းနေသည်…" : "Photo သိမ်းမည် • Drive Auto Sync"}</button>}</div><label><span>မရရှိသော ပစ္စည်းစာရင်း</span><textarea required rows={10} placeholder={"ဥပမာ —\n1-10-2026\n" + order.customerName + "\nSpiru Garlic 5b\nPropanolol 40 pink 1b\nToderm lotion 36b"} value={purchaseForm.bulkText} onChange={(e) => setPurchaseForm({ ...purchaseForm, bulkText: e.target.value })} /></label>{purchaseForm.bulkText && <div className={`bulk-parse-result ${parsedPurchaseItems.invalid.length ? "has-error" : ""}`}><strong>{parsedPurchaseItems.items.length} မျိုး ခွဲပြီး</strong>{parsedPurchaseItems.invalid.length > 0 && <span>မခွဲနိုင်သော စာကြောင်း {parsedPurchaseItems.invalid.length} ကြောင်း</span>}</div>}<label><span>မှတ်ချက်</span><input placeholder="စာရင်းအားလုံးအတွက် မှတ်ချက် (လိုအပ်ပါက)" value={purchaseForm.note} onChange={(e) => setPurchaseForm({ ...purchaseForm, note: e.target.value })} /></label><button disabled={purchaseSaving || parsedPurchaseItems.items.length === 0}>{purchaseSaving ? "ပို့နေသည်…" : `ပစ္စည်း ${parsedPurchaseItems.items.length || ""} မျိုး Purchase Team သို့ ပို့မည်`}</button></form>}

    {!canWarehouse && <div className="detail-counts"><div><span>ဘုံး</span><strong>{t.boxes}</strong></div><div><span>ဆွဲ</span><strong>{t.bundles}</strong></div><div><span>Total</span><strong>{t.total}</strong></div><div className="red"><span>ကျန်</span><strong>{t.remaining}</strong></div></div>}

    {canSale && <div className="detail-section sale-voucher-section">
      <h3>Salesman Review • Delivery Approval</h3>
      {order.warehouseStatus !== "finished" ? <div className="locked-note"><Clock3 />Warehouse Picker နှင့် Checker ပြီးဆုံးမှ Review လုပ်နိုင်ပါမယ်။</div> : order.saleApproved ? <><div className="approved-note"><CheckCircle2 />Products Reviewed • Delivery Approved<br /><small>{order.saleApprovedBy}</small></div>{order.dispatchStatus === "delivered" && role !== "admin" ? <div className="locked-note"><Clock3 />Delivered ဖြစ်ပြီးသော Order ၏ Sale VR Amount ကို Admin သာ ပြင်နိုင်ပါသည်။</div> : voucherEditing ? <div className="voucher-edit-panel"><p className="section-help">Sale Team သည် Delivered မဖြစ်ခင်အထိ၊ Admin သည် Delivered ဖြစ်ပြီးနောက်ပါ Sale VR Amount ကို ပြင်နိုင်ပါသည်။ ပြင်ဆင်မှုကြောင့် Delivery Approved Status မပျက်ပါ။ Audit Log မှတ်တမ်းတင်ပြီး Finance နှင့် Delivery ကို အသိပေးပါမည်။</p>{voucherAmountFields}<div className="voucher-edit-actions"><button type="button" className="cancel" disabled={busy} onClick={() => { voucherDraftDirtyRef.current = false; setVoucherAmount(order.voucherAmount ? String(order.voucherAmount) : ""); setVoucherAmounts(makeVoucherDrafts(order)); setVoucherEditing(false); }}>မပြင်တော့ပါ</button><button type="button" disabled={busy} onClick={() => void run(order.warehouseBatches.length > 1 ? { action: "voucher_edit", voucherAmounts: order.warehouseBatches.map((batch) => ({ sequence: batch.sequence, amount: voucherAmounts[batch.sequence] ?? "" })) } : { action: "voucher_edit", voucherAmount }, "Sale VR Amount ပြင်ပြီးပါပြီ")}>{busy ? "သိမ်းနေသည်…" : "Sale VR Amount သိမ်းမည်"}</button></div></div> : canEditSaleVoucher && <button type="button" className="salesman-review-approve-button" onClick={() => setVoucherEditing(true)}><Pencil size={17} />Sale VR Amount ပြင်မည်</button>}</> : <>
        <p className="section-help">အောက်ပါ Product Table ကိုစစ်ပါ။ အဝါရောင်သည် Quantity ပြောင်းထားသောပစ္စည်း၊ အနီရောင်သည် Unavailable ပစ္စည်း ဖြစ်သည်။ Sale Voucher Amount ဖြည့်ပြီး တစ်ခါတည်း Approve for Delivery လုပ်ပါ။</p>
        {toBuyItems.length > 0 && <div className="salesman-to-buy-panel"><div className="salesman-to-buy-head"><ShoppingCart size={17} /><span><strong>To Buy Review</strong><small>Stock Out / Unavailable Quantity ကို ပြင်ပြီး Delivery Approval နှင့်အတူ Purchase Team သို့ အတည်ပြုပို့ပါမည်။ Qty 0 သည် မဝယ်ရန်ဖြစ်သည်။ Detail ဖွင့်ထားစဉ် Auto Refresh ကို Pause လုပ်ထားပါသည်။</small></span><b>{toBuyItems.length}</b></div><div className="salesman-to-buy-list">{toBuyItems.map((item) => { const actual = item.checkedQuantity >= 0 ? item.checkedQuantity : item.pickedQuantity; return <label key={`to-buy-${item.id}`}><span><strong>{item.originalDescription}</strong><small>{item.originalProductCode || "No Code"} • Ordered {item.quantity} • Actual {actual} {displayUnit(item.originalUnit)}</small></span><span><small>To Buy Qty</small><input type="number" inputMode="numeric" min="0" value={toBuyQtyMap[item.id] ?? String(item.shortageQuantity)} onChange={(event) => { toBuyQtyDirtyRef.current = true; setToBuyQtyMap((current) => ({ ...current, [item.id]: event.target.value })); }} /></span></label>; })}</div></div>}
        {voucherAmountFields}
        <button className="salesman-review-approve-button" disabled={busy} onClick={() => void run(order.warehouseBatches.length > 1 ? { action: "salesman_review_approve", voucherAmounts: order.warehouseBatches.map((batch) => ({ sequence: batch.sequence, amount: voucherAmounts[batch.sequence] ?? "" })), toBuyItems: toBuyItems.map((item) => ({ itemId: item.id, quantity: toBuyQtyMap[item.id] ?? item.shortageQuantity })) } : { action: "salesman_review_approve", voucherAmount, toBuyItems: toBuyItems.map((item) => ({ itemId: item.id, quantity: toBuyQtyMap[item.id] ?? item.shortageQuantity })) }, "Products Review ပြီး • To Buy Approved • Delivery Approved ဖြစ်ပါပြီ")}><CheckCircle2 />Review ပြီး • Approve for Delivery</button>
      </>}
    </div>}

    {canDelivery && <div className="detail-section"><h3>Delivery Update</h3><div className="delivery-role-permission"><ShieldCheck size={15} /><span><strong>Admin / Delivery Role Permission</strong><small>ဘောင်ချာနှင့် ပစ္စည်းပြဿနာ အထောက်အထားပုံများ တင်နိုင်ပါသည်</small></span></div>{order.warehouseStatus !== "finished" ? <div className="locked-note"><Clock3 />Warehouse Finished လုပ်ပြီးမှ ပို့ဆောင်နိုင်ပါမယ်။</div> : !order.saleApproved ? <div className="locked-note"><Clock3 />Sale Team Approved ဖြစ်ရန် စောင့်နေသည်။</div> : <><div className="approved-note compact"><CheckCircle2 />Sale Team Approved • Delivery Ready</div><div className="delivery-proof-box"><div className="delivery-proof-title"><Camera size={18} /><span><strong>ကားဂိတ်ဘောင်ချာ အထောက်အထား / ငွေသိမ်းဘောင်ချာ</strong><small>ဖုန်း Camera ဖြင့်ရိုက်ပါ သို့မဟုတ် Gallery မှရွေးပါ • အများဆုံး 8 MB</small></span></div>{(order.deliveryProofKey || proofPreview) && <a className="delivery-proof-preview" href={proofPreview || `/api/delivery-proof?orderId=${order.id}&v=${encodeURIComponent(order.deliveryProofUploadedAt)}`} target="_blank" rel="noreferrer"><img src={proofPreview || `/api/delivery-proof?orderId=${order.id}&v=${encodeURIComponent(order.deliveryProofUploadedAt)}`} alt="ကားဂိတ်ဘောင်ချာ သို့မဟုတ် ငွေသိမ်းဘောင်ချာ" /><span><CheckCircle2 size={15} /><b>ဘောင်ချာ တင်ပြီး</b><small>{order.deliveryProofUploadedBy || "Delivery"} • {order.deliveryProofUploadedAt ? notificationTime(order.deliveryProofUploadedAt) : "ယခု"}</small></span></a>}<label className="delivery-proof-input"><Camera size={18} /><span>{proofFile ? proofFile.name : order.deliveryProofKey ? "ဘောင်ချာပုံ အသစ်ပြန်ရွေးရန်" : "ဘောင်ချာပုံ ရိုက်ရန် / ရွေးရန်"}</span><input ref={proofInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { const file = event.target.files?.[0] || null; setProofFile(file); if (file) setProofPreview(URL.createObjectURL(file)); }} /></label><button className="delivery-proof-upload" disabled={proofBusy} onClick={() => { if (!proofFile) { proofInputRef.current?.click(); return; } void uploadDeliveryProof(); }}>{proofFile ? <Upload size={16} /> : <Camera size={16} />}{proofBusy ? "တင်နေသည်…" : proofFile ? order.deliveryProofKey ? "ရွေးထားသောပုံဖြင့် အစားထိုးတင်မည်" : "ရွေးထားသော ဘောင်ချာပုံ တင်မည်" : "ဘောင်ချာပုံ ရိုက်ရန် / ရွေးရန်"}</button></div><form className="delivery-incident-form" onSubmit={uploadDeliveryIncident}><div className="delivery-incident-heading"><Camera size={18} /><span><strong>ပစ္စည်းပြဿနာ အထောက်အထား</strong><small>Return သာ Voucher ငွေနှုတ်မည် • အခြားအမျိုးအစားများ ငွေမနှုတ်ပါ</small></span></div><label><span>အမျိုးအစား</span><select value={incidentForm.issueType} onChange={(event) => setIncidentForm((current) => ({ ...current, issueType: event.target.value as DeliveryIncident["issueType"], deductionAmount: event.target.value === "return" ? current.deductionAmount : "" }))}><option value="return">Return ပစ္စည်း — ငွေနှုတ်မည်</option><option value="wrong">ပစ္စည်းမှား — ငွေမနှုတ်</option><option value="extra">ပစ္စည်းပို — ငွေမနှုတ်</option><option value="missing">ပစ္စည်းလို — ငွေမနှုတ်</option></select></label><label><span>ပစ္စည်းအမည် / အရေအတွက် / မှတ်ချက်</span><textarea required rows={3} placeholder="ဥပမာ — Biogesic 2 Box Return" value={incidentForm.itemDetails} onChange={(event) => setIncidentForm((current) => ({ ...current, itemDetails: event.target.value }))} /></label>{incidentForm.issueType === "return" && <label><span>နှုတ်မည့် ပစ္စည်းတန်ဖိုး (MMK)</span><input required type="number" inputMode="numeric" min="1" max={order.voucherAmount} placeholder="0" value={incidentForm.deductionAmount} onChange={(event) => setIncidentForm((current) => ({ ...current, deductionAmount: event.target.value }))} /><small>လက်ရှိ Voucher: {money(order.voucherAmount)} MMK</small></label>}<label className="delivery-proof-input"><Camera size={18} /><span>{incidentFile ? incidentFile.name : "အထောက်အထားပုံ ရိုက်ရန် / ရွေးရန်"}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setIncidentFile(event.target.files?.[0] || null)} /></label><button className="delivery-incident-submit" disabled={incidentBusy || !incidentFile}><Upload size={16} />{incidentBusy ? "တင်နေသည်…" : incidentForm.issueType === "return" ? "ပုံတင်ပြီး ငွေနှုတ်မည်" : "ပုံတင်မည် — ငွေမနှုတ်"}</button></form><div className="two-fields compact"><label><span>ပို့ပြီး ဘုံး</span><input type="number" min="0" max={t.boxes} value={deliveredBoxes} onChange={(e) => setDeliveredBoxes(e.target.value)} /></label><label><span>ပို့ပြီး ဆွဲ</span><input type="number" min="0" max={t.bundles} value={deliveredBundles} onChange={(e) => setDeliveredBundles(e.target.value)} /></label></div><div className="action-grid"><button disabled={busy} onClick={() => void run({ action: "delivery", status: "out_for_delivery", deliveredBoxes, deliveredBundles }, "ပို့ဆောင်နေ အဖြစ်ပြောင်းပြီးပါပြီ")}><Truck />ပို့ဆောင်နေ</button><button disabled={busy} onClick={() => void run({ action: "delivery", status: "delivered", deliveredBoxes: t.boxes, deliveredBundles: t.bundles }, "အပြည့်ပို့ပြီးပါပြီ")}><CheckCircle2 />အပြည့်ပို့ပြီး</button><button disabled={busy} onClick={() => void run({ action: "delivery", status: "partial", deliveredBoxes, deliveredBundles }, "တစ်စိတ်တစ်ပိုင်းပို့ပြီးပါပြီ")}><PackageCheck />တစ်ပိုင်းပို့</button><button disabled={busy} onClick={() => void run({ action: "delivery", status: "returned", deliveredBoxes, deliveredBundles }, "Returned အဖြစ်ပြောင်းပြီးပါပြီ")}><RefreshCw />ပြန်အပ်</button></div></>}</div>}

    {canFinance && <div className="detail-section"><h3>Finance Check</h3>{order.voucherStatus === "pending" && <div className="locked-note"><Clock3 />Sale Team မှ Sale Voucher Amount Update လုပ်ရန် စောင့်နေသည်။</div>}<div className="finance-compare"><div><span>Sale Order Amount</span><strong>{money(order.orderAmount)} MMK</strong></div><div><span>Sale Voucher Amount</span><strong>{order.voucherStatus === "pending" ? "Pending" : `${money(order.voucherAmount)} MMK`}</strong></div><div className="difference"><span>ကွာခြားချက်</span><strong>{order.voucherStatus === "pending" ? "—" : `${money(order.orderAmount - order.voucherAmount)} MMK`}</strong></div></div><label className="full-label"><span>ငွေဝင် Amount (Voucher အရ)</span><input type="number" min="0" disabled={order.voucherStatus === "pending"} value={paid} onChange={(e) => setPaid(e.target.value)} /></label><div className="payment-entry-options"><label><span>Payment Type</span><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "cash" | "banking")}><option value="cash">Cash</option><option value="banking">Banking</option></select></label><label><span>Payment Date</span><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></label></div><div className="payment-actions"><button disabled={busy || order.voucherStatus === "pending"} onClick={() => void run({ action: "payment", status: "paid", paidAmount: order.voucherAmount, paymentMethod, paymentDate }, "ငွေဝင်ပြီး Confirm လုပ်ပါပြီ")}>Paid</button><button disabled={busy || order.voucherStatus === "pending"} onClick={() => void run({ action: "payment", status: "partial", paidAmount: paid, paymentMethod, paymentDate }, "Partial Payment သိမ်းပြီးပါပြီ")}>Partial</button><button disabled={busy || order.voucherStatus === "pending"} onClick={() => void run({ action: "payment", status: "credit", paidAmount: paid, paymentMethod, paymentDate }, "Credit အဖြစ်သတ်မှတ်ပြီးပါပြီ")}>Credit</button><button disabled={busy || order.voucherStatus === "pending"} onClick={() => void run({ action: "payment", status: "pending", paidAmount: paid, paymentMethod, paymentDate }, "Payment စစ်ဆေးဆဲ")}>Pending</button></div></div>}

    <div className="detail-section order-audit-log"><div className="order-audit-heading"><ShieldCheck size={18} /><span><strong>Order Audit Log</strong><small>ဒီ Sale Order အတွက် ပြောင်းလဲမှုအားလုံး</small></span><b>{orderEvents.length}</b></div>{eventsLoading ? <Loading /> : orderEvents.length === 0 ? <p className="section-help">မှတ်တမ်း မရှိသေးပါ</p> : <div className="order-audit-list">{orderEvents.map((event) => <article key={event.id}><span className="audit-dot" /><div><strong>{event.message}</strong><small>{event.actor || "System"} • {event.eventType}</small></div><time>{notificationTime(event.createdAt)}</time></article>)}</div>}</div>

    {role === "admin" && <div className="detail-section admin-delete-zone"><div><Trash2 size={18} /><span><strong>Admin Only — Sale Order Delete</strong><small>ဒီ Order နှင့် သက်ဆိုင်သော Voucher၊ Payment၊ Purchase Request၊ ပုံနှင့် မှတ်တမ်းများအားလုံး ဖျက်ပါမည်။</small></span></div><button disabled={deleteBusy} onClick={() => void removeSaleOrder()}><Trash2 size={16} />{deleteBusy ? "ဖျက်နေသည်…" : "Sale Order ဖျက်မည်"}</button></div>}
  </section></div>;
}

function Loading() { return <div className="loading"><RefreshCw className="spin" /> Data ရယူနေသည်…</div>; }
function DeliveryEmpty({ view }: { view: DeliveryView }) {
  const isPending = view === "pending";
  const isApprovalPending = view === "approval_pending";
  const isOnTheWay = view === "on_the_way";
  return <div className="empty-state"><span>{isApprovalPending ? <ClipboardList /> : isPending || isOnTheWay ? <Truck /> : <CheckCircle2 />}</span><h3>{isPending ? "ပို့ရန်ကျန် Order မရှိပါ" : isApprovalPending ? "Delivery Pending Order မရှိပါ" : isOnTheWay ? "On the Way Order မရှိပါ" : "ပို့ပြီး Order မရှိသေးပါ"}</h3><p>{isPending ? "Sale Team Approved ဖြစ်ပြီး ပို့ရန်ကျန်သော Order မရှိပါ။" : isApprovalPending ? "Sale Team Approved စောင့်နေသော Order မရှိပါ။" : isOnTheWay ? "Delivery စတင်ထားပြီး မပြီးဆုံးသေးသော Orders ကို ဒီ Tab မှာ ပြပါမယ်။" : "Delivery ပြီးဆုံးသော Orders အားလုံးကို ဒီ Tab မှာ ပြပါမယ်။"}</p></div>;
}
function Empty({ canAdd, onAdd }: { canAdd: boolean; onAdd: () => void }) { return <div className="empty-state"><span><ClipboardList /></span><h3>ရွေးထားသောကာလအတွက် Order မရှိပါ</h3><p>Sale Order ရှိလာသောအခါ ဒီနေရာမှာပြပါမယ်။</p>{canAdd && <button onClick={onAdd}><Plus /> Sale Order တင်ရန်</button>}</div>; }
