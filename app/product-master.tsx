"use client";

import { Check, ChevronLeft, ChevronRight, FileSpreadsheet, Pencil, Search, Trash2, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

export type MasterProduct = {
  id: number;
  productCode: string;
  productName: string;
  sku: string;
  salePrice: number;
  active: boolean;
};

export function ProductSearchSelect({ products, selectedId, onSelect, onClear, placeholder = "Code, Name သို့မဟုတ် SKU ရှာရန်" }: { products: MasterProduct[]; selectedId?: number; onSelect: (product: MasterProduct) => void; onClear?: () => void; placeholder?: string }) {
  const selected = products.find((product) => product.id === selectedId);
  const [query, setQuery] = useState(selected ? `${selected.productCode} • ${selected.productName}` : "");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const needle = query.toLocaleLowerCase().trim();
    return products.filter((product) => !needle || `${product.productCode} ${product.productName} ${product.sku}`.toLocaleLowerCase().includes(needle)).slice(0, 30);
  }, [products, query]);
  return <div className="product-search-select">
    <div className={selected ? "product-search-input selected" : "product-search-input"}><Search size={16} /><input value={query} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(event) => { if (selectedId) onClear?.(); setQuery(event.target.value); setOpen(true); }} />{selected && <Check size={16} />}</div>
    {open && <div className="product-search-options">{matches.length ? matches.map((product) => <button type="button" key={product.id} onClick={() => { onSelect(product); setQuery(`${product.productCode} • ${product.productName}`); setOpen(false); }}><span><strong>{product.productName}</strong><small>{product.productCode}{product.sku ? ` • SKU ${product.sku}` : ""}</small></span><b>{product.salePrice.toLocaleString()} MMK</b></button>) : <p>Product Master ထဲတွင် မတွေ့ပါ</p>}</div>}
  </div>;
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}

