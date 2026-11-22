"use client";

import {
  AlertTriangle, Boxes, CalendarClock, CheckCircle2, ChevronDown, Clock3, Download,
  FileSpreadsheet, History, MapPin, RefreshCw, RotateCcw, Search, ShoppingCart,
  TrendingDown, TrendingUp, UserRound, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import ProductIntelligenceImport from "./product-intelligence-import";

type AppRole = "admin" | "sale" | "warehouse" | "purchase" | "delivery" | "finance" | "viewer";
type SyncRun = {
  id: number; syncDate: string; saleTab: string; purchaseTab: string; inventoryTab: string; slowItemsTab: string;
  itemCount: number; status: string; createdAt: string; completedAt: string; sourceSummary: Record<string, unknown>;
  sourceRows: number; validCount: number; uniqueCount: number; duplicateCount: number; skippedCount: number;
  lowSaleCount: number; overstockCount: number; nearExpiredCount: number; unclassifiedCount: number;
  newCount: number; updatedCount: number; unchangedCount: number; durationMs: number; runType: string;
  triggeredBy: string; isActive: boolean;
};
type LiveItem = {
  id: number; insightType: string; productCode: string; productName: string; metricLabel: string; metricValue: string;
  details: string; sourceName: string; priority: string; rank: number; uniqueKey: string; sourceRowNumber: number;
  entryDate: string; enteredBy: string; expiryDate: string; knowledgeLocation: string; checkedTime: string; createdAt: string;
};
type LiveSummary = { topSale: number; stockOut: number; soldProducts: number; stockOutExcludedByIncoming?: number };
type UnmatchedArrival = {
  id: number; importRunId: number; productCode: string; productName: string; incomingQuantity: number;
  supplierName: string; purchaseDate: string; importedAt: string; reason: string; status: string;
};

const categories = [
  ["top_sale", "Top Sale", TrendingUp], ["low_sale", "Low Sale", TrendingDown], ["incoming", "Incoming", ShoppingCart],
  ["stock_out", "Stock Out", AlertTriangle], ["overstock", "Over Stock", Boxes], ["price_change", "Price Change", RefreshCw],
  ["supplier", "Suppliers", ShoppingCart], ["near_expired", "Near Expired", CalendarClock],
] as const;
const alphabeticCategories = new Set(["low_sale", "incoming", "stock_out", "overstock", "near_expired", "price_change"]);
const managedCategories = new Set(["low_sale", "incoming", "overstock", "price_change", "supplier", "near_expired"]);
const liveCategories = new Set(["top_sale", "stock_out"]);
const categoryLabel = new Map<string, string>(categories.map(([key, label]) => [key, label]));

function displayDate(value: string) {
  if (!value) return "—";
  const source = value.slice(0, 10);
  const [year, month, day] = source.split("-");
  return day ? `${day}/${month}/${year}` : value;
}

function displayDateTime(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yangon", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function readJson<T extends object>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({ error: "Server response မရပါ" })) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function ProductLiveData({ role }: { role: AppRole }) {
  const isAdmin = role === "admin";
  const canExport = role === "admin" || role === "sale" || role === "warehouse";
  const [run, setRun] = useState<SyncRun | null>(null);
  const [items, setItems] = useState<LiveItem[]>([]);
  const [active, setActive] = useState("top_sale");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("All");
  const [expiry, setExpiry] = useState("All");
  const [enteredBy, setEnteredBy] = useState("All");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<LiveItem | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SyncRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [liveGeneratedAt, setLiveGeneratedAt] = useState("");
  const [liveSummary, setLiveSummary] = useState<LiveSummary | null>(null);
  const [unmatchedArrivals, setUnmatchedArrivals] = useState<UnmatchedArrival[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [response, unmatchedResponse] = await Promise.all([
        fetch("/api/product-intelligence", { cache: "no-store" }),
        isAdmin ? fetch("/api/product-intelligence/unmatched-arrivals", { cache: "no-store" }) : Promise.resolve(null),
      ]);
      const data = await readJson<{ run?: SyncRun | null; items?: LiveItem[]; live?: { generatedAt?: string; summary?: LiveSummary } }>(response);
      setRun(data.run || null); setItems(data.items || []);
      setLiveGeneratedAt(data.live?.generatedAt || ""); setLiveSummary(data.live?.summary || null);
      if (unmatchedResponse?.ok) {
        const unmatchedData = await readJson<{ unmatched?: UnmatchedArrival[] }>(unmatchedResponse);
        setUnmatchedArrivals(unmatchedData.unmatched || []);
      }
      const first = categories.find(([key]) => (data.items || []).some((item) => item.insightType === key));
      if (first) { setActive((current) => (data.items || []).some((item) => item.insightType === current) ? current : first[0]); setPage(1); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Live Data ရယူမရပါ"); }
    finally { setLoading(false); }
  }, [isAdmin]);
  useEffect(() => {
    // Loading the latest saved server snapshot is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const locations = useMemo(() => ["All", ...new Set(items.map((item) => item.knowledgeLocation).filter(Boolean).sort())], [items]);
  const enteredByOptions = useMemo(() => ["All", ...new Set(items.map((item) => item.enteredBy).filter(Boolean).sort())], [items]);
  const activeItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matched = items.filter((item) => {
      const expiryMatch = expiry === "All" || (expiry === "With Expiry" ? Boolean(item.expiryDate) : !item.expiryDate);
      return item.insightType === active
        && (location === "All" || item.knowledgeLocation === location)
        && (enteredBy === "All" || item.enteredBy === enteredBy)
        && expiryMatch
        && (!needle || `${item.productName} ${item.productCode} ${item.knowledgeLocation} ${item.enteredBy}`.toLocaleLowerCase().includes(needle));
    });
    return alphabeticCategories.has(active)
      ? matched.sort((left, right) => left.productName.localeCompare(right.productName, undefined, { sensitivity: "base", numeric: true }))
      : matched;
  }, [active, enteredBy, expiry, items, location, query]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(activeItems.length / pageSize));
  const effectivePage = Math.min(page, pageCount);
  const visible = useMemo(() => activeItems.slice((effectivePage - 1) * pageSize, effectivePage * pageSize), [activeItems, effectivePage]);

  async function loadHistory() {
    setShowHistory(true); setHistoryLoading(true);
    try {
      const response = await fetch("/api/product-intelligence/history", { cache: "no-store" });
      const data = await readJson<{ runs: SyncRun[] }>(response);
      setHistory(data.runs || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sync History မရပါ"); }
    finally { setHistoryLoading(false); }
  }

  async function restore(snapshot: SyncRun) {
    if (!window.confirm(`${snapshot.syncDate} Import Snapshot ကို Restore လုပ်မှာ သေချာပါသလား?`)) return;
    try {
      const response = await fetch("/api/product-intelligence/history", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ runId: snapshot.id }) });
      await readJson<Record<string, unknown>>(response); await load(); await loadHistory();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Restore မအောင်မြင်ပါ"); }
  }

  async function downloadExcel() {
    const XLSX = await import("xlsx");
    const rows = activeItems.map((item, index) => ({
      No: index + 1, Category: categoryLabel.get(item.insightType) || item.insightType, "Product Name": item.productName,
      "Metric": item.metricLabel, "Value": item.metricValue, "Details": item.details, "Source": item.sourceName,
      "Expiry Date": item.expiryDate, "Knowledge Location": item.knowledgeLocation, "Entered By": item.enteredBy,
      "Entry Date": item.entryDate, "Checked Time": item.checkedTime, "Last Updated": liveCategories.has(active) ? liveGeneratedAt : run?.completedAt || run?.createdAt || "",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 7 }, { wch: 18 }, { wch: 32 }, { wch: 24 }, { wch: 22 }, { wch: 60 }, { wch: 24 }, { wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 16 }, { wch: 23 }];
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Product Knowledge");
    XLSX.writeFile(workbook, `Nawaratt_Product_Knowledge_${active}_${run?.syncDate || "latest"}.xlsx`);
  }

  function printPdf() {
    const popup = window.open("", "_blank", "width=1100,height=760");
    if (!popup) return;
    const rows = activeItems.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.productCode || "—")}</td><td>${escapeHtml(item.productName)}</td><td>${escapeHtml(item.metricLabel || "—")}</td><td>${escapeHtml(item.knowledgeLocation || item.metricValue || "—")}</td><td>${escapeHtml(item.details || "—")}</td><td>${escapeHtml(item.sourceName || "—")}</td></tr>`).join("");
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Product Knowledge Report</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,'Noto Sans Myanmar',sans-serif;color:#172554}h1{font-size:20px;margin:0 0 4px}.meta{font-size:11px;color:#64748b;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top}th{background:#eaf2ff}tr:nth-child(even){background:#f8fafc}</style></head><body><h1>Nawaratt Product Knowledge — ${escapeHtml(categoryLabel.get(active) || active)}</h1><div class="meta">${liveCategories.has(active) ? `System Data • Updated ${escapeHtml(displayDateTime(liveGeneratedAt))}` : `Excel Import ${escapeHtml(run?.syncDate || "—")}`} • ${activeItems.length} Products • Asia/Yangon</div><table><thead><tr><th>No</th><th>Code</th><th>Product Name</th><th>Metric</th><th>Value</th><th>Details</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  return <section className="product-live-card weekly-product-card">
    <header>
      <span className="product-live-icon"><RefreshCw className={loading ? "spin" : ""} /></span>
      <span><strong>Product Knowledge — System + Excel Reports</strong><small>Top Sale · Stock Out: System calculated • Other reports: Manual Excel input</small></span>
      <button onClick={() => void load()} disabled={loading}><RefreshCw />Refresh</button>
    </header>

    {isAdmin && <div className="weekly-sync-admin"><ProductIntelligenceImport onImported={load} /><div className="weekly-sync-actions"><button onClick={() => void loadHistory()}><History />Import History</button></div></div>}

    {isAdmin && <details className="purchase-unmatched-report"><summary><span><AlertTriangle /><b>Unmatched Products Report</b></span><strong>{unmatchedArrivals.length}</strong></summary><div className="purchase-unmatched-list">{unmatchedArrivals.length === 0 ? <p>Unmatched / Ambiguous Incoming Product မရှိပါ</p> : unmatchedArrivals.map((item) => <article key={item.id}><span><small>Import Run #{item.importRunId} • {item.productCode || "No Code"}</small><b>{item.productName}</b><em>{item.reason === "ambiguous_name" ? "Duplicate / Ambiguous Product Name" : "Product Master တွင် မတွေ့ပါ"}</em></span><span><b>{item.incomingQuantity} Qty</b><small>{item.supplierName || "Supplier —"} • Purchase {displayDate(item.purchaseDate)}</small><small>Imported {displayDateTime(item.importedAt)}</small></span></article>)}</div></details>}

    {error && <p className="product-live-error">{error}</p>}
    {!error && !run && !items.length ? <div className="product-live-first"><CalendarClock /><span><b>System Data ကို စောင့်နေပါသည်</b><small>Sale VR၊ Product နှင့် Purchase Records ဝင်လာလျှင် Real-time Report တွင် ပြပါမည်။</small></span></div> : !error && <>
      <div className="product-source-status"><span><i />System Calculated</span><b>{liveGeneratedAt ? displayDateTime(liveGeneratedAt) : "—"}</b><small>Top Sale {liveSummary?.topSale || 0} • Stock Out {liveSummary?.stockOut || 0}{liveSummary?.stockOutExcludedByIncoming ? ` • Incoming matched ${liveSummary.stockOutExcludedByIncoming} removed` : ""}</small></div>
      {run && <div className={`product-live-status ${run.status.startsWith("completed") ? "" : "failed"}`}><span><i />{run.status === "completed_with_warnings" ? "Excel Import — Warnings" : run.status === "completed" ? "Latest Excel Import" : "Excel Import — Failed"}</span><b>{run.syncDate}</b><span>{run.itemCount} Excel Records</span><small>{run.completedAt ? displayDateTime(run.completedAt) : run.triggeredBy}</small></div>}
      {run?.status === "completed_with_warnings" && <div className="weekly-warning-banner"><AlertTriangle /><span><b>{run.skippedCount} Skipped Records</b><small>Excel file ထဲမှ valid rows များကိုသာ သိမ်းထားပါသည်</small></span></div>}
      <nav className="product-live-tabs">{categories.map(([key, label, Icon]) => {
        const count = items.filter((item) => item.insightType === key).length;
        return <button key={key} className={active === key ? "active" : ""} onClick={() => { setActive(key); setPage(1); }}><Icon /><span>{label}<small>{liveCategories.has(key) ? "SYSTEM" : "EXCEL"}</small></span><b>{count}</b></button>;
      })}</nav>
      <div className="product-live-filter weekly-product-filter">
        <label><Search /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Product Name ရှာရန်" /></label>
        {managedCategories.has(active) && <>
          <label><MapPin /><select value={location} onChange={(event) => { setLocation(event.target.value); setPage(1); }}>{locations.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown /></label>
          <label><CalendarClock /><select value={expiry} onChange={(event) => { setExpiry(event.target.value); setPage(1); }}><option>All</option><option>With Expiry</option><option>Without Expiry</option></select><ChevronDown /></label>
          <label><UserRound /><select value={enteredBy} onChange={(event) => { setEnteredBy(event.target.value); setPage(1); }}>{enteredByOptions.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown /></label>
        </>}
        <b>{alphabeticCategories.has(active) ? "A–Z • " : ""}{activeItems.length} Products</b>
      </div>
      {canExport && <div className="weekly-export-actions"><button disabled={!activeItems.length} onClick={() => void downloadExcel()}><FileSpreadsheet />Excel Export</button><button disabled={!activeItems.length} onClick={printPdf}><Download />PDF / Print</button></div>}
      {visible.length ? <div className="product-live-list weekly-product-list">{visible.map((item) => <article key={item.id} className={item.priority} onClick={() => setSelected(item)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setSelected(item); }}>
        <span><small>{item.productCode || item.sourceName}</small><strong>{item.productName}</strong><p>{item.details}</p></span>
        <span><small>{item.metricLabel || "Knowledge Location"}</small><b>{item.knowledgeLocation || item.metricValue || "—"}</b>{item.expiryDate && <em>Expiry {item.expiryDate}</em>}</span>
      </article>)}</div> : <div className="product-live-missing"><AlertTriangle /><span><b>ဒီအမျိုးအစား Data မရှိသေးပါ</b><small>Search သို့မဟုတ် Filters ကို ပြန်စစ်ပါ။</small></span></div>}
      {activeItems.length > pageSize && <div className="product-live-pagination"><span>Page {effectivePage} / {pageCount}</span><div>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} className={effectivePage === number ? "active" : ""} onClick={() => setPage(number)} aria-label={`Page ${number}`}>{number}</button>)}</div></div>}
    </>}

    {selected && <div className="weekly-detail-backdrop" onClick={() => setSelected(null)}><article className="weekly-detail" onClick={(event) => event.stopPropagation()}><header><span><small>{categoryLabel.get(selected.insightType) || selected.insightType}</small><strong>{selected.productName}</strong></span><button onClick={() => setSelected(null)} aria-label="Close"><X /></button></header><dl><Detail icon={<CalendarClock />} label="Expiry Date" value={selected.expiryDate} /><Detail icon={<MapPin />} label="Knowledge Location" value={selected.knowledgeLocation || selected.metricValue} /><Detail icon={<UserRound />} label="Entered By" value={selected.enteredBy} /><Detail icon={<CalendarClock />} label="Source Record Date" value={displayDate(selected.entryDate)} /><Detail icon={<Clock3 />} label="Checked Time" value={selected.checkedTime} /><Detail icon={<RefreshCw />} label="Last Update" value={liveCategories.has(selected.insightType) ? displayDateTime(liveGeneratedAt) : displayDateTime(run?.completedAt || run?.createdAt || "")} /></dl><div className="weekly-detail-note"><b>Full Product Information</b><p>{selected.details || "Additional details မရှိပါ"}</p><small>Source Row #{selected.sourceRowNumber || "—"} • {selected.sourceName}</small></div><div className="weekly-detail-note"><b>Previous Changes</b><p>Import History မှ ယခင် Snapshot များနှင့် ပြန်လည်စစ်ဆေးနိုင်ပါသည်။</p></div></article></div>}

    {showHistory && <div className="weekly-detail-backdrop" onClick={() => setShowHistory(false)}><article className="weekly-history" onClick={(event) => event.stopPropagation()}><header><span><small>Admin Only</small><strong>Product Report Import History</strong></span><button onClick={() => setShowHistory(false)}><X /></button></header>{historyLoading ? <p className="weekly-history-loading">History ဖတ်နေသည်…</p> : <div className="weekly-history-list">{history.map((item) => <div key={item.id} className={item.isActive ? "active" : ""}><span><b>{item.syncDate}</b><small>{item.runType} • {displayDateTime(item.completedAt || item.createdAt)}</small></span><span><b>{item.uniqueCount || item.itemCount} Products</b><small>{item.status} • {item.durationMs ? `${(item.durationMs / 1000).toFixed(1)}s` : "—"}</small></span><span><b>Low {item.lowSaleCount} • Over {item.overstockCount} • Near {item.nearExpiredCount}</b><small>Skipped {item.skippedCount} • Duplicate {item.duplicateCount}</small></span>{item.isActive ? <em><CheckCircle2 />Active</em> : <button disabled={!["completed", "completed_with_warnings"].includes(item.status)} onClick={() => void restore(item)}><RotateCcw />Restore</button>}</div>)}</div>}</article></div>}
  </section>;
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div><dt>{icon}<span>{label}</span></dt><dd>{value || "—"}</dd></div>;
}

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));
}
