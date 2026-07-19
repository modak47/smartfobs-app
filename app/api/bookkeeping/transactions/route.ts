import { NextResponse } from "next/server";
import { calculateAllowables, transactionHash } from "@/lib/production-bookkeeping/core";
import { serverSupabase } from "@/lib/production-bookkeeping/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const recalculated = calculateAllowables(body);
  const payload = {
    ...body,
    ...recalculated,
    transaction_hash: transactionHash(body),
  };
  delete payload.id;
  const { data, error } = await serverSupabase()
    .from("bookkeeping_transactions")
    .insert(payload)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ transaction: data });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
  const recalculated = calculateAllowables(updates);
  const finalUpdates = { ...updates, ...recalculated };
  if (updates.transaction_date && updates.description && updates.original_amount !== undefined) {
    finalUpdates.transaction_hash = transactionHash(updates);
  }
  const { data, error } = await serverSupabase()
    .from("bookkeeping_transactions")
    .update(finalUpdates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ transaction: data });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
  const { error } = await serverSupabase().from("bookkeeping_transactions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
