"use client";

import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, PackagePlus, Upload, X } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";

type FileType = "inventory" | "purchase";
type ImportRow = {
  rowNumber: number; sheetName: string; insightType: string; productCode: string; productName: string;
  metricLabel: string; metricValue: string; inventoryMatch: "code" | "name" | "unmatched";
  action: "add" | "update" | "unchanged"; error: string; duplicate: boolean;
};
type Preview = {
  fileType: FileType; fileName: string; sourceRows: number; rows: ImportRow[]; validCount: number;
  errorCount: number; duplicateCount: number; addCount: number; updateCount: number; unchangedCount: number; unmatchedCount: number;
  supplierGroupCount?: number; typeCounts?: Record<string, number>;
  previewRowCount?: number; hiddenRowCount?: number;
};

const labels: Record<string, string> = {
  low_sale: "Low Sale", overstock: "Over Stock", near_expired: "Near Expired",
  incoming: "Incoming", supplier: "Supplier", price_change: "Price Change",
};

export default function ProductIntelligenceImport({ onImported }: { onImported: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileType, setFileType] = useState<FileType>("inventory");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  function reset(nextType = fileType) {
    setFileType(nextType); setFile(null); setPreview(null); setMessage("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function request(selected: File, mode: "preview" | "commit") {
    const body = new FormData();
    body.append("file", selected); body.append("fileType", fileType); body.append("mode", mode);
    const response = await fetch("/api/product-intelligence/import", { method: "POST", body });
    const data = await response.json() as Preview & { error?: string; importedCount?: number };
    if (!response.ok) throw new Error(data.error || "Excel Import မအောင်မြင်ပါ");
    return data;
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setBusy(true); setFile(selected); setPreview(null); setMessage("");
    try { setPreview(await request(selected, "preview")); }
    catch (error) { setFile(null); setMessage(error instanceof Error ? error.message : "Excel File ဖတ်မရပါ"); }
    finally { setBusy(false); }
  }

  async function commit() {
    if (!file || !preview || busy || !preview.validCount) return;
    if (!window.confirm(`New ${preview.addCount} • Update ${preview.updateCount} • Unchanged ${preview.unchangedCount} ကို သိမ်းမည်။ ဆက်လုပ်မလား?`)) return;
    setBusy(true); setMessage("");
    try {
      const result = await request(file, "commit");
      await onImported();
      setMessage(`${result.importedCount || preview.validCount} Records Excel မှ သိမ်းပြီးပါပြီ`);
      setFile(null); setPreview(null); if (inputRef.current) inputRef.current.value = "";
    } catch (error) { setMessage(error instanceof Error ? error.message : "Records သိမ်းမရပါ"); }
    finally { setBusy(false); }
  }

  return <section className="product-report-import">
    <header><span><FileSpreadsheet /><b>Manual Excel Report Input</b><small>Database matching only • AI tokens မသုံးပါ</small></span></header>
    <div className="product-report-import-types">
      <button className={fileType === "inventory" ? "active" : ""} onClick={() => reset("inventory")}><FileSpreadsheet /><span><b>Low / Over / Near</b><small>Low Sale · Over Stock · Near Expired</small></span></button>
      <button className={fileType === "purchase" ? "active" : ""} onClick={() => reset("purchase")}><PackagePlus /><span><b>Purchase Record</b><small>Incoming · Supplier · Price Change</small></span></button>
    </div>
    <div className="product-report-import-actions">
      <a href={`/api/product-intelligence/import?fileType=${fileType}`} download><Download />Template</a>
      <label><Upload /><span>{busy ? "Excel စစ်နေသည်…" : file?.name || "Excel File ရွေးရန်"}</span><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={(event) => void selectFile(event)} /></label>
      {file && <button onClick={() => reset()} disabled={busy} aria-label="Clear"><X /></button>}
    </div>
    <p className="product-report-import-help">{fileType === "inventory" ? "Type column သို့မဟုတ် Low Sale / Over Stock / Near Expired sheet tabs ကို ဖတ်မည်။" : "Supplier column, merged supplier group, သို့မဟုတ် supplier-named sheets ကို ဖတ်မည်။ Product Code → exact Product Name အစဉ်ဖြင့် Inventory Match လုပ်မည်။"}</p>
    {message && <p className="product-report-import-message">{message}</p>}
    {preview && <>
      <div className="product-report-import-summary">
        <span><small>Source Rows</small><b>{preview.sourceRows}</b></span><span><small>Valid Records</small><b>{preview.validCount}</b></span>
        <span><small>New</small><b>{preview.addCount}</b></span><span><small>Update</small><b>{preview.updateCount}</b></span>
        <span><small>Unchanged</small><b>{preview.unchangedCount}</b></span><span className={preview.errorCount ? "warning" : ""}><small>Errors</small><b>{preview.errorCount}</b></span>
      </div>
      {preview.fileType === "purchase" && <div className="product-report-import-warning supplier-ok"><CheckCircle2 /><span><b>{preview.supplierGroupCount || 0} Supplier Groups Detected</b><small>Incoming {preview.typeCounts?.incoming || 0} • Supplier Records {preview.typeCounts?.supplier || 0} • Price Changes {preview.typeCounts?.price_change || 0}</small></span></div>}
      {preview.unmatchedCount > 0 && <div className="product-report-import-warning"><AlertTriangle />Inventory unmatched {preview.unmatchedCount} records ကို original Product Name ဖြင့် report ထဲသိမ်းမည်။</div>}
      <div className="product-report-import-preview">
        {preview.rows.slice(0, 120).map((row, index) => <div className={row.error ? "invalid" : row.inventoryMatch === "unmatched" ? "unmatched" : ""} key={`${row.sheetName}-${row.rowNumber}-${row.insightType}-${index}`}>
          <span><b>#{row.rowNumber} {row.productName || "Product မရှိ"}</b><small>{row.productCode || row.sheetName}</small></span>
          <span><b>{labels[row.insightType] || row.insightType || "Invalid Type"}</b><small>{row.metricValue || row.metricLabel}</small></span>
          <span><b>{row.action === "add" ? "New" : row.action === "update" ? "Update" : "Unchanged"}</b><small>{row.error ? <><AlertTriangle />{row.error}</> : row.duplicate ? "Duplicate — Skip" : <><CheckCircle2 />{row.inventoryMatch === "unmatched" ? "Unmatched" : `Matched by ${row.inventoryMatch}`}</>}</small></span>
        </div>)}
      </div>
      {(preview.hiddenRowCount || 0) > 0 && <p className="product-report-import-help">Preview တွင် ပထမ {preview.previewRowCount || preview.rows.length} records ကိုသာ ပြထားသည်။ နောက်ထပ် {preview.hiddenRowCount} records ကို Commit လုပ်ရာတွင် အားလုံးထည့်သွင်းမည်။</p>}
      <button className="product-report-import-submit" disabled={busy || !preview.validCount} onClick={() => void commit()}><Upload />{busy ? "သိမ်းနေသည်…" : `${preview.validCount} Records Merge / Upsert လုပ်မည်`}</button>
    </>}
  </section>;
}
