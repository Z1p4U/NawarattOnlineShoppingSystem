"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, X } from "lucide-react";
import { type ChangeEvent, useMemo, useRef, useState } from "react";

type ImportRow = {
  rowNumber: number;
  customerCode: string;
  sourceSalesperson: string;
  salesperson: string;
  sourceCustomerName: string;
  customerName: string;
  township: string;
  openingOutstanding: number;
  paidAmount: number;
  error: string;
};

type Preview = {
  rows: ImportRow[];
  validCount: number;
  errorCount: number;
  total: number;
  asOfDate: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

export default function OpeningBalanceImport({ onImported, notify }: { onImported: () => Promise<void>; notify: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const validRows = useMemo(() => preview?.rows.filter((row) => !row.error) || [], [preview]);

  function reset() {
    setFile(null);
    setPreview(null);
    setConfirming(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function requestImport(selectedFile: File, mode: "preview" | "commit") {
    const body = new FormData();
    body.append("file", selectedFile);
    body.append("mode", mode);
    const response = await fetch("/api/opening-import", { method: "POST", body });
    const data = await response.json() as any;
    if (!response.ok) throw new Error(data.error || "Opening Excel Import မအောင်မြင်ပါ");
    return data as Preview & { importedCount?: number };
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setReading(true);
    setFile(selectedFile);
    setPreview(null);
    try {
      setPreview(await requestImport(selectedFile, "preview"));
    } catch (error) {
      reset();
      notify(error instanceof Error ? error.message : "Excel File ဖတ်မရပါ");
    } finally {
      setReading(false);
    }
  }

  async function commit() {
    if (!file || !preview || importing || preview.errorCount > 0 || !validRows.length) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setImporting(true);
    try {
      const result = await requestImport(file, "commit");
      await onImported();
      notify(`${result.importedCount} Customers • ${money(result.total)} MMK Opening နှင့် Sale Man များ ပြင်ပြီးပါပြီ`);
      reset();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Opening များ ပြင်မရပါ");
    } finally {
      setImporting(false);
    }
  }

  return <section className="payment-import-card opening-import-card">
    <div className="payment-import-head">
      <span className="payment-import-icon"><FileSpreadsheet size={21} /></span>
      <div><strong>{preview?.asOfDate || "2026-10-26"} Official Opening — Excel ပြန်ပြင်ရန်</strong><small>Customer Code • Sale Man • Customer • Amount Column 4 ခု</small></div>
    </div>
    <div className="payment-import-body">
      <div className="payment-import-actions">
        <label className="excel-upload"><Upload size={17} /><span>{reading ? "Server တွင် စစ်နေသည်…" : file?.name || "Opening Excel File ရွေးရန်"}</span><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" disabled={reading || importing} onChange={(event) => void readFile(event)} /></label>
        {file && <button className="payment-import-clear" onClick={reset} disabled={importing} aria-label="Clear opening import"><X size={17} /></button>}
      </div>
      <p className="payment-import-help">File ကို မပြောင်းဘဲ တိုက်ရိုက်တင်နိုင်ပါသည်။ Customer Name ကို Directory နှင့် တိုက်စစ်ပြီး Preview အရင်ပြပါမည်။ Error မရှိမှ Opening အဟောင်းကို အစားထိုးပြီး Sale Man ကို Update လုပ်မည်။</p>
      {preview && <>
        <div className="payment-import-summary">
          <div><span>သိမ်းနိုင်</span><strong>{preview.validCount}</strong></div>
          <div className={preview.errorCount ? "invalid" : ""}><span>စစ်ရန်</span><strong>{preview.errorCount}</strong></div>
          <div><span>Opening Total</span><strong>{money(preview.total)} MMK</strong></div>
        </div>
        <div className="payment-import-preview">
          <div className="payment-import-preview-head"><span>Row / Customer</span><span>Sale Man</span><span>Opening Amount</span></div>
          {preview.rows.map((row) => <div className={row.error ? "payment-import-row invalid" : "payment-import-row"} key={row.rowNumber}>
            <span><b>#{row.rowNumber} {row.customerName || row.sourceCustomerName}</b><small>{row.customerCode}{row.township ? ` • ${row.township}` : ""}</small></span>
            <span><b>{row.salesperson || row.sourceSalesperson}</b><small>{row.error || "Customer / Sale Man ကိုက်ညီ"}</small></span>
            <span><b>{money(row.openingOutstanding)} MMK</b><small>{row.error ? <><AlertTriangle size={12} />ပြင်ရန်လို</> : <><CheckCircle2 size={12} />သိမ်းနိုင်</>}</small></span>
          </div>)}
        </div>
        {preview.errorCount > 0 && <div className="payment-import-warning"><AlertTriangle size={16} />Error Rows များရှိနေသဖြင့် Opening အဟောင်းကို မပြင်သေးပါ။ Customer Name / Sale Man ကို စစ်ပါ။</div>}
        {confirming && <div className="payment-import-warning"><AlertTriangle size={16} />{preview.asOfDate} Official Opening ကို {validRows.length} Customers • {money(preview.total)} MMK ဖြင့် အစားထိုးပြီး Sale Man များ Update လုပ်ပါမည်။ Trial Opening အဟောင်းကို Archive ထားမည်။ အောက်ပါခလုတ်ကို ထပ်နှိပ်၍ အတည်ပြုပါ။</div>}
        <button className="payment-import-submit" disabled={!validRows.length || importing || preview.errorCount > 0} onClick={() => void commit()}><Upload size={17} />{importing ? "Opening ပြင်နေသည်…" : confirming ? "အတည်ပြု၍ Opening ပြင်မည်" : `${validRows.length} Customers • Opening အစားထိုးမည်`}</button>
        {confirming && !importing && <button className="payment-import-clear" onClick={() => setConfirming(false)}>မလုပ်တော့ပါ</button>}
      </>}
    </div>
  </section>;
}
