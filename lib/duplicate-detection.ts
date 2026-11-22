export type CustomerDuplicateRecord = {
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

export type ProductDuplicateRecord = {
  id: number;
  productCode: string;
  productName: string;
  sku: string;
  salePrice: number;
  createdAt: string;
  usageCount: number;
};

export type DuplicateMatch<T> = {
  pairKey: string;
  score: number;
  reasons: string[];
  recordA: T;
  recordB: T;
  reviewStatus: string;
};

export function duplicatePairKey(entityType: "customer" | "product", firstId: number, secondId: number) {
  const [a, b] = [firstId, secondId].sort((left, right) => left - right);
  return `${entityType}:${a}:${b}`;
}

export function normalizeDuplicateText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("959")) digits = `0${digits.slice(2)}`;
  return digits;
}

function diceSimilarity(leftValue: string, rightValue: string) {
  const left = normalizeDuplicateText(leftValue).replace(/\s/g, "");
  const right = normalizeDuplicateText(rightValue).replace(/\s/g, "");
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const pairs = new Map<string, number>();
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }
  let overlap = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2);
    const available = pairs.get(pair) || 0;
    if (available > 0) {
      overlap += 1;
      pairs.set(pair, available - 1);
    }
  }
  return (2 * overlap) / (left.length + right.length - 2);
}

function decisionStatus(pairKey: string, decisions: Map<string, string>) {
  return decisions.get(pairKey) || "pending";
}

export function findCustomerDuplicates(records: CustomerDuplicateRecord[], decisions: Map<string, string>) {
  const buckets = new Map<string, number[]>();
  records.forEach((record, index) => {
    const name = normalizeDuplicateText(record.customerName);
    const township = normalizeDuplicateText(record.township);
    const phone = normalizePhone(record.phone);
    const address = normalizeDuplicateText(record.address);
    const compactName = name.replace(/\s/g, "");
    const keys = [
      `name:${township}:${name}`,
      `prefix:${township}:${compactName.slice(0, 5)}`,
      `token:${township}:${name.split(" ")[0] || ""}`,
    ];
    if (phone.length >= 6) keys.push(`phone:${phone}`);
    if (address.length >= 8) keys.push(`address:${address}`);
    for (const key of keys.filter((item) => !item.endsWith(":"))) {
      const bucket = buckets.get(key) || [];
      bucket.push(index);
      buckets.set(key, bucket);
    }
  });
  const candidatePairs = new Set<string>();
  for (const bucket of buckets.values()) {
    if (bucket.length > 100) continue;
    for (let left = 0; left < bucket.length; left += 1) {
      for (let right = left + 1; right < bucket.length; right += 1) {
        const [a, b] = [bucket[left], bucket[right]].sort((first, second) => first - second);
        candidatePairs.add(`${a}:${b}`);
      }
    }
  }

  const matches: Array<DuplicateMatch<CustomerDuplicateRecord>> = [];
  for (const candidate of candidatePairs) {
      const [leftIndex, rightIndex] = candidate.split(":").map(Number);
      const left = records[leftIndex];
      const right = records[rightIndex];
      const pairKey = duplicatePairKey("customer", left.id, right.id);
      const status = decisionStatus(pairKey, decisions);
      if (["keep_separate", "merged"].includes(status)) continue;

      const leftName = normalizeDuplicateText(left.customerName);
      const rightName = normalizeDuplicateText(right.customerName);
      const leftTownship = normalizeDuplicateText(left.township);
      const rightTownship = normalizeDuplicateText(right.township);
      const leftPhone = normalizePhone(left.phone);
      const rightPhone = normalizePhone(right.phone);
      const leftAddress = normalizeDuplicateText(left.address);
      const rightAddress = normalizeDuplicateText(right.address);
      const nameSimilarity = diceSimilarity(leftName, rightName);
      const phoneMatch = leftPhone.length >= 6 && leftPhone === rightPhone;
      const addressMatch = leftAddress.length >= 8 && leftAddress === rightAddress;
      const sameTownship = Boolean(leftTownship && leftTownship === rightTownship);
      const reasons: string[] = [];
      let score = 0;

      if (left.customerKey === right.customerKey) {
        score = 100;
        reasons.push("Same Customer Key");
      }
      if (phoneMatch) {
        score = Math.max(score, 98);
        reasons.push("Same phone number");
      }
      if (leftName === rightName && sameTownship) {
        score = Math.max(score, 96);
        reasons.push("Same normalized name and township");
      } else if (nameSimilarity >= 0.9 && sameTownship) {
        score = Math.max(score, Math.round(88 + nameSimilarity * 7));
        reasons.push("Very similar name and same township");
      }
      if (addressMatch && nameSimilarity >= 0.75) {
        score = Math.max(score, 92);
        reasons.push("Same address and similar name");
      }
      if (score < 88) continue;
      matches.push({ pairKey, score: Math.min(100, score), reasons, recordA: left, recordB: right, reviewStatus: status });
  }
  return matches.sort((a, b) => b.score - a.score || b.recordA.usageCount + b.recordB.usageCount - a.recordA.usageCount - a.recordB.usageCount).slice(0, 200);
}

