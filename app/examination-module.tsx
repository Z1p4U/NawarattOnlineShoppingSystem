"use client";

import {
  Award, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, CircleX, Clock3, Crown,
  FileSpreadsheet, Flame, GraduationCap, History, Medal, Play, RefreshCw, ShieldCheck,
  Sparkles, Timer, Trophy, Upload, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type AppRole = "admin" | "sale" | "warehouse" | "purchase" | "delivery" | "finance" | "viewer";
type ExamLevel = "senior" | "junior";
type ExamSection = "price" | "supplier" | "inventory";
type Cycle = {
  id: string; cycleKey: string; title: string; status: string; opensAt: string; closesAt: string;
  priceCount: number; supplierCount: number; inventoryCount: number;
  priceFileName?: string; supplierFileName?: string; inventoryFileName?: string;
};
type Result = {
  id: string; cycleId: string; userEmail: string; userName: string; userRole: string; level: ExamLevel;
  attemptType: "official" | "practice"; status: string; startedAt: string; deadlineAt: string; submittedAt: string;
  priceScore: number; supplierScore: number; inventoryScore: number; totalScore: number; maxScore: number;
  percentage: number; timeUsedSeconds: number; passed: boolean; rank?: number;
};
type Question = {
  id: string; section: ExamSection; productKey: string; productName: string; prompt: string; detail: string;
  options: Array<{ id: string; label: string }>; correct?: string[];
};
type AttemptData = Result & { deadlineAt: string };
type DashboardData = {
  serverTime: string; cycle: Cycle | null; records: Result[]; activeAttempt: Result | null; officialCompleted: boolean;
  leaderboards: { senior: Result[]; junior: Result[] }; adminResults: Result[];
};

const sectionNames: Record<ExamSection, string> = { price: "Product Price Knowledge", supplier: "Supplier Knowledge", inventory: "Inventory Knowledge" };

function normalize(value: unknown) {
  return String(value ?? "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function money(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function parsePurchaseDate(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!match) return 0;
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  return Date.UTC(year, Number(match[2]) - 1, Number(match[1]));
}

async function workbookRows(file: File) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  return workbook.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: false, defval: "" }) }));
}

async function parsePriceFile(file: File) {
  const sheets = await workbookRows(file);
  const output = new Map<string, { productKey: string; productName: string; payload: Record<string, unknown> }>();
  for (const sheet of sheets) {
    const headerIndex = sheet.rows.findIndex((row) => row.some((cell) => normalize(cell) === "code") && row.some((cell) => normalize(cell) === "description") && row.some((cell) => normalize(cell).includes("pur price")));
    if (headerIndex < 0) continue;
    const headers = sheet.rows[headerIndex].map(normalize);
    const codeIndex = headers.findIndex((value) => value === "code");
    const nameIndex = headers.findIndex((value) => value === "description");
    const quantityIndex = headers.findIndex((value) => value === "qty");
    const unitIndex = headers.findIndex((value) => value === "unit");
    const purchaseIndex = headers.findIndex((value) => value.includes("pur price"));
    const sellingIndex = headers.findIndex((value) => value.includes("sale price"));
    for (const row of sheet.rows.slice(headerIndex + 1)) {
      const code = String(row[codeIndex] ?? "").trim();
      const productName = String(row[nameIndex] ?? "").replace(/\s+/g, " ").trim();
      const purchasePrice = money(row[purchaseIndex]);
      const sellingPrice = money(row[sellingIndex]);
      if (!code || !productName || purchasePrice <= 0 || sellingPrice <= 0) continue;
      const quantity = String(row[quantityIndex] ?? "").trim();
      const unit = String(row[unitIndex] ?? "").trim();
      const productKey = `${normalize(code)}|${normalize(quantity)}|${normalize(unit)}`;
      output.set(productKey, { productKey, productName, payload: { code, quantity, unit, purchasePrice, sellingPrice } });
    }
  }
  return [...output.values()];
}

