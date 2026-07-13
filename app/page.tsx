"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  createTransactionHash,
  formatGBP,
  formatUKDate,
  getCurrentTaxYearStart,
  getTaxYearEnd,
  getTaxYearQuarters,
  isInDateRange,
  parseMoneyToPence,
  parseUKDate,
  penceToPounds,
  type CategoryType,
  type ReviewStatus,
} from "@/lib/bookkeeping";

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthKey() {
  return getLocalDateKey().slice(0, 7);
}

function addMonths(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function isDateInMonth(dateString: string, monthKey: string) {
  return dateString.startsWith(`${monthKey}-`);
}

const today = getLocalDateKey();

const theme = {
  page: "bg-[#252a34] text-[#f2f2f2]",
  card: "border border-[#3a404d] bg-[#111317]",
  accent: "bg-[#d7d7d7] text-[#111317]",
  accentText: "text-[#d7d7d7]",
  muted: "text-[#b8bcc6]",
  faint: "text-[#8d929e]",
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
  "Miscellaneous",
];

function categoriesForAction(action: BankRow["action"]) {
  if (action === "income") return incomeCategories;
  if (action === "expense") return expenseCategories;
  if (action === "drawings") return ["Drawings"];
  return ["Transfer / Ignore"];
}

function categoryTypeForAction(action: BankRow["action"]): CategoryType {
  if (action === "income") return "income";
  if (action === "expense") return "expense";
  if (action === "drawings") return "owner";
  return "transfer";
}

type Job = {
  id: string; job_date: string; customer_name: string | null; dealer_name: string | null;
  vehicle: string | null; registration: string | null; job_type: string | null;
  amount_charged: number | string | null; payment_method: string | null;
  payment_status: string | null; notes: string | null;
};

type Expense = {
  id: string; expense_date: string; supplier: string | null; category: string | null;
  description: string | null; amount: number | string | null; payment_method: string | null;
  notes: string | null;
};

type BankTransaction = BankRow & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  transaction_type?: string | null;
  money_in?: number | string | null;
  money_out?: number | string | null;
  bank_reference?: string | null;
  source_filename?: string | null;
  import_batch_id?: string | null;
  transaction_hash?: string | null;
  category_type?: CategoryType | string | null;
  review_status?: ReviewStatus | string | null;
  notes?: string | null;
  matched_job_id?: string | null;
  matched_income_id?: string | null;
  matched_expense_id?: string | null;
};

type BankRow = {
  transaction_key: string;
  transaction_date: string;
  type: string;
  description: string;
  amount: number;
  amountPence: number;
  balance: number;
  balancePence: number | null;
  action: "income" | "expense" | "drawings" | "ignore";
  category: string;
  category_type: CategoryType;
  review_status: ReviewStatus;
  notes: string;
  bank_reference: string;
  source_filename: string;
  transaction_hash: string;
  duplicate: boolean;
};

type BankRejectedRow = {
  rowNumber: number;
  raw: string;
  reason: string;
};

type BankImportPreview = {
  filename: string;
  detectedColumns: Record<string, string>;
  validRows: BankRow[];
  rejectedRows: BankRejectedRow[];
  duplicateCount: number;
  dateFrom: string | null;
  dateTo: string | null;
};

type ImportResult = {
  importedRows: number;
  duplicateRows: number;
  rejectedRows: number;
  batchId: string | null;
  fallbackMode: boolean;
};

type BankFilters = {
  search: string;
  dateFrom: string;
  dateTo: string;
  direction: "all" | "in" | "out";
  category: string;
  reviewStatus: "all" | "needs_review" | "rule_applied" | "reviewed";
  match: "all" | "matched" | "unmatched";
  importBatch: string;
  sort: "newest" | "oldest" | "highest" | "lowest";
};

type TaxSettings = {
  otherIncomeThisTaxYear: number;
  personalAllowance: number;
  incomeTaxBasicRate: number;
  incomeTaxHigherRate: number;
  basicRateLimit: number;
  class4LowerLimit: number;
  class4UpperLimit: number;
  class4MainRate: number;
  class4AdditionalRate: number;
  taxSavingsAlreadySetAside: number;
};

type StockSettings = {
  motorcycleStockCount: number;
  motorcycleStockCostValue: number;
  motorcycleExpectedSaleValue: number;
  keyStockCount: number;
  averageKeyCost: number;
  averageKeyRetailPrice: number;
};

type HsbcCallbackStatus = "callback-received" | "error" | "invalid-callback";

type SmartFobsView = "home" | "jobs" | "expenses" | "reports" | "bank";

const defaultStockSettings: StockSettings = {
  motorcycleStockCount: 0,
  motorcycleStockCostValue: 0,
  motorcycleExpectedSaleValue: 0,
  keyStockCount: 0,
  averageKeyCost: 0,
  averageKeyRetailPrice: 0,
};

const defaultTaxSettings: TaxSettings = {
  otherIncomeThisTaxYear: 0,
  personalAllowance: 12570,
  incomeTaxBasicRate: 0.2,
  incomeTaxHigherRate: 0.4,
  basicRateLimit: 37700,
  class4LowerLimit: 12570,
  class4UpperLimit: 50270,
  class4MainRate: 0.06,
  class4AdditionalRate: 0.02,
  taxSavingsAlreadySetAside: 0,
};

