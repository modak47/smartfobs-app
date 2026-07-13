import {
  affectsProfit,
  isInDateRange,
  normaliseCanonicalDescription,
  parseMoneyToPence,
  type CategoryType,
  type ReviewStatus,
} from "./index";

export type ReportingJob = {
  id?: string | null;
  job_date: string;
  customer_name?: string | null;
  dealer_name?: string | null;
  vehicle?: string | null;
  registration?: string | null;
  job_type?: string | null;
  amount_charged?: number | string | null;
  notes?: string | null;
};

export type ReportingExpense = {
  id?: string | null;
  expense_date: string;
  supplier?: string | null;
  category?: string | null;
  description?: string | null;
  amount?: number | string | null;
  notes?: string | null;
};

export type ReportingBankTransaction = {
  id?: string | null;
  transaction_key?: string | null;
  transaction_date: string;
  description?: string | null;
  amount?: number | string | null;
  category?: string | null;
  category_type?: CategoryType | string | null;
  action?: "income" | "expense" | "drawings" | "ignore" | string | null;
  review_status?: ReviewStatus | string | null;
  matched_job_id?: string | null;
  matched_income_id?: string | null;
  matched_expense_id?: string | null;
};

export type ReportingMoneyRow = {
  sourceTable: "smartfobs_jobs" | "smartfobs_expenses" | "smartfobs_bank_transactions";
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  reason: string;
};

export type ExcludedBankRow = ReportingMoneyRow & {
  exclusionType: "matched" | "non_business" | "unreviewed" | "possible_duplicate";
  signedAmount: number;
  matchedRecordId?: string | null;
  matchedRecordSource?: "smartfobs_jobs" | "smartfobs_expenses";
};

export type ReportingReconciliation = {
  from: string;
  to: string;
  authoritativeJobIncome: ReportingMoneyRow[];
  authoritativeExpenseRecords: ReportingMoneyRow[];
  eligibleStandaloneBankIncome: ReportingMoneyRow[];
  eligibleStandaloneBankExpenses: ReportingMoneyRow[];
  matchedBankRowsExcluded: ExcludedBankRow[];
  nonBusinessBankRowsExcluded: ExcludedBankRow[];
  unreviewedBankRowsExcluded: ExcludedBankRow[];
  possibleDuplicateBankRowsExcluded: ExcludedBankRow[];
  finalIncome: number;
  finalExpenses: number;
  finalProfit: number;
};

const incomeCategories = [
  "Key Programming",
  "Dealer Work",
  "Shopify Sale",
  "Locksmith",
  "Bike Sales",
  "Contractor Work",
  "Other Income",
];

const expenseCategories = [
  "Keys / Stock",
  "Vehicle Stock Purchase",
  "Parts",
  "Consumables",
  "Fuel",
  "Vehicle Parts",
  "Vehicle Repairs",
  "MOT / Tax",
  "AutoTrader",
  "Shopify Fees",
  "Advertising",
  "Postage",
  "Software",
  "Phone",
  "Internet",
  "Insurance",
  "Tools & Equipment",
  "Diagnostic Equipment",
  "Clothing / PPE",
  "Training",
  "Bank Charges",
  "Bank Fees",
  "Repairs",
  "Miscellaneous",
];

function money(value: number | string | null | undefined) {
  return Number(value || 0);
}

function amountPence(value: number | string | null | undefined) {
  return parseMoneyToPence(value) || 0;
}

function rowId(row: { id?: string | null; transaction_key?: string | null }) {
  return row.id || row.transaction_key || "";
}

export function getReportingBankCategoryType(row: ReportingBankTransaction): CategoryType {
  const raw = String(row.category_type || "").toLowerCase();
  if (["income", "expense", "transfer", "owner", "tax", "ignored"].includes(raw)) return raw as CategoryType;
  if (row.action === "income") return "income";
  if (row.action === "expense") return "expense";
  if (row.action === "drawings") return "owner";
  if (incomeCategories.includes(row.category || "")) return "income";
  if (expenseCategories.includes(row.category || "")) return "expense";
  return money(row.amount) >= 0 ? "income" : "expense";
}

export function isReviewedReportingBankRow(row: ReportingBankTransaction) {
  return (row.review_status || "needs_review") === "reviewed";
}

export function isMatchedReportingBankRow(row: ReportingBankTransaction) {
  return Boolean(row.matched_job_id || row.matched_income_id || row.matched_expense_id);
}

