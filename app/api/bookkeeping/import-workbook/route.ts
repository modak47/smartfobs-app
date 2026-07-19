import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { calculateAllowables, dateKey, money, normaliseBusinessUsePercent, quarterForDate, transactionHash } from "@/lib/production-bookkeeping/core";
import { safeFilename, serverSupabase } from "@/lib/production-bookkeeping/server";

export const runtime = "nodejs";

function headerKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function cell(row: ExcelJS.Row, headerMap: Map<string, number>, header: string) {
  const col = headerMap.get(headerKey(header));
  return col ? row.getCell(col).value : null;
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "");
  if (typeof value === "object" && "result" in value) return String((value as { result: unknown }).result ?? "");
  return String(value);
}

function hashBuffer(buffer: Uint8Array) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function existingHashes(supabase: ReturnType<typeof serverSupabase>, hashes: string[]) {
  if (!hashes.length) return new Set<string>();
  const { data, error } = await supabase.from("bookkeeping_transactions").select("transaction_hash").in("transaction_hash", hashes);
  if (error) throw error;
  return new Set((data || []).map((row) => row.transaction_hash as string));
}

export async function POST(request: Request) {
  const startedAt = new Date().toISOString();
  const form = await request.formData();
  const file = form.get("file");
  const mode = String(form.get("mode") || "import");
  if (!(file instanceof File)) return NextResponse.json({ error: "No workbook supplied" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "Only .xlsx workbooks are supported" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Workbook is too large" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  const workbookData = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  await workbook.xlsx.load(workbookData);
  const sheet = workbook.getWorksheet("Transactions");
  if (!sheet) return NextResponse.json({ error: "Transactions sheet not found" }, { status: 400 });

  const headerRow = sheet.getRow(1);
  const headerMap = new Map<string, number>();
  headerRow.eachCell((c, col) => headerMap.set(headerKey(text(c.value).trim()), col));

  const transactions = [];
  const errors: { rowNumber: number; error: string }[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const transactionDate = dateKey(cell(row, headerMap, "Date"));
    const description = text(cell(row, headerMap, "Description")).trim();
    const originalAmount = money(cell(row, headerMap, "Original Amount (£)") ?? cell(row, headerMap, "Original Amount (Ł)"));
    if (!transactionDate && !description && originalAmount === 0) continue;
    if (!transactionDate || !description) {
      errors.push({ rowNumber, error: "Missing date or description" });
      continue;
    }
    const bankBalanceValue = cell(row, headerMap, "Bank Balance (£)") ?? cell(row, headerMap, "Bank Balance (Ł)");
    const bankBalance = bankBalanceValue === null || bankBalanceValue === "" ? null : money(bankBalanceValue);
    const direction = text(cell(row, headerMap, "Direction")).trim() || (originalAmount >= 0 ? "Income" : "Expense");
    const base = {
      transaction_date: transactionDate,
      bank_type: text(cell(row, headerMap, "Bank Type")).trim() || null,
      description,
      original_amount: originalAmount,
      direction,
      payment_method: text(cell(row, headerMap, "Payment Method")).trim() || null,
      category: text(cell(row, headerMap, "Category")).trim() || "Needs Review",
      subcategory: text(cell(row, headerMap, "Subcategory / Detail")).trim() || null,
      business_status: text(cell(row, headerMap, "Business Status")).trim() || "Review",
      business_use_percent: normaliseBusinessUsePercent(cell(row, headerMap, "Business Use %") ?? 100),
      allowable_status: text(cell(row, headerMap, "Allowable?")).trim() || "Review",
      vat_treatment: text(cell(row, headerMap, "VAT Treatment")).trim() || null,
      receipt_status: text(cell(row, headerMap, "Receipt Status")).trim() || "To find",
      receipt_file_url: text(cell(row, headerMap, "Receipt / File Link")).trim() || null,
      bike_job_reference: text(cell(row, headerMap, "Bike / Job Ref")).trim() || null,
      mtd_quarter: text(cell(row, headerMap, "MTD Quarter")).trim() || quarterForDate(transactionDate),
      notes: text(cell(row, headerMap, "Notes")).trim() || null,
      accountant_review: text(cell(row, headerMap, "Accountant Review")).trim() || "Not reviewed",
      bank_balance: bankBalance,
      source_type: "workbook",
      source_filename: safeFilename(file.name),
      source_row_number: rowNumber,
      transaction_hash: "",
    };
    const workbookIncome = money(cell(row, headerMap, "Allowable Income (£)") ?? cell(row, headerMap, "Allowable Income (Ł)"));
    const workbookExpense = money(cell(row, headerMap, "Allowable Expense (£)") ?? cell(row, headerMap, "Allowable Expense (Ł)"));
    const calculated = calculateAllowables(base);
    transactions.push({
      ...base,
      allowable_income: workbookIncome || calculated.allowable_income,
      allowable_expense: workbookExpense || calculated.allowable_expense,
      transaction_hash: transactionHash(base),
    });
  }

  const supabase = serverSupabase();
  const duplicates = await existingHashes(supabase, transactions.map((row) => row.transaction_hash));
  const newRows = transactions.filter((row) => !duplicates.has(row.transaction_hash));

  if (mode === "preview") {
    return NextResponse.json({
      totalRows: transactions.length,
      validRows: transactions.length - errors.length,
      duplicates: duplicates.size,
      errors,
      firstRows: transactions.slice(0, 10),
    });
  }

  const { data: importRow } = await supabase.from("bookkeeping_imports").insert({
    import_type: "workbook",
    filename: safeFilename(file.name),
    file_hash: hashBuffer(buffer),
    total_rows: transactions.length,
    imported_rows: 0,
    duplicate_rows: duplicates.size,
    failed_rows: errors.length,
    error_details: errors,
    started_at: startedAt,
  }).select().single();

  let imported = 0;
  if (newRows.length) {
    const { error } = await supabase.from("bookkeeping_transactions").insert(newRows);
    if (error) {
      errors.push({ rowNumber: 0, error: error.message });
    } else {
      imported = newRows.length;
    }
  }

  const bikeSheet = workbook.getWorksheet("Bike Stock");
  const bikeRows = [];
  if (bikeSheet) {
    const map = new Map<string, number>();
    bikeSheet.getRow(1).eachCell((c, col) => map.set(headerKey(text(c.value).trim()), col));
    for (let rowNumber = 2; rowNumber <= bikeSheet.rowCount; rowNumber += 1) {
      const row = bikeSheet.getRow(rowNumber);
      const ref = text(cell(row, map, "Bike ID / Reg")).trim();
      const makeModel = text(cell(row, map, "Make / Model")).trim();
      if (!ref && !makeModel) continue;
      const [make, ...modelParts] = makeModel.split(" ");
      bikeRows.push({
        purchase_date: dateKey(cell(row, map, "Purchase Date")) || null,
        registration: ref || null,
        make: make || null,
        model: modelParts.join(" ") || null,
        purchase_price: money(cell(row, map, "Purchase Price (£)") ?? cell(row, map, "Purchase Price (Ł)")),
        sale_date: dateKey(cell(row, map, "Sale Date")) || null,
        sale_price: money(cell(row, map, "Sale Price (£)") ?? cell(row, map, "Sale Price (Ł)")) || null,
        buyer_or_seller: text(cell(row, map, "Customer / Source")).trim() || null,
        status: text(cell(row, map, "Status")).trim() || "In stock",
        notes: text(cell(row, map, "Notes")).trim() || null,
      });
    }
  }
  if (bikeRows.length) await supabase.from("bookkeeping_bike_stock").insert(bikeRows);

  const mileageSheet = workbook.getWorksheet("Mileage");
  const mileageRows = [];
  if (mileageSheet) {
    const map = new Map<string, number>();
    mileageSheet.getRow(1).eachCell((c, col) => map.set(headerKey(text(c.value).trim()), col));
    for (let rowNumber = 2; rowNumber <= mileageSheet.rowCount; rowNumber += 1) {
      const row = mileageSheet.getRow(rowNumber);
      const journeyDate = dateKey(cell(row, map, "Date"));
      const purpose = text(cell(row, map, "Journey / Purpose")).trim();
      if (!journeyDate || !purpose) continue;
      mileageRows.push({
        journey_date: journeyDate,
        start_location: text(cell(row, map, "From")).trim() || null,
        end_location: text(cell(row, map, "To")).trim() || null,
        purpose,
        miles: Number(cell(row, map, "Business Miles") ?? 0),
        rate_per_mile: money(cell(row, map, "Rate (£/mile)") ?? cell(row, map, "Rate (Ł/mile)")),
        claim_amount: money(cell(row, map, "Allowable Mileage (£)") ?? cell(row, map, "Allowable Mileage (Ł)")),
        vehicle: text(cell(row, map, "Vehicle")).trim() || null,
        notes: text(cell(row, map, "Notes")).trim() || null,
      });
    }
  }
  if (mileageRows.length) await supabase.from("bookkeeping_mileage").insert(mileageRows);

  if (importRow?.id) {
    await supabase.from("bookkeeping_imports").update({
      imported_rows: imported + bikeRows.length + mileageRows.length,
      failed_rows: errors.length,
      error_details: errors,
      completed_at: new Date().toISOString(),
    }).eq("id", importRow.id);
  }

  return NextResponse.json({ imported, duplicates: duplicates.size, failed: errors.length, total: transactions.length, errors });
}
