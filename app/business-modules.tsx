"use client";

import {
  BadgeDollarSign,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  ClipboardCheck,
  Edit3,
  FileText,
  Filter,
  Lightbulb,
  List,
  LockKeyhole,
  Map,
  MapPinCheck,
  MapPinned,
  Navigation,
  Phone,
  PhoneCall,
  Play,
  RefreshCw,
  Route,
  Search,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import ProductKnowledgeImport from "./product-knowledge-import";
import ProductLiveData from "./product-live-data";

type AppRole = "admin" | "sale" | "warehouse" | "purchase" | "delivery" | "finance" | "viewer";
type ModuleKey = "knowledge" | "reporting" | "growth";

type KnowledgeItem = {
  id: number;
  productName: string;
  genericName: string;
  category: string;
  keyBenefits: string;
  talkingPoints: string;
  usageNote: string;
  caution: string;
  tags: string;
  active: boolean;
  updatedBy: string;
  updatedAt: string;
};

type EmployeeReport = {
  id: number;
  reportDate: string;
  reportType: "daily" | "issue" | "achievement";
  title: string;
  completedWork: string;
  challenges: string;
  nextPlan: string;
  supportNeeded: string;
  submittedByEmail: string;
  submittedByName: string;
  submittedByRole: AppRole;
  createdAt: string;
  updatedAt: string;
};

type SalesFollowUp = {
  id: number;
  customerKey: string;
  customerName: string;
  township: string;
  salesperson: string;
  opportunityType: "follow_up";
  status: "planned" | "pending" | "due" | "overdue" | "completed" | "rescheduled" | "order_created" | "no_answer";
  callDate: string;
  callTime: string;
  callPurpose: string;
  callResult: string;
  nextFollowUpDate: string;
  productSuggestion: string;
  note: string;
  expectedAmount: number;
  orderExpected: boolean;
  confirmedOrderId: number | null;
  confirmedOrderAmount?: number;
  paymentFollowUp: string;
  customerRequest: string;
  createdByName: string;
  updatedAt: string;
};

type SalesInsight = {
  customerKey: string;
  customerName: string;
  township: string;
  route: string;
  salesperson: string;
  phone: string;
  address: string;
  lastOrderDate: string;
  lastSaleVrDate: string;
  saleTeam: "A" | "B" | "";
  voucher7: number;
  orderCount90: number;
  voucher90: number;
  lifetimeOrders: number;
  lifetimeVoucher: number;
  inactiveDays: number;
  outstandingAmount: number;
  lastPaymentDate: string;
  recommendation: "follow_up" | "route_call" | "";
  inclusionReason: string;
  latestFollowUp: SalesFollowUp | null;
};

type ReconciliationSummary = {
  team: "A" | "B"; totalActiveCustomers: number; saleVrExcluded: number; followUpCustomers: number;
  routeSaleCustomers: number; unmatchedCustomers: number; duplicateCustomers: number;
};

type SalesGrowthQuality = {
  keyMismatches: Array<{ orderNo: string; customerName: string; township: string; orderKey: string; customerKey: string; method: string }>;
  unmatchedOrders: Array<{ orderNo: string; customerName: string; township: string; orderKey: string }>;
  duplicateCustomers: Array<{ normalizedName: string; customers: Array<{ customerName: string; township: string; customerKey: string }> }>;
  saleVrCandidateLeaks: Array<{ customerName: string; township: string; voucher7: number }>;
};

type CustomerLocation = {
  id: number; customerKey: string; latitude: string; longitude: string; landmark: string;
  directionsNote: string; shopPhotoUrl: string; verified: boolean; updatedBy: string; updatedAt: string;
};

type RoutePlan = {
  id: number; planDate: string; routeName: string; township: string; salesperson: string; plannedStartTime: string;
  status: string; remark: string; isTemplate: boolean; createdByName: string; createdAt: string; updatedAt: string;
};

type RouteStop = {
  id: number; routePlanId: number; sequence: number; customerKey: string; customerName: string; township: string; route: string;
  salesperson: string; status: string; visitPurpose: string; visitResult: string; noOrderReason: string; orderReceived: boolean;
  estimatedOrderAmount: number; confirmedOrderId: number | null; confirmedOrderAmount: number; paymentCollected: boolean;
  collectedAmount: number; financeVerified: boolean; customerRequest: string; nextFollowUpDate: string; nextVisitDate: string;
  remark: string; checkInLatitude: string; checkInLongitude: string; checkInDistanceMeters: number; checkInVerified: boolean;
  checkInReason: string; checkInAt: string; checkOutAt: string; location: CustomerLocation | null;
};

export type SalesOrderPrefill = {
  customerName: string; township: string; salesperson: string; route: string; orderAmount: string;
  sourceType: "follow_up" | "route_stop"; sourceId: number;
};

const emptyKnowledge = {
  id: 0, productName: "", genericName: "", category: "", keyBenefits: "",
  talkingPoints: "", usageNote: "", caution: "", tags: "", active: true,
};

function todayLocal() {
  return new Date(Date.now() + 6.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function money(value: number) {
  return Math.round(value || 0).toLocaleString();
}

function displayDate(value: string) {
  if (!value) return "မရှိသေး";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function relativeUpdate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yangon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

async function readJson<T extends object>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => ({ error: "Server မှ အဖြေမှန်ကန်စွာ မရရှိပါ" }));
  if (!response.ok) {
    const message = response.status >= 500
      ? "Load Failed"
      : typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
      ? data.error
      : "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export default function BusinessModules({ role, userName, notify, onCreateSaleOrder }: { role: AppRole; userName: string; notify: (message: string) => void; onCreateSaleOrder: (prefill: SalesOrderPrefill) => void }) {
  const canSalesGrowth = role === "admin" || role === "sale";
  const [active, setActive] = useState<ModuleKey>("knowledge");
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [reports, setReports] = useState<EmployeeReport[]>([]);
  const [insights, setInsights] = useState<SalesInsight[]>([]);
  const [followUps, setFollowUps] = useState<SalesFollowUp[]>([]);
  const [reconciliationSummary, setReconciliationSummary] = useState<ReconciliationSummary[]>([]);
  const [growthQuality, setGrowthQuality] = useState<SalesGrowthQuality | null>(null);
  const [loading, setLoading] = useState(true);

  const loadModules = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [
        fetch("/api/product-knowledge", { cache: "no-store" }),
        fetch("/api/employee-reports", { cache: "no-store" }),
        ...(canSalesGrowth ? [fetch("/api/sales-growth", { cache: "no-store" })] : []),
      ];
      const responses = await Promise.all(requests);
      const knowledgeData = await readJson<{ products: KnowledgeItem[] }>(responses[0]);
      const reportData = await readJson<{ reports: EmployeeReport[] }>(responses[1]);
      setKnowledge(knowledgeData.products || []);
      setReports(reportData.reports || []);
      if (canSalesGrowth && responses[2]) {
        const growthData = await readJson<{ insights: SalesInsight[]; followUps: SalesFollowUp[]; reconciliationSummary: ReconciliationSummary[]; qualityReport: SalesGrowthQuality | null }>(responses[2]);
        setInsights(growthData.insights || []);
        setFollowUps(growthData.followUps || []);
        setReconciliationSummary(growthData.reconciliationSummary || []);
        setGrowthQuality(growthData.qualityReport || null);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Module Data ရယူမရပါ");
    } finally {
      setLoading(false);
    }
  }, [canSalesGrowth, notify]);

  useEffect(() => {
    // Loading remote module data is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadModules();
  }, [loadModules]);

  return (
    <section className="business-modules">
      <div className="module-access-summary">
        <div><span><BookOpenCheck /></span><b>Product Knowledge</b><small>ဝန်ထမ်းအားလုံး</small></div>
        <div><span><FileText /></span><b>Reporting</b><small>ဝန်ထမ်းအားလုံး</small></div>
        <div className={!canSalesGrowth ? "locked" : ""}><span>{canSalesGrowth ? <TrendingUp /> : <LockKeyhole />}</span><b>Sales Growth</b><small>Admin & Sales Team</small></div>
      </div>

      <nav className="module-tabs" aria-label="Business Modules">
        <button className={active === "knowledge" ? "active" : ""} onClick={() => setActive("knowledge")}><BookOpenCheck />Product Knowledge</button>
        <button className={active === "reporting" ? "active" : ""} onClick={() => setActive("reporting")}><ClipboardCheck />Reporting</button>
        <button className={active === "growth" ? "active" : ""} disabled={!canSalesGrowth} onClick={() => setActive("growth")}>{canSalesGrowth ? <TrendingUp /> : <LockKeyhole />}Sales Growth</button>
        <button className="module-refresh" onClick={() => void loadModules()} disabled={loading} aria-label="Refresh Modules"><RefreshCw className={loading ? "spin" : ""} /></button>
      </nav>

      {active === "knowledge" && <ProductKnowledgePanel items={knowledge} role={role} loading={loading} setItems={setKnowledge} reload={loadModules} notify={notify} />}
      {active === "reporting" && <ReportingPanel reports={reports} role={role} userName={userName} loading={loading} setReports={setReports} notify={notify} />}
      {active === "growth" && canSalesGrowth && <SalesGrowthPanel insights={insights} followUps={followUps} reconciliationSummary={reconciliationSummary} qualityReport={growthQuality} loading={loading} reload={loadModules} notify={notify} role={role} userName={userName} onCreateSaleOrder={onCreateSaleOrder} />}
    </section>
  );
}

function ProductKnowledgePanel({ items, role, loading, setItems, reload, notify }: {
  items: KnowledgeItem[]; role: AppRole; loading: boolean;
  setItems: React.Dispatch<React.SetStateAction<KnowledgeItem[]>>; reload: () => Promise<void>; notify: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyKnowledge);
  const [saving, setSaving] = useState(false);
  const categories = useMemo(() => ["All", ...new Set(items.map((item) => item.category).filter(Boolean))], [items]);
  const filtered = useMemo(() => items.filter((item) => {
    const needle = query.trim().toLocaleLowerCase();
    const text = `${item.productName} ${item.genericName} ${item.category} ${item.tags} ${item.keyBenefits}`.toLocaleLowerCase();
    return (category === "All" || item.category === category) && (!needle || text.includes(needle));
  }).sort((left, right) => left.productName.localeCompare(right.productName, undefined, { sensitivity: "base", numeric: true })), [category, items, query]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const effectivePage = Math.min(page, pageCount);
  const visible = useMemo(() => filtered.slice((effectivePage - 1) * pageSize, effectivePage * pageSize), [effectivePage, filtered]);

  function edit(item?: KnowledgeItem) {
    setForm(item ? { ...item } : emptyKnowledge);
    setFormOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/product-knowledge", {
        method: form.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await readJson<{ product: KnowledgeItem }>(response);
      setItems((current) => form.id
        ? current.map((item) => item.id === data.product.id ? data.product : item)
        : [data.product, ...current]);
      setForm(emptyKnowledge);
      setFormOpen(false);
      notify(form.id ? "Product Knowledge ပြင်ပြီးပါပြီ" : "Product Knowledge ထည့်ပြီးပါပြီ");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Product Knowledge သိမ်းမရပါ");
    } finally {
      setSaving(false);
    }
  }

  return <div className="module-panel">
    <div className="module-panel-head">
      <div><span className="module-panel-icon knowledge"><BookOpenCheck /></span><span><strong>Product Knowledge</strong><small>Product အချက်အလက်၊ အကျိုးကျေးဇူးနှင့် Customer ပြောရန်အချက်များ</small></span></div>
      {role === "admin" && <button onClick={() => formOpen ? setFormOpen(false) : edit()}>{formOpen ? <X /> : <CirclePlus />}{formOpen ? "ပိတ်မည်" : "Product ထည့်ရန်"}</button>}
    </div>

    {role === "admin" && formOpen && <form className="module-form knowledge-form" onSubmit={save}>
      <div className="module-form-title"><Edit3 /><span><b>{form.id ? "Product Knowledge ပြင်ရန်" : "Product Knowledge အသစ်"}</b><small>မသေချာသော ဆေးဘက်ဆိုင်ရာအချက်အလက်ကို မထည့်ပါနှင့်</small></span></div>
      <label><span>Product Name *</span><input required value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} /></label>
      <label><span>Generic Name</span><input value={form.genericName} onChange={(e) => setForm({ ...form, genericName: e.target.value })} /></label>
      <label><span>Category</span><input placeholder="ဥပမာ — Antibiotic" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
      <label><span>Tags</span><input placeholder="comma ခွဲရေးပါ" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></label>
      <label className="wide"><span>Key Benefits *</span><textarea required rows={3} value={form.keyBenefits} onChange={(e) => setForm({ ...form, keyBenefits: e.target.value })} /></label>
      <label className="wide"><span>Customer Talking Points</span><textarea rows={3} value={form.talkingPoints} onChange={(e) => setForm({ ...form, talkingPoints: e.target.value })} /></label>
      <label><span>Usage / Product Note</span><textarea rows={3} value={form.usageNote} onChange={(e) => setForm({ ...form, usageNote: e.target.value })} /></label>
      <label><span>Caution</span><textarea rows={3} value={form.caution} onChange={(e) => setForm({ ...form, caution: e.target.value })} /></label>
      {form.id > 0 && <label className="module-active-check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /><span>Active Product Knowledge</span></label>}
      <button className="module-primary" disabled={saving}>{saving ? "သိမ်းနေသည်…" : "သိမ်းမည်"}</button>
    </form>}

    {role === "admin" && <ProductKnowledgeImport onImported={reload} notify={notify} />}

    <ProductLiveData role={role} />

    <div className="module-toolbar">
      <label className="module-search"><Search /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Product / Generic / Benefit ရှာရန်" /></label>
      <label><Filter /><select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <span className="knowledge-sort">A–Z</span>
      <b>{filtered.length} Products</b>
    </div>

    {loading ? <ModuleLoading /> : filtered.length === 0 ? <ModuleEmpty icon={<BookOpenCheck />} title="Product Knowledge မရှိသေးပါ" text={role === "admin" ? "Product ထည့်ရန်ကိုနှိပ်ပြီး ပထမဆုံး Knowledge ကိုထည့်နိုင်ပါသည်။" : "Admin မှ Product Knowledge ထည့်ပြီးလျှင် ဒီနေရာမှာ မြင်ရပါမယ်။"} /> :
      <div className="knowledge-grid">{visible.map((item) => <article className={item.active ? "knowledge-card" : "knowledge-card inactive"} key={item.id}>
        <header><span><small>{item.category || "General"}</small><strong>{item.productName}</strong>{item.genericName && <em>{item.genericName}</em>}</span>{role === "admin" && <button onClick={() => edit(item)}><Edit3 />ပြင်ရန်</button>}</header>
        <div className="knowledge-section benefit"><b><Lightbulb />Key Benefits</b><p>{item.keyBenefits}</p></div>
        {item.talkingPoints && <div className="knowledge-section talk"><b><Users />Customer Talking Points</b><p>{item.talkingPoints}</p></div>}
        {(item.usageNote || item.caution) && <div className="knowledge-notes">{item.usageNote && <p><b>Note</b>{item.usageNote}</p>}{item.caution && <p className="caution"><b>Caution</b>{item.caution}</p>}</div>}
        <footer><span>{item.tags || "No tags"}</span><small>{item.active ? "Active" : "Inactive"} • {item.updatedBy || "Admin"} • {relativeUpdate(item.updatedAt)}</small></footer>
      </article>)}</div>}
    {filtered.length > pageSize && <div className="module-pagination knowledge-pagination"><span>Page {effectivePage} / {pageCount} • A–Z • {filtered.length} Products</span><div>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} className={effectivePage === number ? "active" : ""} onClick={() => setPage(number)} aria-label={`Page ${number}`}>{number}</button>)}</div></div>}
  </div>;
}