async function parseSupplierFile(file: File) {
  const sheets = await workbookRows(file);
  const latest = new Map<string, { productKey: string; productName: string; payload: Record<string, unknown>; timestamp: number }>();
  for (const sheet of sheets) {
    let supplier = "";
    let code = "";
    let productName = "";
    for (const row of sheet.rows) {
      const first = String(row[0] ?? "").trim();
      const supplierMatch = first.match(/^supplier\s*:\s*(.+)$/i);
      if (supplierMatch) { supplier = supplierMatch[1].trim(); code = ""; productName = ""; continue; }
      if (String(row[0] ?? "").trim() && String(row[2] ?? "").trim()) {
        code = String(row[0]).trim();
        productName = String(row[2]).replace(/\s+/g, " ").trim();
      }
      const timestamp = parsePurchaseDate(row[7]);
      if (!supplier || !code || !productName || !timestamp) continue;
      const productKey = `${normalize(code)}|${normalize(productName)}`;
      const current = latest.get(productKey);
      if (!current || timestamp >= current.timestamp) latest.set(productKey, { productKey, productName, timestamp, payload: { code, supplier, purchaseDate: String(row[7] ?? "").trim() } });
    }
  }
  return [...latest.values()].map((entry) => ({ productKey: entry.productKey, productName: entry.productName, payload: entry.payload }));
}

function inventoryStatus(value: unknown) {
  const type = normalize(value);
  if (!type || type === "type" || type === "lot") return "";
  if (type.includes("slow")) return "low_sale";
  if (type.includes("over")) return "over_stock";
  if (type.includes("near") || type === "date" || type.includes("expired") || type === "exp" || type.includes("date နီး") || type.includes("date ကုန်")) return "near_expired";
  if (type.includes("none") || type.includes("normal") || type === "ok") return "none";
  return "";
}

async function parseInventoryFile(file: File) {
  const sheets = await workbookRows(file);
  const products = new Map<string, { productKey: string; productName: string; expiry: string; statuses: Set<string> }>();
  for (const sheet of sheets) for (const row of sheet.rows) {
    const productName = String(row[2] ?? "").replace(/\s+/g, " ").trim();
    const status = inventoryStatus(row[4]);
    if (!productName || normalize(productName) === "description" || !status) continue;
    const productKey = normalize(productName);
    const item = products.get(productKey) || { productKey, productName, expiry: String(row[3] ?? "").trim(), statuses: new Set<string>() };
    if (status !== "none") item.statuses.add(status);
    products.set(productKey, item);
  }
  return [...products.values()].map((item) => ({ productKey: item.productKey, productName: item.productName, payload: { expiry: item.expiry, statuses: [...item.statuses] } }));
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds);
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yangon", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

async function readResponse<T>(response: Response) {
  const data: unknown = await response.json().catch(() => ({ error: "Load Failed" }));
  if (!response.ok) throw new Error(typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "Load Failed");
  return data as T;
}

