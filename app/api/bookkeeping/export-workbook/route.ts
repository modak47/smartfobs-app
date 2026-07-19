import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { existsSync } from "node:fs";
import { mkdir, copyFile } from "node:fs/promises";
import { currentDateKey } from "@/lib/production-bookkeeping/core";
import { serverSupabase } from "@/lib/production-bookkeeping/server";

export const runtime = "nodejs";

const sourceWorkbook = "data/imports/DWB_Accountant_Bookkeeping_2026-27 live.xlsx";
const templatePath = "templates/DWB-accountant-template.xlsx";

async function ensureTemplate() {
  if (!existsSync(templatePath) && existsSync(sourceWorkbook)) {
    await mkdir("templates", { recursive: true });
    await copyFile(sourceWorkbook, templatePath);
  }
}

function clearRows(sheet: ExcelJS.Worksheet, startRow = 2) {
  if (sheet.rowCount >= startRow) sheet.spliceRows(startRow, sheet.rowCount - startRow + 1);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taxYear = searchParams.get("taxYear") || "2026-27";
  await ensureTemplate();
  if (!existsSync(templatePath)) return NextResponse.json({ error: "Workbook template not found" }, { status: 400 });

  const supabase = serverSupabase();
  const [{ data: transactions }, { data: stock }, { data: mileage }] = await Promise.all([
    supabase.from("bookkeeping_transactions").select("*").order("transaction_date", { ascending: true }),
    supabase.from("bookkeeping_bike_stock").select("*").order("purchase_date", { ascending: true }),
    supabase.from("bookkeeping_mileage").select("*").order("journey_date", { ascending: true }),
  ]);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const txSheet = workbook.getWorksheet("Transactions");
  if (txSheet) {
    clearRows(txSheet);
    (transactions || []).forEach((row, index) => {
      txSheet.addRow([
        row.transaction_date,
        row.bank_type,
        row.description,
        Number(row.original_amount || 0),
        row.direction,
        row.payment_method,
        row.category,
        row.subcategory,
        row.business_status,
        Number(row.business_use_percent || 100) / 100,
        row.allowable_status,
        Number(row.allowable_income || 0),
        Number(row.allowable_expense || 0),
        row.vat_treatment,
        row.receipt_status,
        row.receipt_file_url,
        row.bike_job_reference,
        row.mtd_quarter,
        row.notes,
        row.accountant_review,
        row.bank_balance,
      ]);
      const previous = txSheet.getRow(Math.max(2, index + 1));
      const added = txSheet.getRow(index + 2);
      previous.eachCell({ includeEmpty: true }, (cell, col) => {
        added.getCell(col).style = { ...cell.style };
      });
    });
  }

  const stockSheet = workbook.getWorksheet("Bike Stock");
  if (stockSheet) {
    clearRows(stockSheet);
    (stock || []).forEach((row) => stockSheet.addRow([
      row.registration,
      row.purchase_date,
      [row.make, row.model].filter(Boolean).join(" "),
      Number(row.purchase_price || 0),
      0,
      0,
      row.status,
      row.sale_date,
      row.sale_price,
      row.sale_price && row.purchase_price ? Number(row.sale_price) - Number(row.purchase_price) : null,
      row.buyer_or_seller,
      row.notes,
    ]));
  }

  const mileageSheet = workbook.getWorksheet("Mileage");
  if (mileageSheet) {
    clearRows(mileageSheet);
    (mileage || []).forEach((row) => mileageSheet.addRow([
      row.journey_date,
      row.purpose,
      row.start_location,
      row.end_location,
      row.vehicle,
      row.miles,
      row.rate_per_mile,
      row.claim_amount,
      row.notes,
    ]));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="DWB_Accountant_Bookkeeping_${taxYear}_${currentDateKey()}.xlsx"`,
    },
  });
}