function ReportingPanel({ reports, role, userName, loading, setReports, notify }: {
  reports: EmployeeReport[]; role: AppRole; userName: string; loading: boolean;
  setReports: React.Dispatch<React.SetStateAction<EmployeeReport[]>>; notify: (message: string) => void;
}) {
  const empty = { id: 0, reportDate: todayLocal(), reportType: "daily" as EmployeeReport["reportType"], title: "", completedWork: "", challenges: "", nextPlan: "", supportNeeded: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const filtered = useMemo(() => reports.filter((report) => {
    const needle = query.trim().toLocaleLowerCase();
    const text = `${report.title} ${report.completedWork} ${report.submittedByName} ${report.challenges}`.toLocaleLowerCase();
    return (typeFilter === "all" || report.reportType === typeFilter) && (!needle || text.includes(needle));
  }), [query, reports, typeFilter]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/employee-reports", {
        method: form.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await readJson<{ report: EmployeeReport }>(response);
      setReports((current) => form.id ? current.map((item) => item.id === data.report.id ? data.report : item) : [data.report, ...current]);
      setForm(empty);
      notify(form.id ? "Report ပြင်ပြီးပါပြီ" : "Report တင်ပြီးပါပြီ");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Report သိမ်းမရပါ");
    } finally {
      setSaving(false);
    }
  }

  return <div className="module-panel">
    <div className="module-panel-head">
      <div><span className="module-panel-icon reporting"><FileText /></span><span><strong>Employee Reporting</strong><small>{role === "admin" ? "ဝန်ထမ်းအားလုံး၏ Report များ" : `${userName} ၏ Report မှတ်တမ်း`}</small></span></div>
      <span className="module-access-badge">All Employees</span>
    </div>

    <form className="module-form report-form" onSubmit={save}>
      <div className="module-form-title"><ClipboardCheck /><span><b>{form.id ? "Report ပြင်ရန်" : "Report တင်ရန်"}</b><small>လုပ်ပြီး၊ အခက်အခဲနှင့် နောက်လုပ်မည့်အလုပ်ကို ရှင်းလင်းစွာရေးပါ</small></span>{form.id > 0 && <button type="button" onClick={() => setForm(empty)}><X />Cancel Edit</button>}</div>
      <label><span>Report Date *</span><input type="date" required value={form.reportDate} onChange={(e) => setForm({ ...form, reportDate: e.target.value })} /></label>
      <label><span>Report Type *</span><select value={form.reportType} onChange={(e) => setForm({ ...form, reportType: e.target.value as EmployeeReport["reportType"] })}><option value="daily">Daily Report</option><option value="issue">Issue / Problem</option><option value="achievement">Achievement</option></select></label>
      <label className="wide"><span>Report Title *</span><input required placeholder="ဒီနေ့အဓိကလုပ်ဆောင်ချက်" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label className="wide"><span>Completed Work *</span><textarea required rows={4} placeholder="ပြီးစီးခဲ့သောအလုပ်များ" value={form.completedWork} onChange={(e) => setForm({ ...form, completedWork: e.target.value })} /></label>
      <label><span>Challenges / Problems</span><textarea rows={3} placeholder="ကြုံတွေ့ရသော အခက်အခဲ" value={form.challenges} onChange={(e) => setForm({ ...form, challenges: e.target.value })} /></label>
      <label><span>Next Plan</span><textarea rows={3} placeholder="နောက်တစ်နေ့/နောက်အဆင့် အစီအစဉ်" value={form.nextPlan} onChange={(e) => setForm({ ...form, nextPlan: e.target.value })} /></label>
      <label className="wide"><span>Support Needed</span><input placeholder="ဘယ်သူ့ဆီက ဘာအကူအညီလိုသလဲ" value={form.supportNeeded} onChange={(e) => setForm({ ...form, supportNeeded: e.target.value })} /></label>
      <button className="module-primary" disabled={saving}>{saving ? "သိမ်းနေသည်…" : form.id ? "Report ပြင်ပြီး သိမ်းမည်" : "Report တင်မည်"}</button>
    </form>

    <div className="module-toolbar">
      <label className="module-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Report / Employee ရှာရန်" /></label>
      <label><Filter /><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">All Types</option><option value="daily">Daily</option><option value="issue">Issue</option><option value="achievement">Achievement</option></select></label>
      <b>{filtered.length} Reports</b>
    </div>

    {loading ? <ModuleLoading /> : filtered.length === 0 ? <ModuleEmpty icon={<FileText />} title="Report မရှိသေးပါ" text="အပေါ်က Form မှာ ဒီနေ့ Report ကို စတင်တင်နိုင်ပါသည်။" /> :
      <div className="report-list">{filtered.map((report) => <article className={`report-card ${report.reportType}`} key={report.id}>
        <header><span className="report-type">{report.reportType === "daily" ? "Daily" : report.reportType === "issue" ? "Issue" : "Achievement"}</span><span><strong>{report.title}</strong><small>{report.submittedByName} • {report.submittedByRole} • {displayDate(report.reportDate)}</small></span><button onClick={() => setForm({ id: report.id, reportDate: report.reportDate, reportType: report.reportType, title: report.title, completedWork: report.completedWork, challenges: report.challenges, nextPlan: report.nextPlan, supportNeeded: report.supportNeeded })}><Edit3 />ပြင်ရန်</button></header>
        <div className="report-content"><p><b>Completed Work</b>{report.completedWork}</p>{report.challenges && <p className="challenge"><b>Challenges</b>{report.challenges}</p>}{report.nextPlan && <p><b>Next Plan</b>{report.nextPlan}</p>}{report.supportNeeded && <p className="support"><b>Support Needed</b>{report.supportNeeded}</p>}</div>
      </article>)}</div>}
  </div>;
}

