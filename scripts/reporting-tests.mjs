import assert from "node:assert/strict";

const reportingModulePath = process.env.REPORTING_MODULE_PATH || "../lib/bookkeeping/reporting.ts";
const { buildReportingReconciliation } = await import(reportingModulePath);

const job = {
  id: "job-1",
  job_date: "2026-04-10",
  customer_name: "Customer",
  job_type: "Key Programming",
  amount_charged: 100,
};

const expense = {
  id: "expense-1",
  expense_date: "2026-04-10",
  supplier: "Parts Supplier",
  category: "Parts",
  description: "Parts Supplier",
  amount: 50,
};

const baseBank = {
  transaction_date: "2026-04-10",
  review_status: "reviewed",
  matched_job_id: null,
  matched_expense_id: null,
  matched_income_id: null,
};

function report(bankTransactions, from = "2026-04-01", to = "2026-04-30") {
  return buildReportingReconciliation({
    jobs: [job],
    expenses: [expense],
    bankTransactions,
    from,
    to,
  });
}

let result = report([
  { ...baseBank, id: "bank-income-match", description: "Customer key", amount: 100, category: "Key Programming", category_type: "income", matched_job_id: "job-1" },
]);
assert.equal(result.finalIncome, 100, "£100 job plus matched £100 bank transaction reports £100, not £200");
assert.equal(result.matchedBankRowsExcluded.length, 1);

result = report([
  { ...baseBank, id: "bank-expense-match", description: "Parts Supplier", amount: -50, category: "Parts", category_type: "expense", matched_expense_id: "expense-1" },
]);
assert.equal(result.finalExpenses, 50, "£50 expense plus matched -£50 bank transaction reports £50, not £100");
assert.equal(result.matchedBankRowsExcluded.length, 1);

result = buildReportingReconciliation({
  jobs: [],
  expenses: [],
  bankTransactions: [
    { ...baseBank, id: "standalone-income", description: "Standalone locksmith", amount: 75, category: "Locksmith", category_type: "income" },
  ],
  from: "2026-04-01",
  to: "2026-04-30",
});
assert.equal(result.finalIncome, 75, "reviewed unmatched business bank income counts once");

result = buildReportingReconciliation({
  jobs: [],
  expenses: [],
  bankTransactions: [
    { ...baseBank, id: "standalone-expense", description: "Fuel", amount: -25, category: "Fuel", category_type: "expense" },
  ],
  from: "2026-04-01",
  to: "2026-04-30",
});
assert.equal(result.finalExpenses, 25, "reviewed unmatched business bank expense counts once");

result = buildReportingReconciliation({
  jobs: [],
  expenses: [],
  bankTransactions: [
    { ...baseBank, id: "unreviewed", description: "Fuel", amount: -25, category: "Fuel", category_type: "expense", review_status: "needs_review" },
  ],
  from: "2026-04-01",
  to: "2026-04-30",
});
assert.equal(result.finalExpenses, 0, "unreviewed bank rows do not affect final totals");

for (const [category, categoryType] of [
  ["Drawings", "owner"],
  ["Transfer / Ignore", "transfer"],
  ["Personal transaction", "ignored"],
]) {
  result = buildReportingReconciliation({
    jobs: [],
    expenses: [],
    bankTransactions: [
      { ...baseBank, id: category, description: category, amount: -25, category, category_type: categoryType },
    ],
    from: "2026-04-01",
    to: "2026-04-30",
  });
  assert.equal(result.finalProfit, 0, `${category} does not affect profit`);
}

const fullYearRows = [
  { ...baseBank, id: "apr-income", transaction_date: "2026-04-10", description: "Standalone locksmith", amount: 75, category: "Locksmith", category_type: "income" },
  { ...baseBank, id: "jul-expense", transaction_date: "2026-07-10", description: "Fuel", amount: -25, category: "Fuel", category_type: "expense" },
];
const monthly = buildReportingReconciliation({ jobs: [], expenses: [], bankTransactions: fullYearRows, from: "2026-04-01", to: "2026-04-30" });
const quarterly = buildReportingReconciliation({ jobs: [], expenses: [], bankTransactions: fullYearRows, from: "2026-04-06", to: "2026-07-05" });
const taxYear = buildReportingReconciliation({ jobs: [], expenses: [], bankTransactions: fullYearRows, from: "2026-04-06", to: "2027-04-05" });
assert.equal(monthly.finalIncome, 75, "monthly totals use reporting function");
assert.equal(quarterly.finalIncome, 75, "quarterly totals use reporting function");
assert.equal(taxYear.finalIncome, 75, "tax-year totals use reporting function");
assert.equal(taxYear.finalExpenses, 25, "tax-year expense totals use reporting function");

console.log("Reporting tests passed");