export default function ExaminationModule({ role, userName, notify }: { role: AppRole; userName: string; notify: (message: string) => void }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<ExamLevel>("junior");
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [resultQuestions, setResultQuestions] = useState<Question[]>([]);
  const [resultAnswers, setResultAnswers] = useState<Record<string, string[]>>({});
  const [remaining, setRemaining] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [uploadMonth, setUploadMonth] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yangon", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7));
  const submitLock = useRef(false);
  const answerSaveQueue = useRef<Promise<void>>(Promise.resolve());

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try { setDashboard(await readResponse<DashboardData>(await fetch("/api/exams", { cache: "no-store" }))); }
    catch (error) { notify(error instanceof Error ? error.message : "Examination data unavailable"); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => {
    // Loading the remote examination state is the external synchronization performed here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const update = () => {
      if (attempt) setRemaining(Math.max(0, Math.floor((new Date(attempt.deadlineAt).getTime() - Date.now()) / 1000)));
      else if (dashboard?.cycle) {
        const now = Date.now();
        const target = now < new Date(dashboard.cycle.opensAt).getTime() ? new Date(dashboard.cycle.opensAt).getTime() : new Date(dashboard.cycle.closesAt).getTime();
        setCountdown(Math.max(0, Math.floor((target - now) / 1000)));
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, dashboard?.cycle]);

  const submitAttempt = useCallback(async (reason = "finish") => {
    if (!attempt || submitLock.current) return;
    submitLock.current = true;
    setBusy("submit");
    try {
      await answerSaveQueue.current;
      const data = await readResponse<{ attempt: Result }>(await fetch("/api/exams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "submit", attemptId: attempt.id, reason }) }));
      setAttempt(null); setResult(data.attempt);
      const detail = await readResponse<{ attempt: Result; questions: Question[]; answers: Record<string, string[]> }>(await fetch(`/api/exams?action=result&id=${encodeURIComponent(data.attempt.id)}`, { cache: "no-store" }));
      setResult(detail.attempt); setResultQuestions(detail.questions); setResultAnswers(detail.answers); await loadDashboard();
    } catch (error) { notify(error instanceof Error ? error.message : "Exam submission failed"); }
    finally { setBusy(""); submitLock.current = false; }
  }, [attempt, loadDashboard, notify]);

  useEffect(() => {
    // Reaching the server-controlled deadline submits the attempt exactly once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (attempt && remaining === 0) void submitAttempt("timer");
  }, [attempt, remaining, submitAttempt]);

  useEffect(() => {
    if (!attempt || attempt.attemptType !== "official") return;
    const close = () => navigator.sendBeacon("/api/exams", new Blob([JSON.stringify({ action: "submit", attemptId: attempt.id, reason: "close" })], { type: "application/json" }));
    window.addEventListener("pagehide", close);
    return () => window.removeEventListener("pagehide", close);
  }, [attempt]);

  async function upload(section: ExamSection, file: File) {
    setBusy(`upload-${section}`);
    try {
      const rows = section === "price" ? await parsePriceFile(file) : section === "supplier" ? await parseSupplierFile(file) : await parseInventoryFile(file);
      const minimum = section === "price" ? 50 : section === "supplier" ? 25 : 30;
      if (rows.length < minimum) throw new Error(`${file.name}: only ${rows.length} valid products found; at least ${minimum} are required`);
      await readResponse(await fetch("/api/exams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "upload", cycleKey: uploadMonth, section, fileName: file.name, rows }) }));
      notify(`${sectionNames[section]}: ${rows.length} products uploaded`);
      await loadDashboard();
    } catch (error) { notify(error instanceof Error ? error.message : "Upload failed"); }
    finally { setBusy(""); }
  }

  async function publish() {
    if (!dashboard?.cycle || !window.confirm(`Publish ${dashboard.cycle.title} Examination? Uploaded files will be locked.`)) return;
    setBusy("publish");
    try {
      await readResponse(await fetch("/api/exams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish", cycleId: dashboard.cycle.id }) }));
      notify("Monthly Examination published"); await loadDashboard();
    } catch (error) { notify(error instanceof Error ? error.message : "Publish failed"); }
    finally { setBusy(""); }
  }

  async function loadAttempt(id: string) {
    const data = await readResponse<{ attempt: AttemptData; questions: Question[]; answers: Record<string, string[]> }>(await fetch(`/api/exams?action=attempt&id=${encodeURIComponent(id)}`, { cache: "no-store" }));
    setAttempt(data.attempt); setQuestions(data.questions); setAnswers(data.answers || {}); setResult(null);
  }

  async function start(attemptType: "official" | "practice") {
    setBusy(attemptType);
    try {
      const data = await readResponse<{ attemptId: string }>(await fetch("/api/exams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", level: selectedLevel, attemptType }) }));
      await loadAttempt(data.attemptId);
    } catch (error) { notify(error instanceof Error ? error.message : "Cannot start examination"); }
    finally { setBusy(""); }
  }

  async function saveAnswer(question: Question, selected: string[]) {
    if (!attempt) return;
    setAnswers((current) => ({ ...current, [question.id]: selected }));
    const save = answerSaveQueue.current.then(async () => {
      await readResponse(await fetch("/api/exams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "answer", attemptId: attempt.id, questionId: question.id, selected }) }));
    });
    answerSaveQueue.current = save.catch(() => undefined);
    try {
      await save;
    } catch (error) { notify(error instanceof Error ? error.message : "Answer was not saved"); await loadAttempt(attempt.id); }
  }

  async function openResult(record: Result) {
    setBusy(`result-${record.id}`);
    try {
      const detail = await readResponse<{ attempt: Result; questions: Question[]; answers: Record<string, string[]> }>(await fetch(`/api/exams?action=result&id=${encodeURIComponent(record.id)}`, { cache: "no-store" }));
      setResult(detail.attempt); setResultQuestions(detail.questions); setResultAnswers(detail.answers);
    } catch (error) { notify(error instanceof Error ? error.message : "Result unavailable"); }
    finally { setBusy(""); }
  }

  async function resetAttempt(record: Result) {
    const reason = window.prompt(`Reset official attempt for ${record.userName}. Enter reason:`)?.trim();
    if (!reason) return;
    try {
      await readResponse(await fetch("/api/exams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reset", attemptId: record.id, reason }) }));
      notify("Official attempt reset with Audit Log"); await loadDashboard();
    } catch (error) { notify(error instanceof Error ? error.message : "Reset failed"); }
  }

  if (loading && !dashboard) return <div className="exam-loading"><RefreshCw className="spin" />Loading Examination…</div>;
  if (attempt) return <ExamRunner attempt={attempt} questions={questions} answers={answers} remaining={remaining} busy={busy === "submit"} onAnswer={saveAnswer} onFinish={() => { if (window.confirm("Submit this examination now? You cannot continue or retake an official exam.")) void submitAttempt("finish"); }} onClose={() => { if (window.confirm("Closing will submit all saved answers immediately. You cannot retake the official exam. Continue?")) void submitAttempt("close"); }} />;
  if (result) return <ResultView result={result} questions={resultQuestions} answers={resultAnswers} onBack={() => setResult(null)} />;

  const cycle = dashboard?.cycle;
  const now = dashboard?.serverTime ? new Date(dashboard.serverTime).getTime() : 0;
  const officialOpen = Boolean(cycle && cycle.status === "published" && now >= new Date(cycle.opensAt).getTime() && now <= new Date(cycle.closesAt).getTime());
  const beforeOpen = Boolean(cycle && cycle.status === "published" && now < new Date(cycle.opensAt).getTime());

  return <div className="exam-home">
    <section className="exam-hero">
      <div className="exam-hero-orb one" /><div className="exam-hero-orb two" />
      <div className="exam-hero-copy"><span className="exam-kicker"><Sparkles size={14} /> NAWARATT KNOWLEDGE CHALLENGE</span><h1>Examination Center</h1><p>Welcome, {userName}. Price, Supplier and Inventory knowledge—one continuous candidate-specific exam.</p></div>
      <div className="exam-countdown"><Clock3 /><span>{beforeOpen ? "Official exam opens in" : officialOpen ? "Official exam closes in" : cycle?.status === "draft" ? "Admin preparation" : "Practice available"}</span><strong>{formatCountdown(countdown)}</strong><small>{cycle ? cycle.title : "No published cycle"}</small></div>
    </section>

    {role === "admin" && <AdminUpload cycle={cycle} month={uploadMonth} setMonth={setUploadMonth} busy={busy} upload={upload} publish={publish} />}

    <section className="exam-action-grid">
      <div className="exam-level-card"><div className="exam-card-title"><GraduationCap /><div><span>CHOOSE LEVEL</span><h2>Senior or Junior</h2></div></div><div className="exam-level-switch"><button className={selectedLevel === "senior" ? "active" : ""} onClick={() => setSelectedLevel("senior")}><Trophy />Senior<small>100 marks · 45 min</small></button><button className={selectedLevel === "junior" ? "active" : ""} onClick={() => setSelectedLevel("junior")}><Medal />Junior<small>60 marks · 30 min</small></button></div><div className="exam-start-actions"><button className="official" disabled={!officialOpen || dashboard?.officialCompleted || Boolean(busy)} onClick={() => void start("official")}><Play />{dashboard?.officialCompleted ? "Official Exam Completed" : dashboard?.activeAttempt ? "Resume Official Exam" : "Start Official Exam"}</button><button className="practice" disabled={!cycle || cycle.status !== "published" || Boolean(busy)} onClick={() => void start("practice")}><GraduationCap />Practice Anytime</button></div></div>
      <div className="exam-rules-card"><div className="exam-card-title"><ShieldCheck /><div><span>EXAM RULES</span><h2>Fair and secure</h2></div></div><ul><li>Every candidate receives a different randomized question set.</li><li>Closing or reaching zero automatically submits the official attempt.</li><li>Official exam can be taken only once; practice is unlimited.</li><li>Inventory questions allow multiple selections with exact-match scoring.</li></ul></div>
    </section>

    <Leaderboards boards={dashboard?.leaderboards || { senior: [], junior: [] }} />
    <Records title="My Examination Records" records={dashboard?.records || []} busy={busy} openResult={openResult} />
    {role === "admin" && <AdminResults records={dashboard?.adminResults || []} openResult={openResult} reset={resetAttempt} />}
  </div>;
}