function SalesGrowthPanel({ insights, followUps, reconciliationSummary, qualityReport, loading, reload, notify, role, userName, onCreateSaleOrder }: {
  insights: SalesInsight[]; followUps: SalesFollowUp[]; loading: boolean; reload: () => Promise<void>; notify: (message: string) => void;
  reconciliationSummary: ReconciliationSummary[]; qualityReport: SalesGrowthQuality | null;
  role: AppRole; userName: string; onCreateSaleOrder: (prefill: SalesOrderPrefill) => void;
}) {
  const emptyCall = { customerKey: "", callDate: todayLocal(), callTime: "", callPurpose: "customer_follow_up", callResult: "planned", status: "planned", nextFollowUpDate: "", paymentFollowUp: "", customerRequest: "", note: "", expectedAmount: "", orderExpected: false };
  const emptyRoute = { planDate: todayLocal(), routeName: "", township: "", salesperson: role === "admin" ? "Admin" : userName, plannedStartTime: "09:00", remark: "", isTemplate: false };
  const emptyVisit = { status: "completed", visitPurpose: "collect_order", visitResult: "", noOrderReason: "", orderReceived: false, estimatedOrderAmount: "", paymentCollected: false, collectedAmount: "", customerRequest: "", nextFollowUpDate: "", nextVisitDate: "", remark: "" };
  const [view, setView] = useState<"follow_up" | "route">("follow_up");
  const [callForm, setCallForm] = useState(emptyCall);
  const [routeForm, setRouteForm] = useState(emptyRoute);
  const [visitForm, setVisitForm] = useState(emptyVisit);
  const [saving, setSaving] = useState(false);
  const [routeLoading, setRouteLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [salesperson, setSalesperson] = useState("All");
  const [teamFilter, setTeamFilter] = useState<"All" | "A" | "B">("All");
  const [routeFilter, setRouteFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [routePlans, setRoutePlans] = useState<RoutePlan[]>([]);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [activePlanId, setActivePlanId] = useState(0);
  const [activeStopId, setActiveStopId] = useState(0);
  const [routeView, setRouteView] = useState<"list" | "map">("list");
  const selectedInsight = insights.find((item) => item.customerKey === callForm.customerKey);
  const activePlan = routePlans.find((item) => item.id === activePlanId) || null;
  const activeStops = routeStops.filter((item) => item.routePlanId === activePlanId).sort((a, b) => a.sequence - b.sequence);
  const activeStop = routeStops.find((item) => item.id === activeStopId) || null;
  const salespeople = useMemo(() => ["All", ...new Set(["Zaw Tun Kyaw", "Zin Mg Mg Lin", "Myo Min", "Htin Lin Kyaw Swar", "Aung Kyaw Zaw", "Admin", ...insights.map((item) => item.salesperson).filter(Boolean)])], [insights]);
  const routes = useMemo(() => ["All", ...new Set(insights.map((item) => item.route).filter(Boolean))], [insights]);

  const loadRoutes = useCallback(async () => {
    setRouteLoading(true);
    try {
      const response = await fetch("/api/sales-routes", { cache: "no-store" });
      const data = await readJson<{ plans: RoutePlan[]; stops: RouteStop[] }>(response);
      setRoutePlans(data.plans || []);
      setRouteStops(data.stops || []);
      setActivePlanId((current) => current || data.plans?.[0]?.id || 0);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sale Route Data ရယူမရပါ");
    } finally { setRouteLoading(false); }
  }, [notify]);

  useEffect(() => { void loadRoutes(); }, [loadRoutes]);

  const teamInsights = useMemo(() => insights.filter((item) => teamFilter === "All" || item.saleTeam === teamFilter), [insights, teamFilter]);
  const followUpCandidates = useMemo(() => teamInsights.filter((item) => item.recommendation === "follow_up"), [teamInsights]);
  const routeCandidates = useMemo(() => teamInsights.filter((item) => item.recommendation === "route_call"), [teamInsights]);
  const teamSummary = useMemo(() => ({
    sale7: teamInsights.reduce((sum, item) => sum + item.voucher7, 0),
    outstanding: teamInsights.reduce((sum, item) => sum + Math.max(0, item.outstandingAmount), 0),
    followUps: followUpCandidates.length,
    routes: routeCandidates.length,
  }), [followUpCandidates, routeCandidates, teamInsights]);
  const filtered = useMemo(() => followUpCandidates.filter((item) => {
    const needle = query.trim().toLocaleLowerCase();
    return (salesperson === "All" || item.salesperson === salesperson) && (routeFilter === "All" || item.route === routeFilter)
      && (!needle || `${item.customerName} ${item.township} ${item.salesperson} ${item.route} ${item.phone}`.toLocaleLowerCase().includes(needle));
  }).sort((a, b) => a.customerName.localeCompare(b.customerName, undefined, { sensitivity: "base" })), [followUpCandidates, query, routeFilter, salesperson]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const effectivePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((effectivePage - 1) * pageSize, effectivePage * pageSize);
  const today = todayLocal();
  const openCalls = followUps.filter((item) => !["completed", "order_created"].includes(item.status));
  const dueToday = openCalls.filter((item) => item.nextFollowUpDate === today).length;
  const overdue = openCalls.filter((item) => item.nextFollowUpDate && item.nextFollowUpDate < today).length;
  const todayPlans = routePlans.filter((item) => item.planDate === today && item.status !== "cancelled");
  const completedInteractions = followUps.filter((item) => item.status === "completed" || item.status === "order_created").length + routeStops.filter((item) => !["pending", "arrived", "not_visited"].includes(item.status)).length;
  const orderCustomers = followUps.filter((item) => item.confirmedOrderId).length + routeStops.filter((item) => item.confirmedOrderId).length;
  const confirmedSales = followUps.reduce((sum, item) => sum + (item.confirmedOrderAmount || 0), 0) + routeStops.reduce((sum, item) => sum + (item.confirmedOrderAmount || 0), 0);

  async function saveCall(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch("/api/sales-growth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(callForm) });
      const data = await readJson<{ followUp: SalesFollowUp }>(response);
      const customer = insights.find((item) => item.customerKey === callForm.customerKey);
      if (callForm.callResult === "order_received" && customer) onCreateSaleOrder({ customerName: customer.customerName, township: customer.township, salesperson: customer.salesperson, route: customer.route, orderAmount: callForm.expectedAmount, sourceType: "follow_up", sourceId: data.followUp.id });
      setCallForm(emptyCall); await reload(); notify("Follow Up Call မှတ်တမ်း သိမ်းပြီးပါပြီ");
    } catch (error) { notify(error instanceof Error ? error.message : "Follow Up Call သိမ်းမရပါ"); }
    finally { setSaving(false); }
  }

  async function createRoute(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch("/api/sales-routes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create_plan", ...routeForm, customerKeys: selectedKeys }) });
      const data = await readJson<{ plan: RoutePlan }>(response);
      setRouteForm(emptyRoute); setSelectedKeys([]); await loadRoutes(); setActivePlanId(data.plan.id); notify("Sale Route Plan ဖန်တီးပြီးပါပြီ");
    } catch (error) { notify(error instanceof Error ? error.message : "Route Plan သိမ်းမရပါ"); }
    finally { setSaving(false); }
  }

  async function patchRoute(payload: Record<string, unknown>, success: string) {
    const response = await fetch("/api/sales-routes", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    await readJson(response); await loadRoutes(); notify(success);
  }

  async function reuseRoute(plan: RoutePlan) {
    setSaving(true);
    try {
      const response = await fetch("/api/sales-routes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "copy_plan", sourceId: plan.id, planDate: today, salesperson: role === "admin" ? plan.salesperson : userName }) });
      const data = await readJson<{ plan: RoutePlan }>(response); await loadRoutes(); setActivePlanId(data.plan.id); notify("Route ကို ယနေ့အတွက် ပြန်အသုံးပြုပြီးပါပြီ");
    } catch (error) { notify(error instanceof Error ? error.message : "Route ပြန်အသုံးမပြုနိုင်ပါ"); }
    finally { setSaving(false); }
  }

  async function gps() {
    return new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 }));
  }

  async function checkIn(stop: RouteStop, reason = "") {
    try {
      const position = await gps();
      const response = await fetch("/api/sales-routes", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "check_in", id: stop.id, latitude: position.coords.latitude, longitude: position.coords.longitude, reason }) });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        if (!reason && data.error?.includes("Manual Check-in Reason")) {
          const manualReason = window.prompt(`${data.error}\n\nReason ရေးပါ`);
          if (manualReason) return checkIn(stop, manualReason);
        }
        throw new Error(data.error || "Check-in မအောင်မြင်ပါ");
      }
      await loadRoutes(); setActiveStopId(stop.id); notify("Location Check-in ပြီးပါပြီ");
    } catch (error) { notify(error instanceof GeolocationPositionError ? "GPS Location Permission ဖွင့်ပေးပါ" : error instanceof Error ? error.message : "Check-in မအောင်မြင်ပါ"); }
  }

  async function saveLocation(stop: RouteStop) {
    try {
      const position = await gps();
      const landmark = window.prompt("ဆိုင်အနီး Landmark ရေးပါ", stop.location?.landmark || "") ?? "";
      const directionsNote = window.prompt("လမ်းညွှန်မှတ်ချက် ရေးပါ", stop.location?.directionsNote || "") ?? "";
      const response = await fetch("/api/sales-routes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_location", customerKey: stop.customerKey, latitude: position.coords.latitude, longitude: position.coords.longitude, landmark, directionsNote, verified: role === "admin" }) });
      await readJson(response); await loadRoutes(); notify(role === "admin" ? "Customer Location Verified လုပ်ပြီးပါပြီ" : "Customer Location သိမ်းပြီးပါပြီ — Admin Verify လုပ်ရန်လိုပါသည်");
    } catch (error) { notify(error instanceof GeolocationPositionError ? "GPS Location Permission ဖွင့်ပေးပါ" : error instanceof Error ? error.message : "Location မသိမ်းနိုင်ပါ"); }
  }

  async function verifyLocation(stop: RouteStop) {
    try {
      await patchRoute({ action: "verify_location", customerKey: stop.customerKey }, "Customer Location Verified လုပ်ပြီးပါပြီ");
    } catch (error) { notify(error instanceof Error ? error.message : "Location Verify မလုပ်နိုင်ပါ"); }
  }

  async function saveVisit(event: FormEvent) {
    event.preventDefault(); if (!activeStop) return; setSaving(true);
    try {
      await patchRoute({ action: "visit_result", id: activeStop.id, ...visitForm }, "Visit Result သိမ်းပြီးပါပြီ");
      if (visitForm.orderReceived) onCreateSaleOrder({ customerName: activeStop.customerName, township: activeStop.township, salesperson: activeStop.salesperson, route: activeStop.route, orderAmount: visitForm.estimatedOrderAmount, sourceType: "route_stop", sourceId: activeStop.id });
      setVisitForm(emptyVisit); setActiveStopId(0);
    } catch (error) { notify(error instanceof Error ? error.message : "Visit Result မသိမ်းနိုင်ပါ"); }
    finally { setSaving(false); }
  }

  function routeMapUrl(stops: RouteStop[]) {
    const places = stops.map((stop) => stop.location ? `${stop.location.latitude},${stop.location.longitude}` : `${stop.customerName}, ${stop.township}`).filter(Boolean);
    if (!places.length) return "https://www.google.com/maps";
    const destination = places[places.length - 1];
    const waypoints = places.slice(0, -1).join("|");
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}`;
  }

  function downloadReport() {
    const rows = view === "follow_up"
      ? [["Date", "Customer", "Township", "Salesman", "Purpose", "Result", "Next Follow-up", "Confirmed Sale"], ...followUps.map((item) => [item.callDate, item.customerName, item.township, item.salesperson, item.callPurpose, item.callResult, item.nextFollowUpDate, item.confirmedOrderAmount || 0])]
      : [["Plan Date", "Route", "Sequence", "Customer", "Salesman", "Status", "Check-in", "Confirmed Sale"], ...routeStops.map((stop) => [routePlans.find((plan) => plan.id === stop.routePlanId)?.planDate || "", stop.route, stop.sequence, stop.customerName, stop.salesperson, stop.status, stop.checkInVerified ? "Verified" : stop.checkInAt ? "Unverified" : "", stop.confirmedOrderAmount || 0])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })); link.download = `Sales_Growth_${view}_${today}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <div className="module-panel sales-growth-v2">
    <div className="module-panel-head">
      <div><span className="module-panel-icon growth"><TrendingUp /></span><span><strong>Sales Growth</strong><small>Follow Up Call • Sale Route Call • Sales Performance</small></span></div>
      <span className="module-access-badge restricted"><LockKeyhole />Admin & Sales</span>
    </div>

    <section className="sale-team-overview">
      <div className="sale-team-filter"><span><Users />Sale Team</span><button className={teamFilter === "All" ? "active" : ""} onClick={() => { setTeamFilter("All"); setSelectedKeys([]); setPage(1); }}>All <b>{insights.length}</b></button><button className={teamFilter === "A" ? "active" : ""} onClick={() => { setTeamFilter("A"); setSelectedKeys([]); setPage(1); }}>Team A <b>{insights.filter((item) => item.saleTeam === "A").length}</b></button><button className={teamFilter === "B" ? "active" : ""} onClick={() => { setTeamFilter("B"); setSelectedKeys([]); setPage(1); }}>Team B <b>{insights.filter((item) => item.saleTeam === "B").length}</b></button></div>
      <div className="sale-team-metrics"><article><span>Last 7 Days Sale VR</span><strong>{money(teamSummary.sale7)}</strong><small>MMK</small></article><article className="outstanding"><span>Total Outstanding</span><strong>{money(teamSummary.outstanding)}</strong><small>MMK</small></article><article><span>Follow Up Call</span><strong>{teamSummary.followUps}</strong><small>Non-HTY • No Sale VR 7 Days</small></article><article><span>Route Sale Call</span><strong>{teamSummary.routes}</strong><small>HTY • No Sale VR 7 Days</small></article></div>
      <p><RefreshCw />နေ့စဉ် မနက် 10:00 AM စည်းမျဉ်း — နောက်ဆုံး 7 ရက် Sale VR မရှိသော Customer များကို အလိုအလျောက်ခွဲပြမည်</p>
    </section>

    {role === "admin" && <details className="sales-growth-quality"><summary><span><ClipboardCheck />Reconciliation & Data Quality</span><b>{(qualityReport?.keyMismatches.length || 0) + (qualityReport?.unmatchedOrders.length || 0)} Issues</b></summary><div className="reconciliation-grid">{reconciliationSummary.map((row) => <article key={row.team}><strong>Team {row.team}</strong><span>Active Customers <b>{row.totalActiveCustomers}</b></span><span>Sale VR ရှိ၍ ဖယ်ရှား <b>{row.saleVrExcluded}</b></span><span>Follow Up <b>{row.followUpCustomers}</b></span><span>Route Sale <b>{row.routeSaleCustomers}</b></span></article>)}</div><div className="quality-counts"><span>Key Mismatch <b>{qualityReport?.keyMismatches.length || 0}</b></span><span>Unmatched Orders <b>{qualityReport?.unmatchedOrders.length || 0}</b></span><span>Duplicate Customers <b>{qualityReport?.duplicateCustomers.length || 0}</b></span><span>Sale VR List Leak <b>{qualityReport?.saleVrCandidateLeaks.length || 0}</b></span></div>{qualityReport?.unmatchedOrders.length ? <div className="quality-rows">{qualityReport.unmatchedOrders.slice(0, 20).map((item) => <p key={`${item.orderNo}-${item.orderKey}`}><strong>{item.customerName}</strong><span>{item.township} • {item.orderNo}</span><code>{item.orderKey}</code></p>)}</div> : <small className="quality-ok">Customer Master နှင့် မချိတ်နိုင်သော Order မရှိပါ။</small>}</details>}

    <div className="growth-kpis v2">
      <div><span><PhoneCall /></span><small>Follow-up Due</small><strong>{dueToday}</strong></div>
      <div className={overdue ? "danger" : ""}><span><CalendarDays /></span><small>Overdue</small><strong>{overdue}</strong></div>
      <div><span><Route /></span><small>Today&apos;s Route</small><strong>{todayPlans.length}</strong></div>
      <div><span><CheckCircle2 /></span><small>Completed</small><strong>{completedInteractions}</strong></div>
      <div><span><Target /></span><small>Order Customers</small><strong>{orderCustomers}</strong></div>
      <div><span><BadgeDollarSign /></span><small>Confirmed Sales</small><strong>{money(confirmedSales)}</strong></div>
    </div>

    <div className="sales-growth-tabs">
      <button className={view === "follow_up" ? "active" : ""} onClick={() => setView("follow_up")}><PhoneCall />Follow Up Call</button>
      <button className={view === "route" ? "active" : ""} onClick={() => setView("route")}><MapPinned />Sale Route Call</button>
      <span><button onClick={downloadReport}><FileText />Excel</button><button onClick={() => window.print()}><BarChart3 />PDF / Print</button></span>
    </div>

    {view === "follow_up" && <>
      <form className="module-form growth-form" onSubmit={saveCall}>
        <div className="module-form-title"><PhoneCall /><span><b>Follow Up Call မှတ်တမ်း</b><small>နယ် Customer များကို ဖုန်းဆက်ခြင်း၊ Order နှင့် ငွေကောက်ရန် Follow-up</small></span></div>
        <label className="wide"><span>Customer *</span><select required value={callForm.customerKey} onChange={(e) => setCallForm({ ...callForm, customerKey: e.target.value })}><option value="">Customer ရွေးပါ</option>{insights.map((item) => <option value={item.customerKey} key={item.customerKey}>{item.customerName} — {item.township} — {item.salesperson}</option>)}</select></label>
        <label><span>Call Date *</span><input type="date" required value={callForm.callDate} onChange={(e) => setCallForm({ ...callForm, callDate: e.target.value })} /></label>
        <label><span>Call Time</span><input type="time" value={callForm.callTime} onChange={(e) => setCallForm({ ...callForm, callTime: e.target.value })} /></label>
        <label><span>Call Purpose *</span><select value={callForm.callPurpose} onChange={(e) => setCallForm({ ...callForm, callPurpose: e.target.value })}><option value="collect_order">Order ကောက်ရန်</option><option value="customer_follow_up">Customer Follow-up</option><option value="collect_payment">ငွေကောက်ရန်</option><option value="product_information">Price/Product Information</option><option value="complaint_follow_up">Complaint Follow-up</option><option value="new_customer">New Customer Follow-up</option><option value="other">အခြား</option></select></label>
        <label><span>Call Result *</span><select value={callForm.callResult} onChange={(e) => setCallForm({ ...callForm, callResult: e.target.value, status: e.target.value === "planned" ? "planned" : e.target.value === "no_answer" ? "no_answer" : "completed", orderExpected: e.target.value === "order_received" })}><option value="planned">ဆက်ရန်စီစဉ်ထား</option><option value="order_received">Order ရ</option><option value="order_later">နောက်မှ Order တင်မည်</option><option value="stock_available">Stock ရှိနေသေး</option><option value="price_not_match">ဈေးနှုန်းမကိုက်</option><option value="competitor">Competitor ဆီမှဝယ်ထား</option><option value="no_answer">ဖုန်းမကိုင်</option><option value="phone_off">ဖုန်းပိတ်ထား</option><option value="unreachable">ဆက်သွယ်မရ</option><option value="follow_up_required">Follow-up ပြန်လုပ်ရန်</option><option value="payment_promised">ငွေပေးမည်ဟု အကြောင်းပြန်</option><option value="not_buying">မဝယ်တော့</option><option value="other">အခြား</option></select></label>
        <label><span>Next Follow-up Date</span><input type="date" required={["order_later", "follow_up_required"].includes(callForm.callResult)} value={callForm.nextFollowUpDate} onChange={(e) => setCallForm({ ...callForm, nextFollowUpDate: e.target.value })} /></label>
        <label><span>Expected Order Amount</span><input type="number" inputMode="numeric" min="0" value={callForm.expectedAmount} onChange={(e) => setCallForm({ ...callForm, expectedAmount: e.target.value })} /></label>
        <label><span>Payment Follow-up</span><input value={callForm.paymentFollowUp} onChange={(e) => setCallForm({ ...callForm, paymentFollowUp: e.target.value })} /></label>
        <label><span>Customer Request</span><input value={callForm.customerRequest} onChange={(e) => setCallForm({ ...callForm, customerRequest: e.target.value })} /></label>
        <label className="wide"><span>Remark</span><textarea rows={3} value={callForm.note} onChange={(e) => setCallForm({ ...callForm, note: e.target.value })} /></label>
        {selectedInsight && <div className="growth-customer-context"><span><b>Phone</b>{selectedInsight.phone || "မရှိသေး"}</span><span><b>Last Order</b>{displayDate(selectedInsight.lastOrderDate)}</span><span><b>90 Days Sale</b>{money(selectedInsight.voucher90)}</span><span><b>Outstanding</b>{money(selectedInsight.outstandingAmount)}</span><span><b>Last Payment</b>{displayDate(selectedInsight.lastPaymentDate)}</span><span><b>Assigned</b>{selectedInsight.salesperson}</span></div>}
        <button className="module-primary" disabled={saving || !callForm.customerKey}>{saving ? "သိမ်းနေသည်…" : callForm.callResult === "order_received" ? "သိမ်းပြီး Sale Order တင်မည်" : "Follow Up Call သိမ်းမည်"}</button>
      </form>

      <div className="module-toolbar"><label className="module-search"><Search /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Customer / Township / Phone ရှာရန်" /></label><label><Filter /><select value={salesperson} onChange={(e) => { setSalesperson(e.target.value); setPage(1); }}>{salespeople.map((item) => <option key={item}>{item}</option>)}</select></label><label><Route /><select value={routeFilter} onChange={(e) => { setRouteFilter(e.target.value); setPage(1); }}>{routes.map((item) => <option key={item}>{item}</option>)}</select></label><span className="knowledge-sort">A–Z</span><b>{filtered.length} Customers</b></div>
      {loading ? <ModuleLoading /> : pageItems.length === 0 ? <ModuleEmpty icon={<PhoneCall />} title="Follow Up Customer မရှိပါ" text="ရွေးထားသော Team အတွက် နယ် Customer 7 ရက် Sale VR မရှိစာရင်း မရှိပါ။" /> : <div className="growth-insight-list">{pageItems.map((item) => <article className="growth-insight-card call-card" key={item.customerKey}>
        <header><span><strong>{item.customerName}</strong><small>Team {item.saleTeam} • {item.township} • {item.salesperson}</small></span>{item.phone ? <a href={`tel:${item.phone}`}><Phone />Call</a> : <span className="growth-suggestion follow_up">Phone မရှိ</span>}</header>
        <div><span><small>Last Sale VR</small><b>{displayDate(item.lastSaleVrDate)}</b></span><span><small>Inactive</small><b>{item.inactiveDays >= 9999 ? "No Order" : `${item.inactiveDays} days`}</b></span><span><small>7 Days Sale VR</small><b>{money(item.voucher7)}</b></span><span><small>Reason</small><b>{item.inclusionReason}</b></span></div>
        <footer className={item.latestFollowUp ? "" : "empty"}><button onClick={() => { setCallForm({ ...emptyCall, customerKey: item.customerKey }); window.scrollTo({ top: 0, behavior: "smooth" }); }}><CirclePlus />Follow-up မှတ်တမ်းထည့်ရန်</button><span><b>{item.latestFollowUp ? item.latestFollowUp.callResult || item.latestFollowUp.status : "မှတ်တမ်းမရှိသေး"}</b><small>{item.latestFollowUp?.nextFollowUpDate ? `Next ${displayDate(item.latestFollowUp.nextFollowUpDate)}` : "Follow-up စတင်နိုင်ပါသည်"}</small></span></footer>
      </article>)}</div>}
      {filtered.length > pageSize && <div className="module-pagination"><span>Page {effectivePage} / {pageCount} • {filtered.length} Customers</span><div><button disabled={effectivePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0, effectivePage - 3), effectivePage + 2).map((number) => <button className={number === effectivePage ? "active" : ""} key={number} onClick={() => setPage(number)}>{number}</button>)}<button disabled={effectivePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight /></button></div></div>}
      <section className="opportunity-pipeline"><div className="subsection-title"><PhoneCall /><span><strong>Follow Up Call History</strong><small>နောက်ဆုံး Call မှတ်တမ်းများ</small></span><b>{followUps.length}</b></div>{followUps.length === 0 ? <p className="pipeline-empty">Follow-up မှတ်တမ်းမရှိသေးပါ</p> : <div className="followup-history">{followUps.slice(0, 50).map((item) => <article key={item.id}><span className={`call-result ${item.callResult}`}>{item.callResult.replaceAll("_", " ")}</span><span><strong>{item.customerName}</strong><small>{displayDate(item.callDate)} {item.callTime} • {item.salesperson} • Next {displayDate(item.nextFollowUpDate)}</small><em>{item.customerRequest || item.note || "မှတ်ချက်မရှိ"}</em></span><b>{item.confirmedOrderId ? `${money(item.confirmedOrderAmount || 0)} MMK` : `${money(item.expectedAmount)} Est.`}</b>{item.callResult === "order_received" && !item.confirmedOrderId && <button onClick={() => { const customer = insights.find((entry) => entry.customerKey === item.customerKey); if (customer) onCreateSaleOrder({ customerName: customer.customerName, township: customer.township, salesperson: customer.salesperson, route: customer.route, orderAmount: String(item.expectedAmount || ""), sourceType: "follow_up", sourceId: item.id }); }}>Create Sale Order</button>}</article>)}</div>}</section>
    </>}

    {view === "route" && <>
      <form className="module-form route-plan-form" onSubmit={createRoute}>
        <div className="module-form-title"><MapPinned /><span><b>Sale Route Plan အသစ်</b><small>Customer အစဉ်နှင့် Google Maps Location ကို နောက် Salesman အတွက် ပြန်သုံးနိုင်ပါသည်</small></span></div>
        <label><span>Plan Date *</span><input type="date" required value={routeForm.planDate} onChange={(e) => setRouteForm({ ...routeForm, planDate: e.target.value })} /></label>
        <label><span>Route Name *</span><input required placeholder="ဥပမာ — Hlaing Thar Yar Route A" value={routeForm.routeName} onChange={(e) => setRouteForm({ ...routeForm, routeName: e.target.value })} /></label>
        <label><span>Township</span><input value={routeForm.township} onChange={(e) => setRouteForm({ ...routeForm, township: e.target.value })} /></label>
        <label><span>Salesman *</span><select disabled={role !== "admin"} value={routeForm.salesperson} onChange={(e) => setRouteForm({ ...routeForm, salesperson: e.target.value })}>{salespeople.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Planned Start Time</span><input type="time" value={routeForm.plannedStartTime} onChange={(e) => setRouteForm({ ...routeForm, plannedStartTime: e.target.value })} /></label>
        <label className="route-template-check"><input type="checkbox" checked={routeForm.isTemplate} onChange={(e) => setRouteForm({ ...routeForm, isTemplate: e.target.checked })} /><span>Save as Route Template</span></label>
        <label className="wide"><span>Remark</span><input value={routeForm.remark} onChange={(e) => setRouteForm({ ...routeForm, remark: e.target.value })} /></label>
        <div className="wide route-customer-picker"><span>အလိုအလျောက် Route Sale Call List * — Hlaing Thar Yar • 7 ရက် Sale VR မရှိ</span><div>{routeCandidates.filter((item) => !routeForm.township || item.township.toLocaleLowerCase().includes(routeForm.township.toLocaleLowerCase())).map((item) => <label key={item.customerKey} className={selectedKeys.includes(item.customerKey) ? "selected" : ""}><input type="checkbox" checked={selectedKeys.includes(item.customerKey)} onChange={(e) => setSelectedKeys((current) => e.target.checked ? [...current, item.customerKey] : current.filter((key) => key !== item.customerKey))} /><b>{selectedKeys.indexOf(item.customerKey) + 1 || ""}</b><span><strong>{item.customerName}</strong><small>Team {item.saleTeam} • {item.salesperson} • {item.township}</small><small>Last Sale VR: {displayDate(item.lastSaleVrDate)} • 7 Days: {money(item.voucher7)} • {item.inclusionReason}</small></span></label>)}</div></div>
        <button className="module-primary" disabled={saving || !routeForm.routeName || selectedKeys.length === 0}>{saving ? "သိမ်းနေသည်…" : `Route Plan သိမ်းမည် • ${selectedKeys.length} Customers`}</button>
      </form>

      <div className="route-workspace">
        <aside className="route-plan-list"><div className="subsection-title"><Route /><span><strong>Route Plans</strong><small>ယနေ့နှင့် ယခင် Route များ</small></span><b>{routePlans.length}</b></div>{routeLoading ? <ModuleLoading /> : routePlans.length === 0 ? <p className="pipeline-empty">Route Plan မရှိသေးပါ</p> : routePlans.map((plan) => <button className={activePlanId === plan.id ? "active" : ""} key={plan.id} onClick={() => setActivePlanId(plan.id)}><span><strong>{plan.routeName}</strong><small>{displayDate(plan.planDate)} • {plan.salesperson}</small></span><em>{plan.isTemplate ? "Template" : plan.status.replaceAll("_", " ")}</em></button>)}</aside>
        <section className="route-plan-detail">{!activePlan ? <ModuleEmpty icon={<MapPinned />} title="Route Plan ရွေးပါ" text="ဘယ်ဘက်မှ Route Plan တစ်ခုကို ရွေးပါ။" /> : <>
          <header><span><strong>{activePlan.routeName}</strong><small>{displayDate(activePlan.planDate)} • {activePlan.plannedStartTime || "အချိန်မသတ်မှတ်"} • {activePlan.salesperson} • {activeStops.length} Customers</small></span><div><button onClick={() => setRouteView("list")} className={routeView === "list" ? "active" : ""}><List />List</button><button onClick={() => setRouteView("map")} className={routeView === "map" ? "active" : ""}><Map />Map</button><a href={routeMapUrl(activeStops)} target="_blank" rel="noreferrer"><Navigation />Google Maps</a><button onClick={() => void reuseRoute(activePlan)}><RefreshCw />Reuse</button><button onClick={() => void patchRoute({ action: "plan_status", id: activePlan.id, status: "started" }, "Route စတင်ပြီးပါပြီ")}><Play />Start</button></div></header>
          {routeView === "map" && <div className="route-map-view">{activeStops.find((stop) => stop.location) ? <iframe title="Customer Map" loading="lazy" src={`https://www.google.com/maps?q=${activeStops.find((stop) => stop.location)?.location?.latitude},${activeStops.find((stop) => stop.location)?.location?.longitude}&output=embed`} /> : <ModuleEmpty icon={<MapPinned />} title="Map Pin မရှိသေးပါ" text="Customer ဆိုင်ရောက်လျှင် Save Location သို့ Check In လုပ်ပါ။" />}<ol>{activeStops.map((stop) => <li key={stop.id}><b>{stop.sequence}</b><span>{stop.customerName}<small>{stop.location ? `${stop.location.verified ? "Verified" : "Unverified"} • ${stop.location.landmark || stop.township}` : "Location မရှိသေး"}</small></span></li>)}</ol></div>}
          {routeView === "list" && <div className="route-stop-list">{activeStops.map((stop) => <article key={stop.id} className={stop.checkInVerified ? "verified" : stop.checkInAt ? "unverified" : ""}><b>{stop.sequence}</b><span><strong>{stop.customerName}</strong><small>{stop.township} • {stop.route} • {stop.status.replaceAll("_", " ")}</small>{stop.location && <em><MapPinCheck />{stop.location.verified ? "Verified Location" : "Location စစ်ဆေးရန်"} • {stop.location.landmark || "Landmark မရှိ"}</em>}{stop.checkInAt && <em><CheckCircle2 />{stop.checkInVerified ? "Verified Check-in" : "Unverified Check-in"} • {stop.checkInDistanceMeters} m</em>}</span><div>{stop.location && <a href={`https://www.google.com/maps/dir/?api=1&destination=${stop.location.latitude},${stop.location.longitude}`} target="_blank" rel="noreferrer"><Navigation />Navigate</a>}<button onClick={() => void (role === "admin" && stop.location ? verifyLocation(stop) : saveLocation(stop))}><MapPinned />{role === "admin" && stop.location ? "Verify Pin" : stop.location ? "Update Pin" : "Save Pin"}</button><button onClick={() => void checkIn(stop)}><MapPinCheck />Check In</button><button onClick={() => { setActiveStopId(stop.id); setVisitForm({ ...emptyVisit, status: stop.status === "pending" ? "completed" : stop.status, visitPurpose: stop.visitPurpose || "collect_order", visitResult: stop.visitResult || "" }); }}>Visit Result</button></div></article>)}</div>}
        </>}</section>
      </div>

      {activeStop && <form className="module-form visit-result-form" onSubmit={saveVisit}>
        <div className="module-form-title"><ClipboardCheck /><span><b>{activeStop.customerName} — Visit Result</b><small>{activeStop.checkInAt ? `Check-in ${relativeUpdate(activeStop.checkInAt)}` : "Check-in မလုပ်ရသေးပါ"}</small></span><button type="button" onClick={() => setActiveStopId(0)}><X />ပိတ်မည်</button></div>
        <label><span>Visit Purpose</span><select value={visitForm.visitPurpose} onChange={(e) => setVisitForm({ ...visitForm, visitPurpose: e.target.value })}><option value="collect_order">Order ကောက်ရန်</option><option value="collect_payment">ငွေကောက်ရန်</option><option value="customer_follow_up">Customer Follow-up</option><option value="product_information">Product/Price Information</option><option value="complaint">Complaint ဖြေရှင်းရန်</option><option value="new_customer">New Customer Visit</option><option value="other">အခြား</option></select></label>
        <label><span>Visit Result *</span><select required value={visitForm.visitResult} onChange={(e) => setVisitForm({ ...visitForm, visitResult: e.target.value, status: e.target.value || "completed", orderReceived: e.target.value === "order_received", paymentCollected: e.target.value === "payment_collected" })}><option value="">Result ရွေးပါ</option><option value="order_received">Order ရ</option><option value="no_order">Order မရ</option><option value="customer_unavailable">Customer မတွေ့</option><option value="shop_closed">ဆိုင်ပိတ်</option><option value="payment_collected">ငွေကောက်ပြီး</option><option value="follow_up">Follow-up လို</option><option value="skipped">Skip</option><option value="other">အခြား</option></select></label>
        {visitForm.visitResult === "no_order" && <label className="wide"><span>No Order Reason</span><select value={visitForm.noOrderReason} onChange={(e) => setVisitForm({ ...visitForm, noOrderReason: e.target.value })}><option value="">Reason ရွေးပါ</option><option value="Stock ရှိနေသေး">Stock ရှိနေသေး</option><option value="ဈေးနှုန်းမကိုက်">ဈေးနှုန်းမကိုက်</option><option value="Competitor ဆီမှဝယ်ထား">Competitor ဆီမှဝယ်ထား</option><option value="ငွေကြေးအခက်အခဲ">ငွေကြေးအခက်အခဲ</option><option value="လိုချင်သော Product မရှိ">လိုချင်သော Product မရှိ</option><option value="ဆုံးဖြတ်သူမရှိ">ဆုံးဖြတ်သူမရှိ</option><option value="အခြား">အခြား</option></select></label>}
        <label><span>Estimated Order Amount</span><input type="number" min="0" value={visitForm.estimatedOrderAmount} onChange={(e) => setVisitForm({ ...visitForm, estimatedOrderAmount: e.target.value })} /></label>
        <label><span>Collected Amount</span><input type="number" min="0" value={visitForm.collectedAmount} onChange={(e) => setVisitForm({ ...visitForm, collectedAmount: e.target.value, paymentCollected: Number(e.target.value) > 0 })} /></label>
        <label><span>Next Follow-up Date</span><input type="date" value={visitForm.nextFollowUpDate} onChange={(e) => setVisitForm({ ...visitForm, nextFollowUpDate: e.target.value })} /></label>
        <label><span>Next Visit Date</span><input type="date" value={visitForm.nextVisitDate} onChange={(e) => setVisitForm({ ...visitForm, nextVisitDate: e.target.value })} /></label>
        <label className="wide"><span>Customer Request</span><textarea rows={2} value={visitForm.customerRequest} onChange={(e) => setVisitForm({ ...visitForm, customerRequest: e.target.value })} /></label>
        <label className="wide"><span>Remark</span><textarea rows={2} value={visitForm.remark} onChange={(e) => setVisitForm({ ...visitForm, remark: e.target.value })} /></label>
        <button className="module-primary" disabled={saving || !visitForm.visitResult}>{saving ? "သိမ်းနေသည်…" : visitForm.orderReceived ? "သိမ်းပြီး Sale Order တင်မည်" : "Visit Result သိမ်းမည်"}</button>
      </form>}
    </>}
  </div>;
}

function ModuleLoading() {
  return <div className="module-loading"><RefreshCw className="spin" /><span>Data ရယူနေသည်…</span></div>;
}

function ModuleEmpty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="module-empty"><span>{icon}</span><strong>{title}</strong><p>{text}</p></div>;
}
