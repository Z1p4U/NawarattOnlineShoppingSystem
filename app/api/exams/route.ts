import { and, asc, count, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { examAttempts, examCycles, examQuestionPool } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";
import { recordAuditLog } from "../../../lib/audit-log";
import {
  cycleTitle,
  cycleWindow,
  currentMyanmarCycleKey,
  generateAttemptQuestions,
  publicQuestions,
  scoreAttempt,
  type AttemptAnswers,
  type ExamLevel,
  type ExamSection,
  type GeneratedQuestion,
  type PoolRow,
} from "../../../lib/examination";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseJson<T>(value: string, fallback: T) {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function isSubmitted(status: string) {
  return status === "submitted" || status === "auto_submitted";
}

function publicCycle(cycle: typeof examCycles.$inferSelect | undefined, admin = false) {
  if (!cycle) return null;
  return {
    id: cycle.id, cycleKey: cycle.cycleKey, title: cycle.title, status: cycle.status,
    opensAt: cycle.opensAt, closesAt: cycle.closesAt,
    priceCount: cycle.priceCount, supplierCount: cycle.supplierCount, inventoryCount: cycle.inventoryCount,
    ...(admin ? { priceFileName: cycle.priceFileName, supplierFileName: cycle.supplierFileName, inventoryFileName: cycle.inventoryFileName } : {}),
  };
}

function resultSummary(attempt: typeof examAttempts.$inferSelect) {
  return {
    id: attempt.id, cycleId: attempt.cycleId, userEmail: attempt.userEmail, userName: attempt.userName,
    userRole: attempt.userRole, level: attempt.level, attemptType: attempt.attemptType, status: attempt.status,
    startedAt: attempt.startedAt, deadlineAt: attempt.deadlineAt, submittedAt: attempt.submittedAt,
    priceScore: attempt.priceScore, supplierScore: attempt.supplierScore, inventoryScore: attempt.inventoryScore,
    totalScore: attempt.totalScore, maxScore: attempt.maxScore, percentage: attempt.percentage,
    timeUsedSeconds: attempt.timeUsedSeconds,
    passed: attempt.percentage >= 70 && attempt.priceScore >= Math.ceil((attempt.level === "senior" ? 50 : 10) * .6) && attempt.supplierScore >= 12 && attempt.inventoryScore >= 18,
  };
}

async function finalizeAttempt(attempt: typeof examAttempts.$inferSelect, status: "submitted" | "auto_submitted") {
  if (isSubmitted(attempt.status) || attempt.status === "reset") return attempt;
  const questions = parseJson<GeneratedQuestion[]>(attempt.questionsJson, []);
  const answers = parseJson<AttemptAnswers>(attempt.answersJson, {});
  const score = scoreAttempt(questions, answers);
  const now = new Date();
  const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(attempt.startedAt).getTime()) / 1000));
  const [saved] = await getDb().update(examAttempts).set({
    status, submittedAt: now.toISOString(), priceScore: score.price, supplierScore: score.supplier,
    inventoryScore: score.inventory, totalScore: score.total, maxScore: score.max,
    percentage: score.percentage, timeUsedSeconds: Math.min(attempt.allowedSeconds, elapsed), updatedAt: now.toISOString(),
  }).where(eq(examAttempts.id, attempt.id)).returning();
  return saved || attempt;
}

async function expireIfNeeded(attempt: typeof examAttempts.$inferSelect | undefined) {
  if (!attempt || attempt.status !== "in_progress") return attempt;
  if (Date.now() >= new Date(attempt.deadlineAt).getTime()) return finalizeAttempt(attempt, "auto_submitted");
  return attempt;
}