function AdminUpload({ cycle, month, setMonth, busy, upload, publish }: { cycle: Cycle | null | undefined; month: string; setMonth: (value: string) => void; busy: string; upload: (section: ExamSection, file: File) => Promise<void>; publish: () => Promise<void> }) {
  const items: Array<{ section: ExamSection; count: number; file?: string }> = [
    { section: "price", count: cycle?.priceCount || 0, file: cycle?.priceFileName },
    { section: "supplier", count: cycle?.supplierCount || 0, file: cycle?.supplierFileName },
    { section: "inventory", count: cycle?.inventoryCount || 0, file: cycle?.inventoryFileName },
  ];
  const ready = (cycle?.priceCount || 0) >= 50 && (cycle?.supplierCount || 0) >= 25 && (cycle?.inventoryCount || 0) >= 30;
  return <section className="exam-admin-upload"><header><div><ShieldCheck /><span><small>ADMIN CONTROL</small><h2>Monthly Question Files</h2></span></div><label>Exam month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} disabled={cycle?.status === "published"} /></label></header><div className="exam-upload-grid">{items.map((item) => <label className={item.count ? "uploaded" : ""} key={item.section}><span>{item.count ? <CheckCircle2 /> : <FileSpreadsheet />}<b>{sectionNames[item.section]}</b><small>{item.file || "Choose the approved Excel workbook"}</small></span><em>{item.count.toLocaleString()} products</em><input type="file" accept=".xlsx,.xls,.csv" disabled={cycle?.status === "published" || busy === `upload-${item.section}`} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(item.section, file); event.currentTarget.value = ""; }} /><strong><Upload />{busy === `upload-${item.section}` ? "Importing…" : cycle?.status === "published" ? "Locked" : "Upload file"}</strong></label>)}</div><button className="exam-publish" disabled={!ready || cycle?.status === "published" || Boolean(busy)} onClick={() => void publish()}><Sparkles />{cycle?.status === "published" ? "Published and Locked" : "Publish Monthly Examination"}</button></section>;
}

