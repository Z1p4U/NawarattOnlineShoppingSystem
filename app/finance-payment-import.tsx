"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, X } from "lucide-react";
import { type ChangeEvent, useMemo, useRef, useState } from "react";

type ImportRow = {
  rowNumber: number;
  paymentDate: string;
  customerName: string;
  matchedCustomerName: string;
  matchedTownship: string;
  amount: number;
  method: "cash" | "banking" | "";
  account: string;
  outstandingBefore: number;
  outstandingAfter: number;
  overpayment: number;
  error: string;
};

type Preview = {
  duplicate: boolean;
  rows: ImportRow[];
  validCount: number;
  errorCount: number;
  total: number;
};

type Props = {
  onImported: () => Promise<void>;
  notify: (message: string) => void;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

export default function FinancePaymentImport({ onImported, notify }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);

  const validRows = useMemo(() => preview?.rows.filter((row) => !row.error) || [], [preview]);

  function reset() {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function requestImport(selectedFile: File, mode: "preview" | "commit") {
    const body = new FormData();
    body.append("file", selectedFile);
    body.append("mode", mode);
    const response = await fetch("/api/payment-import", { method: "POST", body });
    const data = await response.json() as any;
    if (!response.ok) throw new Error(data.error || "Payment File Import မအောင်မြင်ပါ");
    return data;
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setReading(true);
    setFile(selectedFile);
    setPreview(null);
    try {
      const data = await requestImport(selectedFile, "preview");
      setPreview(data);
      if (data.duplicate) notify("ဒီ File ကို အရင်က Import လုပ်ပြီးပါပြီ");
    } catch (error) {
      reset();
      notify(error instanceof Error ? error.message : "Excel File ဖတ်မရပါ");
    } finally {
      setReading(false);
    }
  }

  async function importPayments() {
    if (!file || !preview || !validRows.length || importing || preview.duplicate) return;
    if (!window.confirm(`${validRows.length} Payments • ${money(preview.total)} MMK ကို သိမ်းမည်။ ဆက်လုပ်မလား?`)) return;
    setImporting(true);
    try {
      const result = await requestImport(file, "commit");
      await onImported();
      notify(`${result.importedCount} Payments • ${money(result.total)} MMK သိမ်းပြီးပါပြီ${result.skippedCount ? ` • Error ${result.skippedCount} ကြောင်း မသိမ်းပါ` : ""}`);
      reset();
      setOpen(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Payment များ သိမ်းမရပါ");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="payment-import-card">
      <div className="payment-import-head">
        <span className="payment-import-icon"><FileSpreadsheet size={21} /></span>
        <div><strong>Customers Payment — Excel File</strong><small>Cash / Banking Payment အများကြီးကို File တစ်ခုတည်းဖြင့် ထည့်နိုင်သည်</small></div>
        <button className="payment-import-toggle" onClick={() => setOpen((value) => !value)}>{open ? "ပိတ်မည်" : "Excel ထည့်မည်"}</button>
      </div>
      {open && <div className="payment-import-body">
        <div className="payment-import-actions">
          <label className="excel-upload"><Upload size={17} /><span>{reading ? "Server တွင် စစ်နေသည်…" : file?.name || "Excel File ရွေးရန်"}</span><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" disabled={reading || importing} onChange={(event) => void readFile(event)} /></label>
          {file && <button className="payment-import-clear" onClick={reset} disabled={importing} aria-label="Clear import"><X size={17} /></button>}
        </div>
        <p className="payment-import-help">Nawaratt Cash/Bank Payment Export File ကို မပြောင်းဘဲ တိုက်ရိုက်တင်နိုင်ပါသည်။ System က Customer၊ Date၊ Amount နဲ့ Cash/Banking ကို စစ်ပြီး Preview အရင်ပြပါမည်။</p>
        {preview && <>
          <div className="payment-import-summary">
            <div><span>သိမ်းနိုင်</span><strong>{preview.validCount}</strong></div>
            <div className={preview.errorCount ? "invalid" : ""}><span>စစ်ရန်</span><strong>{preview.errorCount}</strong></div>
            <div><span>သိမ်းမည့် Total</span><strong>{money(preview.total)} MMK</strong></div>
          </div>
          {preview.duplicate && <div className="payment-import-warning"><AlertTriangle size={16} />ဒီ File ကို အရင်က Import လုပ်ပြီးဖြစ်သောကြောင့် ထပ်မသိမ်းနိုင်ပါ။</div>}
          <div className="payment-import-preview">
            <div className="payment-import-preview-head"><span>Row / Customer</span><span>Date / Type</span><span>Amount / Result</span></div>
            {preview.rows.map((row) => <div className={row.error ? "payment-import-row invalid" : "payment-import-row"} key={row.rowNumber}>
              <span><b>#{row.rowNumber} {row.matchedCustomerName || row.customerName}</b><small>{row.matchedTownship || "Township မတွေ့"}</small></span>
              <span><b>{row.paymentDate}</b><small>{row.method === "cash" ? "Cash" : row.method === "banking" ? `Banking${row.account ? ` • ${row.account}` : ""}` : "Type မသိ"}</small></span>
              <span><b>{money(row.amount)} MMK</b><small>{row.error ? <><AlertTriangle size={12} />{row.error}</> : row.overpayment > 0 ? <><CheckCircle2 size={12} />Payment ပိုဝင် {money(row.overpayment)} MMK</> : <><CheckCircle2 size={12} />Outstanding ကျန် {money(row.outstandingAfter)}</>}</small></span>
            </div>)}
          </div>
          {preview.errorCount > 0 && <div className="payment-import-warning"><AlertTriangle size={16} />အနီရောင် Rows များကို မသိမ်းပါ။ ကျန် Valid Rows များကိုသာ တစ်ခါတည်းသိမ်းပါမည်။</div>}
          <button className="payment-import-submit" disabled={!validRows.length || importing || preview.duplicate} onClick={() => void importPayments()}><Upload size={17} />{importing ? "Payments သိမ်းနေသည်…" : `${validRows.length} Payments • ${money(preview.total)} MMK သိမ်းမည်`}</button>
          <small className="payment-import-caution">Import ပြီးသော File ကို ထပ်တင်မိလျှင် System က အလိုအလျောက်တားဆီးပါမည်။</small>
        </>}
      </div>}
    </section>
  );
}
