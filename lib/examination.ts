export type ExamSection = "price" | "supplier" | "inventory";
export type ExamLevel = "senior" | "junior";

export type PoolRow = {
  id: number;
  productKey: string;
  productName: string;
  payloadJson: string;
};

export type GeneratedOption = { id: string; label: string };
export type GeneratedQuestion = {
  id: string;
  section: ExamSection;
  productKey: string;
  productName: string;
  prompt: string;
  detail: string;
  options: GeneratedOption[];
  correct: string[];
};

export type AttemptAnswers = Record<string, string[]>;

function randomIndex(max: number) {
  if (max <= 1) return 0;
  const range = 0x100000000 - (0x100000000 % max);
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value); while (value[0] >= range);
  return value[0] % max;
}

export function shuffle<T>(items: T[]) {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

function sample<T>(items: T[], count: number) {
  if (items.length < count) throw new Error(`Question pool requires ${count} items but only ${items.length} are available`);
  return shuffle(items).slice(0, count);
}

function parsePayload<T>(row: PoolRow) {
  return JSON.parse(row.payloadJson) as T;
}

function priceStep(value: number) {
  if (value >= 100000) return 1000;
  if (value >= 10000) return 500;
  if (value >= 1000) return 100;
  return 50;
}

function adjustedPrice(value: number, percent: number) {
  const step = priceStep(value);
  return Math.max(step, Math.round((value * (1 + percent)) / step) * step);
}

function priceLabel(purchase: number, selling: number) {
  return `Purchase ${purchase.toLocaleString()} MMK · Selling ${selling.toLocaleString()} MMK`;
}

function buildPriceQuestion(row: PoolRow): GeneratedQuestion {
  const payload = parsePayload<{ code: string; quantity: string; unit: string; purchasePrice: number; sellingPrice: number }>(row);
  const purchase = Number(payload.purchasePrice || 0);
  const selling = Number(payload.sellingPrice || 0);
  const direction = randomIndex(2) === 0 ? -1 : 1;
  const alternatePurchase = adjustedPrice(purchase, direction * (0.04 + randomIndex(5) / 100));
  const alternateSelling = adjustedPrice(selling, -direction * (0.04 + randomIndex(6) / 100));
  const pairs = [
    [purchase, selling],
    [alternatePurchase, selling],
    [purchase, alternateSelling],
    [alternatePurchase, Math.max(alternatePurchase, alternateSelling)],
  ];
  const unique = new Map<string, [number, number]>();
  for (const pair of pairs) unique.set(`${pair[0]}:${pair[1]}`, pair as [number, number]);
  let bump = 1;
  while (unique.size < 4) {
    const nextPurchase = adjustedPrice(purchase, 0.03 * bump);
    const nextSelling = Math.max(nextPurchase, adjustedPrice(selling, -0.025 * bump));
    unique.set(`${nextPurchase}:${nextSelling}`, [nextPurchase, nextSelling]);
    bump += 1;
  }
  const correctKey = `${purchase}:${selling}`;
  const options = shuffle([...unique.entries()].slice(0, 4)).map(([key, pair], index) => ({ id: `price_${index}_${key}`, label: priceLabel(pair[0], pair[1]) }));
  const correct = options.filter((option) => option.id.endsWith(correctKey)).map((option) => option.id);
  return {
    id: crypto.randomUUID(), section: "price", productKey: row.productKey, productName: row.productName,
    prompt: "Choose the correct Purchase Price and Selling Price.",
    detail: [payload.code, payload.quantity && `${payload.quantity} ${payload.unit}`].filter(Boolean).join(" · "),
    options, correct,
  };
}

function buildSupplierQuestion(row: PoolRow, allSuppliers: string[]): GeneratedQuestion {
  const payload = parsePayload<{ code: string; supplier: string; purchaseDate: string }>(row);
  const correctSupplier = String(payload.supplier || "").trim();
  const candidates = allSuppliers
    .filter((item) => item !== correctSupplier)
    .sort((left, right) => Math.abs(left.length - correctSupplier.length) - Math.abs(right.length - correctSupplier.length));
  const distractors = sample(candidates.slice(0, Math.max(8, Math.min(30, candidates.length))), 3);
  const labels = shuffle([correctSupplier, ...distractors]);
  const options = labels.map((label, index) => ({ id: `supplier_${index}_${crypto.randomUUID().slice(0, 6)}`, label }));
  return {
    id: crypto.randomUUID(), section: "supplier", productKey: row.productKey, productName: row.productName,
    prompt: "Which supplier was used for the latest purchase of this product?",
    detail: payload.code || "Supplier Knowledge",
    options, correct: options.filter((option) => option.label === correctSupplier).map((option) => option.id),
  };
}

const inventoryLabels: Record<string, string> = {
  low_sale: "Low Sale",
  over_stock: "Over Stock",
  near_expired: "Near Expired",
  none: "None of the Above",
};

function buildInventoryQuestion(row: PoolRow): GeneratedQuestion {
  const payload = parsePayload<{ statuses: string[]; expiry: string }>(row);
  const statuses = Array.isArray(payload.statuses) ? payload.statuses.filter((item) => inventoryLabels[item]) : [];
  const correct = statuses.length ? statuses : ["none"];
  const optionKeys = shuffle(["low_sale", "over_stock", "near_expired", "none"]);
  return {
    id: crypto.randomUUID(), section: "inventory", productKey: row.productKey, productName: row.productName,
    prompt: "Select every inventory status that applies.",
    detail: payload.expiry ? `Expiry ${payload.expiry}` : "Multiple answers may be correct",
    options: optionKeys.map((id) => ({ id, label: inventoryLabels[id] })), correct,
  };
}

export async function generateAttemptQuestions(level: ExamLevel, pools: Record<ExamSection, PoolRow[]>) {
  const priceRows = sample(pools.price, level === "senior" ? 50 : 10);
  const supplierRows = sample(pools.supplier, 25);
  const inventoryRows = sample(pools.inventory, 30);
  const suppliers = [...new Set(pools.supplier.map((row) => parsePayload<{ supplier: string }>(row).supplier).filter(Boolean))];
  if (suppliers.length < 4) throw new Error("Supplier file must contain at least four different suppliers");
  const questions: GeneratedQuestion[] = [
    ...priceRows.map(buildPriceQuestion),
    ...supplierRows.map((row) => buildSupplierQuestion(row, suppliers)),
    ...inventoryRows.map(buildInventoryQuestion),
  ];
  const fingerprintSource = questions.map((question) => `${question.section}:${question.productKey}:${question.options.map((option) => option.label).join("|")}`).join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprintSource));
  const fingerprint = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  return { questions, fingerprint };
}