export function isUncategorisedReportingBankRow(row: ReportingBankTransaction) {
  return !row.category || row.category === "Miscellaneous" || row.category === "Other Income";
}

function isValidBusinessBankRow(row: ReportingBankTransaction) {
  const categoryType = getReportingBankCategoryType(row);
  if (!affectsProfit(categoryType)) return false;
  if (isUncategorisedReportingBankRow(row)) return false;
  if (categoryType === "income" && money(row.amount) <= 0) return false;
  if (categoryType === "expense" && money(row.amount) >= 0) return false;
  return true;
}

function jobDescription(job: ReportingJob) {
  return [job.customer_name, job.dealer_name, job.vehicle, job.registration, job.job_type].filter(Boolean).join(" ") || "Job income";
}

function expenseDescription(expense: ReportingExpense) {
  return [expense.supplier, expense.description].filter(Boolean).join(" ") || expense.category || "Expense";
}

function bankDescription(row: ReportingBankTransaction) {
  return row.description || "Bank transaction";
}

function daysBetween(a: string, b: string) {
  const left = new Date(`${a}T12:00:00`).getTime();
  const right = new Date(`${b}T12:00:00`).getTime();
  return Math.abs(left - right) / 86_400_000;
}

function tokenSet(value: string) {
  return new Set(
    normaliseCanonicalDescription(value)
      .split(" ")
      .filter((token) => token.length >= 3),
  );
}

