"use client";

import { AlertTriangle, Check, DatabaseZap, RefreshCw, SearchCheck, ShieldCheck, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type EntityType = "customer" | "product";

type CustomerRecord = {
  id: number;
  customerName: string;
  township: string;
  customerKey: string;
  phone: string;
  address: string;
  route: string;
  salesperson: string;
  createdAt: string;
  usageCount: number;
};

type ProductRecord = {
  id: number;
  productCode: string;
  productName: string;
  sku: string;
  salePrice: number;
  createdAt: string;
  usageCount: number;
};

type Match<T> = {
  pairKey: string;
  score: number;
  reasons: string[];
  recordA: T;
  recordB: T;
  reviewStatus: string;
};

type DuplicateScan = {
  customerMatches: Match<CustomerRecord>[];
  productMatches: Match<ProductRecord>[];
  summary: {
    activeCustomers: number;
    activeProducts: number;
    customerMatches: number;
    productMatches: number;
    reviewLater: number;
  };
};

const emptyScan: DuplicateScan = {
  customerMatches: [],
  productMatches: [],
  summary: { activeCustomers: 0, activeProducts: 0, customerMatches: 0, productMatches: 0, reviewLater: 0 },
};

function money(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function CustomerDetails({ record }: { record: CustomerRecord }) {
  return <div className="duplicate-record-details">
    <strong>{record.customerName || "—"}</strong>
    <span><b>Township</b>{record.township || "—"}</span>
    <span><b>Phone</b>{record.phone || "—"}</span>
    <span><b>Address</b>{record.address || "—"}</span>
    <span><b>Route</b>{record.route || "—"}</span>
    <span><b>Sale Man</b>{record.salesperson || "—"}</span>
    <span><b>Customer Key</b><code>{record.customerKey || "—"}</code></span>
    <small>{record.usageCount} linked records</small>
  </div>;
}

function ProductDetails({ record }: { record: ProductRecord }) {
  return <div className="duplicate-record-details">
    <strong>{record.productName || "—"}</strong>
    <span><b>Product Code</b><code>{record.productCode || "—"}</code></span>
    <span><b>SKU</b>{record.sku || "—"}</span>
    <span><b>Sale Price</b>{money(record.salePrice)}</span>
    <span><b>Created</b>{record.createdAt ? record.createdAt.slice(0, 10) : "—"}</span>
    <small>{record.usageCount} linked records</small>
  </div>;
}

export default function DuplicateDetectionPanel({ notify }: { notify: (message: string) => void }) {
  const [scan, setScan] = useState<DuplicateScan>(emptyScan);
  const [entityType, setEntityType] = useState<EntityType>("customer");
  const [loading, setLoading] = useState(true);
  const [busyPair, setBusyPair] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function loadDuplicates(showMessage = false) {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/duplicates", { cache: "no-store" });
      const data = await response.json() as DuplicateScan & { error?: string };
      if (!response.ok) throw new Error(data.error || "Duplicate scan failed");
      setScan(data);
      if (showMessage) notify(`Duplicate Scan ပြီးပါပြီ — Customer ${data.summary.customerMatches}, Product ${data.summary.productMatches}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Duplicate scan failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/duplicates", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as DuplicateScan & { error?: string };
        if (!response.ok) throw new Error(data.error || "Duplicate scan failed");
        if (!cancelled) setScan(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) notify(error instanceof Error ? error.message : "Duplicate scan failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [notify]);

  const matches = useMemo(() => entityType === "customer" ? scan.customerMatches : scan.productMatches, [entityType, scan]);

  async function saveDecision(match: Match<CustomerRecord> | Match<ProductRecord>, action: "merge" | "keep_separate" | "review_later", canonicalId = 0) {
    if (action === "merge") {
      const selected = canonicalId === match.recordA.id ? "ဘယ်ဘက် Record" : "ညာဘက် Record";
      const confirmed = window.confirm(`${selected} ကို Master အဖြစ်ထားပြီး အခြား Record ကို Merge လုပ်မည်။\n\nMerge မလုပ်ခင် Backup Snapshot အလိုအလျောက်သိမ်းပြီး Duplicate Record ကို Delete မလုပ်ဘဲ Inactive ပြောင်းပါမည်။ ဆက်လုပ်မည်လား?`);
      if (!confirmed) return;
    }
    setBusyPair(match.pairKey);
    try {
      const response = await fetch("/api/admin/duplicates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entityType,
          action,
          recordAId: match.recordA.id,
          recordBId: match.recordB.id,
          canonicalId,
          note: notes[match.pairKey] || "",
        }),
      });
      const data = await response.json() as { error?: string; backupId?: string };
      if (!response.ok) throw new Error(data.error || "Duplicate action failed");
      if (action === "merge") notify(`Merge ပြီးပါပြီ • Backup ID: ${data.backupId}`);
      else if (action === "keep_separate") notify("Records နှစ်ခုကို သီးခြားထားရန် မှတ်သားပြီးပါပြီ");
      else notify("Review Later အဖြစ် မှတ်သားပြီးပါပြီ");
      setNotes((current) => ({ ...current, [match.pairKey]: "" }));
      await loadDuplicates();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Duplicate action failed");
    } finally {
      setBusyPair("");
    }
  }

  return <section className="duplicate-panel">
    <div className="duplicate-panel-head">
      <div className="settings-card-icon data-quality-icon"><SearchCheck size={24} /></div>
      <div>
        <span className="settings-kicker">DATA QUALITY</span>
        <h2>Duplicate Customer / Product Detection</h2>
        <p>နာမည်၊ Township၊ Phone၊ Address၊ Product Code၊ SKU၊ Strength နှင့် Form ကို စစ်ပြီး ဖြစ်နိုင်ခြေမြင့် Duplicate Records များကို Review လုပ်နိုင်ပါသည်။</p>
      </div>
      <button type="button" className="duplicate-scan-button" disabled={loading || Boolean(busyPair)} onClick={() => void loadDuplicates(true)}>
        <RefreshCw className={loading ? "spin" : ""} size={17} /><span>{loading ? "Scanning…" : "Scan Again"}</span>
      </button>
    </div>

    <div className="duplicate-summary">
      <span><UsersRound size={17} /><b>{scan.summary.activeCustomers}</b><small>Active Customers</small></span>
      <span><DatabaseZap size={17} /><b>{scan.summary.activeProducts}</b><small>Active Products</small></span>
      <span className={scan.summary.customerMatches ? "attention" : ""}><b>{scan.summary.customerMatches}</b><small>Customer Matches</small></span>
      <span className={scan.summary.productMatches ? "attention" : ""}><b>{scan.summary.productMatches}</b><small>Product Matches</small></span>
    </div>

    <div className="duplicate-tabs" role="tablist" aria-label="Duplicate type">
      <button type="button" className={entityType === "customer" ? "active" : ""} onClick={() => setEntityType("customer")}>Customers <b>{scan.summary.customerMatches}</b></button>
      <button type="button" className={entityType === "product" ? "active" : ""} onClick={() => setEntityType("product")}>Products <b>{scan.summary.productMatches}</b></button>
    </div>

    <div className="duplicate-safety-note"><ShieldCheck size={17} /><span><strong>Safe Merge</strong><small>Automatic backup snapshot + Alias history + Audit Log သိမ်းပြီး Duplicate Master Record ကို Inactive သာ ပြောင်းပါမည်။</small></span></div>

    {loading ? <div className="duplicate-empty"><RefreshCw className="spin" size={22} /><strong>Duplicate Records စစ်ဆေးနေသည်…</strong></div> : matches.length === 0 ? <div className="duplicate-empty"><Check size={24} /><strong>Review လိုသော {entityType === "customer" ? "Customer" : "Product"} Duplicate မရှိပါ</strong><small>Scan Again ကိုနှိပ်ပြီး နောက်ဆုံး Data ကို ပြန်စစ်နိုင်ပါသည်။</small></div> : <div className="duplicate-list">
      {matches.map((match) => {
        const busy = busyPair === match.pairKey;
        return <article className="duplicate-card" key={match.pairKey}>
          <header>
            <span className={`duplicate-score ${match.score >= 96 ? "high" : "review"}`}><b>{match.score}%</b> match</span>
            <div>{match.reasons.map((reason) => <small key={reason}>{reason}</small>)}</div>
            {match.reviewStatus === "review_later" && <span className="review-later-chip"><AlertTriangle size={13} />Review Later</span>}
          </header>
          <div className="duplicate-comparison">
            <section><span className="record-label">RECORD A</span>{entityType === "customer" ? <CustomerDetails record={match.recordA as CustomerRecord} /> : <ProductDetails record={match.recordA as ProductRecord} />}</section>
            <div className="duplicate-vs">VS</div>
            <section><span className="record-label">RECORD B</span>{entityType === "customer" ? <CustomerDetails record={match.recordB as CustomerRecord} /> : <ProductDetails record={match.recordB as ProductRecord} />}</section>
          </div>
          <label className="duplicate-note"><span>Review Note (optional)</span><input value={notes[match.pairKey] || ""} onChange={(event) => setNotes((current) => ({ ...current, [match.pairKey]: event.target.value }))} placeholder="Merge / Keep Separate လုပ်ရသည့် အကြောင်းရင်း…" maxLength={500} /></label>
          <footer>
            <button type="button" className="merge-button" disabled={busy || Boolean(busyPair && !busy)} onClick={() => void saveDecision(match, "merge", match.recordA.id)}>A ကို Master ထားပြီး Merge</button>
            <button type="button" className="merge-button" disabled={busy || Boolean(busyPair && !busy)} onClick={() => void saveDecision(match, "merge", match.recordB.id)}>B ကို Master ထားပြီး Merge</button>
            <button type="button" className="separate-button" disabled={busy || Boolean(busyPair && !busy)} onClick={() => void saveDecision(match, "keep_separate")}><X size={15} />Keep Separate</button>
            <button type="button" className="later-button" disabled={busy || Boolean(busyPair && !busy)} onClick={() => void saveDecision(match, "review_later")}><AlertTriangle size={15} />Review Later</button>
          </footer>
          {busy && <div className="duplicate-busy"><RefreshCw className="spin" size={18} />Processing…</div>}
        </article>;
      })}
    </div>}
  </section>;
}
