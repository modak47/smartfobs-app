export type CategoryType = "income" | "expense" | "transfer" | "owner" | "tax" | "ignored";
export type ReviewStatus = "needs_review" | "rule_applied" | "reviewed";
export type MatchStatus = "unmatched" | "suggested" | "matched" | "difference_found";

export type NormalisedBankTransaction = {
  transactionDate: string;
  description: string;
  transactionType: string;
  amountPence: number;
  balancePence: number | null;
  bankReference: string;
  transactionHash: string;
  category: string;
  categoryType: CategoryType;
  reviewStatus: ReviewStatus;
};

export function normaliseDescription(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normaliseCanonicalDescription(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseMoneyToPence(value: string | number | null | undefined) {
  if (typeof value === "number") return Math.round(value * 100);
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[£,\s]/g, "")
    .replace(/^\((.*)\)$/, "-$1");

  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export function penceToPounds(value: number) {
  return Math.round(value) / 100;
}

export function formatGBP(value: number) {
  return value.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}

export function formatUKDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return dateString;
  return new Intl.DateTimeFormat("en-GB").format(new Date(year, month - 1, day));
}

export function parseUKDate(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const uk = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (uk) {
    const [, day, month, yearRaw] = uk;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const ukTextMonth = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (ukTextMonth) {
    const [, day, monthText, year] = ukTextMonth;
    const monthMap: Record<string, string> = {
      jan: "01",
      january: "01",
      feb: "02",
      february: "02",
      mar: "03",
      march: "03",
      apr: "04",
      april: "04",
      may: "05",
      jun: "06",
      june: "06",
      jul: "07",
      july: "07",
      aug: "08",
      august: "08",
      sep: "09",
      sept: "09",
      september: "09",
      oct: "10",
      october: "10",
      nov: "11",
      november: "11",
      dec: "12",
      december: "12",
    };
    const month = monthMap[monthText.toLowerCase()];
    if (month) return `${year}-${month}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

export function determineDirection(amountPence: number) {
  if (amountPence > 0) return "incoming";
  if (amountPence < 0) return "outgoing";
  return "zero";
}

export function affectsProfit(categoryType: CategoryType) {
  return categoryType === "income" || categoryType === "expense";
}

export function createTransactionHash({
  transactionDate,
  description,
  amountPence,
  bankReference,
}: {
  transactionDate: string;
  description: string;
  amountPence: number;
  bankReference?: string | null;
}) {
  const source = [
    transactionDate,
    normaliseDescription(description),
    String(amountPence),
    normaliseDescription(bankReference || ""),
  ].join("|");

  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `sf_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createCanonicalTransactionBase({
  transactionDate,
  description,
  amountPence,
}: {
  transactionDate: string;
  description: string;
  amountPence: number;
}) {
  const direction = determineDirection(amountPence);
  const source = [
    transactionDate,
    normaliseCanonicalDescription(description),
    String(amountPence),
    direction,
  ].join("|");
  return `sf_base_${stableHash(source)}`;
}

export function createCanonicalOccurrenceHash(baseFingerprint: string, occurrenceIndex: number) {
  return `${baseFingerprint}_${String(occurrenceIndex).padStart(3, "0")}`;
}

export function getCurrentTaxYearStart(today: string) {
  const year = Number(today.slice(0, 4));
  const thisYearsStart = `${year}-04-06`;
  return today >= thisYearsStart ? thisYearsStart : `${year - 1}-04-06`;
}

export function getTaxYearEnd(taxYearStart: string) {
  return `${Number(taxYearStart.slice(0, 4)) + 1}-04-05`;
}

export function isInDateRange(dateString: string, from: string, to: string) {
  return dateString >= from && dateString <= to;
}

export function getTaxYearQuarters(taxYearStart: string) {
  const startYear = Number(taxYearStart.slice(0, 4));
  return [
    { label: "Q1", from: `${startYear}-04-06`, to: `${startYear}-07-05` },
    { label: "Q2", from: `${startYear}-07-06`, to: `${startYear}-10-05` },
    { label: "Q3", from: `${startYear}-10-06`, to: `${startYear + 1}-01-05` },
    { label: "Q4", from: `${startYear + 1}-01-06`, to: `${startYear + 1}-04-05` },
  ];
}
