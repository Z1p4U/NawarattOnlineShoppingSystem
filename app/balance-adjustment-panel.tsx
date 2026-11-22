"use client";
import { useEffect, useState } from "react";
type Customer = { customerKey?: string; name: string; township: string };
type Adjustment = { id: string; customerKey: string; amount: number; reason: string; adjustmentDate: string; beforeBalance: number; afterBalance: number; enteredBy: string; createdAt: string; reversalOf: string | null };
export default function BalanceAdjustmentPanel({ customers, balances, isAdmin, onSaved, notify }: { customers: Customer[]; balances: Map<string, number>; isAdmin: boolean; onSaved: () => Promise<void>; notify: (s: string) => void }) {
  const [rows, setRows] = useState<Adjustment[]>([]);
  const [key, setKey] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState(1);
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Yangon" }));
  const [reason, setReason] = useState("");
  const [reversal, setReversal] = useState<Adjustment | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [page, setPage] = useState(1);
  async function load() { const response = await fetch("/api/balance-adjustments", { cache: "no-store" }); const data = await response.json() as { adjustments: Adjustment[]; error?: string }; if (!response.ok) throw new Error(data.error || "Load Failed"); setRows(data.adjustments); }
  useEffect(() => { void load().catch(() => notify("Adjustment History — Load Failed")); }, []);
  const before = balances.get(key) || 0;
  const signedAmount = reversal ? -reversal.amount : Number(amount) * direction;
  const history = rows.filter(row => !key || row.customerKey === key);
  const reversed = new Set(rows.map(row => row.reversalOf));
  return <details className="balance-adjustment-panel"><summary>စာရင်းကွာငွေ Adjust / History {isAdmin && "— Admin Only"}</summary>
    {isAdmin && <form onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); try {
      const response = await fetch("/api/balance-adjustments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: requestId, customerKey: key, amount: signedAmount, beforeBalance: before, adjustmentDate: date, reason, reversalOf: reversal?.id }) });
      const data = await response.json() as { error?: string }; if (!response.ok) { setRequestId(crypto.randomUUID()); throw new Error(data.error || "Adjustment failed"); }
      setAmount(""); setReason(""); setReversal(null); setRequestId(crypto.randomUUID()); await Promise.all([load(), onSaved()]); notify("စာရင်းကွာငွေ ညှိပြီးပါပြီ");
    } catch (err) { notify(err instanceof Error ? err.message : "Adjustment failed"); } finally { setBusy(false); } }}>
      <label>Customer<select required disabled={busy || !!reversal} value={key} onChange={e => { setKey(e.target.value); setPage(1); setRequestId(crypto.randomUUID()); }}><option value="">Customer ရွေးပါ</option>{customers.map(c => <option key={c.customerKey} value={c.customerKey}>{c.name} • {c.township}</option>)}</select></label>
      <label>အမျိုးအစား<select disabled={busy || !!reversal} value={direction} onChange={e => setDirection(Number(e.target.value))}><option value={1}>ကြွေးကျန်တိုး</option><option value={-1}>ကြွေးကျန်လျှော့</option></select></label>
      <label>Amount<input required type="number" min="1" step="1" disabled={busy || !!reversal} value={reversal ? Math.abs(reversal.amount) : amount} onChange={e => setAmount(e.target.value)} /></label>
      <label>Date<input required type="date" disabled={busy} value={date} max={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Yangon" })} onChange={e => setDate(e.target.value)} /></label>
      <label>Reason<input required maxLength={400} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <p>မူလလက်ကျန် {before.toLocaleString()} → ညှိငွေ {signedAmount.toLocaleString()} → <b>လက်ကျန်အသစ် {(before + signedAmount).toLocaleString()} MMK</b></p>
      <button disabled={busy || !key || !signedAmount}>{busy ? "သိမ်းနေသည်…" : reversal ? "Reverse Adjustment အတည်ပြုမည်" : "Adjustment အတည်ပြုမည်"}</button>{reversal && <button type="button" disabled={busy} onClick={() => { setReversal(null); setReason(""); setRequestId(crypto.randomUUID()); }}>မပြင်တော့ပါ</button>}
    </form>}
    {!isAdmin && <label>Customer<select value={key} onChange={e => { setKey(e.target.value); setPage(1); }}><option value="">All Customers</option>{customers.map(c => <option key={c.customerKey} value={c.customerKey}>{c.name} • {c.township}</option>)}</select></label>}
    <p>Adjustment သည် Payment မဟုတ်ပါ။ Last Payment Date မပြောင်းပါ။</p>
    {history.slice((page-1)*10, page*10).map(row => <article key={row.id}><strong>{customers.find(c => c.customerKey === row.customerKey)?.name} • {row.adjustmentDate} • {row.amount > 0 ? "+" : ""}{row.amount.toLocaleString()} MMK</strong><p>{row.beforeBalance.toLocaleString()} → {row.afterBalance.toLocaleString()} • {row.reason}</p><small>{row.enteredBy} • {new Date(row.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Yangon" })}{row.reversalOf ? " • Reversal" : reversed.has(row.id) ? " • Reversed" : ""}</small>{isAdmin && !row.reversalOf && !reversed.has(row.id) && <button disabled={busy} onClick={() => { setKey(row.customerKey); setReversal(row); setDirection(row.amount > 0 ? -1 : 1); setReason(""); setRequestId(crypto.randomUUID()); }}>Reverse</button>}</article>)}
    {history.length > 10 && <div><button disabled={page<=1} onClick={() => setPage(page-1)}>Previous</button> Page {page} / {Math.ceil(history.length/10)} <button disabled={page*10>=history.length} onClick={() => setPage(page+1)}>Next</button></div>}
  </details>;
}