export default function ProductMasterPage({ products, canManage, reload, notify }: { products: MasterProduct[]; canManage: boolean; reload: () => Promise<void>; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ productCode: "", productName: "", sku: "", salePrice: "" });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const needle = query.toLocaleLowerCase().trim();
    return products.filter((product) => !needle || `${product.productCode} ${product.productName} ${product.sku}`.toLocaleLowerCase().includes(needle));
  }, [products, query]);
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);

  function edit(product: MasterProduct) {
    setEditingId(product.id);
    setDraft({ productCode: product.productCode, productName: product.productName, sku: product.sku, salePrice: String(product.salePrice || "") });
  }

  async function save() {
    if (!editingId || !draft.productCode.trim() || !draft.productName.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/products", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: editingId, ...draft }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Product ပြင်မရပါ");
      await reload(); setEditingId(null); notify("Product ကို table ထဲတွင် ပြင်ပြီးပါပြီ");
    } catch (error) { notify(error instanceof Error ? error.message : "Product ပြင်မရပါ"); }
    finally { setBusy(false); }
  }

  async function addProduct() {
    if (!draft.productCode.trim() || !draft.productName.trim()) return notify("Product Code နှင့် Product Name ထည့်ပါ");
    setBusy(true);
    try {
      const response = await fetch("/api/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Product အသစ်ထည့်မရပါ");
      await reload(); setAdding(false); setDraft({ productCode: "", productName: "", sku: "", salePrice: "" }); notify("Product အသစ်ထည့်ပြီးပါပြီ");
    } catch (error) { notify(error instanceof Error ? error.message : "Product အသစ်ထည့်မရပါ"); }
    finally { setBusy(false); }
  }

  async function remove(product: MasterProduct) {
    if (!window.confirm(`${product.productName} ကို Product List မှဖျက်မည်လား? Historical Orders မပျက်ပါ။`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/products", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: product.id }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Product ဖျက်မရပါ");
      await reload(); notify("Product ကို list မှဖယ်ရှားပြီးပါပြီ");
    } catch (error) { notify(error instanceof Error ? error.message : "Product ဖျက်မရပါ"); }
    finally { setBusy(false); }
  }

  async function importExcel(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const productsToImport = rows.map((row) => {
        const mapped = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
        return { productCode: mapped.productcode ?? mapped.code ?? mapped.usrcode ?? mapped.itemcode, productName: mapped.productname ?? mapped.name ?? mapped.description ?? mapped.itemname, sku: mapped.sku ?? "", salePrice: mapped.saleprice ?? mapped.price ?? 0 };
      }).filter((product) => !(String(product.productCode).trim() === "7" && String(product.productName).trim() === "7"));
      const response = await fetch("/api/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ products: productsToImport }) });
      const data = await response.json() as { imported?: number; skipped?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Product Excel Import မလုပ်နိုင်ပါ");
      await reload(); notify(`${data.imported || 0} Products imported • ${data.skipped || 0} skipped`);
    } catch (error) { notify(error instanceof Error ? error.message : "Product Excel Import မလုပ်နိုင်ပါ"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return <div className="product-master-page">
    <section className="product-master-hero"><div><FileSpreadsheet size={22} /><span><strong>Product Master</strong><small>Order, Warehouse Match နှင့် Sale Price အတွက် တစ်ခုတည်းသော Product List</small></span></div><b>{products.length} Products</b></section>
    <div className="product-master-toolbar"><label><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Code, Product Name, SKU ရှာရန်" />{query && <button type="button" onClick={() => { setQuery(""); setPage(1); }}><X size={15} /></button>}</label>{canManage && <><button type="button" className="product-add-trigger" disabled={busy} onClick={() => { setAdding(true); setEditingId(null); setDraft({ productCode: "", productName: "", sku: "", salePrice: "" }); }}><Pencil size={16} />Add Product</button><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void importExcel(event.target.files?.[0] || null)} /><button type="button" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={16} />{busy ? "Processing…" : "Import Excel"}</button></>}</div>
    {canManage && <p className="product-import-note">Required columns: <b>Product Code + Product Name</b> • Accepted: Code/ProductCode/usr_code and Name/ProductName/Description • SKU and Sale Price are optional.</p>}
    {canManage && adding && <div className="product-manual-add"><div><strong>Product တစ်မျိုးချင်း ထည့်ရန်</strong><button type="button" onClick={() => setAdding(false)}><X size={15} /></button></div><div><label><span>Product Code *</span><input autoFocus value={draft.productCode} onChange={(event) => setDraft({ ...draft, productCode: event.target.value })} /></label><label><span>Product Name *</span><input value={draft.productName} onChange={(event) => setDraft({ ...draft, productName: event.target.value })} /></label><label><span>SKU (Optional)</span><input value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} /></label><label><span>Sale Price (Optional)</span><input type="number" min="0" value={draft.salePrice} onChange={(event) => setDraft({ ...draft, salePrice: event.target.value })} /></label></div><button type="button" disabled={busy || !draft.productCode.trim() || !draft.productName.trim()} onClick={() => void addProduct()}><Check size={16} />{busy ? "သိမ်းနေသည်…" : "Product သိမ်းမည်"}</button></div>}
    <div className={canManage ? "product-master-table manageable" : "product-master-table readonly"}><div className="head"><span>Code</span><span>Product Name</span><span>SKU</span><span>Sale Price</span>{canManage && <span>Actions</span>}</div>{pageRows.map((product) => editingId === product.id ? <div className="editing" key={product.id}><input value={draft.productCode} onChange={(event) => setDraft({ ...draft, productCode: event.target.value })} /><input value={draft.productName} onChange={(event) => setDraft({ ...draft, productName: event.target.value })} /><input value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} /><input type="number" min="0" value={draft.salePrice} onChange={(event) => setDraft({ ...draft, salePrice: event.target.value })} /><span><button type="button" className="save" disabled={busy} onClick={() => void save()}><Check size={15} />Save</button><button type="button" className="cancel" onClick={() => setEditingId(null)}><X size={15} /></button></span></div> : <div key={product.id}><span data-label="Code"><b>{product.productCode}</b></span><span data-label="Product"><strong>{product.productName}</strong></span><span data-label="SKU">{product.sku || "—"}</span><span data-label="Sale Price"><b>{product.salePrice.toLocaleString()}</b></span>{canManage && <span className="product-row-actions"><button type="button" className="edit" onClick={() => edit(product)}><Pencil size={14} />Edit</button><button type="button" className="delete" disabled={busy} onClick={() => void remove(product)}><Trash2 size={14} />Delete</button></span>}</div>)}</div>
    {filtered.length > pageSize && <div className="product-master-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} />Previous</button><span>Page <b>{Math.min(page, pageCount)}</b> of {pageCount} • {filtered.length} Products</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next<ChevronRight size={15} /></button></div>}
    {!filtered.length && <div className="product-master-empty">Product မရှိသေးပါ။ Admin က Excel file ဖြင့် Import လုပ်နိုင်ပါသည်။</div>}
  </div>;
}
