"use client";

import { Archive, Banknote, Box, CalendarCheck2, ClipboardList, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ArchiveData = {
  period: { trialStartDate: string; trialEndDate: string; officialStartDate: string; purchaseOfficialStartDate?: string };
  summary: { orders: number; packages: number; voucherAmount: number; payments: number; paymentAmount: number; openings: number; openingOutstanding: number; purchaseRequests: number };
  orders: Array<{ id: number; orderNo: string; orderDate: string; customerName: string; township: string; salesperson: string; voucherAmount: number; dispatchStatus: string }>;
  payments: Array<{ id: number; paymentDate: string; customerName: string; township: string; amount: number; method: string; enteredBy: string }>;
  openings: Array<{ id: number; originalId: number; asOfDate: string; customerName: string; township: string; openingPackages: number; deliveredPackages: number; openingOutstanding: number; paidAmount: number }>;
};

type CutoverData = {
  period: { trialStartDate: string; officialStartDate: string };
  targetDate: string;
  completed: boolean;
  snapshot: { productGroupCount: number; sourceRequestCount: number; counts: { pending: number; ordered_company: number; ordered_mglz: number; unavailable: number; stock_out: number } };
  lastRun: { id: number; officialStartDate: string; productGroupCount: number; sourceRequestCount: number; backupSize: number; createdAt: string } | null;
};

function money(value: number) {
  return Math.round(value || 0).toLocaleString();
}

export default function TrialArchivePanel({ notify }: { notify: (message: string) => void }) {
  const [data, setData] = useState<ArchiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"orders" | "payments" | "openings">("orders");
  const [query, setQuery] = useState("");
  const [cutover, setCutover] = useState<CutoverData | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [cutoverSaving, setCutoverSaving] = useState(false);

  const loadCutover = useCallback(async () => {
    const response = await fetch("/api/admin/purchase-live-cutover", { cache: "no-store" });
    const result = await response.json() as CutoverData & { error?: string };
    if (!response.ok) throw new Error(result.error || "Purchase Cutover Preview မရပါ");
    setCutover(result);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/trial-archive", { cache: "no-store" });
      const result = await response.json() as ArchiveData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Trial Archive ရယူမရပါ");
      setData(result);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Trial Archive ရယူမရပါ");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    // Loading the remote archive is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void loadCutover().catch((error) => notify(error instanceof Error ? error.message : "Purchase Cutover Preview မရပါ"));
  }, [load, loadCutover, notify]);

  async function startLiveMode() {
    if (!cutover || cutover.completed || cutoverSaving) return;
    setCutoverSaving(true);
    try {
      const response = await fetch("/api/admin/purchase-live-cutover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation: confirmation.trim(), targetDate: cutover.targetDate }) });
      const result = await response.json() as { success?: boolean; error?: string; runId?: number; archived?: { productGroupCount: number; sourceRequestCount: number } };
      if (!response.ok) throw new Error(result.error || "Live Cutover မလုပ်နိုင်ပါ");
      notify(`Purchase Live Start ${cutover.targetDate} • ${result.archived?.productGroupCount || 0} Products Archive ပြီးပါပြီ`);
      setConfirmation("");
      await Promise.all([load(), loadCutover()]);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Live Cutover မလုပ်နိုင်ပါ");
    } finally { setCutoverSaving(false); }
  }

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const source = view === "orders" ? data?.orders || [] : view === "payments" ? data?.payments || [] : data?.openings || [];
    if (!needle) return source;
    return source.filter((item) => `${item.customerName} ${item.township} ${"orderNo" in item ? item.orderNo : ""} ${"salesperson" in item ? item.salesperson : ""}`.toLocaleLowerCase().includes(needle));
  }, [data, query, view]);

  return <section className="trial-archive-panel">
    <div className="trial-archive-head">
      <span><Archive /></span>
      <div><strong>Trial Archive</strong><small>စမ်းသပ်ကာလ Data ကို မဖျက်ဘဲ Read-only အဖြစ် သိမ်းထားသည်</small></div>
      <button onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} />Refresh</button>
    </div>

    {data && <>
      <div className="official-start-banner"><CalendarCheck2 /><span><b>Official Live Start</b><strong>{data.period.officialStartDate}</strong><small>Trial: {data.period.trialStartDate} မှ {data.period.trialEndDate} အထိ</small></span><em><ShieldCheck />Live Reports သာတွက်မည်</em></div>
      <div className="trial-archive-summary">
        <div><ClipboardList /><span><small>Trial Orders</small><strong>{data.summary.orders}</strong><b>{money(data.summary.voucherAmount)} MMK</b></span></div>
        <div><Box /><span><small>Trial Packages</small><strong>{data.summary.packages}</strong><b>Purchase {data.summary.purchaseRequests}</b></span></div>
        <div><Banknote /><span><small>Trial Payments</small><strong>{data.summary.payments}</strong><b>{money(data.summary.paymentAmount)} MMK</b></span></div>
        <div><Archive /><span><small>Trial Openings</small><strong>{data.summary.openings}</strong><b>{money(data.summary.openingOutstanding)} MMK</b></span></div>
      </div>
      {cutover && <div className={`purchase-cutover-card ${cutover.completed ? "completed" : ""}`}>
        <div><CalendarCheck2 /><span><strong>{cutover.completed ? "Purchase Live Mode စတင်ပြီး" : "Purchase Backup → Archive → Live Start"}</strong><small>{cutover.completed ? `Official Start ${cutover.period.officialStartDate}` : `${cutover.snapshot.productGroupCount} Product Groups • ${cutover.snapshot.sourceRequestCount} Source Requests • Live Start ${cutover.targetDate}`}</small></span></div>
        {!cutover.completed ? <><label><span>Confirmation</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={`ARCHIVE ${cutover.snapshot.productGroupCount}`} /></label><button type="button" disabled={cutoverSaving || confirmation.trim() !== `ARCHIVE ${cutover.snapshot.productGroupCount}`} onClick={() => void startLiveMode()}>{cutoverSaving ? "Backup & Archive လုပ်နေသည်…" : "Backup & Start Live Mode"}</button></> : cutover.lastRun && <a href={`/api/admin/purchase-live-cutover?downloadRunId=${cutover.lastRun.id}`}>Cutover Backup Download</a>}
      </div>}
      <div className="trial-archive-controls">
        <nav><button className={view === "orders" ? "active" : ""} onClick={() => setView("orders")}>Orders</button><button className={view === "payments" ? "active" : ""} onClick={() => setView("payments")}>Payments</button><button className={view === "openings" ? "active" : ""} onClick={() => setView("openings")}>Opening</button></nav>
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Archive Customer ရှာရန်" /></label>
      </div>
      <div className="trial-archive-table">
        {view === "orders" && <><div className="head"><span>Date / Order</span><span>Customer</span><span>Sale Man</span><span>Voucher</span></div>{visibleRows.slice(0, 200).map((item) => "orderNo" in item && <div key={`order-${item.id}`}><span><b>{item.orderDate}</b><small>{item.orderNo}</small></span><span><b>{item.customerName}</b><small>{item.township}</small></span><span>{item.salesperson}</span><span>{money(item.voucherAmount)}</span></div>)}</>}
        {view === "payments" && <><div className="head"><span>Date</span><span>Customer</span><span>Method</span><span>Amount</span></div>{visibleRows.slice(0, 200).map((item) => "paymentDate" in item && <div key={`payment-${item.id}`}><span>{item.paymentDate}</span><span><b>{item.customerName}</b><small>{item.township}</small></span><span>{item.method}</span><span>{money(item.amount)}</span></div>)}</>}
        {view === "openings" && <><div className="head"><span>Date</span><span>Customer</span><span>Packages</span><span>Outstanding</span></div>{visibleRows.slice(0, 200).map((item) => "asOfDate" in item && <div key={`opening-${item.originalId}-${item.id}`}><span>{item.asOfDate}</span><span><b>{item.customerName}</b><small>{item.township}</small></span><span>{Math.max(0, item.openingPackages - item.deliveredPackages)}</span><span>{money(item.openingOutstanding - item.paidAmount)}</span></div>)}</>}
        {!loading && visibleRows.length === 0 && <p>ဒီ Archive အမျိုးအစားမှာ Data မရှိသေးပါ</p>}
        {loading && <p><RefreshCw className="spin" />Archive Data ရယူနေသည်…</p>}
      </div>
      <div className="trial-archive-foot"><ShieldCheck />Archive Data ကို ဒီနေရာမှ ပြင်/ဖျက်၍မရပါ။ Audit နှင့် စစ်ဆေးရန်သာ အသုံးပြုပါ။</div>
    </>}
  </section>;
}