function strengthSignature(value: string) {
  const matches = value.toLocaleUpperCase().match(/\d+(?:\.\d+)?\s*(?:MCG|MG|G|ML|IU|%)/g) || [];
  return [...new Set(matches.map((item) => item.replace(/\s+/g, "")))].sort().join("|");
}

function formSignature(value: string) {
  const normalized = ` ${normalizeDuplicateText(value)} `;
  const forms: Array<[string, string[]]> = [
    ["tablet", [" tablet ", " tab "]], ["capsule", [" capsule ", " cap "]],
    ["syrup", [" syrup ", " sy ", " syp "]], ["injection", [" injection ", " inj "]],
    ["cream", [" cream "]], ["ointment", [" ointment ", " oint "]], ["lotion", [" lotion "]],
    ["drops", [" drop ", " drops "]], ["suppository", [" suppo ", " suppository "]],
    ["powder", [" powder "]], ["sachet", [" sachet "]],
  ];
  return forms.filter(([, words]) => words.some((word) => normalized.includes(word))).map(([form]) => form).join("|");
}

function productCandidateKeys(record: ProductDuplicateRecord) {
  const name = normalizeDuplicateText(record.productName);
  const compact = name.replace(/\s/g, "");
  const firstToken = name.split(" ")[0] || compact.slice(0, 6);
  const strength = strengthSignature(record.productName);
  const keys = [`prefix:${compact.slice(0, 7)}:${strength}`, `token:${firstToken}:${strength}`, `name:${name}`];
  if (record.sku.trim()) keys.push(`sku:${normalizeDuplicateText(record.sku)}`);
  return keys;
}

export function findProductDuplicates(records: ProductDuplicateRecord[], decisions: Map<string, string>) {
  const buckets = new Map<string, number[]>();
  records.forEach((record, index) => {
    for (const key of productCandidateKeys(record)) {
      const bucket = buckets.get(key) || [];
      bucket.push(index);
      buckets.set(key, bucket);
    }
  });
  const candidatePairs = new Set<string>();
  for (const bucket of buckets.values()) {
    if (bucket.length > 80) continue;
    for (let left = 0; left < bucket.length; left += 1) {
      for (let right = left + 1; right < bucket.length; right += 1) {
        const [a, b] = [bucket[left], bucket[right]].sort((first, second) => first - second);
        candidatePairs.add(`${a}:${b}`);
      }
    }
  }

  const matches: Array<DuplicateMatch<ProductDuplicateRecord>> = [];
  for (const candidate of candidatePairs) {
    const [leftIndex, rightIndex] = candidate.split(":").map(Number);
    const left = records[leftIndex];
    const right = records[rightIndex];
    const pairKey = duplicatePairKey("product", left.id, right.id);
    const status = decisionStatus(pairKey, decisions);
    if (["keep_separate", "merged"].includes(status)) continue;

    const leftName = normalizeDuplicateText(left.productName);
    const rightName = normalizeDuplicateText(right.productName);
    const leftSku = normalizeDuplicateText(left.sku);
    const rightSku = normalizeDuplicateText(right.sku);
    const leftStrength = strengthSignature(left.productName);
    const rightStrength = strengthSignature(right.productName);
    const leftForm = formSignature(left.productName);
    const rightForm = formSignature(right.productName);
    const skuMatch = Boolean(leftSku && leftSku === rightSku);
    if (!skuMatch && leftStrength && rightStrength && leftStrength !== rightStrength) continue;
    if (!skuMatch && leftForm && rightForm && leftForm !== rightForm) continue;

    const similarity = diceSimilarity(leftName, rightName);
    const reasons: string[] = [];
    let score = 0;
    if (left.productCode === right.productCode) {
      score = 100;
      reasons.push("Same Product Code");
    }
    if (skuMatch) {
      score = Math.max(score, 98);
      reasons.push("Same SKU");
    }
    if (leftName === rightName) {
      score = Math.max(score, 96);
      reasons.push("Same normalized product name");
    } else if (similarity >= 0.9) {
      score = Math.max(score, Math.round(86 + similarity * 8));
      reasons.push("Very similar product name");
    } else if (similarity >= 0.82 && leftName.split(" ")[0] === rightName.split(" ")[0]) {
      score = Math.max(score, 88);
      reasons.push("Same product family, strength and form");
    }
    if (leftStrength && leftStrength === rightStrength) reasons.push(`Same strength: ${leftStrength}`);
    if (leftForm && leftForm === rightForm) reasons.push(`Same form: ${leftForm}`);
    if (score < 88) continue;
    matches.push({ pairKey, score: Math.min(100, score), reasons, recordA: left, recordB: right, reviewStatus: status });
  }
  return matches.sort((a, b) => b.score - a.score || b.recordA.usageCount + b.recordB.usageCount - a.recordA.usageCount - a.recordB.usageCount).slice(0, 200);
}