export default function HomePage({
  initialView = "home",
  initialHsbcStatus = null,
}: {
  initialView?: SmartFobsView;
  initialHsbcStatus?: HsbcCallbackStatus | null;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [bankRows, setBankRows] = useState<BankRow[]>([]);
  const [bankImportPreview, setBankImportPreview] = useState<BankImportPreview | null>(null);
  const [bankImportResult, setBankImportResult] = useState<ImportResult | null>(null);
  const [selectedBankTransaction, setSelectedBankTransaction] = useState<BankTransaction | null>(null);
  const [bankFilters, setBankFilters] = useState<BankFilters>({
    search: "",
    dateFrom: "",
    dateTo: "",
    direction: "all",
    category: "all",
    reviewStatus: "all",
    match: "all",
    importBatch: "all",
    sort: "newest",
  });
  const [view, setView] = useState<SmartFobsView>(initialView);
  const [showForm, setShowForm] = useState<"job" | "expense" | null>(null);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(defaultTaxSettings);
  const [stockSettings, setStockSettings] = useState<StockSettings>(defaultStockSettings);
  const [receiptName, setReceiptName] = useState("");
  const [receiptPreview, setReceiptPreview] = useState("");
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [hsbcStatus] = useState<HsbcCallbackStatus | null>(initialHsbcStatus);

  const [job, setJob] = useState({
    job_date: today,
    customer_name: "",
    dealer_name: "",
    vehicle: "",
    registration: "",
    job_type: "Smart Key",
    amount_charged: "",
    payment_method: "Bank Transfer",
    payment_status: "Paid",
    notes: "",
  });

  const [expense, setExpense] = useState({
    expense_date: today,
    supplier: "",
    category: "Keys / Stock",
    description: "",
    amount: "",
    payment_method: "Bank Transfer",
    notes: "",
    linked_job_or_bike: "",
  });

  useEffect(() => {
    loadData();
    loadStockValues();
  }, []);

  async function loadData() {
    const [jobsResult, expensesResult, bankResult] = await Promise.all([
      supabase.from("smartfobs_jobs").select("*").order("job_date", { ascending: false }),
      supabase.from("smartfobs_expenses").select("*").order("expense_date", { ascending: false }),
      supabase.from("smartfobs_bank_transactions").select("*").order("transaction_date", { ascending: false }).limit(500),
    ]);
    setJobs((jobsResult.data || []) as Job[]);
    setExpenses((expensesResult.data || []) as Expense[]);
    setBankTransactions((bankResult.data || []) as BankTransaction[]);
  }

  function updateStockSetting(field: keyof StockSettings, value: number) {
    setStockSettings((current) => ({ ...current, [field]: Math.max(0, value) }));
  }

  async function loadStockValues() {
    const { data, error } = await supabase
      .from("smartfobs_settings")
      .select("value")
      .eq("key", "stock_values")
      .maybeSingle();

    if (error) {
      console.error("Could not load stock values", error);
      return;
    }

    if (!data?.value || typeof data.value !== "object" || Array.isArray(data.value)) {
      setStockSettings(defaultStockSettings);
      return;
    }

    const saved = data.value as Partial<Record<keyof StockSettings, unknown>>;
    const values = { ...defaultStockSettings };
    (Object.keys(values) as (keyof StockSettings)[]).forEach((key) => {
      const value = Number(saved[key]);
      values[key] = Number.isFinite(value) ? Math.max(0, value) : 0;
    });
    setStockSettings(values);
  }

  async function saveStockValues(updatedValues: StockSettings) {
    const { error } = await supabase.from("smartfobs_settings").upsert({
      key: "stock_values",
      value: updatedValues,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    if (error) return alert(`Could not save stock values: ${error.message}`);
    setStockSettings(updatedValues);
    alert("Stock values saved");
  }

  function openJob(type: string) {
    setJob({
      ...job,
      job_type: type,
      job_date: today,
      payment_method: type === "Shopify Sale" ? "Shopify" : "Bank Transfer",
      payment_status: "Paid",
    });
    setShowForm("job");
  }

  async function addJob() {
    if (!job.amount_charged) return alert("Amount required");

    const { error } = await supabase.from("smartfobs_jobs").insert({
      ...job,
      amount_charged: Number(job.amount_charged),
      source: job.payment_method === "Shopify" ? "Shopify" : "Manual",
    });

    if (error) return alert(error.message);

    setJob({
      job_date: today,
      customer_name: "",
      dealer_name: "",
      vehicle: "",
      registration: "",
      job_type: "Smart Key",
      amount_charged: "",
      payment_method: "Bank Transfer",
      payment_status: "Paid",
      notes: "",
    });

    setShowForm(null);
    loadData();
  }

  async function addExpense() {
    if (!expense.amount) return alert("Amount required");

    const { linked_job_or_bike, ...expenseFields } = expense;
    const linkedNote = linked_job_or_bike.trim() ? `Used for: ${linked_job_or_bike.trim()}` : "";
    const combinedNotes = [expense.notes.trim(), linkedNote].filter(Boolean).join("\n");
    const { error } = await supabase.from("smartfobs_expenses").insert({
      ...expenseFields,
      amount: Number(expense.amount),
      notes: combinedNotes,
      // TODO: Upload receipt files to the Supabase "receipts" bucket once receipt_url is added.
    });

    if (error) return alert(error.message);

    setExpense({
      expense_date: today,
      supplier: "",
      category: "Keys / Stock",
      description: "",
      amount: "",
      payment_method: "Bank Transfer",
      notes: "",
      linked_job_or_bike: "",
    });

    setReceiptName("");
    setReceiptPreview("");
    setShowForm(null);
    loadData();
  }

  async function deleteJob(id: string) {
    if (!confirm("Delete this job?")) return;
    const { error } = await supabase.from("smartfobs_jobs").delete().eq("id", id);
    if (error) return alert(error.message);
    loadData();
  }

  async function deleteExpense(id: string) {
    if (!confirm("Delete this expense?")) return;
    const { error } = await supabase.from("smartfobs_expenses").delete().eq("id", id);
    if (error) return alert(error.message);
    loadData();
  }

  async function saveEditedJob() {
    if (!editingJob) return;
    if (!editingJob.amount_charged) return alert("Amount required");
    const { error } = await supabase.from("smartfobs_jobs").update({
      customer_name: editingJob.customer_name,
      vehicle: editingJob.vehicle,
      registration: editingJob.registration,
      job_type: editingJob.job_type,
      amount_charged: Number(editingJob.amount_charged),
      job_date: editingJob.job_date,
      notes: editingJob.notes,
    }).eq("id", editingJob.id);
    if (error) return alert(error.message);
    setEditingJob(null);
    await loadData();
  }

  async function saveEditedExpense() {
    if (!editingExpense) return;
    if (!editingExpense.amount) return alert("Amount required");
    const { error } = await supabase.from("smartfobs_expenses").update({
      supplier: editingExpense.supplier,
      category: editingExpense.category,
      amount: Number(editingExpense.amount),
      expense_date: editingExpense.expense_date,
      description: editingExpense.description,
      notes: editingExpense.notes,
    }).eq("id", editingExpense.id);
    if (error) return alert(error.message);
    setEditingExpense(null);
    await loadData();
  }

  function parseCSVLine(line: string) {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else current += char;
    }

    result.push(current);
    return result.map((v) => v.trim().replace(/^"|"$/g, ""));
  }

  function normaliseHeader(header: string) {
    return header.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function pickColumn(headers: string[], variants: string[]) {
    const normalisedVariants = variants.map(normaliseHeader);
    return headers.find((header) => normalisedVariants.includes(normaliseHeader(header)));
  }

  function getRowValue(row: Record<string, string>, column?: string) {
    return column ? row[column]?.trim() || "" : "";
  }

  function suggestBankTreatment(description: string, amount: number): Pick<BankRow, "action" | "category" | "category_type" | "review_status"> {
    const d = description.toLowerCase();
    const contains = (...terms: string[]) => terms.some((term) => d.includes(term));
    const result = (action: BankRow["action"], category: string, categoryType: CategoryType, reviewStatus: ReviewStatus = "rule_applied") => ({
      action,
      category,
      category_type: categoryType,
      review_status: reviewStatus,
    });

    // When Shopify order import is added, change positive payouts to Ignore / Shopify Payout to avoid double counting.
    if (d.includes("shopify") && amount > 0) return result("income", "Shopify Sale", "income");
    if (d.includes("shopify") && amount < 0) return result("expense", "Shopify Fees", "expense");
    if (contains("dan byrne", "drawings")) return result("drawings", "Drawings", "owner");
    if (contains("sell your motorbike", "yesmoto", "software dev")) return result("income", "Contractor Work", "income");
    if (contains("motorcycle", "moto", "dealer", "dg motorcycle")) return result("income", "Dealer Work", "income");
    if (contains("bike sale", "vehicle sale", "sold bike")) return result("income", "Bike Sales", "income");
    if (contains("autotrader", "auto trader")) return result("expense", "AutoTrader", "expense");
    if (contains("royal mail", "post office", "postage")) return result("expense", "Postage", "expense");
    if (contains("shell", "bp", "esso", "texaco", "fuel", "service station", "university way", "sf brighton", "brighton s/stn", "fbrighton")) return result("expense", "Fuel", "expense");
    if (contains("honda", "yamaha", "fowlers", "ebay", "parts")) return result("expense", "Parts", "expense");
    if (contains("screwfix", "toolstation", "machine mart")) return result("expense", "Tools & Equipment", "expense");
    if (contains("garden centre", "clothing", "workwear", "t shirt", "t-shirt")) return result("expense", "Clothing / PPE", "expense");
    if (contains("ee", "vodafone", "o2", "three")) return result("expense", "Phone", "expense");
    if (d.includes("insurance")) return result("expense", "Insurance", "expense");
    if (contains("natwest", "transfer", "savings")) return result("ignore", "Transfer / Ignore", "transfer");
    if (amount > 0) return result("income", "Other Income", "income", "needs_review");
    return result("expense", "Miscellaneous", "expense", "needs_review");
  }

  async function handleBankCSV(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) return alert("Please upload a CSV file.");

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return alert("The CSV did not contain any transaction rows.");

    const headers = parseCSVLine(lines[0]);
    const columns = {
      date: pickColumn(headers, ["Date", "Transaction Date"]),
      description: pickColumn(headers, ["Description", "Details"]),
      type: pickColumn(headers, ["Type", "Transaction Type"]),
      paidIn: pickColumn(headers, ["Paid In", "Money In", "Credit"]),
      paidOut: pickColumn(headers, ["Paid Out", "Money Out", "Debit"]),
      amount: pickColumn(headers, ["Amount", "Value"]),
      balance: pickColumn(headers, ["Balance"]),
      reference: pickColumn(headers, ["Reference", "Bank Reference"]),
    };

    const { data: existing } = await supabase
      .from("smartfobs_bank_transactions")
      .select("transaction_key, transaction_hash");

    const existingKeys = new Set((existing || []).flatMap((row: { transaction_key?: string | null; transaction_hash?: string | null }) => [row.transaction_key, row.transaction_hash].filter(Boolean) as string[]));
    const seenInFile = new Set<string>();
    const validRows: BankRow[] = [];
    const rejectedRows: BankRejectedRow[] = [];

    lines.slice(1).forEach((line, index) => {
      const values = parseCSVLine(line);
      const row = Object.fromEntries(headers.map((header, i) => [header, values[i] || ""]));
      const rowNumber = index + 2;
      const transactionDate = parseUKDate(getRowValue(row, columns.date));
      const description = getRowValue(row, columns.description);
      const transactionType = getRowValue(row, columns.type);
      const bankReference = getRowValue(row, columns.reference);

      const paidInPence = parseMoneyToPence(getRowValue(row, columns.paidIn));
      const paidOutPence = parseMoneyToPence(getRowValue(row, columns.paidOut));
      const amountPenceFromSingleColumn = parseMoneyToPence(getRowValue(row, columns.amount));
      const balancePence = parseMoneyToPence(getRowValue(row, columns.balance));
      let amountPence: number | null = null;

      if (paidInPence && paidInPence > 0) amountPence = paidInPence;
      else if (paidOutPence && paidOutPence > 0) amountPence = -paidOutPence;
      else amountPence = amountPenceFromSingleColumn;

      if (!transactionDate) {
        rejectedRows.push({ rowNumber, raw: line, reason: "Missing or invalid date" });
        return;
      }
      if (!description) {
        rejectedRows.push({ rowNumber, raw: line, reason: "Missing description/details" });
        return;
      }
      if (amountPence === null || !Number.isFinite(amountPence) || amountPence === 0) {
        rejectedRows.push({ rowNumber, raw: line, reason: "Missing, zero or invalid amount" });
        return;
      }

      const amount = penceToPounds(amountPence);
      const transactionHash = createTransactionHash({
        transactionDate,
        description,
        amountPence,
        bankReference,
      });
      const transactionKey = transactionHash;
      const duplicate = existingKeys.has(transactionHash) || seenInFile.has(transactionHash);
      seenInFile.add(transactionHash);

      validRows.push({
        transaction_key: transactionKey,
        transaction_date: transactionDate,
        type: transactionType,
        description,
        amountPence,
        amount,
        balancePence,
        balance: balancePence === null ? 0 : penceToPounds(balancePence),
        bank_reference: bankReference,
        source_filename: file.name,
        transaction_hash: transactionHash,
        notes: "",
        duplicate,
        ...suggestBankTreatment(description, amount),
      });
    });

    const needsReview = (row: BankRow) => row.category === "Miscellaneous" || row.category === "Other Income";
    const sortedRows = validRows.sort((a, b) => Number(b.duplicate) - Number(a.duplicate) || Number(needsReview(b)) - Number(needsReview(a)));
    const dates = sortedRows.map((row) => row.transaction_date).sort();
    setBankRows(sortedRows);
    setBankImportPreview({
      filename: file.name,
      detectedColumns: Object.fromEntries(Object.entries(columns).map(([key, value]) => [key, value || "Not found"])),
      validRows: sortedRows,
      rejectedRows,
      duplicateCount: sortedRows.filter((row) => row.duplicate).length,
      dateFrom: dates[0] || null,
      dateTo: dates.at(-1) || null,
    });
    setBankImportResult(null);
    setView("bank");
  }

  function updateBankRow(index: number, changes: Partial<BankRow>) {
    setBankRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...changes } : row))
    );
  }

  async function importBankRows() {
    if (!bankRows.length) return alert("No bank rows to import");
    if (!confirm("Import these bank transactions? Duplicates will be skipped and transactions will still need checking.")) return;

    const { data: existing } = await supabase
      .from("smartfobs_bank_transactions")
      .select("transaction_key, transaction_hash");

    const existingKeys = new Set((existing || []).flatMap((row: { transaction_key?: string | null; transaction_hash?: string | null }) => [row.transaction_key, row.transaction_hash].filter(Boolean) as string[]));
    const preview = bankImportPreview;
    let batchId: string | null = null;
    let fallbackMode = false;
    let importedRows = 0;
    let skippedDuplicates = 0;
    let failed = 0;

    if (preview) {
      const { data: batch, error: batchError } = await supabase
        .from("smartfobs_bank_import_batches")
        .insert({
          filename: preview.filename,
          total_rows: preview.validRows.length + preview.rejectedRows.length,
          imported_rows: 0,
          duplicate_rows: preview.duplicateCount,
          rejected_rows: preview.rejectedRows.length,
          date_from: preview.dateFrom,
          date_to: preview.dateTo,
          status: "pending",
        })
        .select("id")
        .single();

      if (!batchError) batchId = batch?.id || null;
      else fallbackMode = true;
    }

    for (const row of bankRows) {
      if (existingKeys.has(row.transaction_key) || existingKeys.has(row.transaction_hash)) {
        skippedDuplicates++;
        continue;
      }

      const { error: bankError } = await supabase.from("smartfobs_bank_transactions").insert({
        transaction_key: row.transaction_key,
        transaction_date: row.transaction_date,
        type: row.type,
        transaction_type: row.type,
        description: row.description,
        amount: row.amount,
        money_in: row.amountPence > 0 ? row.amount : null,
        money_out: row.amountPence < 0 ? Math.abs(row.amount) : null,
        balance: row.balance,
        bank_reference: row.bank_reference,
        source_filename: row.source_filename,
        import_batch_id: batchId,
        transaction_hash: row.transaction_hash,
        action: row.action,
        category: row.category,
        category_type: row.category_type,
        review_status: row.review_status,
        notes: row.notes,
      });

      if (bankError) {
        fallbackMode = true;
        const { error: fallbackError } = await supabase.from("smartfobs_bank_transactions").insert({
          transaction_key: row.transaction_key,
          transaction_date: row.transaction_date,
          type: row.type,
          description: row.description,
          amount: row.amount,
          balance: row.balance,
          action: row.action,
          category: row.category,
        });
        if (fallbackError) {
          failed++;
          continue;
        }
      }

      importedRows++;
      existingKeys.add(row.transaction_key);
      existingKeys.add(row.transaction_hash);
    }

    if (batchId) {
      await supabase
        .from("smartfobs_bank_import_batches")
        .update({
          imported_rows: importedRows,
          duplicate_rows: skippedDuplicates,
          rejected_rows: preview?.rejectedRows.length || 0,
          status: failed ? "completed_with_errors" : "completed",
        })
        .eq("id", batchId);
    }

    setBankImportResult({
      importedRows,
      duplicateRows: skippedDuplicates,
      rejectedRows: preview?.rejectedRows.length || 0,
      batchId,
      fallbackMode,
    });
    alert([
      `Imported bank transactions: ${importedRows}`,
      `Skipped duplicates: ${skippedDuplicates}`,
      `Rejected CSV rows: ${preview?.rejectedRows.length || 0}`,
      ...(failed ? [`Failed rows: ${failed}`] : []),
      fallbackMode ? "Enhanced import fields need the Supabase migration before full batch/review metadata can be stored." : "Import batch recorded.",
    ].join("\n"));
    setBankRows([]);
    setBankImportPreview(null);
    loadData();
  }
  function exportCSV(type: "jobs" | "expenses") {
    const rows =
      type === "jobs"
        ? jobs.map((j) => ({
            date: j.job_date,
            customer: j.customer_name,
            dealer: j.dealer_name,
            vehicle: j.vehicle,
            registration: j.registration,
            job_type: j.job_type,
            payment_method: j.payment_method,
            payment_status: j.payment_status,
            amount: j.amount_charged,
            notes: j.notes,
          }))
        : expenses.map((e) => ({
            date: e.expense_date,
            supplier: e.supplier,
            category: e.category,
            description: e.description,
            payment_method: e.payment_method,
            amount: e.amount,
            notes: e.notes,
          }));

    const csv = [
      Object.keys(rows[0] || {}).join(","),
      ...rows.map((row) =>
        Object.values(row)
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartfobs-${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCSV(filename: string, rows: Record<string, string | number | null | undefined>[]) {
    const csv = [
      Object.keys(rows[0] || {}).join(","),
      ...rows.map((row) =>
        Object.values(row)
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportBankTransactionsCSV() {
    downloadCSV("smartfobs-filtered-bank-transactions.csv", filteredBankTransactions.map((row) => ({
      date: formatUKDate(row.transaction_date),
      description: row.description,
      amount: Number(row.amount || 0).toFixed(2),
      category: row.category,
      category_type: row.category_type,
      review_status: row.review_status,
      match_status: row.matched_job_id || row.matched_income_id || row.matched_expense_id ? "Matched" : "Unmatched",
      reference: row.bank_reference,
      source_filename: row.source_filename,
      import_batch_id: row.import_batch_id,
      notes: row.notes,
    })));
  }

  function exportQuarterlySummaryCSV() {
    downloadCSV("smartfobs-quarterly-summary.csv", quarterlySummary.map((row) => ({
      quarter: row.label,
      date_from: formatUKDate(row.from),
      date_to: formatUKDate(row.to),
      income: row.income.toFixed(2),
      expenses: row.expenses.toFixed(2),
      profit: row.profit.toFixed(2),
      uncategorised_transactions: row.uncategorised,
      unreviewed_transactions: row.unreviewed,
      status: row.status,
      submission_status: "Not submitted",
    })));
  }

  const totals = useMemo(() => {
    const now = new Date(`${today}T12:00:00`);
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1));
    const weekStart = startOfWeek.toISOString().slice(0, 10);
    const taxStart = getCurrentTaxYearStart(today);
    const taxEnd = getTaxYearEnd(taxStart);
    const sumJobs = (from: string, to = today) => jobs.filter((j) => j.job_date >= from && j.job_date <= to).reduce((sum, j) => sum + Number(j.amount_charged || 0), 0);
    const sumExpenses = (from: string, to = today) => expenses.filter((e) => e.expense_date >= from && e.expense_date <= to).reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const period = (from: string, to = today) => {
      const income = sumJobs(from, to);
      const expensesTotal = sumExpenses(from, to);
      return { income, expenses: expensesTotal, profit: income - expensesTotal };
    };
    const allIncome = jobs.reduce((sum, j) => sum + Number(j.amount_charged || 0), 0);
    const allExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const selectedMonthJobs = jobs.filter((job) => isDateInMonth(job.job_date, selectedMonth));
    const selectedMonthExpenses = expenses.filter((expense) => isDateInMonth(expense.expense_date, selectedMonth));
    const selectedMonthIncome = selectedMonthJobs.reduce((sum, job) => sum + Number(job.amount_charged || 0), 0);
    const selectedMonthExpenseTotal = selectedMonthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    return {
      income: allIncome,
      expenseTotal: allExpenses,
      profit: allIncome - allExpenses,
      today: period(today),
      week: period(weekStart),
      selectedMonth: {
        income: selectedMonthIncome,
        expenses: selectedMonthExpenseTotal,
        profit: selectedMonthIncome - selectedMonthExpenseTotal,
        jobs: selectedMonthJobs.length,
      },
      taxYear: period(taxStart, taxEnd),
      taxStart,
      taxEnd,
      jobCount: jobs.length,
    };
  }, [jobs, expenses, selectedMonth]);

  const taxEstimate = useMemo(() => {
    const businessProfit = totals.taxYear.profit;
    const totalTaxableIncomeBeforeAllowance = businessProfit + taxSettings.otherIncomeThisTaxYear;
    const taxableIncome = Math.max(0, totalTaxableIncomeBeforeAllowance - taxSettings.personalAllowance);
    const basicRateIncome = Math.min(taxableIncome, taxSettings.basicRateLimit);
    const higherRateIncome = Math.max(0, taxableIncome - taxSettings.basicRateLimit);
    const incomeTax =
      basicRateIncome * taxSettings.incomeTaxBasicRate +
      higherRateIncome * taxSettings.incomeTaxHigherRate;

    const class4MainBand = Math.max(
      0,
      Math.min(businessProfit, taxSettings.class4UpperLimit) - taxSettings.class4LowerLimit,
    );
    const class4AdditionalBand = Math.max(0, businessProfit - taxSettings.class4UpperLimit);
    const class4NI =
      class4MainBand * taxSettings.class4MainRate +
      class4AdditionalBand * taxSettings.class4AdditionalRate;
    const estimatedTotalTax = incomeTax + class4NI;
    const recommendedTaxPot = estimatedTotalTax;

    return {
      businessProfit,
      incomeTax,
      class4NI,
      estimatedTotalTax,
      recommendedTaxPot,
      taxPotDifference: taxSettings.taxSavingsAlreadySetAside - recommendedTaxPot,
    };
  }, [taxSettings, totals.taxYear.profit]);

  const stockValues = useMemo(() => {
    const motorcycleExpectedGrossProfit = stockSettings.motorcycleExpectedSaleValue - stockSettings.motorcycleStockCostValue;
    const keyStockCostValue = stockSettings.keyStockCount * stockSettings.averageKeyCost;
    const keyStockRetailValue = stockSettings.keyStockCount * stockSettings.averageKeyRetailPrice;
    const keyStockExpectedGrossProfit = keyStockRetailValue - keyStockCostValue;
    const totalStockCostValue = stockSettings.motorcycleStockCostValue + keyStockCostValue;
    const totalPotentialRetailValue = stockSettings.motorcycleExpectedSaleValue + keyStockRetailValue;
    return {
      motorcycleExpectedGrossProfit,
      keyStockCostValue,
      keyStockRetailValue,
      keyStockExpectedGrossProfit,
      totalStockCostValue,
      totalPotentialRetailValue,
      totalPotentialGrossProfit: totalPotentialRetailValue - totalStockCostValue,
      estimatedBusinessPosition: totals.profit + totalStockCostValue,
    };
  }, [stockSettings, totals.profit]);

  const breakdowns = useMemo(() => {
    const group = <T,>(rows: T[], label: (row: T) => string, value: (row: T) => number) =>
      Object.entries(rows.reduce<Record<string, number>>((totals, row) => {
        const key = label(row) || "Uncategorised";
        totals[key] = (totals[key] || 0) + value(row);
        return totals;
      }, {})).sort((a, b) => b[1] - a[1]);
    const monthJobs = jobs.filter((job) => isDateInMonth(job.job_date, selectedMonth));
    const monthExpenses = expenses.filter((expense) => isDateInMonth(expense.expense_date, selectedMonth));
    return {
      income: group(monthJobs, (j) => j.job_type || "Other Income", (j) => Number(j.amount_charged || 0)),
      expenses: group(monthExpenses, (e) => e.category || "Miscellaneous", (e) => Number(e.amount || 0)),
    };
  }, [jobs, expenses, selectedMonth]);

  const filteredJobs = jobs.filter((j) =>
    `${j.customer_name} ${j.dealer_name} ${j.vehicle} ${j.registration} ${j.job_type}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredExpenses = expenses.filter((e) =>
    `${e.supplier} ${e.category} ${e.description}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const bankCategories = useMemo(
    () => Array.from(new Set(bankTransactions.map((row) => row.category).filter(Boolean))).sort() as string[],
    [bankTransactions],
  );

  const bankBatchIds = useMemo(
    () => Array.from(new Set(bankTransactions.map((row) => row.import_batch_id).filter(Boolean))).sort() as string[],
    [bankTransactions],
  );

  const filteredBankTransactions = useMemo(() => {
    const rows = bankTransactions.filter((row) => {
      const amount = Number(row.amount || 0);
      const reviewStatus = (row.review_status || (row.category === "Miscellaneous" || row.category === "Other Income" ? "needs_review" : "reviewed")) as BankFilters["reviewStatus"];
      const matched = Boolean(row.matched_job_id || row.matched_income_id || row.matched_expense_id);
      const matchesSearch = `${row.description} ${row.bank_reference || ""}`.toLowerCase().includes(bankFilters.search.toLowerCase());
      const matchesDateFrom = !bankFilters.dateFrom || row.transaction_date >= bankFilters.dateFrom;
      const matchesDateTo = !bankFilters.dateTo || row.transaction_date <= bankFilters.dateTo;
      const matchesDirection =
        bankFilters.direction === "all" ||
        (bankFilters.direction === "in" && amount > 0) ||
        (bankFilters.direction === "out" && amount < 0);
      const matchesCategory = bankFilters.category === "all" || row.category === bankFilters.category;
      const matchesReview = bankFilters.reviewStatus === "all" || reviewStatus === bankFilters.reviewStatus;
      const matchesMatched =
        bankFilters.match === "all" ||
        (bankFilters.match === "matched" && matched) ||
        (bankFilters.match === "unmatched" && !matched);
      const matchesBatch = bankFilters.importBatch === "all" || row.import_batch_id === bankFilters.importBatch;
      return matchesSearch && matchesDateFrom && matchesDateTo && matchesDirection && matchesCategory && matchesReview && matchesMatched && matchesBatch;
    });

    return rows.sort((a, b) => {
      if (bankFilters.sort === "oldest") return a.transaction_date.localeCompare(b.transaction_date);
      if (bankFilters.sort === "highest") return Number(b.amount || 0) - Number(a.amount || 0);
      if (bankFilters.sort === "lowest") return Number(a.amount || 0) - Number(b.amount || 0);
      return b.transaction_date.localeCompare(a.transaction_date);
    });
  }, [bankFilters, bankTransactions]);

  const bankSummary = useMemo(() => {
    const moneyIn = filteredBankTransactions.filter((row) => Number(row.amount || 0) > 0).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const moneyOut = filteredBankTransactions.filter((row) => Number(row.amount || 0) < 0).reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
    const needsReview = filteredBankTransactions.filter((row) => (row.review_status || row.category === "Miscellaneous" || row.category === "Other Income") === "needs_review").length;
    const uncategorised = filteredBankTransactions.filter((row) => !row.category || row.category === "Miscellaneous" || row.category === "Other Income").length;
    const matched = filteredBankTransactions.filter((row) => row.matched_job_id || row.matched_income_id || row.matched_expense_id).length;
    return { moneyIn, moneyOut, netMovement: moneyIn - moneyOut, needsReview, uncategorised, matched };
  }, [filteredBankTransactions]);

  const qualityChecks = useMemo(() => ({
    uncategorisedTransactions: bankTransactions.filter((row) => !row.category || row.category === "Miscellaneous" || row.category === "Other Income").length,
    unreviewedTransactions: bankTransactions.filter((row) => (row.review_status || "needs_review") !== "reviewed").length,
    unmatchedIncome: jobs.filter((job) => !job.notes?.includes("Matched bank transaction")).length,
    unmatchedExpenses: expenses.filter((expense) => !expense.notes?.includes("Matched bank transaction")).length,
    possibleDuplicates: bankTransactions.length - new Set(bankTransactions.map((row) => row.transaction_hash || row.transaction_key)).size,
    parsingErrors: bankImportPreview?.rejectedRows.length || bankImportResult?.rejectedRows || 0,
    missingDates: [...jobs.filter((job) => !job.job_date), ...expenses.filter((expense) => !expense.expense_date), ...bankTransactions.filter((row) => !row.transaction_date)].length,
    invalidAmounts: [...jobs.filter((job) => !Number(job.amount_charged)), ...expenses.filter((expense) => !Number(expense.amount)), ...bankTransactions.filter((row) => !Number(row.amount))].length,
  }), [bankImportPreview?.rejectedRows.length, bankImportResult?.rejectedRows, bankTransactions, expenses, jobs]);

  const quarterlySummary = useMemo(() => (
    getTaxYearQuarters(totals.taxStart).map((quarter) => {
      const quarterJobs = jobs.filter((job) => isInDateRange(job.job_date, quarter.from, quarter.to));
      const quarterExpenses = expenses.filter((expense) => isInDateRange(expense.expense_date, quarter.from, quarter.to));
      const quarterBank = bankTransactions.filter((row) => isInDateRange(row.transaction_date, quarter.from, quarter.to));
      const income = quarterJobs.reduce((sum, job) => sum + Number(job.amount_charged || 0), 0);
      const expenseTotal = quarterExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const uncategorised = quarterBank.filter((row) => !row.category || row.category === "Miscellaneous" || row.category === "Other Income").length;
      const unreviewed = quarterBank.filter((row) => (row.review_status || "needs_review") !== "reviewed").length;
      return {
        ...quarter,
        income,
        expenses: expenseTotal,
        profit: income - expenseTotal,
        uncategorised,
        unreviewed,
        status: uncategorised === 0 && unreviewed === 0 ? "Review complete" : "Needs review",
      };
    })
  ), [bankTransactions, expenses, jobs, totals.taxStart]);

  const needsReviewCount = bankRows.filter((row) => row.category === "Miscellaneous" || row.category === "Other Income" || row.review_status === "needs_review").length;

  async function saveBankTransactionChanges(updated: BankTransaction) {
    if (!updated.id) return alert("This transaction cannot be updated until it has been imported.");

    const enhancedUpdate = {
      category: updated.category,
      category_type: updated.category_type || categoryTypeForAction(updated.action),
      review_status: updated.review_status || "needs_review",
      notes: updated.notes || "",
      matched_job_id: updated.matched_job_id || null,
      matched_income_id: updated.matched_income_id || null,
      matched_expense_id: updated.matched_expense_id || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("smartfobs_bank_transactions")
      .update(enhancedUpdate)
      .eq("id", updated.id);

    if (error) {
      const { error: fallbackError } = await supabase
        .from("smartfobs_bank_transactions")
        .update({
          category: updated.category,
          action: updated.action,
        })
        .eq("id", updated.id);
      if (fallbackError) return alert(fallbackError.message);
    }

    setSelectedBankTransaction(null);
    await loadData();
  }

  function bestJobMatches(transaction: BankTransaction) {
    const amount = Math.abs(Number(transaction.amount || 0));
    return jobs
      .map((job) => ({
        job,
        difference: Math.abs(Number(job.amount_charged || 0) - amount),
        dateDistance: Math.abs(new Date(job.job_date).getTime() - new Date(transaction.transaction_date).getTime()),
      }))
      .sort((a, b) => a.difference - b.difference || a.dateDistance - b.dateDistance)
      .slice(0, 5);
  }

  function bestExpenseMatches(transaction: BankTransaction) {
    const amount = Math.abs(Number(transaction.amount || 0));
    return expenses
      .map((expense) => ({
        expense,
        difference: Math.abs(Number(expense.amount || 0) - amount),
        dateDistance: Math.abs(new Date(expense.expense_date).getTime() - new Date(transaction.transaction_date).getTime()),
      }))
      .sort((a, b) => a.difference - b.difference || a.dateDistance - b.dateDistance)
      .slice(0, 5);
  }

  function startEditingJob(jobToEdit: Job) {
    const category = jobToEdit.job_type && incomeCategories.includes(jobToEdit.job_type)
      ? jobToEdit.job_type
      : incomeCategories[0];
    setEditingJob({ ...jobToEdit, job_type: category });
  }

  function money(value: number) {
    return formatGBP(value);
  }

  return (
    <main className={`min-h-screen ${theme.page} pb-28`}>
      <div className="mx-auto max-w-5xl p-4 space-y-5">
        <header className="flex items-start justify-between gap-3 pt-2">
          <div>
            <p className={`text-xs font-bold tracking-[0.25em] ${theme.accentText}`}>SMARTFOBS</p>
            <h1 className="text-3xl font-black">
              {view === "home" && "Home"}
              {view === "jobs" && "Jobs"}
              {view === "expenses" && "Expenses"}
              {view === "reports" && "Reports"}
              {view === "bank" && "Bank Import"}
            </h1>
            <p className={`text-sm ${theme.muted}`}>Fast records for jobs, expenses and tax.</p>
          </div>
          <button type="button" onClick={() => void Promise.all([loadData(), loadStockValues()])} className={`min-h-11 shrink-0 rounded-xl ${theme.card} px-4 text-sm font-bold active:scale-[0.98]`}>
            Refresh
          </button>
        </header>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jobs, bikes, customers, expenses..."
          className={`w-full rounded-2xl ${theme.card} p-4 text-white outline-none focus:border-[#d7d7d7]`}
        />

        {view === "home" && (
          <>
            <section className={`rounded-3xl ${theme.card} p-5`}>
              <p className={`text-sm ${theme.muted}`}>Today</p>
              <p className={`mt-1 text-4xl font-black ${theme.accentText}`}>
                {money(totals.today.income)}
              </p>
              <p className={`mt-1 text-sm ${theme.faint}`}>Profit today: {money(totals.today.profit)}</p>
            </section>

            <section className="grid grid-cols-2 gap-2">
              <Kpi title="Income this month" value={money(totals.selectedMonth.income)} />
              <Kpi title="Expenses this month" value={money(totals.selectedMonth.expenses)} />
              <Kpi title="Profit this month" value={money(totals.selectedMonth.profit)} />
              <Kpi title="Income this tax year" value={money(totals.taxYear.income)} />
              <Kpi title="Expenses this tax year" value={money(totals.taxYear.expenses)} />
              <Kpi title="Profit this tax year" value={money(totals.taxYear.profit)} />
              <Kpi title="Transactions needing review" value={String(qualityChecks.unreviewedTransactions)} valueClassName={qualityChecks.unreviewedTransactions ? "text-red-300" : theme.accentText} />
              <Kpi title="Unmatched bank transactions" value={String(bankTransactions.length - bankSummary.matched)} />
            </section>

            <section className="grid grid-cols-2 gap-3">
              <Quick label="Smart Key" onClick={() => openJob("Smart Key")} />
              <Quick label="Lost Key" onClick={() => openJob("Lost Key")} />
              <Quick label="Spare Key" onClick={() => openJob("Spare Key")} />
              <Quick label="Dealer Job" onClick={() => openJob("Dealer Job")} />
              <Quick label="Shopify Sale" onClick={() => openJob("Shopify Sale")} />
              <Quick label="Expense" onClick={() => setShowForm("expense")} dark />
            </section>

            <Panel title="Recent Jobs">
              <JobList jobs={filteredJobs.slice(0, 5)} money={money} deleteJob={deleteJob} editJob={startEditingJob} />
            </Panel>

            <Panel title="Transactions needing attention">
              {bankTransactions.filter((row) => (row.review_status || "needs_review") !== "reviewed").slice(0, 5).length ? (
                <div className="space-y-3">
                  {bankTransactions.filter((row) => (row.review_status || "needs_review") !== "reviewed").slice(0, 5).map((row) => (
                    <button key={row.id || row.transaction_key} type="button" onClick={() => { setView("bank"); setSelectedBankTransaction(row); }} className="w-full rounded-xl bg-[#252a34] p-3 text-left">
                      <span className="block font-bold">{row.description}</span>
                      <span className={`block text-xs ${theme.faint}`}>{formatUKDate(row.transaction_date)} · {row.category || "Uncategorised"} · {money(Number(row.amount || 0))}</span>
                    </button>
                  ))}
                </div>
              ) : <p className={theme.faint}>No imported bank transactions need review.</p>}
            </Panel>
          </>
        )}

        {view === "jobs" && (
          <>
            <button onClick={() => setShowForm("job")} className={`w-full rounded-2xl ${theme.accent} p-4 font-black`}>
              + Add Job
            </button>
            <Panel title="All Jobs">
              <JobList jobs={filteredJobs} money={money} deleteJob={deleteJob} editJob={startEditingJob} />
            </Panel>
          </>
        )}

        {view === "expenses" && (
          <>
            <button onClick={() => setShowForm("expense")} className={`w-full rounded-2xl ${theme.accent} p-4 font-black`}>
              + Add Expense
            </button>
            <Panel title="All Expenses">
              <ExpenseList expenses={filteredExpenses} money={money} deleteExpense={deleteExpense} editExpense={setEditingExpense} />
            </Panel>
          </>
        )}

        {view === "reports" && (
          <div className="space-y-4">
            <ReportPeriod title="Today" totals={totals.today} money={money} />
            <ReportPeriod title="This week" totals={totals.week} money={money} />
            <Panel title="Selected Month">
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <button type="button" onClick={() => setSelectedMonth((month) => addMonths(month, -1))} className={`min-h-12 rounded-xl ${theme.card} px-3 text-sm font-bold active:scale-[0.98]`}>
                    Previous Month
                  </button>
                  <p className="min-w-28 text-center text-sm font-black">{formatMonthLabel(selectedMonth)}</p>
                  <button type="button" onClick={() => setSelectedMonth((month) => addMonths(month, 1))} className={`min-h-12 rounded-xl ${theme.card} px-3 text-sm font-bold active:scale-[0.98]`}>
                    Next Month
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Kpi title="Income" value={money(totals.selectedMonth.income)} />
                  <Kpi title="Expenses" value={money(totals.selectedMonth.expenses)} />
                  <Kpi title="Profit" value={money(totals.selectedMonth.profit)} />
                  <Kpi title="Jobs" value={String(totals.selectedMonth.jobs)} />
                </div>
              </div>
            </Panel>
            <ReportPeriod title={`Tax year · ${totals.taxStart} to ${totals.taxEnd}`} totals={totals.taxYear} money={money} />
            <ReportPeriod title="All-time totals" totals={{ income: totals.income, expenses: totals.expenseTotal, profit: totals.profit }} money={money} />
            <Kpi title="All-time jobs" value={String(totals.jobCount)} />

            <Panel title="Current Stock Value">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberInput label="Motorcycles in stock" value={stockSettings.motorcycleStockCount} step="1" onChange={(value) => updateStockSetting("motorcycleStockCount", value)} />
                  <MoneyInput label="Motorcycle stock cost value" value={stockSettings.motorcycleStockCostValue} onChange={(value) => updateStockSetting("motorcycleStockCostValue", value)} />
                  <MoneyInput label="Expected motorcycle sale value" value={stockSettings.motorcycleExpectedSaleValue} onChange={(value) => updateStockSetting("motorcycleExpectedSaleValue", value)} />
                  <NumberInput label="Keys in stock" value={stockSettings.keyStockCount} step="1" onChange={(value) => updateStockSetting("keyStockCount", value)} />
                  <MoneyInput label="Average key cost" value={stockSettings.averageKeyCost} onChange={(value) => updateStockSetting("averageKeyCost", value)} />
                  <MoneyInput label="Average key retail price" value={stockSettings.averageKeyRetailPrice} onChange={(value) => updateStockSetting("averageKeyRetailPrice", value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Kpi title="Motorcycles in stock" value={String(stockSettings.motorcycleStockCount)} />
                  <Kpi title="Motorcycle cost value" value={money(stockSettings.motorcycleStockCostValue)} />
                  <Kpi title="Expected motorcycle sale value" value={money(stockSettings.motorcycleExpectedSaleValue)} />
                  <Kpi title="Expected motorcycle gross profit" value={money(stockValues.motorcycleExpectedGrossProfit)} />
                  <Kpi title="Keys in stock" value={String(stockSettings.keyStockCount)} />
                  <Kpi title="Key stock cost value" value={money(stockValues.keyStockCostValue)} />
                  <Kpi title="Key stock retail value" value={money(stockValues.keyStockRetailValue)} />
                  <Kpi title="Key stock expected gross profit" value={money(stockValues.keyStockExpectedGrossProfit)} />
                  <Kpi title="Total stock cost value" value={money(stockValues.totalStockCostValue)} />
                  <Kpi title="Total potential retail value" value={money(stockValues.totalPotentialRetailValue)} />
                  <Kpi title="Total potential gross profit" value={money(stockValues.totalPotentialGrossProfit)} />
                  <Kpi title="Estimated business position" value={money(stockValues.estimatedBusinessPosition)} />
                </div>
                <button type="button" onClick={() => void saveStockValues(stockSettings)} className={`min-h-14 w-full rounded-2xl ${theme.accent} p-4 font-black`}>
                  Save Stock Values
                </button>
                <p className={`rounded-xl bg-[#252a34] p-3 text-xs ${theme.faint}`}>
                  Expected sale values are estimates only. Actual profit is only confirmed once stock is sold.
                </p>
              </div>
            </Panel>

            <Panel title="Tax Estimate">
              <div className="space-y-4">
                <p className={`text-sm ${theme.muted}`}>
                  UK sole trader estimate for {totals.taxStart} to {totals.taxEnd}. Drawings and ignored transfers are excluded.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MoneyInput
                    label="Other taxable income this tax year"
                    value={taxSettings.otherIncomeThisTaxYear}
                    onChange={(value) => setTaxSettings((settings) => ({ ...settings, otherIncomeThisTaxYear: value }))}
                  />
                  <MoneyInput
                    label="Tax savings already set aside"
                    value={taxSettings.taxSavingsAlreadySetAside}
                    onChange={(value) => setTaxSettings((settings) => ({ ...settings, taxSavingsAlreadySetAside: value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Kpi title="Tax year income" value={money(totals.taxYear.income)} />
                  <Kpi title="Tax year expenses" value={money(totals.taxYear.expenses)} />
                  <Kpi title="Tax year profit" value={money(taxEstimate.businessProfit)} />
                  <Kpi title="Estimated income tax" value={money(taxEstimate.incomeTax)} />
                  <Kpi title="Estimated Class 4 NI" value={money(taxEstimate.class4NI)} />
                  <Kpi title="Estimated total tax" value={money(taxEstimate.estimatedTotalTax)} />
                  <Kpi title="Recommended tax pot" value={money(taxEstimate.recommendedTaxPot)} />
                  <Kpi title="Saved so far" value={money(taxSettings.taxSavingsAlreadySetAside)} />
                  <Kpi title="Difference" value={money(taxEstimate.taxPotDifference)} valueClassName={taxEstimate.taxPotDifference < 0 ? "text-red-300" : theme.accentText} />
                </div>
                <p className={`rounded-xl bg-[#252a34] p-3 text-xs leading-relaxed ${theme.faint}`}>
                  Estimate only. Final tax can change depending on other income, allowances, student loan, pensions, benefits, losses, capital allowances and HMRC rules.
                </p>
              </div>
            </Panel>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => exportCSV("jobs")} className={`rounded-2xl ${theme.accent} p-4 font-black`}>
                Export Jobs CSV
              </button>
              <button onClick={() => exportCSV("expenses")} className={`rounded-2xl ${theme.card} p-4 font-black`}>
                Export Expenses CSV
              </button>
              <button onClick={exportQuarterlySummaryCSV} className={`rounded-2xl ${theme.card} p-4 font-black`}>
                Export Quarterly CSV
              </button>
            </div>

            <Panel title="Bank CSV Import">
              <label className={`block rounded-2xl ${theme.card} p-4 text-center font-black`}>
                Upload Bank CSV
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBankCSV(file);
                  }}
                />
              </label>
            </Panel>

            <Panel title="Tax record summary">
              <div className={`space-y-3 text-sm ${theme.muted}`}>
                <p>Total business income recorded: <b>{money(totals.income)}</b></p>
                <p>Total expenses recorded: <b>{money(totals.expenseTotal)}</b></p>
                <p>Estimated profit: <b>{money(totals.profit)}</b></p>
                <p>Bookkeeping estimate — review before using for a tax return.</p>
              </div>
            </Panel>

            <Panel title="Quarterly bookkeeping summary">
              <div className="space-y-3">
                {quarterlySummary.map((quarter) => (
                  <div key={quarter.label} className="rounded-xl bg-[#252a34] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{quarter.label} · {formatUKDate(quarter.from)} to {formatUKDate(quarter.to)}</p>
                        <p className={`text-xs ${theme.faint}`}>Uncategorised: {quarter.uncategorised} · Unreviewed: {quarter.unreviewed} · Not submitted</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${quarter.status === "Review complete" ? "bg-green-500/20 text-green-200" : "bg-red-500/20 text-red-200"}`}>
                        {quarter.status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Kpi title="Income" value={money(quarter.income)} />
                      <Kpi title="Expenses" value={money(quarter.expenses)} />
                      <Kpi title="Net profit" value={money(quarter.profit)} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Bookkeeping Checks">
              <div className="grid grid-cols-2 gap-2">
                <Kpi title="Uncategorised transactions" value={String(qualityChecks.uncategorisedTransactions)} />
                <Kpi title="Unreviewed transactions" value={String(qualityChecks.unreviewedTransactions)} />
                <Kpi title="Unmatched income" value={String(qualityChecks.unmatchedIncome)} />
                <Kpi title="Unmatched expenses" value={String(qualityChecks.unmatchedExpenses)} />
                <Kpi title="Possible duplicates" value={String(qualityChecks.possibleDuplicates)} />
                <Kpi title="Parsing errors" value={String(qualityChecks.parsingErrors)} />
                <Kpi title="Missing dates" value={String(qualityChecks.missingDates)} />
                <Kpi title="Invalid amounts" value={String(qualityChecks.invalidAmounts)} />
              </div>
            </Panel>

            <Panel title="Shopify Import">
              <p className={`text-sm leading-relaxed ${theme.muted}`}>
                Coming next: upload Shopify orders CSV or connect Shopify API to create jobs automatically. Until then, positive Shopify bank payouts are imported as income; after order import is added, payouts should be ignored to avoid double counting.
              </p>
            </Panel>

            <Panel title="Bank Connection">
              <p className={`text-sm leading-relaxed ${theme.muted}`}>
                Current method: bank CSV upload. Later this can be replaced with Open Banking.
              </p>
            </Panel>

            <div className="grid gap-4 sm:grid-cols-2">
              <Breakdown title={`${formatMonthLabel(selectedMonth)} income by category`} rows={breakdowns.income} money={money} />
              <Breakdown title={`${formatMonthLabel(selectedMonth)} expenses by category`} rows={breakdowns.expenses} money={money} />
            </div>

            <Panel title="Recent bank imports">
              {bankTransactions.length ? (
                <div className="space-y-3">
                  {bankTransactions.map((row) => (
                    <div key={row.transaction_key} className="flex items-start justify-between gap-3 rounded-xl bg-[#252a34] p-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{row.description}</p>
                        <p className={`text-xs ${theme.faint}`}>{row.transaction_date} · {row.category}</p>
                      </div>
                      <p className={`shrink-0 font-black ${row.amount >= 0 ? theme.accentText : "text-red-300"}`}>{money(row.amount)}</p>
                    </div>
                  ))}
                </div>
              ) : <p className={theme.faint}>No bank imports yet.</p>}
            </Panel>
          </div>
        )}

        {view === "bank" && (
          <div className="space-y-4">
            {hsbcStatus && (
              <div className={`rounded-2xl ${theme.card} p-4`}>
                <p className="font-black">HSBC Open Banking</p>
                <p className={`mt-1 text-sm ${theme.muted}`}>
                  {hsbcStatus === "callback-received" && "HSBC authorisation callback received. Secure token exchange is not enabled yet."}
                  {hsbcStatus === "error" && "HSBC authorisation was cancelled or returned an error."}
                  {hsbcStatus === "invalid-callback" && "The HSBC callback did not contain the required information."}
                </p>
              </div>
            )}

            <Panel title="HSBC Bank Feed">
              <p className={`text-sm leading-relaxed ${theme.muted}`}>
                Sandbox application registered. Live connection will be added after the bookkeeping workflow is complete.
              </p>
            </Panel>

            <Panel title="Import HSBC CSV">
              <div className="space-y-3">
                <label className={`block rounded-2xl ${theme.accent} p-4 text-center font-black`}>
                  Upload HSBC CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleBankCSV(file);
                    }}
                  />
                </label>
                <p className={`text-xs leading-relaxed ${theme.faint}`}>
                  Imported bank transactions still need checking and categorisation. CSV import does not create jobs or expenses automatically.
                </p>
                {bankImportResult && (
                  <div className="rounded-xl bg-[#252a34] p-3 text-sm">
                    <p className="font-bold">Import result</p>
                    <p className={theme.muted}>Imported: {bankImportResult.importedRows} · Duplicates: {bankImportResult.duplicateRows} · Rejected: {bankImportResult.rejectedRows}</p>
                    {bankImportResult.fallbackMode && <p className="mt-1 text-xs text-red-200">Run the Supabase migration to enable batch IDs, hashes and review metadata.</p>}
                  </div>
                )}
              </div>
            </Panel>

            {bankImportPreview && (
              <Panel title={`CSV preview · ${bankImportPreview.filename}`}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Kpi title="Valid rows" value={String(bankImportPreview.validRows.length)} />
                    <Kpi title="Possible duplicates" value={String(bankImportPreview.duplicateCount)} />
                    <Kpi title="Rejected rows" value={String(bankImportPreview.rejectedRows.length)} />
                    <Kpi title="Date range" value={bankImportPreview.dateFrom && bankImportPreview.dateTo ? `${formatUKDate(bankImportPreview.dateFrom)}–${formatUKDate(bankImportPreview.dateTo)}` : "Unknown"} />
                  </div>
                  <div className="rounded-xl bg-[#252a34] p-3 text-xs">
                    <p className="mb-2 font-bold">Detected columns</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(bankImportPreview.detectedColumns).map(([key, value]) => (
                        <p key={key}><span className={theme.faint}>{key}:</span> {value}</p>
                      ))}
                    </div>
                  </div>
                  {bankImportPreview.rejectedRows.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-red-200">Rejected rows</p>
                      {bankImportPreview.rejectedRows.slice(0, 5).map((row) => (
                        <p key={`${row.rowNumber}-${row.reason}`} className={`rounded-xl bg-red-500/10 p-3 text-xs ${theme.muted}`}>
                          Row {row.rowNumber}: {row.reason}
                        </p>
                      ))}
                    </div>
                  )}
                  <button onClick={importBankRows} className={`w-full rounded-2xl ${theme.accent} p-4 font-black`}>
                    Confirm Import
                  </button>
                </div>
              </Panel>
            )}

            <section className="grid grid-cols-2 gap-2">
              <Kpi title="Money In" value={money(bankSummary.moneyIn)} />
              <Kpi title="Money Out" value={money(bankSummary.moneyOut)} />
              <Kpi title="Net Movement" value={money(bankSummary.netMovement)} />
              <Kpi title="Needs Review" value={String(bankSummary.needsReview)} valueClassName={bankSummary.needsReview ? "text-red-300" : theme.accentText} />
              <Kpi title="Uncategorised" value={String(bankSummary.uncategorised)} />
              <Kpi title="Matched Transactions" value={String(bankSummary.matched)} />
            </section>

            <Panel title="Bank transaction filters">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Search description/reference" value={bankFilters.search} onChange={(value) => setBankFilters((filters) => ({ ...filters, search: value }))} />
                <Input label="Date from" type="date" value={bankFilters.dateFrom} onChange={(value) => setBankFilters((filters) => ({ ...filters, dateFrom: value }))} />
                <Input label="Date to" type="date" value={bankFilters.dateTo} onChange={(value) => setBankFilters((filters) => ({ ...filters, dateTo: value }))} />
                <Select label="Money direction" value={bankFilters.direction} onChange={(value) => setBankFilters((filters) => ({ ...filters, direction: value as BankFilters["direction"] }))} options={["all", "in", "out"]} />
                <Select label="Category" value={bankFilters.category} onChange={(value) => setBankFilters((filters) => ({ ...filters, category: value }))} options={["all", ...bankCategories]} />
                <Select label="Review status" value={bankFilters.reviewStatus} onChange={(value) => setBankFilters((filters) => ({ ...filters, reviewStatus: value as BankFilters["reviewStatus"] }))} options={["all", "needs_review", "rule_applied", "reviewed"]} />
                <Select label="Matched" value={bankFilters.match} onChange={(value) => setBankFilters((filters) => ({ ...filters, match: value as BankFilters["match"] }))} options={["all", "matched", "unmatched"]} />
                <Select label="Import batch" value={bankFilters.importBatch} onChange={(value) => setBankFilters((filters) => ({ ...filters, importBatch: value }))} options={["all", ...bankBatchIds]} />
                <Select label="Sort" value={bankFilters.sort} onChange={(value) => setBankFilters((filters) => ({ ...filters, sort: value as BankFilters["sort"] }))} options={["newest", "oldest", "highest", "lowest"]} />
              </div>
            </Panel>

            <Panel title={`${filteredBankTransactions.length} imported bank transactions`}>
              <button type="button" onClick={exportBankTransactionsCSV} className={`mb-3 w-full rounded-2xl ${theme.card} p-3 font-bold`}>
                Export Filtered Bank CSV
              </button>
              {filteredBankTransactions.length ? (
                <div className="space-y-3">
                  {filteredBankTransactions.map((row) => {
                    const amount = Number(row.amount || 0);
                    const reviewStatus = row.review_status || (row.category === "Miscellaneous" || row.category === "Other Income" ? "needs_review" : "reviewed");
                    const matched = Boolean(row.matched_job_id || row.matched_income_id || row.matched_expense_id);
                    return (
                      <button key={row.id || row.transaction_key} type="button" onClick={() => setSelectedBankTransaction(row)} className={`w-full rounded-xl bg-[#252a34] p-3 text-left ${reviewStatus !== "reviewed" ? "ring-1 ring-red-400/50" : ""}`}>
                        <span className="flex justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate font-bold">{row.description}</span>
                            <span className={`block text-xs ${theme.faint}`}>{formatUKDate(row.transaction_date)} · {row.category || "Uncategorised"} · {matched ? "Matched" : "Unmatched"}{row.notes ? " · Notes" : ""}</span>
                          </span>
                          <span className={`shrink-0 font-black ${amount >= 0 ? theme.accentText : "text-red-300"}`}>{money(amount)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : <p className={theme.faint}>No imported bank transactions match these filters.</p>}
            </Panel>

            <div className={`rounded-2xl ${theme.card} p-4`}>
              <p className="font-black">Needs Review: {needsReviewCount}</p>
              <p className={`mt-1 text-sm ${theme.muted}`}>Review Miscellaneous and Other Income before importing.</p>
            </div>
            <button onClick={importBankRows} className={`w-full rounded-2xl ${theme.accent} p-4 font-black`}>
              Import Selected Bank Rows
            </button>

            <Panel title={`${bankRows.length} bank rows ready`}>
              <div className="space-y-3">
                {bankRows.map((row, index) => (
                  <div key={row.transaction_key} className="rounded-xl bg-[#252a34] p-3 space-y-2">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-bold">{row.description}</p>
                        <p className={`text-xs ${theme.faint}`}>{row.transaction_date} · {row.type}</p>
                      </div>
                      <p className={row.amount >= 0 ? theme.accentText : "text-red-300"}>
                        {money(row.amount)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={row.action}
                        onChange={(e) => {
                          const newAction = e.target.value as BankRow["action"];

                          updateBankRow(index, {
                            action: newAction,
                            category: categoriesForAction(newAction)[0],
                            category_type: categoryTypeForAction(newAction),
                            review_status: "needs_review",
                          });
                        }}
                        className="rounded-xl border border-[#3a404d] bg-[#111317] p-3 text-sm"
                      >
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                        <option value="drawings">Drawings</option>
                        <option value="ignore">Ignore</option>
                      </select>

                      {row.action === "drawings" || row.action === "ignore" ? (
                        <div className="rounded-xl border border-[#3a404d] bg-[#111317] p-3 text-sm text-[#b8bcc6]">
                          {row.action === "drawings" ? "Drawings" : "Transfer / Ignore"}
                        </div>
                      ) : (
                        <select
                          value={row.category}
                          onChange={(e) => updateBankRow(index, { category: e.target.value, review_status: "needs_review" })}
                          className="rounded-xl border border-[#3a404d] bg-[#111317] p-3 text-sm"
                        >
                          {categoriesForAction(row.action).map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/80 p-4">
          <div className={`mx-auto max-w-lg rounded-3xl ${theme.card} p-4 space-y-4`}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">{showForm === "job" ? "New Job" : "New Expense"}</h2>
              <button onClick={() => setShowForm(null)} className="rounded-full bg-[#252a34] px-3 py-1 font-bold">✕</button>
            </div>

            {showForm === "job" ? (
              <div className="space-y-3">
                <Input label="Date" type="date" value={job.job_date} onChange={(v) => setJob({ ...job, job_date: v })} />
                <Input label="Customer / Dealer" value={job.customer_name} onChange={(v) => setJob({ ...job, customer_name: v })} />
                <Input label="Vehicle" value={job.vehicle} onChange={(v) => setJob({ ...job, vehicle: v })} />
                <Input label="Reg" value={job.registration} onChange={(v) => setJob({ ...job, registration: v.toUpperCase() })} />
                <Select label="Job Type" value={job.job_type} onChange={(v) => setJob({ ...job, job_type: v })} options={["Smart Key", "Lost Key", "Spare Key", "SCU Decode", "Dealer Job", "Shopify Sale", "Other"]} />
                <Input label="Amount £" type="number" value={job.amount_charged} onChange={(v) => setJob({ ...job, amount_charged: v })} />
                <Select label="Payment" value={job.payment_method} onChange={(v) => setJob({ ...job, payment_method: v })} options={["Bank Transfer", "Shopify", "Cash", "SumUp"]} />
                <Input label="Notes" value={job.notes} onChange={(v) => setJob({ ...job, notes: v })} />
                <button onClick={addJob} className={`w-full rounded-2xl ${theme.accent} p-4 font-black`}>Save Job</button>
              </div>
            ) : (
              <div className="space-y-3">
                <Input label="Date" type="date" value={expense.expense_date} onChange={(v) => setExpense({ ...expense, expense_date: v })} />
                <Input label="Supplier" value={expense.supplier} onChange={(v) => setExpense({ ...expense, supplier: v })} />
                <Select label="Category" value={expense.category} onChange={(v) => setExpense({ ...expense, category: v })} options={expenseCategories} />
                <Input label="Amount £" type="number" value={expense.amount} onChange={(v) => setExpense({ ...expense, amount: v })} />
                <Input label="Description" value={expense.description} onChange={(v) => setExpense({ ...expense, description: v })} />
                <Input label="Used for job / bike (optional)" value={expense.linked_job_or_bike} onChange={(v) => setExpense({ ...expense, linked_job_or_bike: v })} />
                <label className="block">
                  <span className={`mb-1 block text-sm ${theme.muted}`}>Receipt photo</span>
                  <span className="block min-h-14 cursor-pointer rounded-2xl border border-[#3a404d] bg-[#252a34] p-4 text-center font-bold">
                    {receiptName || "Choose receipt photo"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setReceiptName(file.name);
                      const reader = new FileReader();
                      reader.onload = () => setReceiptPreview(typeof reader.result === "string" ? reader.result : "");
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {receiptPreview && <Image src={receiptPreview} alt="Receipt preview" width={640} height={480} unoptimized className="max-h-64 w-full rounded-2xl border border-[#3a404d] object-contain" />}
                <p className={`text-xs ${theme.faint}`}>Preview only for now; the file is not uploaded or saved.</p>
                <button onClick={addExpense} className={`w-full rounded-2xl ${theme.accent} p-4 font-black`}>Save Expense</button>
              </div>
            )}
          </div>
        </div>
      )}

      {editingJob && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4">
          <div className={`mx-auto max-w-lg space-y-4 rounded-3xl ${theme.card} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Edit Job</h2>
              <button type="button" onClick={() => setEditingJob(null)} className="min-h-11 min-w-11 rounded-full bg-[#252a34] font-bold" aria-label="Close">×</button>
            </div>
            <Input label="Date" type="date" value={editingJob.job_date} onChange={(value) => setEditingJob({ ...editingJob, job_date: value })} />
            <Input label="Customer" value={editingJob.customer_name ?? ""} onChange={(value) => setEditingJob({ ...editingJob, customer_name: value })} />
            <Input label="Vehicle" value={editingJob.vehicle ?? ""} onChange={(value) => setEditingJob({ ...editingJob, vehicle: value })} />
            <Input label="Registration" value={editingJob.registration ?? ""} onChange={(value) => setEditingJob({ ...editingJob, registration: value.toUpperCase() })} />
            <Select label="Income category" value={editingJob.job_type ?? incomeCategories[0]} onChange={(value) => setEditingJob({ ...editingJob, job_type: value })} options={incomeCategories} />
            <Input label="Amount £" type="number" value={String(editingJob.amount_charged ?? "")} onChange={(value) => setEditingJob({ ...editingJob, amount_charged: value })} />
            <Input label="Notes" value={editingJob.notes ?? ""} onChange={(value) => setEditingJob({ ...editingJob, notes: value })} />
            <button type="button" onClick={saveEditedJob} className={`min-h-14 w-full rounded-2xl ${theme.accent} p-4 font-black`}>Save Changes</button>
          </div>
        </div>
      )}

      {editingExpense && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4">
          <div className={`mx-auto max-w-lg space-y-4 rounded-3xl ${theme.card} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Edit Expense</h2>
              <button type="button" onClick={() => setEditingExpense(null)} className="min-h-11 min-w-11 rounded-full bg-[#252a34] font-bold" aria-label="Close">×</button>
            </div>
            <Input label="Date" type="date" value={editingExpense.expense_date} onChange={(value) => setEditingExpense({ ...editingExpense, expense_date: value })} />
            <Input label="Supplier" value={editingExpense.supplier ?? ""} onChange={(value) => setEditingExpense({ ...editingExpense, supplier: value })} />
            <Select label="Expense category" value={editingExpense.category ?? expenseCategories[0]} onChange={(value) => setEditingExpense({ ...editingExpense, category: value })} options={expenseCategories} />
            <Input label="Amount £" type="number" value={String(editingExpense.amount ?? "")} onChange={(value) => setEditingExpense({ ...editingExpense, amount: value })} />
            <Input label="Description" value={editingExpense.description ?? ""} onChange={(value) => setEditingExpense({ ...editingExpense, description: value })} />
            <Input label="Notes" value={editingExpense.notes ?? ""} onChange={(value) => setEditingExpense({ ...editingExpense, notes: value })} />
            <button type="button" onClick={saveEditedExpense} className={`min-h-14 w-full rounded-2xl ${theme.accent} p-4 font-black`}>Save Changes</button>
          </div>
        </div>
      )}

      {selectedBankTransaction && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4">
          <div className={`mx-auto max-w-lg space-y-4 rounded-3xl ${theme.card} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Review Bank Transaction</h2>
                <p className={`text-sm ${theme.faint}`}>{formatUKDate(selectedBankTransaction.transaction_date)} · {money(Number(selectedBankTransaction.amount || 0))}</p>
              </div>
              <button type="button" onClick={() => setSelectedBankTransaction(null)} className="min-h-11 min-w-11 rounded-full bg-[#252a34] font-bold" aria-label="Close">×</button>
            </div>

            <div className="rounded-xl bg-[#252a34] p-3">
              <p className="font-bold">{selectedBankTransaction.description}</p>
              {selectedBankTransaction.bank_reference && <p className={`text-xs ${theme.faint}`}>Reference: {selectedBankTransaction.bank_reference}</p>}
              <p className={`text-xs ${theme.faint}`}>Match status: {selectedBankTransaction.matched_job_id || selectedBankTransaction.matched_income_id || selectedBankTransaction.matched_expense_id ? "Matched" : "Unmatched"}</p>
            </div>

            <Select
              label="Category type"
              value={String(selectedBankTransaction.category_type || categoryTypeForAction(selectedBankTransaction.action))}
              onChange={(value) => {
                const categoryType = value as CategoryType;
                setSelectedBankTransaction({
                  ...selectedBankTransaction,
                  category_type: categoryType,
                  action: categoryType === "income" ? "income" : categoryType === "expense" ? "expense" : categoryType === "owner" ? "drawings" : "ignore",
                });
              }}
              options={["income", "expense", "transfer", "owner", "tax", "ignored"]}
            />
            <Input label="Category" value={selectedBankTransaction.category || ""} onChange={(value) => setSelectedBankTransaction({ ...selectedBankTransaction, category: value })} />
            <Select
              label="Review status"
              value={String(selectedBankTransaction.review_status || "needs_review")}
              onChange={(value) => setSelectedBankTransaction({ ...selectedBankTransaction, review_status: value as ReviewStatus })}
              options={["needs_review", "rule_applied", "reviewed"]}
            />
            <Input label="Notes" value={selectedBankTransaction.notes || ""} onChange={(value) => setSelectedBankTransaction({ ...selectedBankTransaction, notes: value })} />

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setSelectedBankTransaction({ ...selectedBankTransaction, category: "Personal transaction", category_type: "ignored", action: "ignore", review_status: "reviewed" })} className={`rounded-xl ${theme.card} p-3 text-sm font-bold`}>
                Personal / non-business
              </button>
              <button type="button" onClick={() => setSelectedBankTransaction({ ...selectedBankTransaction, category: "Transfer between accounts", category_type: "transfer", action: "ignore", review_status: "reviewed" })} className={`rounded-xl ${theme.card} p-3 text-sm font-bold`}>
                Internal transfer
              </button>
              <button type="button" onClick={() => setSelectedBankTransaction({ ...selectedBankTransaction, category: "Owner withdrawal", category_type: "owner", action: "drawings", review_status: "reviewed" })} className={`rounded-xl ${theme.card} p-3 text-sm font-bold`}>
                Owner withdrawal
              </button>
              <button type="button" onClick={() => setSelectedBankTransaction({ ...selectedBankTransaction, matched_job_id: null, matched_income_id: null, matched_expense_id: null })} className={`rounded-xl ${theme.card} p-3 text-sm font-bold`}>
                Remove match
              </button>
            </div>

            {Number(selectedBankTransaction.amount || 0) >= 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-bold">Suggested job matches</p>
                {bestJobMatches(selectedBankTransaction).map(({ job: match, difference }) => (
                  <button key={match.id} type="button" onClick={() => setSelectedBankTransaction({ ...selectedBankTransaction, matched_job_id: match.id, matched_income_id: null, matched_expense_id: null })} className="w-full rounded-xl bg-[#252a34] p-3 text-left text-sm">
                    <span className="block font-bold">{match.customer_name || match.dealer_name || "Unnamed job"}</span>
                    <span className={theme.faint}>{formatUKDate(match.job_date)} · {money(Number(match.amount_charged || 0))} · Difference {money(difference)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-bold">Suggested expense matches</p>
                {bestExpenseMatches(selectedBankTransaction).map(({ expense: match, difference }) => (
                  <button key={match.id} type="button" onClick={() => setSelectedBankTransaction({ ...selectedBankTransaction, matched_expense_id: match.id, matched_job_id: null, matched_income_id: null })} className="w-full rounded-xl bg-[#252a34] p-3 text-left text-sm">
                    <span className="block font-bold">{match.supplier || "Expense"}</span>
                    <span className={theme.faint}>{formatUKDate(match.expense_date)} · {money(Number(match.amount || 0))} · Difference {money(difference)}</span>
                  </button>
                ))}
              </div>
            )}

            <button type="button" onClick={() => void saveBankTransactionChanges(selectedBankTransaction)} className={`min-h-14 w-full rounded-2xl ${theme.accent} p-4 font-black`}>
              Save Bank Review
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#3a404d] bg-[#111317] p-3">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-2">
          <NavButton active={view === "home"} onClick={() => setView("home")} label="Home" />
          <NavButton active={view === "jobs"} onClick={() => setView("jobs")} label="Jobs" />
          <NavButton active={view === "expenses"} onClick={() => setView("expenses")} label="Expenses" />
          <NavButton active={view === "reports"} onClick={() => setView("reports")} label="Reports" />
          <NavButton active={view === "bank"} onClick={() => setView("bank")} label="Bank" />
        </div>
      </nav>
    </main>
  );
}

function Kpi({ title, value, valueClassName = "" }: { title: string; value: string; valueClassName?: string }) {
  return (
    <div className={`rounded-2xl ${theme.card} p-4`}>
      <p className={`text-xs ${theme.muted}`}>{title}</p>
      <p className={`mt-1 break-words text-lg font-black sm:text-xl ${valueClassName}`}>{value}</p>
    </div>
  );
}

function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-sm ${theme.muted}`}>{label}</span>
      <div className="flex items-center rounded-2xl border border-[#3a404d] bg-[#252a34] focus-within:border-[#d7d7d7]">
        <span className={`pl-4 ${theme.muted}`}>£</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
          className="min-w-0 flex-1 bg-transparent p-4 text-lg text-white outline-none"
        />
      </div>
    </label>
  );
}

function NumberInput({ label, value, onChange, step = "0.01" }: { label: string; value: number; onChange: (value: number) => void; step?: string }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-sm ${theme.muted}`}>{label}</span>
      <input
        type="number"
        min="0"
        step={step}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="w-full rounded-2xl border border-[#3a404d] bg-[#252a34] p-4 text-lg text-white outline-none focus:border-[#d7d7d7]"
      />
    </label>
  );
}

function ReportPeriod({ title, totals, money }: { title: string; totals: { income: number; expenses: number; profit: number }; money: (value: number) => string }) {
  return (
    <section>
      <h2 className={`mb-2 text-sm font-bold ${theme.muted}`}>{title}</h2>
      <div className="grid grid-cols-3 gap-2">
        <Kpi title="Income" value={money(totals.income)} />
        <Kpi title="Expenses" value={money(totals.expenses)} />
        <Kpi title="Profit" value={money(totals.profit)} />
      </div>
    </section>
  );
}

function Breakdown({ title, rows, money }: { title: string; rows: [string, number][]; money: (value: number) => string }) {
  return (
    <Panel title={title}>
      {rows.length ? <div className="space-y-2">{rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 rounded-xl bg-[#252a34] p-3 text-sm">
          <span className={theme.muted}>{label}</span><b>{money(value)}</b>
        </div>
      ))}</div> : <p className={theme.faint}>Nothing recorded yet.</p>}
    </Panel>
  );
}

function Quick({ label, onClick, dark = false }: { label: string; onClick: () => void; dark?: boolean }) {
  return (
    <button onClick={onClick} className={dark ? `rounded-2xl ${theme.card} p-4 text-left font-black active:scale-[0.98]` : `rounded-2xl ${theme.accent} p-4 text-left font-black active:scale-[0.98]`}>
      + {label}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl ${theme.card} p-4`}>
      <h2 className="mb-3 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

function JobList({ jobs, money, deleteJob, editJob }: { jobs: Job[]; money: (value: number) => string; deleteJob?: (id: string) => void; editJob?: (job: Job) => void }) {
  if (!jobs.length) return <p className={theme.faint}>No jobs found.</p>;

  return (
    <div className="space-y-3">
      {jobs.map((j) => (
        <div key={j.id} className="rounded-xl bg-[#252a34] p-3">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-bold">{j.customer_name || j.dealer_name || "Unnamed job"}</p>
              <p className={`text-sm ${theme.muted}`}>{j.job_date} · {j.vehicle || "No vehicle"}</p>
              <p className={`text-xs ${theme.faint}`}>{j.job_type || "No job type"}</p>
            </div>
            <div className="text-right">
              <p className={`font-black ${theme.accentText}`}>{money(Number(j.amount_charged || 0))}</p>
              <div className="mt-2 flex justify-end gap-2">
                {editJob && <button onClick={() => editJob(j)} className="min-h-9 rounded-lg border border-[#3a404d] px-3 text-xs font-bold">Edit</button>}
                {deleteJob && <button onClick={() => deleteJob(j.id)} className="min-h-9 rounded-lg px-2 text-xs text-red-300">Delete</button>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpenseList({ expenses, money, deleteExpense, editExpense }: { expenses: Expense[]; money: (value: number) => string; deleteExpense?: (id: string) => void; editExpense?: (expense: Expense) => void }) {
  if (!expenses.length) return <p className={theme.faint}>No expenses found.</p>;

  return (
    <div className="space-y-3">
      {expenses.map((e) => (
        <div key={e.id} className="rounded-xl bg-[#252a34] p-3">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-bold">{e.supplier || "Expense"}</p>
              <p className={`text-sm ${theme.muted}`}>{e.expense_date} · {e.category || "Other"}</p>
              <p className={`text-xs ${theme.faint}`}>{e.description}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-red-300">-{money(Number(e.amount || 0))}</p>
              <div className="mt-2 flex justify-end gap-2">
                {editExpense && <button onClick={() => editExpense(e)} className="min-h-9 rounded-lg border border-[#3a404d] px-3 text-xs font-bold">Edit</button>}
                {deleteExpense && <button onClick={() => deleteExpense(e.id)} className="min-h-9 rounded-lg px-2 text-xs text-red-300">Delete</button>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NavButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={active ? `rounded-2xl ${theme.accent} px-2 py-3 text-[11px] font-black` : "rounded-2xl bg-[#252a34] px-2 py-3 text-[11px] font-bold text-[#b8bcc6]"}>
      {label}
    </button>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-sm ${theme.muted}`}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-[#3a404d] bg-[#252a34] p-4 text-lg text-white outline-none focus:border-[#d7d7d7]" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-sm ${theme.muted}`}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-[#3a404d] bg-[#252a34] p-4 text-lg text-white outline-none focus:border-[#d7d7d7]">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}