function descriptionsAreSimilar(left: string, right: string) {
  const a = normaliseCanonicalDescription(left);
  const b = normaliseCanonicalDescription(right);
  if (!a || !b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const leftTokens = tokenSet(a);
  const rightTokens = tokenSet(b);
  if (!leftTokens.size || !rightTokens.size) return true;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.min(leftTokens.size, rightTokens.size) >= 0.34;
}

function possibleDuplicateJob(bankRow: ReportingBankTransaction, jobs: ReportingJob[]) {
  const bankPence = amountPence(bankRow.amount);
  if (bankPence <= 0) return null;
  return jobs.find((job) =>
    amountPence(job.amount_charged) === bankPence &&
    daysBetween(bankRow.transaction_date, job.job_date) <= 5 &&
    descriptionsAreSimilar(bankDescription(bankRow), jobDescription(job))
  ) || null;
}

function possibleDuplicateExpense(bankRow: ReportingBankTransaction, expenses: ReportingExpense[]) {
  const bankPence = amountPence(bankRow.amount);
  if (bankPence >= 0) return null;
  return expenses.find((expense) =>
    amountPence(expense.amount) === Math.abs(bankPence) &&
    daysBetween(bankRow.transaction_date, expense.expense_date) <= 5 &&
    descriptionsAreSimilar(bankDescription(bankRow), expenseDescription(expense))
  ) || null;
}

function toJobMoneyRow(job: ReportingJob): ReportingMoneyRow {
  return {
    sourceTable: "smartfobs_jobs",
    id: job.id || "",
    date: job.job_date,
    description: jobDescription(job),
    amount: money(job.amount_charged),
    category: job.job_type || "Other Income",
    reason: "Included because jobs are authoritative income records and job_date is in the report period.",
  };
}

function toExpenseMoneyRow(expense: ReportingExpense): ReportingMoneyRow {
  return {
    sourceTable: "smartfobs_expenses",
    id: expense.id || "",
    date: expense.expense_date,
    description: expenseDescription(expense),
    amount: money(expense.amount),
    category: expense.category || "Miscellaneous",
    reason: "Included because expense records are authoritative expense records and expense_date is in the report period.",
  };
}

function toBankMoneyRow(row: ReportingBankTransaction, reason: string): ReportingMoneyRow {
  return {
    sourceTable: "smartfobs_bank_transactions",
    id: rowId(row),
    date: row.transaction_date,
    description: bankDescription(row),
    amount: Math.abs(money(row.amount)),
    category: row.category || "Uncategorised",
    reason,
  };
}

function toExcludedBankRow(
  row: ReportingBankTransaction,
  exclusionType: ExcludedBankRow["exclusionType"],
  reason: string,
  match?: { id?: string | null; source: "smartfobs_jobs" | "smartfobs_expenses" },
): ExcludedBankRow {
  return {
    ...toBankMoneyRow(row, reason),
    exclusionType,
    signedAmount: money(row.amount),
    matchedRecordId: match?.id || null,
    matchedRecordSource: match?.source,
  };
}

export function buildReportingReconciliation({
  jobs,
  expenses,
  bankTransactions,
  from,
  to,
}: {
  jobs: ReportingJob[];
  expenses: ReportingExpense[];
  bankTransactions: ReportingBankTransaction[];
  from: string;
  to: string;
}): ReportingReconciliation {
  const periodJobs = jobs.filter((job) => isInDateRange(job.job_date, from, to));
  const periodExpenses = expenses.filter((expense) => isInDateRange(expense.expense_date, from, to));
  const periodBankRows = bankTransactions.filter((row) => isInDateRange(row.transaction_date, from, to));

  const authoritativeJobIncome = periodJobs.map(toJobMoneyRow);
  const authoritativeExpenseRecords = periodExpenses.map(toExpenseMoneyRow);
  const eligibleStandaloneBankIncome: ReportingMoneyRow[] = [];
  const eligibleStandaloneBankExpenses: ReportingMoneyRow[] = [];
  const matchedBankRowsExcluded: ExcludedBankRow[] = [];
  const nonBusinessBankRowsExcluded: ExcludedBankRow[] = [];
  const unreviewedBankRowsExcluded: ExcludedBankRow[] = [];
  const possibleDuplicateBankRowsExcluded: ExcludedBankRow[] = [];

  periodBankRows.forEach((row) => {
    if (isMatchedReportingBankRow(row)) {
      matchedBankRowsExcluded.push(toExcludedBankRow(row, "matched", "Excluded because the bank row is already matched to a job, income or expense record."));
      return;
    }

    if (!isReviewedReportingBankRow(row)) {
      unreviewedBankRowsExcluded.push(toExcludedBankRow(row, "unreviewed", "Excluded because unreviewed bank rows do not affect final reports."));
      return;
    }

    if (!isValidBusinessBankRow(row)) {
      nonBusinessBankRowsExcluded.push(toExcludedBankRow(row, "non_business", "Excluded because the bank row is uncategorised, non-business, owner/drawings, transfer, tax or ignored."));
      return;
    }

    const duplicateJob = possibleDuplicateJob(row, periodJobs);
    if (duplicateJob) {
      possibleDuplicateBankRowsExcluded.push(toExcludedBankRow(row, "possible_duplicate", "Excluded from reports because it closely matches an authoritative job record and needs confirmation before matching.", { id: duplicateJob.id, source: "smartfobs_jobs" }));
      return;
    }

    const duplicateExpense = possibleDuplicateExpense(row, periodExpenses);
    if (duplicateExpense) {
      possibleDuplicateBankRowsExcluded.push(toExcludedBankRow(row, "possible_duplicate", "Excluded from reports because it closely matches an authoritative expense record and needs confirmation before matching.", { id: duplicateExpense.id, source: "smartfobs_expenses" }));
      return;
    }

    const categoryType = getReportingBankCategoryType(row);
    if (categoryType === "income") {
      eligibleStandaloneBankIncome.push(toBankMoneyRow(row, "Included because this is a reviewed, unmatched, business income bank row with no matching authoritative job record."));
    } else if (categoryType === "expense") {
      eligibleStandaloneBankExpenses.push(toBankMoneyRow(row, "Included because this is a reviewed, unmatched, business expense bank row with no matching authoritative expense record."));
    }
  });

  const finalIncome =
    authoritativeJobIncome.reduce((sum, row) => sum + row.amount, 0) +
    eligibleStandaloneBankIncome.reduce((sum, row) => sum + row.amount, 0);
  const finalExpenses =
    authoritativeExpenseRecords.reduce((sum, row) => sum + row.amount, 0) +
    eligibleStandaloneBankExpenses.reduce((sum, row) => sum + row.amount, 0);

  return {
    from,
    to,
    authoritativeJobIncome,
    authoritativeExpenseRecords,
    eligibleStandaloneBankIncome,
    eligibleStandaloneBankExpenses,
    matchedBankRowsExcluded,
    nonBusinessBankRowsExcluded,
    unreviewedBankRowsExcluded,
    possibleDuplicateBankRowsExcluded,
    finalIncome,
    finalExpenses,
    finalProfit: finalIncome - finalExpenses,
  };
}
