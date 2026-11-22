import { asc, gte, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { orders, saleOrderItems } from "../db/schema";

type LiveInsight = {
  id: number;
  insightType: "top_sale" | "stock_out";
  productCode: string;
  productName: string;
  metricLabel: string;
  metricValue: string;
  details: string;
  sourceName: string;
  priority: "normal" | "attention" | "urgent";
  rank: number;
  uniqueKey: string;
  sourceRowNumber: number;
  entryDate: string;
  enteredBy: string;
  expiryDate: string;
  knowledgeLocation: string;
  checkedTime: string;
  createdAt: string;
};

type SaleMetric = {
  productCode: string;
  productName: string;
  quantity30: number;
  quantityPrevious30: number;
  saleAmount30: number;
  orderIds30: Set<number>;
  customers30: Set<string>;
  lastSoldDate: string;
};

const LIVE_TYPES = new Set(["top_sale", "stock_out"]);

function clean(value: unknown, max = 240) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function normalizedName(value: string) {
  return clean(value).toLocaleLowerCase().replace(/[\s_\-\/().:*'’]+/g, "");
}

function productKey(code: string, name: string) {
  return code ? `code:${clean(code, 80).toLocaleLowerCase()}` : `name:${normalizedName(name)}`;
}

function yangonDate(offsetDays = 0) {
  return new Date(Date.now() + 6.5 * 60 * 60 * 1000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function numberFrom(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function actualItem(item: typeof saleOrderItems.$inferSelect) {
  const substituted = item.substitutionStatus === "confirmed" && Boolean(item.substituteProductName);
  const quantity = substituted && item.substituteQuantity > 0
    ? item.substituteQuantity
    : item.checkedQuantity >= 0
      ? item.checkedQuantity
      : item.pickedQuantity > 0
        ? item.pickedQuantity
        : item.quantity;
  return {
    productCode: clean(substituted ? item.substituteProductCode : item.matchedProductCode || item.originalProductCode, 80),
    productName: clean(substituted ? item.substituteProductName : item.matchedProductName || item.originalDescription, 180),
    quantity: Math.max(0, quantity),
    unitPrice: substituted && item.substituteSalePrice > 0 ? item.substituteSalePrice : numberFrom(item.originalSalePrice),
  };
}

async function saleMetrics() {
  const db = getDb();
  const start30 = yangonDate(-29);
  const start60 = yangonDate(-59);
  const orderRows = (await db.select({
    id: orders.id,
    orderDate: orders.orderDate,
    customerKey: orders.customerKey,
    voucherAmount: orders.voucherAmount,
    dispatchStatus: orders.dispatchStatus,
  }).from(orders).where(gte(orders.orderDate, start60)).orderBy(asc(orders.orderDate), asc(orders.id)))
    .filter((order) => order.voucherAmount > 0 && order.dispatchStatus !== "returned");
  const itemRows: (typeof saleOrderItems.$inferSelect)[] = [];
  for (let offset = 0; offset < orderRows.length; offset += 80) {
    const ids = orderRows.slice(offset, offset + 80).map((order) => order.id);
    if (ids.length) itemRows.push(...await db.select().from(saleOrderItems).where(inArray(saleOrderItems.orderId, ids)));
  }
  const orderMap = new Map(orderRows.map((order) => [order.id, order]));
  const metrics = new Map<string, SaleMetric>();
  const stockOut = new Map<string, { productCode: string; productName: string; occurrences: number; orderIds: Set<number>; lastDate: string }>();
  for (const row of itemRows) {
    const item = actualItem(row);
    const order = orderMap.get(row.orderId);
    if (!order || !item.productName) continue;
    const key = productKey(item.productCode, item.productName);
    if (["unavailable", "stock_out"].includes(row.fulfillmentStatus)) {
      if (order.orderDate >= start30) {
        const current = stockOut.get(key) || { productCode: item.productCode, productName: item.productName, occurrences: 0, orderIds: new Set<number>(), lastDate: "" };
        current.occurrences += 1;
        current.orderIds.add(order.id);
        if (!current.lastDate || order.orderDate > current.lastDate) current.lastDate = order.orderDate;
        stockOut.set(key, current);
      }
      continue;
    }
    if (item.quantity <= 0) continue;
    const metric = metrics.get(key) || {
      productCode: item.productCode,
      productName: item.productName,
      quantity30: 0,
      quantityPrevious30: 0,
      saleAmount30: 0,
      orderIds30: new Set<number>(),
      customers30: new Set<string>(),
      lastSoldDate: "",
    };
    if (order.orderDate >= start30) {
      metric.quantity30 += item.quantity;
      metric.saleAmount30 += item.quantity * item.unitPrice;
      metric.orderIds30.add(order.id);
      metric.customers30.add(order.customerKey);
      if (!metric.lastSoldDate || order.orderDate > metric.lastSoldDate) metric.lastSoldDate = order.orderDate;
    } else {
      metric.quantityPrevious30 += item.quantity;
    }
    metrics.set(key, metric);
  }
  return { metrics, stockOut, start30, generatedAt: new Date().toISOString() };
}

function baseInsight(id: number, insightType: LiveInsight["insightType"], code: string, name: string, createdAt: string): LiveInsight {
  return {
    id, insightType, productCode: code, productName: name, metricLabel: "", metricValue: "", details: "",
    sourceName: "Live System Data", priority: "normal", rank: 0, uniqueKey: `${insightType}|${productKey(code, name)}`,
    sourceRowNumber: 0, entryDate: yangonDate(), enteredBy: "System", expiryDate: "", knowledgeLocation: "",
    checkedTime: "Real time", createdAt,
  };
}

export async function buildLiveProductIntelligence() {
  const { metrics, stockOut, start30, generatedAt } = await saleMetrics();

  const sold = [...metrics.values()].filter((metric) => metric.quantity30 > 0)
    .sort((left, right) => right.quantity30 - left.quantity30 || right.saleAmount30 - left.saleAmount30 || left.productName.localeCompare(right.productName));
  const topCount = sold.length ? Math.max(1, Math.ceil(sold.length * 0.2)) : 0;
  const topSale = sold.slice(0, topCount).map((metric, index) => {
    const item = baseInsight(-(index + 1), "top_sale", metric.productCode, metric.productName, generatedAt);
    const growth = metric.quantityPrevious30 > 0 ? ((metric.quantity30 - metric.quantityPrevious30) / metric.quantityPrevious30) * 100 : null;
    return {
      ...item,
      rank: index + 1,
      metricLabel: "30-Day Sold Qty",
      metricValue: metric.quantity30.toLocaleString(),
      details: `Sale VR ${metric.orderIds30.size} • Customers ${metric.customers30.size} • Sale Amount ${Math.round(metric.saleAmount30).toLocaleString()} MMK • Last Sold ${metric.lastSoldDate}${growth === null ? " • New/No previous sale" : ` • Growth ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`}`,
    };
  });

  const stockOutItems = [...stockOut.values()]
    .sort((left, right) => right.occurrences - left.occurrences || left.productName.localeCompare(right.productName))
    .map((record, index) => {
      const item = baseInsight(-(10_000 + index + 1), "stock_out", record.productCode, record.productName, generatedAt);
      return {
        ...item,
        rank: index + 1,
        priority: "urgent" as const,
        metricLabel: "30-Day Stock-out Cases",
        metricValue: record.occurrences.toLocaleString(),
        details: `Warehouse marked Stock Out/Unavailable • Sale Orders ${record.orderIds.size} • Last Case ${record.lastDate}`,
      };
    });

  return {
    items: [...topSale, ...stockOutItems],
    generatedAt,
    periodStart: start30,
    summary: { topSale: topSale.length, stockOut: stockOutItems.length, soldProducts: sold.length },
  };
}

export function isLiveProductType(value: string) {
  return LIVE_TYPES.has(value);
}