async function loadDashboard(user: NonNullable<Awaited<ReturnType<typeof getAppUser>>>) {
  const db = getDb();
  const cycles = await db.select().from(examCycles).orderBy(desc(examCycles.cycleKey));
  const currentKey = currentMyanmarCycleKey();
  const cycle = user.role === "admin"
    ? cycles.find((item) => item.cycleKey === currentKey) || cycles[0]
    : cycles.find((item) => item.cycleKey === currentKey && item.status === "published") || cycles.find((item) => item.status === "published");
  const mine = await db.select().from(examAttempts).where(eq(examAttempts.userEmail, user.email)).orderBy(desc(examAttempts.createdAt));
  for (let index = 0; index < mine.length; index += 1) mine[index] = (await expireIfNeeded(mine[index])) || mine[index];
  const leaderboardSource = cycle
    ? await db.select().from(examAttempts).where(and(eq(examAttempts.cycleId, cycle.id), eq(examAttempts.attemptType, "official"))).orderBy(desc(examAttempts.percentage), desc(examAttempts.priceScore), asc(examAttempts.timeUsedSeconds), asc(examAttempts.submittedAt))
    : [];
  const leaderboard = (level: ExamLevel) => leaderboardSource.filter((item) => item.level === level && isSubmitted(item.status)).map((item, index) => ({ rank: index + 1, ...resultSummary(item) }));
  const adminResults = user.role === "admin" && cycle
    ? leaderboardSource.map(resultSummary)
    : [];
  return {
    serverTime: new Date().toISOString(), cycle: publicCycle(cycle, user.role === "admin"),
    records: mine.filter((item) => isSubmitted(item.status)).map(resultSummary),
    activeAttempt: mine.find((item) => item.cycleId === cycle?.id && item.status === "in_progress") ? resultSummary(mine.find((item) => item.cycleId === cycle?.id && item.status === "in_progress")!) : null,
    officialCompleted: mine.some((item) => item.cycleId === cycle?.id && item.attemptType === "official" && isSubmitted(item.status)),
    leaderboards: { senior: leaderboard("senior"), junior: leaderboard("junior") },
    adminResults,
  };
}

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "dashboard";
  if (action === "dashboard") return Response.json(await loadDashboard(user));
  const id = clean(url.searchParams.get("id"));
  const [rawAttempt] = id ? await getDb().select().from(examAttempts).where(eq(examAttempts.id, id)).limit(1) : [];
  if (!rawAttempt) return Response.json({ error: "Exam attempt not found" }, { status: 404 });
  if (user.role !== "admin" && rawAttempt.userEmail !== user.email) return Response.json({ error: "Forbidden" }, { status: 403 });
  const attempt = (await expireIfNeeded(rawAttempt)) || rawAttempt;
  const questions = parseJson<GeneratedQuestion[]>(attempt.questionsJson, []);
  const answers = parseJson<AttemptAnswers>(attempt.answersJson, {});
  if (action === "attempt") {
    return Response.json({ attempt: resultSummary(attempt), questions: publicQuestions(questions), answers, serverTime: new Date().toISOString() });
  }
  if (action === "result") {
    if (!isSubmitted(attempt.status)) return Response.json({ error: "Exam is not submitted yet" }, { status: 409 });
    return Response.json({ attempt: resultSummary(attempt), questions, answers });
  }
  return Response.json({ error: "Unsupported action" }, { status: 400 });
}

