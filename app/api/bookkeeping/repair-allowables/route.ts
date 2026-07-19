import { NextResponse } from "next/server";
import { calculateAllowables, normaliseBusinessUsePercent } from "@/lib/production-bookkeeping/core";
import { serverSupabase } from "@/lib/production-bookkeeping/server";
import type { BookkeepingTransaction } from "@/lib/production-bookkeeping/types";

export const runtime = "nodejs";

export async function POST() {
  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from("bookkeeping_transactions")
    .select("*")
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let updated = 0;
  const errors: string[] = [];
  for (const row of (data || []) as BookkeepingTransaction[]) {
    const calculated = calculateAllowables(row);
    const normalisedPercent = normaliseBusinessUsePercent(row.business_use_percent);
    const currentIncome = Number(row.allowable_income || 0);
    const currentExpense = Number(row.allowable_expense || 0);
    if (
      currentIncome === calculated.allowable_income &&
      currentExpense === calculated.allowable_expense &&
      Number(row.business_use_percent ?? 100) === normalisedPercent
    ) continue;

    const { error: updateError } = await supabase
      .from("bookkeeping_transactions")
      .update({ ...calculated, business_use_percent: normalisedPercent })
      .eq("id", row.id);

    if (updateError) errors.push(`${row.id}: ${updateError.message}`);
    else updated += 1;
  }

  return NextResponse.json({ updated, errors });
}
