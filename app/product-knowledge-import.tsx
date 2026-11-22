"use client";

import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Link2, RefreshCw, Upload, X } from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type ImportRow = {
  rowNumber: number;
  productName: string;
  genericName: string;
  category: string;
  keyBenefits: string;
  action: "add" | "update";
  error: string;
};

type Preview = {
  rows: ImportRow[];
  validCount: number;
  errorCount: number;
  addCount: number;
  updateCount: number;
};

const DEFAULT_PRODUCT_KNOWLEDGE_SHEET = "https://docs.google.com/spreadsheets/d/1PeY3oILV_Jk2mnjRQx0iB-Qv8EorQtxU_YMwbnRC5Fo/edit";

export default function ProductKnowledgeImport({ onImported, notify }: { onImported: () => Promise<void>; notify: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<"excel" | "google_sheet">("excel");
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_PRODUCT_KNOWLEDGE_SHEET);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sheetError, setSheetError] = useState("");
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const validRows = useMemo(() => preview?.rows.filter((row) => !row.error) || [], [preview]);
  useEffect(() => {
    setSheetUrl(window.localStorage.getItem("nawaratt-product-knowledge-sheet") || DEFAULT_PRODUCT_KNOWLEDGE_SHEET);
  }, []);

  function reset() {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function requestFileImport(selectedFile: File, mode: "preview" | "commit") {
    const body = new FormData();
    body.append("file", selectedFile);
    body.append("mode", mode);
    const response = await fetch("/api/product-knowledge-import", { method: "POST", body });
    const data = await response.json() as Preview & { importedCount?: number; error?: string };
    if (!response.ok) throw new Error(data.error || "Product Excel Import မအောင်မြင်ပါ");
    return data;
  }

  async function requestSheetImport(mode: "preview" | "commit") {
    const response = await fetch("/api/product-knowledge-import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sheetUrl, mode }),
    });
    const data = await response.json() as Preview & { importedCount?: number; error?: string };
    if (!response.ok) throw new Error(data.error || "Google Sheet ဖတ်မရပါ");
    return data;
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setReading(true);
    setFile(selectedFile);
    setPreview(null);
    try {
      setSource("excel");
      setPreview(await requestFileImport(selectedFile, "preview"));
    } catch (error) {
      reset();
      notify(error instanceof Error ? error.message : "Excel File ဖတ်မရပါ");
    } finally {
      setReading(false);
    }
  }

  async function previewSheet() {
    if (!sheetUrl.trim() || reading) return;
    setReading(true);
    setPreview(null);
    setSheetError("");
    try {
      window.localStorage.setItem("nawaratt-product-knowledge-sheet", sheetUrl.trim());
      setPreview(await requestSheetImport("preview"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google Sheet ဖတ်မရပါ";
      setSheetError(message);
      notify(message);
    } finally {
      setReading(false);
    }
  }

  async function commit() {
    if ((source === "excel" && !file) || !preview || preview.errorCount || !validRows.length || importing) return;
    if (!window.confirm(`Product အသစ် ${preview.addCount} • Update ${preview.updateCount} ကို သိမ်းမည်။ ဆက်လုပ်မလား?`)) return;
    setImporting(true);
    try {
      const result = source === "excel" && file
        ? await requestFileImport(file, "commit")
        : await requestSheetImport("commit");
      await onImported();
      notify(`Product Knowledge ${result.importedCount || validRows.length} ခု ${source === "excel" ? "Excel မှ သိမ်း" : "Google Sheet မှ Manual Sync လုပ်"}ပြီးပါပြီ`);
      reset();
      setOpen(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Products များ သိမ်းမရပါ");
    } finally {
      setImporting(false);
    }
  }

  return <section className="payment-import-card knowledge-import-card">
    <div className="payment-import-head">
      <span className="payment-import-icon"><FileSpreadsheet size={21} /></span>
      <div><strong>Product Knowledge — Excel / Google Sheet</strong><small>Excel Upload သို့မဟုတ် Google Sheet ကို လိုအပ်ချိန်မှသာ Manual Sync လုပ်ရန်</small></div>
      <button className="payment-import-toggle" onClick={() => setOpen((value) => !value)}>{open ? "ပိတ်မည်" : "Data ထည့်မည်"}</button>
    </div>
    {open && <div className="payment-import-body">
      <div className="knowledge-source-tabs">
        <button className={source === "excel" ? "active" : ""} onClick={() => { setSource("excel"); setPreview(null); }}><FileSpreadsheet />Excel File</button>
        <button className={source === "google_sheet" ? "active" : ""} onClick={() => { setSource("google_sheet"); setPreview(null); }}><Link2 />Google Sheet</button>
      </div>
      {source === "excel" ? <>
      <a className="knowledge-template-download" href="/api/product-knowledge-import" download><Download size={16} />Excel Template Download</a>
      <div className="payment-import-actions">
        <label className="excel-upload"><Upload size={17} /><span>{reading ? "Server တွင် စစ်နေသည်…" : file?.name || "Product Excel File ရွေးရန်"}</span><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" disabled={reading || importing} onChange={(event) => void readFile(event)} /></label>
        {file && <button className="payment-import-clear" onClick={reset} disabled={importing} aria-label="Clear product import"><X size={17} /></button>}
      </div>
      <p className="payment-import-help">Template ရဲ့ Column အမည်များ မပြောင်းပါနှင့်။ Product Name နှင့် Generic Name တူပြီးသားရှိပါက Duplicate မထည့်ဘဲ Update လုပ်မည်။</p>
      </> : <>
        <div className="knowledge-sheet-connect">
          <label><span>Google Sheet Link</span><input type="url" value={sheetUrl} onChange={(event) => { setSheetUrl(event.target.value); setPreview(null); setSheetError(""); }} placeholder="https://docs.google.com/spreadsheets/d/..." /></label>
          <button onClick={() => void previewSheet()} disabled={reading || !sheetUrl.trim()}><RefreshCw className={reading ? "spin" : ""} />{reading ? "ဖတ်နေသည်…" : "Preview ဖတ်မည်"}</button>
        </div>
        <p className="payment-import-help">အလိုအလျောက် Sync မလုပ်ပါ။ Sheet ရှိ Tab အားလုံးကို Category အဖြစ်ဖတ်ပြီး လိုအပ်သည့်အချိန်တွင် Preview စစ်ကာ “Manual Sync လုပ်မည်” ကိုနှိပ်ပါ။ Viewer Permission လိုအပ်ပါသည်။</p>
        {sheetError && <div className="payment-import-warning"><AlertTriangle size={16} />{sheetError}</div>}
      </>}
      {preview && <>
        <div className="payment-import-summary knowledge-import-summary">
          <div><span>Product အသစ်</span><strong>{preview.addCount}</strong></div>
          <div><span>Update</span><strong>{preview.updateCount}</strong></div>
          <div className={preview.errorCount ? "invalid" : ""}><span>စစ်ရန်</span><strong>{preview.errorCount}</strong></div>
        </div>
        <div className="payment-import-preview">
          <div className="payment-import-preview-head"><span>Row / Product</span><span>Category / Generic</span><span>Result</span></div>
          {preview.rows.map((row) => <div className={row.error ? "payment-import-row invalid" : "payment-import-row"} key={row.rowNumber}>
            <span><b>#{row.rowNumber} {row.productName || "Product Name မရှိ"}</b><small>{row.keyBenefits || "Key Benefits မရှိ"}</small></span>
            <span><b>{row.category}</b><small>{row.genericName || "Generic Name မရှိ"}</small></span>
            <span><b>{row.action === "add" ? "Product အသစ်" : "Update"}</b><small>{row.error ? <><AlertTriangle size={12} />{row.error}</> : <><CheckCircle2 size={12} />သိမ်းနိုင်</>}</small></span>
          </div>)}
        </div>
        {preview.errorCount > 0 && <div className="payment-import-warning"><AlertTriangle size={16} />Error Rows များကို ပြင်ပြီး File ပြန်ရွေးပါ။ Error မရှိမှ Products အားလုံးကို သိမ်းမည်။</div>}
        <button className="payment-import-submit" disabled={!validRows.length || importing || preview.errorCount > 0} onClick={() => void commit()}><Upload size={17} />{importing ? "Products သိမ်းနေသည်…" : source === "google_sheet" ? `${validRows.length} Products Manual Sync လုပ်မည်` : `${validRows.length} Products သိမ်းမည်`}</button>
      </>}
    </div>}
  </section>;
}