export function publicQuestions(questions: GeneratedQuestion[]) {
  return questions.map((question) => {
    const publicQuestion: Partial<GeneratedQuestion> = { ...question };
    delete publicQuestion.correct;
    return publicQuestion;
  });
}

function sameAnswer(selected: string[], correct: string[]) {
  if (selected.length !== correct.length) return false;
  const expected = new Set(correct);
  return selected.every((item) => expected.has(item));
}

export function scoreAttempt(questions: GeneratedQuestion[], answers: AttemptAnswers) {
  const scores = { price: 0, supplier: 0, inventory: 0 };
  for (const question of questions) {
    if (sameAnswer(answers[question.id] || [], question.correct)) scores[question.section] += 1;
  }
  scores.supplier = Math.min(20, scores.supplier);
  const total = scores.price + scores.supplier + scores.inventory;
  const max = questions.filter((question) => question.section === "price").length + 20 + 30;
  return { ...scores, total, max, percentage: Math.round((total / max) * 100) };
}

export function currentMyanmarCycleKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yangon", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = parts.find((item) => item.type === "year")?.value || String(now.getUTCFullYear());
  const month = parts.find((item) => item.type === "month")?.value || String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function cycleWindow(cycleKey: string) {
  const [year, month] = cycleKey.split("-").map(Number);
  const opensAt = new Date(`${cycleKey}-20T00:00:00+06:30`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const closesAt = new Date(new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+06:30`).getTime() - 1);
  return { opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString() };
}

export function cycleTitle(cycleKey: string) {
  const [year, month] = cycleKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "Asia/Yangon" }).format(new Date(Date.UTC(year, month - 1, 1)));
}
