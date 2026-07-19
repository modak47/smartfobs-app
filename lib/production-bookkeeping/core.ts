import type { BookkeepingTransaction, CategoryRule } from "@/lib/production-bookkeeping/types";

export function money(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/£|Ł|,/g, "").trim());
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

export function formatGBP(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value ?? 0);
}

export function dateKey(value: unknown) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const uk = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (uk) return `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  return "";
}

export function currentDateKey() {
  return dateKey(new Date());
}

export function currentTaxYear() {
  return { label: "2026-27", start: "2026-04-06", end: "2027-04-05" };
}

export function quarterForDate(transactionDate: string) {
  if (transactionDate >= "2026-04-06" && transactionDate <= "2026-07-05") return "Q1";
  if (transactionDate >= "2026-07-06" && transactionDate <= "2026-10-05") return "Q2";
  if (transactionDate >= "2026-10-06" && transactionDate <= "2027-01-05") return "Q3";
  if (transactionDate >= "2027-01-06" && transactionDate <= "2027-04-05") return "Q4";
  return "";
}

export function normaliseForHash(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function transactionHash(input: {
  transaction_date: string;
  original_amount: number;
  description: string;
  bank_type?: string | null;
  bank_balance?: number | null;
}) {
  const stable = [
    input.transaction_date,
    input.original_amount.toFixed(2),
    normaliseForHash(input.description),
    normaliseForHash(input.bank_type),
    input.bank_balance === null || input.bank_balance === undefined ? "" : Number(input.bank_balance).toFixed(2),
  ].join("|");
  let hash = 2166136261;
  for (let index = 0; index < stable.length; index += 1) {
    hash ^= stable.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `bk_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function calculateAllowables(row: Partial<BookkeepingTransaction>) {
  const amount = money(row.original_amount);
  const direction = String(row.direction || (amount >= 0 ? "Income" : "Expense"));
  const businessStatus = String(row.business_status || "Review");
  const allowableStatus = String(row.allowable_status || "Review");
  const usePercent = normaliseBusinessUsePercent(row.business_use_percent);
  const useRatio = Number.isFinite(usePercent) ? Math.max(0, Math.min(100, usePercent)) / 100 : 1;

  const allowableIncome =
    direction === "Income" && businessStatus === "Business" && allowableStatus === "Yes"
      ? Math.max(amount, 0) * useRatio
      : 0;

  const allowableExpense =
    direction === "Expense" &&
    (businessStatus === "Business" || businessStatus === "Mixed") &&
    (allowableStatus === "Yes" || allowableStatus === "Stock")
      ? Math.abs(Math.min(amount, 0)) * useRatio
      : 0;

  return {
    allowable_income: Number(allowableIncome.toFixed(2)),
    allowable_expense: Number(allowableExpense.toFixed(2)),
  };
}

export function normaliseBusinessUsePercent(value: unknown) {
  const numeric = Number(value ?? 100);
  if (!Number.isFinite(numeric)) return 100;
  if (numeric >= 0 && numeric <= 1) return numeric * 100;
  return numeric;
}

export function applyRules(description: string, amount: number, rules: CategoryRule[]) {
  const text = description.toUpperCase();
  const direction = amount >= 0 ? "incoming" : "outgoing";
  for (const rule of rules.filter((r) => r.is_active !== false).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))) {
    const matchText = String(rule.match_text || "").toUpperCase();
    if (!matchText) continue;
    const matchType = rule.match_type || "contains";
    const matched = matchType === "exact" ? text === matchText : matchType === "starts_with" ? text.startsWith(matchText) : text.includes(matchText);
    if (!matched) continue;
    return {
      category: rule.category || "Needs Review",
      subcategory: rule.subcategory || null,
      business_status: rule.business_status || (direction === "incoming" ? "Business" : "Review"),
      business_use_percent: rule.business_use_percent ?? 100,
      allowable_status: rule.allowable_status || "Review",
      accountant_review: rule.category === "Needs Review" ? "Not reviewed" : "Reviewed",
    };
  }
  return {
    category: "Needs Review",
    subcategory: null,
    business_status: "Review",
    business_use_percent: 100,
    allowable_status: "Review",
    accountant_review: "Not reviewed",
  };
}

export function summarise(transactions: BookkeepingTransaction[]) {
  const taxYear = currentTaxYear();
  const rows = transactions.filter((row) => row.transaction_date >= taxYear.start && row.transaction_date <= taxYear.end);
  const normalisedRows = rows.map((row) => {
    const existingIncome = Number(row.allowable_income || 0);
    const existingExpense = Number(row.allowable_expense || 0);
    if (existingIncome || existingExpense) return row;
    return { ...row, ...calculateAllowables(row) };
  });
  const income = normalisedRows.reduce((sum, row) => sum + Number(row.allowable_income || 0), 0);
  const expenses = normalisedRows.reduce((sum, row) => sum + Number(row.allowable_expense || 0), 0);
  const profit = income - expenses;
  const basicTaxable = Math.max(0, Math.min(profit, 50270) - 12570);
  const higherTaxable = Math.max(0, profit - 50270);
  const incomeTax = basicTaxable * 0.2 + higherTaxable * 0.4;
  const class4 = Math.max(0, Math.min(profit, 50270) - 12570) * 0.06 + Math.max(0, profit - 50270) * 0.02;
  return {
    taxYear,
    rows: normalisedRows,
    income,
    expenses,
    profit,
    incomeTax,
    class4,
    taxReserve: incomeTax + class4,
    missingReceipts: rows.filter((row) => row.receipt_status === "To find" || row.receipt_status === "review_required").length,
    needsReview: rows.filter((row) => row.category === "Needs Review" || row.business_status === "Review" || row.allowable_status === "Review" || row.accountant_review === "Query for accountant").length,
    personalExcluded: rows.filter((row) => row.business_status === "Personal" || row.business_status === "Exclude").length,
    accountantQueries: rows.filter((row) => row.accountant_review === "Query for accountant").length,
    latestBalance: transactions.find((row) => row.bank_balance !== null && row.bank_balance !== undefined)?.bank_balance ?? null,
  };
}