async function requireAdmin() {
  const user = await getAppUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  if (user.role !== "admin") return { error: Response.json({ error: "Admin only" }, { status: 403 }) } as const;
  return { user } as const;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = clean(payload.action, 40);
  const db = getDb();

  if (action === "upload") {
    const access = await requireAdmin();
    if (access.error) return access.error;
    const section = clean(payload.section, 20) as ExamSection;
    try {
      if (!(["price", "supplier", "inventory"] as string[]).includes(section)) return Response.json({ error: "Invalid exam section" }, { status: 400 });
      const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, 8000) as Array<Record<string, unknown>> : [];
      if (!rows.length) return Response.json({ error: "No valid question rows were found" }, { status: 400 });
      const cycleKey = clean(payload.cycleKey, 7) || currentMyanmarCycleKey();
      if (!/^\d{4}-\d{2}$/.test(cycleKey)) return Response.json({ error: "Invalid examination month" }, { status: 400 });
      const [existing] = await db.select().from(examCycles).where(eq(examCycles.cycleKey, cycleKey)).limit(1);
      if (existing?.status === "published") return Response.json({ error: "Published question files are locked. Create a new cycle or reset it first." }, { status: 409 });
      const cycleId = existing?.id || crypto.randomUUID();
      if (!existing) await db.insert(examCycles).values({ id: cycleId, cycleKey, title: cycleTitle(cycleKey), createdBy: access.user.displayName });
      const cleanRows = rows.map((row, index) => ({
        cycleId, section, productKey: clean(row.productKey, 300) || `${section}-${index + 1}`,
        productName: clean(row.productName, 300), payloadJson: JSON.stringify(row.payload || {}), uploadedBy: access.user.displayName,
      })).filter((row) => row.productName);
      await db.delete(examQuestionPool).where(and(eq(examQuestionPool.cycleId, cycleId), eq(examQuestionPool.section, section)));
      // D1 accepts at most 100 bound parameters per statement. Each row uses six,
      // so ten rows leaves enough headroom for Drizzle-generated bindings.
      const insertStatements = [];
      for (let index = 0; index < cleanRows.length; index += 10) {
        insertStatements.push(db.insert(examQuestionPool).values(cleanRows.slice(index, index + 10)).onConflictDoNothing());
      }
      // Submit safe statements in D1 batches so a 3,000+ product workbook does
      // not create hundreds of network round trips within one Worker request.
      for (let index = 0; index < insertStatements.length; index += 40) {
        const statements = insertStatements.slice(index, index + 40);
        if (statements.length) await db.batch(statements as [typeof statements[number], ...typeof statements[number][]]);
      }
      const [countRow] = await db.select({ value: count() }).from(examQuestionPool).where(and(eq(examQuestionPool.cycleId, cycleId), eq(examQuestionPool.section, section)));
      const actualCount = Number(countRow?.value || 0);
      const fileName = clean(payload.fileName, 240);
      const update = section === "price" ? { priceCount: actualCount, priceFileName: fileName }
        : section === "supplier" ? { supplierCount: actualCount, supplierFileName: fileName }
        : { inventoryCount: actualCount, inventoryFileName: fileName };
      const [cycle] = await db.update(examCycles).set({ ...update, updatedAt: new Date().toISOString() }).where(eq(examCycles.id, cycleId)).returning();
      await recordAuditLog(access.user, { action: "exam_questions_uploaded", entityType: "exam_cycle", entityId: cycleId, summary: `${section} • ${actualCount} products • ${fileName}` });
      return Response.json({ cycle: publicCycle(cycle, true), count: actualCount });
    } catch (error) {
      console.error("Exam question upload failed", { section, error: error instanceof Error ? error.message : String(error) });
      return Response.json({ error: "Question import failed while saving to the database. Please retry after refreshing the page." }, { status: 500 });
    }
  }

  if (action === "publish") {
    const access = await requireAdmin();
    if (access.error) return access.error;
    const cycleId = clean(payload.cycleId);
    const [cycle] = await db.select().from(examCycles).where(eq(examCycles.id, cycleId)).limit(1);
    if (!cycle) return Response.json({ error: "Exam cycle not found" }, { status: 404 });
    if (cycle.priceCount < 50 || cycle.supplierCount < 25 || cycle.inventoryCount < 30) return Response.json({ error: "Upload at least 50 Price, 25 Supplier and 30 Inventory products before publishing" }, { status: 400 });
    const window = cycleWindow(cycle.cycleKey);
    const [saved] = await db.update(examCycles).set({ status: "published", ...window, publishedBy: access.user.displayName, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(examCycles.id, cycle.id)).returning();
    await recordAuditLog(access.user, { action: "exam_published", entityType: "exam_cycle", entityId: cycle.id, summary: `${cycle.title} • 20th through month-end • Myanmar time` });
    return Response.json({ cycle: publicCycle(saved, true) });
  }

  if (action === "start") {
    const user = await getAppUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const level = clean(payload.level, 20) as ExamLevel;
    const attemptType = clean(payload.attemptType, 20) === "practice" ? "practice" : "official";
    if (level !== "senior" && level !== "junior") return Response.json({ error: "Choose Senior or Junior" }, { status: 400 });
    const cycles = await db.select().from(examCycles).where(eq(examCycles.status, "published")).orderBy(desc(examCycles.cycleKey));
    const cycle = cycles.find((item) => item.cycleKey === currentMyanmarCycleKey()) || cycles[0];
    if (!cycle) return Response.json({ error: "No published examination is available" }, { status: 409 });
    const now = new Date();
    if (attemptType === "official" && (now < new Date(cycle.opensAt) || now > new Date(cycle.closesAt))) return Response.json({ error: now < new Date(cycle.opensAt) ? "Official examination has not opened yet" : "Official examination has closed" }, { status: 409 });
    const lockKey = attemptType === "official" ? `${cycle.id}|${user.email.toLowerCase()}` : null;
    if (lockKey) {
      const [existing] = await db.select().from(examAttempts).where(eq(examAttempts.officialLockKey, lockKey)).limit(1);
      if (existing) {
        const current = (await expireIfNeeded(existing)) || existing;
        if (current.status === "in_progress") return Response.json({ attemptId: current.id, resumed: true });
        return Response.json({ error: "Official examination already completed. Retake is not allowed." }, { status: 409 });
      }
    }
    const poolRows = await db.select().from(examQuestionPool).where(eq(examQuestionPool.cycleId, cycle.id));
    const pools = { price: [], supplier: [], inventory: [] } as Record<ExamSection, PoolRow[]>;
    for (const row of poolRows) if (row.section in pools) pools[row.section as ExamSection].push(row);
    let generated = await generateAttemptQuestions(level, pools);
    for (let tries = 0; tries < 5; tries += 1) {
      const [collision] = await db.select({ id: examAttempts.id }).from(examAttempts).where(and(eq(examAttempts.cycleId, cycle.id), eq(examAttempts.level, level), eq(examAttempts.fingerprint, generated.fingerprint))).limit(1);
      if (!collision) break;
      generated = await generateAttemptQuestions(level, pools);
    }
    const allowedSeconds = (level === "senior" ? 45 : 30) * 60;
    const deadline = new Date(now.getTime() + allowedSeconds * 1000);
    if (attemptType === "official" && deadline > new Date(cycle.closesAt)) deadline.setTime(new Date(cycle.closesAt).getTime());
    const id = crypto.randomUUID();
    await db.insert(examAttempts).values({ id, cycleId: cycle.id, userEmail: user.email, userName: user.displayName, userRole: user.role, level, attemptType, officialLockKey: lockKey, startedAt: now.toISOString(), deadlineAt: deadline.toISOString(), allowedSeconds, questionsJson: JSON.stringify(generated.questions), fingerprint: generated.fingerprint });
    await recordAuditLog(user, { action: "exam_started", entityType: "exam_attempt", entityId: id, summary: `${attemptType} • ${level} • ${cycle.title}` });
    return Response.json({ attemptId: id, resumed: false });
  }

  if (action === "answer") {
    const user = await getAppUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const attemptId = clean(payload.attemptId);
    const questionId = clean(payload.questionId);
    const selected = Array.isArray(payload.selected) ? [...new Set(payload.selected.map((item) => clean(item, 120)).filter(Boolean))] : [];
    const [raw] = await db.select().from(examAttempts).where(eq(examAttempts.id, attemptId)).limit(1);
    if (!raw || raw.userEmail !== user.email) return Response.json({ error: "Attempt not found" }, { status: 404 });
    const attempt = (await expireIfNeeded(raw)) || raw;
    if (attempt.status !== "in_progress") return Response.json({ error: "Exam has already been submitted" }, { status: 409 });
    const questions = parseJson<GeneratedQuestion[]>(attempt.questionsJson, []);
    const question = questions.find((item) => item.id === questionId);
    if (!question) return Response.json({ error: "Question not found" }, { status: 404 });
    const validOptions = new Set(question.options.map((option) => option.id));
    const isSupplierSkip = question.section === "supplier" && selected.length === 1 && selected[0] === "__skip__";
    if (!isSupplierSkip && selected.some((item) => !validOptions.has(item))) return Response.json({ error: "Invalid answer" }, { status: 400 });
    if (question.section !== "inventory" && selected.length > 1) return Response.json({ error: "Choose one answer" }, { status: 400 });
    if (selected.includes("none") && selected.length > 1) return Response.json({ error: "None of the Above cannot be combined with another answer" }, { status: 400 });
    const answers = parseJson<AttemptAnswers>(attempt.answersJson, {});
    if (question.section === "supplier" && selected.length) {
      const otherSupplierQuestions = questions.filter((item) => item.section === "supplier" && item.id !== questionId);
      const answeredSuppliers = otherSupplierQuestions.filter((item) => answers[item.id]?.length && !answers[item.id].includes("__skip__")).length;
      const skippedSuppliers = otherSupplierQuestions.filter((item) => answers[item.id]?.includes("__skip__")).length;
      if (!isSupplierSkip && answeredSuppliers >= 20) return Response.json({ error: "Supplier section allows exactly 20 answers" }, { status: 409 });
      if (isSupplierSkip && skippedSuppliers >= 5) return Response.json({ error: "Only five Supplier questions may be skipped" }, { status: 409 });
    }
    if (selected.length) answers[questionId] = selected; else delete answers[questionId];
    await db.update(examAttempts).set({ answersJson: JSON.stringify(answers), updatedAt: new Date().toISOString() }).where(eq(examAttempts.id, attempt.id));
    return Response.json({ saved: true });
  }

  if (action === "submit") {
    const user = await getAppUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const attemptId = clean(payload.attemptId);
    const [attempt] = await db.select().from(examAttempts).where(eq(examAttempts.id, attemptId)).limit(1);
    if (!attempt || attempt.userEmail !== user.email) return Response.json({ error: "Attempt not found" }, { status: 404 });
    const reason = clean(payload.reason);
    if (reason === "finish" && attempt.status === "in_progress") {
      const questions = parseJson<GeneratedQuestion[]>(attempt.questionsJson, []);
      const answers = parseJson<AttemptAnswers>(attempt.answersJson, {});
      const sectionQuestions = (section: ExamSection) => questions.filter((question) => question.section === section);
      const answered = (question: GeneratedQuestion) => Boolean(answers[question.id]?.length && !answers[question.id].includes("__skip__"));
      const priceAnswered = sectionQuestions("price").filter(answered).length;
      const supplierAnswered = sectionQuestions("supplier").filter(answered).length;
      const supplierSkipped = sectionQuestions("supplier").filter((question) => answers[question.id]?.includes("__skip__")).length;
      const inventoryAnswered = sectionQuestions("inventory").filter(answered).length;
      const complete = priceAnswered === sectionQuestions("price").length && supplierAnswered === 20 && supplierSkipped === 5 && inventoryAnswered === sectionQuestions("inventory").length;
      if (!complete) return Response.json({ error: `Complete all questions first. Price ${priceAnswered}/${sectionQuestions("price").length}, Supplier ${supplierAnswered}/20 plus ${supplierSkipped}/5 skipped, Inventory ${inventoryAnswered}/${sectionQuestions("inventory").length}.` }, { status: 409 });
    }
    const saved = await finalizeAttempt(attempt, reason === "timer" || reason === "close" ? "auto_submitted" : "submitted");
    await recordAuditLog(user, { action: "exam_submitted", entityType: "exam_attempt", entityId: saved.id, summary: `${saved.level} • ${saved.totalScore}/${saved.maxScore} • ${saved.percentage}%` });
    return Response.json({ attempt: resultSummary(saved) });
  }

  if (action === "reset") {
    const access = await requireAdmin();
    if (access.error) return access.error;
    const attemptId = clean(payload.attemptId);
    const reason = clean(payload.reason, 500);
    if (!reason) return Response.json({ error: "Reset reason is required" }, { status: 400 });
    const [attempt] = await db.select().from(examAttempts).where(eq(examAttempts.id, attemptId)).limit(1);
    if (!attempt) return Response.json({ error: "Attempt not found" }, { status: 404 });
    await db.update(examAttempts).set({ status: "reset", officialLockKey: null, resetReason: reason, updatedAt: new Date().toISOString() }).where(eq(examAttempts.id, attempt.id));
    await recordAuditLog(access.user, { action: "exam_attempt_reset", entityType: "exam_attempt", entityId: attempt.id, summary: `${attempt.userName} • ${reason}` });
    return Response.json({ reset: true });
  }

  return Response.json({ error: "Unsupported action" }, { status: 400 });
}