function ExamRunner({ attempt, questions, answers, remaining, busy, onAnswer, onFinish, onClose }: { attempt: AttemptData; questions: Question[]; answers: Record<string, string[]>; remaining: number; busy: boolean; onAnswer: (question: Question, selected: string[]) => Promise<void>; onFinish: () => void; onClose: () => void }) {
  const sections: ExamSection[] = ["price", "supplier", "inventory"];
  const bySection = (section: ExamSection) => questions.filter((question) => question.section === section);
  const hasAnswer = (question: Question) => Boolean(answers[question.id]?.length && !answers[question.id].includes("__skip__"));
  const isSkipped = (question: Question) => answers[question.id]?.includes("__skip__") || false;
  const priceAnswered = bySection("price").filter(hasAnswer).length;
  const supplierAnswered = bySection("supplier").filter(hasAnswer).length;
  const supplierSkipped = bySection("supplier").filter(isSkipped).length;
  const inventoryAnswered = bySection("inventory").filter(hasAnswer).length;
  const resolved = priceAnswered + supplierAnswered + supplierSkipped + inventoryAnswered;
  const complete = priceAnswered === bySection("price").length && supplierAnswered === 20 && supplierSkipped === 5 && inventoryAnswered === bySection("inventory").length;

  if (!questions.length) return <div className="exam-loading">Question set unavailable</div>;

  function choose(question: Question, id: string) {
    const selected = answers[question.id] || [];
    if (question.section !== "inventory") {
      if (question.section === "supplier" && !hasAnswer(question) && supplierAnswered >= 20) return;
      void onAnswer(question, [id]);
      return;
    }
    const next = id === "none" ? (selected.includes("none") ? [] : ["none"]) : selected.includes(id) ? selected.filter((item) => item !== id) : [...selected.filter((item) => item !== "none" && item !== "__skip__"), id];
    void onAnswer(question, next);
  }

  function toggleSkip(question: Question) {
    if (isSkipped(question)) void onAnswer(question, []);
    else if (supplierSkipped < 5) void onAnswer(question, ["__skip__"]);
  }

  return <div className="exam-runner">
    <header className="exam-runner-head"><button onClick={onClose}><X />Exit Exam</button><div><span>{attempt.attemptType === "official" ? "OFFICIAL EXAM" : "PRACTICE EXAM"}</span><strong>{attempt.level.toUpperCase()} · ALL QUESTIONS</strong></div><div className={remaining < 300 ? "exam-timer danger" : "exam-timer"}><Timer /><strong>{formatTime(remaining)}</strong><small>remaining</small></div></header>
    <div className="exam-progress"><span style={{ width: `${Math.round((resolved / questions.length) * 100)}%` }} /></div>
    <nav className="exam-section-nav">{sections.map((section) => { const sectionQuestions = bySection(section); const done = section === "supplier" ? supplierAnswered + supplierSkipped : sectionQuestions.filter(hasAnswer).length; return <button key={section} onClick={() => document.getElementById(`exam-section-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}><b>{sectionNames[section]}</b><small>{done}/{sectionQuestions.length}</small></button>; })}</nav>
    <main className="exam-all-questions">
      <section className="exam-completion-card"><div><span>ANSWER PROGRESS</span><strong>{resolved} of {questions.length} questions completed</strong></div><small>{complete ? "All questions are complete. You can submit now." : `Remaining: ${questions.length - resolved}`}</small></section>
      {sections.map((section) => {
        const sectionQuestions = bySection(section);
        const done = section === "supplier" ? supplierAnswered + supplierSkipped : sectionQuestions.filter(hasAnswer).length;
        return <section className="exam-section-block" id={`exam-section-${section}`} key={section}>
          <header className="exam-section-heading"><div><span>{sectionNames[section]}</span><small>{section === "supplier" ? "Answer 20 and explicitly skip 5 questions." : "Complete every question in this section."}</small></div><strong>{done}/{sectionQuestions.length}</strong></header>
          {sectionQuestions.map((question, sectionIndex) => {
            const selected = answers[question.id] || [];
            const skipped = isSkipped(question);
            return <article className={skipped ? "exam-question-card skipped" : "exam-question-card"} key={question.id}>
              <div className="exam-question-meta"><span>{sectionNames[question.section]}</span><b>Question {sectionIndex + 1} of {sectionQuestions.length}</b></div>
              <h1>{question.productName}</h1><p>{question.prompt}</p><small className="exam-question-detail">{question.detail}</small>
              {question.section === "supplier" && <div className="exam-question-actions"><button className={skipped ? "active" : ""} disabled={!skipped && supplierSkipped >= 5} onClick={() => toggleSkip(question)}>{skipped ? "Skipped — undo" : "Skip this question"}</button><small>{supplierAnswered}/20 answered · {supplierSkipped}/5 skipped</small></div>}
              <div className={question.section === "inventory" ? "exam-options multiple" : "exam-options"}>{question.options.map((option, optionIndex) => <button key={option.id} className={selected.includes(option.id) ? "selected" : ""} disabled={question.section === "supplier" && !hasAnswer(question) && supplierAnswered >= 20} onClick={() => choose(question, option.id)}><span>{question.section === "inventory" ? (selected.includes(option.id) ? "✓" : "□") : String.fromCharCode(65 + optionIndex)}</span><b>{option.label}</b></button>)}</div>
            </article>;
          })}
        </section>;
      })}
      <section className={complete ? "exam-submit-card complete" : "exam-submit-card"}><CheckCircle2 /><div><strong>{complete ? "Ready to submit" : "Complete all questions before submitting"}</strong><small>Price {priceAnswered}/{bySection("price").length} · Supplier {supplierAnswered}/20 + {supplierSkipped}/5 skipped · Inventory {inventoryAnswered}/{bySection("inventory").length}</small></div><button disabled={!complete || busy} onClick={onFinish}>{busy ? "Submitting…" : "Submit Examination"}</button></section>
    </main>
  </div>;
}

function ResultView({ result, questions, answers, onBack }: { result: Result; questions: Question[]; answers: Record<string, string[]>; onBack: () => void }) {
  const optionLabel = (question: Question, ids: string[]) => ids.includes("__skip__") ? "Skipped" : ids.map((id) => question.options.find((option) => option.id === id)?.label || id).join(" + ") || "Skipped";
  return <div className="exam-result-page"><button className="exam-back" onClick={onBack}><ChevronLeft />Back to Examination Center</button><section className={result.passed ? "result-hero passed" : "result-hero"}><div className="result-medal">{result.passed ? <Trophy /> : <BarChart3 />}</div><span>{result.attemptType === "official" ? "OFFICIAL RESULT" : "PRACTICE RESULT"}</span><h1>{result.percentage}%</h1><strong>{result.passed ? "Passed — Excellent work!" : "Needs Improvement"}</strong><p>{result.totalScore} / {result.maxScore} marks · {formatTime(result.timeUsedSeconds)} used</p></section><div className="result-sections"><article><b>{result.priceScore}</b><span>Price Knowledge</span><small>/{result.level === "senior" ? 50 : 10}</small></article><article><b>{result.supplierScore}</b><span>Supplier Knowledge</span><small>/20</small></article><article><b>{result.inventoryScore}</b><span>Inventory Knowledge</span><small>/30</small></article></div><section className="answer-review"><header><History /><div><h2>Complete Answer Review</h2><p>Correct answers are shown for every question.</p></div></header>{questions.map((question, index) => { const picked = answers[question.id] || []; const correct = question.correct || []; const right = picked.length === correct.length && picked.every((item) => correct.includes(item)); return <article className={right ? "correct" : "incorrect"} key={question.id}><span className="review-number">{right ? <CheckCircle2 /> : <CircleX />}{index + 1}</span><div><h3>{question.productName}</h3><p>Your answer: <b>{optionLabel(question, picked)}</b></p><p>Correct answer: <strong>{optionLabel(question, correct)}</strong></p></div></article>; })}</section></div>;
}

function Leaderboards({ boards }: { boards: { senior: Result[]; junior: Result[] } }) {
  const [level, setLevel] = useState<ExamLevel>("senior");
  const rows = boards[level];
  return <section className="leaderboard"><header><div><Trophy /><span><small>MONTHLY LEADERBOARD</small><h2>Knowledge Champions</h2></span></div><div><button className={level === "senior" ? "active" : ""} onClick={() => setLevel("senior")}>Senior</button><button className={level === "junior" ? "active" : ""} onClick={() => setLevel("junior")}>Junior</button></div></header>{rows.length === 0 ? <div className="leaderboard-empty"><Award /><p>No completed official exams yet.</p></div> : <><div className="podium">{rows.slice(0, 3).map((row, index) => <article className={`place-${index + 1}`} key={row.id}><div>{index === 0 ? <Crown /> : <Medal />}</div><strong>{row.userName}</strong><b>{row.percentage}%</b><small>{formatTime(row.timeUsedSeconds)}</small></article>)}</div>{rows.slice(3).map((row, index) => <div className="leader-row" key={row.id}><b>#{index + 4}</b><span>{row.userName}<small>{row.totalScore}/{row.maxScore} marks</small></span><strong>{row.percentage}%</strong><em><Flame />{formatTime(row.timeUsedSeconds)}</em></div>)}</>}</section>;
}

function Records({ title, records, busy, openResult }: { title: string; records: Result[]; busy: string; openResult: (record: Result) => Promise<void> }) {
  return <section className="exam-records"><header><History /><div><h2>{title}</h2><p>Official and practice results</p></div></header>{records.length === 0 ? <div className="records-empty">No examination records yet.</div> : <div className="records-list">{records.map((record) => <button key={record.id} onClick={() => void openResult(record)} disabled={busy === `result-${record.id}`}><span className={record.passed ? "record-score pass" : "record-score"}>{record.percentage}%</span><span><b>{record.level === "senior" ? "Senior" : "Junior"} · {record.attemptType === "official" ? "Official" : "Practice"}</b><small>{formatDate(record.submittedAt)} · {record.totalScore}/{record.maxScore}</small></span><em>{record.passed ? "Passed" : "Review"}<ChevronRight /></em></button>)}</div>}</section>;
}

function AdminResults({ records, openResult, reset }: { records: Result[]; openResult: (record: Result) => Promise<void>; reset: (record: Result) => Promise<void> }) {
  return <section className="admin-exam-results"><header><ShieldCheck /><div><h2>All User Results</h2><p>{records.length} official attempts in this cycle</p></div></header><div className="admin-result-table"><div className="admin-result-head"><span>User</span><span>Level</span><span>Price</span><span>Supplier</span><span>Inventory</span><span>Total</span><span>Action</span></div>{records.map((record) => <div className="admin-result-row" key={record.id}><span><b>{record.userName}</b><small>{record.userEmail}</small></span><span>{record.level}</span><span>{record.priceScore}</span><span>{record.supplierScore}</span><span>{record.inventoryScore}</span><strong>{record.percentage}%</strong><span><button onClick={() => void openResult(record)}>Review</button><button className="reset" onClick={() => void reset(record)}>Reset</button></span></div>)}</div></section>;
}
