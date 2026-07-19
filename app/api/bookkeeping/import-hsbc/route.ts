import { NextResponse } from "next/server";
import { calculateAllowables, dateKey, money, quarterForDate, transactionHash, applyRules } from "@/lib/production-bookkeeping/core";
import { safeFilename, serverSupabase } from "@/lib/production-bookkeeping/server";
import type { CategoryRule } from "@/lib/production-bookkeeping/types";

export const runtime = "nodejs";

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += c;
  }
  cells.push(current);
  return cells;
}

function normaliseHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function find(headers: string[], names: string[]) {
  const wanted = names.map(normaliseHeader);
  return headers.find((h) => wanted.includes(normaliseHeader(h))) || "";
}

export async function POST(request: Request) {
  const startedAt = new Date().toISOString();
  const form = await request.formData();
  const file = form.get("file");
  const mode = String(form.get("mode") || "import");
  if (!(file instanceof File)) return NextResponse.json({ error: "No CSV supplied" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ error: "Only CSV files are supported" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "CSV is too large" }, { status: 400 });

  const csv = (await file.text()).replace(/^\uFEFF/, "");
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  const headers = splitCsvLine(lines[0] || "").map((h) => h.trim());
  const dateCol = find(headers, ["Date", "Transaction Date"]);
  const descriptionCol = find(headers, ["Description"]);
  const typeCol = find(headers, ["Type", "Bank Type"]);
  const amountCol = find(headers, ["Amount"]);
  const balanceCol = find(headers, ["Balance"]);
  if (!dateCol || !descriptionCol || !amountCol) return NextResponse.json({ error: "CSV must include Date, Description and signed Amount columns" }, { status: 400 });

  const supabase = serverSupabase();
  const { data: rulesData } = await supabase
    .from("bookkeeping_category_rules")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: true });
  const rules = (rulesData || []) as CategoryRule[];

  const rows = [];
  const errors: { rowNumber: number; error: string }[] = [];
  for (const [index, line] of lines.slice(1).entries()) {
    const rowNumber = index + 2;
    const values = splitCsvLine(line);
    const raw = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]));
    const transactionDate = dateKey(raw[dateCol]);
    const description = String(raw[descriptionCol] || "").trim();
    const amountText = String(raw[amountCol] || "").trim();
    if (!/^-?[£Ł]?\s?\d[\d,]*(\.\d{1,2})?$/.test(amountText)) {
      errors.push({ rowNumber, error: "Invalid signed Amount" });
      continue;
    }
    const amount = money(amountText);
    if (!transactionDate || !description) {
      errors.push({ rowNumber, error: "Missing date or description" });
      continue;
    }
    const rule = applyRules(description, amount, rules);
    const base = {
      transaction_date: transactionDate,
      bank_type: typeCol ? raw[typeCol] || null : null,
      description,
      original_amount: amount,
      direction: amount >= 0 ? "Income" : "Expense",
      payment_method: "Bank Transfer",
      category: rule.category,
      subcategory: rule.subcategory,
      business_status: rule.business_status,
      business_use_percent: rule.business_use_percent,
      allowable_status: rule.allowable_status,
      vat_treatment: "No VAT registered",
      receipt_status: "To find",
      receipt_file_url: null,
      receipt_id: null,
      bike_job_reference: null,
      mtd_quarter: quarterForDate(transactionDate),
      notes: null,
      accountant_review: rule.accountant_review,
      bank_balance: balanceCol && raw[balanceCol] ? money(raw[balanceCol]) : null,
      source_type: "hsbc_csv",
      source_filename: safeFilename(file.name),
      source_row_number: rowNumber,
      transaction_hash: "",
    };
    rows.push({ ...base, ...calculateAllowables(base), transaction_hash: transactionHash(base) });
  }

  const { data: existing } = rows.length
    ? await supabase.from("bookkeeping_transactions").select("transaction_hash").in("transaction_hash", rows.map((r) => r.transaction_hash))
    : { data: [] };
  const duplicateHashes = new Set((existing || []).map((r) => r.transaction_hash));
  const newRows = rows.filter((r) => !duplicateHashes.has(r.transaction_hash));

  if (mode === "preview") {
    return NextResponse.json({
      amountModel: "Signed amount column",
      positiveValues: "Money in",
      negativeValues: "Money out",
      totalMoneyIn: rows.filter((r) => r.original_amount > 0).reduce((s, r) => s + r.original_amount, 0),
      totalMoneyOut: rows.filter((r) => r.original_amount < 0).reduce((s, r) => s + Math.abs(r.original_amount), 0),
      netMovement: rows.reduce((s, r) => s + r.original_amount, 0),
      totalRows: rows.length,
      duplicates: duplicateHashes.size,
      errors,
      firstRows: rows.slice(0, 10),
    });
  }

  const { data: importRow } = await supabase.from("bookkeeping_imports").insert({
    import_type: "hsbc_csv",
    filename: safeFilename(file.name),
    total_rows: rows.length,
    imported_rows: 0,
    duplicate_rows: duplicateHashes.size,
    failed_rows: errors.length,
    error_details: errors,
    started_at: startedAt,
  }).select().single();

  let imported = 0;
  if (newRows.length) {
    const { error } = await supabase.from("bookkeeping_transactions").insert(newRows);
    if (error) errors.push({ rowNumber: 0, error: error.message });
    else imported = newRows.length;
  }
  if (importRow?.id) {
    await supabase.from("bookkeeping_imports").update({
      imported_rows: imported,
      failed_rows: errors.length,
      completed_at: new Date().toISOString(),
    }).eq("id", importRow.id);
  }
  return NextResponse.json({ imported, duplicates: duplicateHashes.size, failed: errors.length, total: rows.length, errors });
}
