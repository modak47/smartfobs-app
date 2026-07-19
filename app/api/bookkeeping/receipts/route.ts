import { NextResponse } from "next/server";
import { money } from "@/lib/production-bookkeeping/core";
import { safeFilename, serverSupabase } from "@/lib/production-bookkeeping/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No receipt file supplied" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Receipt file is too large" }, { status: 400 });

  const supabase = serverSupabase();
  const transactionId = String(form.get("transaction_id") || "") || null;
  const receiptDate = String(form.get("receipt_date") || "") || null;
  const merchant = String(form.get("merchant") || "") || null;
  const totalAmount = money(form.get("total_amount"));
  const category = String(form.get("category") || "") || null;
  const notes = String(form.get("notes") || "") || null;
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeFilename(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("bookkeeping-receipts")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: receipt, error } = await supabase.from("bookkeeping_receipts").insert({
    transaction_id: transactionId,
    receipt_date: receiptDate,
    merchant,
    total_amount: totalAmount,
    category,
    notes,
    storage_path: path,
    status: transactionId ? "matched" : "unmatched",
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (transactionId) {
    await supabase.from("bookkeeping_transactions").update({
      receipt_id: receipt.id,
      receipt_status: "matched",
    }).eq("id", transactionId);
  }

  return NextResponse.json({ receipt });
}

export async function PATCH(request: Request) {
  const { receipt_id, transaction_id, action } = await request.json();
  const supabase = serverSupabase();
  if (action === "detach") {
    await supabase.from("bookkeeping_transactions").update({ receipt_id: null, receipt_status: "To find" }).eq("receipt_id", receipt_id);
    const { data, error } = await supabase.from("bookkeeping_receipts").update({ transaction_id: null, status: "unmatched" }).eq("id", receipt_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ receipt: data });
  }
  if (!receipt_id || !transaction_id) return NextResponse.json({ error: "Missing receipt or transaction id" }, { status: 400 });
  const { data, error } = await supabase.from("bookkeeping_receipts").update({ transaction_id, status: "matched" }).eq("id", receipt_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabase.from("bookkeeping_transactions").update({ receipt_id, receipt_status: "matched" }).eq("id", transaction_id);
  return NextResponse.json({ receipt: data });
}
