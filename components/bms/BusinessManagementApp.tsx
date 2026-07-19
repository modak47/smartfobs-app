"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { calculateAllowables, currentDateKey, formatGBP, normaliseBusinessUsePercent, quarterForDate, summarise } from "@/lib/production-bookkeeping/core";
import type { BookkeepingBikeStock, BookkeepingMileage, BookkeepingReceipt, BookkeepingTransaction, CategoryRule } from "@/lib/production-bookkeeping/types";
import { KpiCard } from "@/components/bms/KpiCard";

type Section = "dashboard" | "transactions" | "review" | "imports" | "jobs" | "stock" | "receipts" | "mileage" | "tax" | "reports" | "settings";

const navItems: { key: Section; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "transactions", label: "Transactions" },
  { key: "review", label: "Review Queue" },
  { key: "imports", label: "Imports" },
  { key: "jobs", label: "Jobs" },
  { key: "stock", label: "Motorcycle Stock" },
  { key: "receipts", label: "Receipts" },
  { key: "mileage", label: "Mileage" },
  { key: "tax", label: "Tax & MTD" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" },
];

const mobileNavItems: { key: Section; label: string }[] = [
  { key: "dashboard", label: "Home" },
  { key: "transactions", label: "Txns" },
  { key: "review", label: "Review" },
  { key: "receipts", label: "Receipts" },
  { key: "imports", label: "Import" },
  { key: "tax", label: "Tax" },
  { key: "reports", label: "Reports" },
  { key: "stock", label: "Stock" },
  { key: "mileage", label: "Miles" },
  { key: "settings", label: "Settings" },
];

const categories = [
  "Needs Review",
  "SmartFobs Sales",
  "Labour / Contract Income",
  "Bike Sales",
  "Other Business Income",
  "Bike Purchases (Stock)",
  "Parts and Materials",
  "Keys / Stock / Small Parts",
  "Fuel / Vehicle Costs",
  "Travel and Parking",
  "Postage and Courier",
  "Software and Subscriptions",
  "Advertising and Marketing",
  "Tools and Equipment",
  "Repairs and Maintenance",
  "Office and Stationery",
  "Accountancy and Legal",
  "Owner Drawings",
  "Transfer Between Own Accounts",
  "Personal / Non-business",
  "Other Business Expense",
];

function emptyFilters() {
  return { dateFrom: "", dateTo: "", category: "all", business: "all", receipt: "all", quarter: "all", needsReview: false, sort: "date_desc" };
}

export default function BusinessManagementApp({ initialSection = "dashboard" }: { initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection);
  const [transactions, setTransactions] = useState<BookkeepingTransaction[]>([]);
  const [receipts, setReceipts] = useState<BookkeepingReceipt[]>([]);
  const [mileage, setMileage] = useState<BookkeepingMileage[]>([]);
  const [stock, setStock] = useState<BookkeepingBikeStock[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<BookkeepingTransaction | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    const [tx, rc, mi, st, ru] = await Promise.all([
      supabase.from("bookkeeping_transactions").select("*").order("transaction_date", { ascending: false }).limit(2000),
      supabase.from("bookkeeping_receipts").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("bookkeeping_mileage").select("*").order("journey_date", { ascending: false }).limit(500),
      supabase.from("bookkeeping_bike_stock").select("*").order("purchase_date", { ascending: false }).limit(500),
      supabase.from("bookkeeping_category_rules").select("*").order("priority", { ascending: true }),
    ]);
    if (tx.error) setError(tx.error.message);
    setTransactions((tx.data || []) as BookkeepingTransaction[]);
    setReceipts(await withSignedReceiptUrls((rc.data || []) as BookkeepingReceipt[]));
    setMileage((mi.data || []) as BookkeepingMileage[]);
    setStock((st.data || []) as BookkeepingBikeStock[]);
    setRules((ru.data || []) as CategoryRule[]);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    async function initialLoad() {
      setLoading(true);
      setError("");
      const [tx, rc, mi, st, ru] = await Promise.all([
        supabase.from("bookkeeping_transactions").select("*").order("transaction_date", { ascending: false }).limit(2000),
        supabase.from("bookkeeping_receipts").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("bookkeeping_mileage").select("*").order("journey_date", { ascending: false }).limit(500),
        supabase.from("bookkeeping_bike_stock").select("*").order("purchase_date", { ascending: false }).limit(500),
        supabase.from("bookkeeping_category_rules").select("*").order("priority", { ascending: true }),
      ]);
      if (!active) return;
      if (tx.error) setError(tx.error.message);
      setTransactions((tx.data || []) as BookkeepingTransaction[]);
      setReceipts(await withSignedReceiptUrls((rc.data || []) as BookkeepingReceipt[]));
      setMileage((mi.data || []) as BookkeepingMileage[]);
      setStock((st.data || []) as BookkeepingBikeStock[]);
      setRules((ru.data || []) as CategoryRule[]);
      setLoading(false);
    }
    void initialLoad();
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => summarise(transactions), [transactions]);
  const filtered = useMemo(() => filterTransactions(transactions, query, filters), [transactions, query, filters]);
  const reviewRows = useMemo(() => transactions.filter(isReviewNeeded), [transactions]);

  function showRows(target: "review" | "missing_receipts" | "transactions") {
    if (target === "review") {
      setFilters(emptyFilters());
      setQuery("");
      setSection("review");
      return;
    }
    if (target === "missing_receipts") {
      setFilters({ ...emptyFilters(), receipt: "To find" });
      setQuery("");
      setSection("transactions");
      return;
    }
    setFilters(emptyFilters());
    setQuery("");
    setSection("transactions");
  }

  async function mutate(path: string, init: RequestInit) {
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch(path, init);
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Action failed");
      return null;
    }
    setNotice("Saved successfully");
    await loadData();
    return json;
  }

  async function uploadImport(file: File, type: "workbook" | "hsbc") {
    const endpoint = type === "workbook" ? "/api/bookkeeping/import-workbook" : "/api/bookkeeping/import-hsbc";
    const previewForm = new FormData();
    previewForm.set("file", file);
    previewForm.set("mode", "preview");
    setBusy(true);
    const previewRes = await fetch(endpoint, { method: "POST", body: previewForm });
    const preview = await previewRes.json().catch(() => ({}));
    setBusy(false);
    if (!previewRes.ok) {
      setError(preview.error || "Could not preview import");
      return;
    }
    const ok = confirm(
      [
        `${type === "workbook" ? "Workbook" : "HSBC CSV"} preview`,
        `Sheet/CSV rows: ${preview.totalRows ?? 0}`,
        `Valid rows: ${preview.validRows ?? preview.totalRows ?? 0}`,
        `Duplicates: ${preview.duplicates ?? 0}`,
        `Rows with errors: ${preview.errors?.length ?? 0}`,
        "",
        "Import these rows now?",
      ].join("\n"),
    );
    if (!ok) return;
    const form = new FormData();
    form.set("file", file);
    const result = await mutate(endpoint, { method: "POST", body: form });
    if (result) setNotice(`Imported ${result.imported}. Duplicates skipped ${result.duplicates}. Failed ${result.failed}.`);
  }

  async function saveTransaction(row: BookkeepingTransaction) {
    const allowables = calculateAllowables(row);
    const result = await mutate("/api/bookkeeping/transactions", {
      method: row.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...row, ...allowables }),
    });
    if (result) setSelected(null);
  }

  async function repairAllowables() {
    const result = await mutate("/api/bookkeeping/repair-allowables", { method: "POST" });
    if (result) setNotice(`Recalculated ${result.updated} imported transaction totals.`);
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Delete this transaction?")) return;
    await mutate(`/api/bookkeeping/transactions?id=${id}`, { method: "DELETE" });
    setSelected(null);
  }

  async function bulkEdit(field: string, value: string) {
    if (!selectedIds.size || !value) return;
    setBusy(true);
    for (const id of selectedIds) {
      const current = transactions.find((t) => t.id === id);
      if (!current) continue;
      await fetch("/api/bookkeeping/transactions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...current, [field]: value }),
      });
    }
    setSelectedIds(new Set());
    setBusy(false);
    setNotice("Bulk edit complete");
    await loadData();
  }

  return (
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(119,255,0,0.14),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_28%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 pb-28 pt-3 sm:px-6 sm:py-5 lg:px-8">
        <header className="sticky top-2 z-30 mb-4 flex flex-col gap-3 rounded-[1.75rem] border border-white/10 bg-[#080c13]/90 p-3 shadow-2xl shadow-black/30 backdrop-blur md:static md:mb-6 md:flex-row md:items-center md:justify-between md:p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black sm:h-14 sm:w-14">
              <Image src="/logo.png" alt="SmartFobs logo" fill sizes="56px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.32em] text-lime-300">DWB Trading</p>
              <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">SmartFobs Bookkeeping</h1>
              <p className="hidden text-sm text-slate-400 sm:block">Supabase is live truth. Excel is import/export only.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <button onClick={loadData} className="btn-secondary mobile-tap">Refresh</button>
            <a href="/api/bookkeeping/export-workbook" className="btn-primary mobile-tap text-center">Export Workbook</a>
          </div>
        </header>

        {notice ? <div className="mb-4 rounded-2xl border border-lime-300/20 bg-lime-300/10 p-3 text-sm text-lime-100">{notice}</div> : null}
        {error ? <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</div> : null}

        <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
          <nav className="hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-3 lg:sticky lg:top-5 lg:grid lg:grid-cols-1 lg:self-start">
            {navItems.map((item) => (
              <button key={item.key} onClick={() => setSection(item.key)} className={`rounded-2xl px-3 py-3 text-left text-sm transition ${section === item.key ? "bg-white text-black" : "text-slate-300 hover:bg-white/10"}`}>
                {item.label}
              </button>
            ))}
          </nav>

          <section className="space-y-5">
            {loading ? <Panel title="Loading">Reading live Supabase data…</Panel> : null}
            {section === "dashboard" && <Dashboard summary={summary} transactions={transactions} stock={stock} repairAllowables={repairAllowables} needsStoredTotalRepair={needsStoredTotalRepair(transactions)} openRows={showRows} openTransaction={setSelected} />}
            {section === "transactions" && <Transactions rows={filtered} query={query} setQuery={setQuery} filters={filters} setFilters={setFilters} selectedIds={selectedIds} setSelectedIds={setSelectedIds} setSelected={setSelected} bulkEdit={bulkEdit} />}
            {section === "review" && <ReviewQueue rows={reviewRows} setSelected={setSelected} />}
            {section === "imports" && <Imports uploadImport={uploadImport} busy={busy} />}
            {section === "jobs" && <Transactions rows={transactions.filter((t) => t.direction === "Income" || t.bike_job_reference)} query="" setQuery={() => {}} filters={filters} setFilters={setFilters} selectedIds={selectedIds} setSelectedIds={setSelectedIds} setSelected={setSelected} bulkEdit={bulkEdit} />}
            {section === "receipts" && <Receipts receipts={receipts} transactions={transactions} reload={loadData} />}
            {section === "mileage" && <Mileage rows={mileage} reload={loadData} />}
            {section === "stock" && <BikeStock rows={stock} transactions={transactions} reload={loadData} />}
            {section === "tax" && <Tax summary={summary} />}
            {section === "reports" && <Reports transactions={transactions} />}
            {section === "settings" && <Settings rules={rules} reload={loadData} />}
          </section>
        </div>
      </div>
      <MobileBottomNav section={section} setSection={setSection} />
      {selected ? <TransactionModal row={selected} setRow={setSelected} save={saveTransaction} remove={deleteTransaction} reload={loadData} /> : null}
    </main>
  );
}

function MobileBottomNav({ section, setSection }: { section: Section; setSection: (section: Section) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#080c13]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-2xl shadow-black/60 backdrop-blur lg:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {mobileNavItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setSection(item.key)}
            className={`mobile-tap min-w-[4.7rem] rounded-2xl px-3 py-2 text-center text-xs font-medium transition ${
              section === item.key ? "bg-white text-black" : "bg-white/[0.06] text-slate-300"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Dashboard({
  summary,
  transactions,
  stock,
  repairAllowables,
  needsStoredTotalRepair,
  openRows,
  openTransaction,
}: {
  summary: ReturnType<typeof summarise>;
  transactions: BookkeepingTransaction[];
  stock: BookkeepingBikeStock[];
  repairAllowables: () => void;
  needsStoredTotalRepair: boolean;
  openRows: (target: "review" | "missing_receipts" | "transactions") => void;
  openTransaction: (row: BookkeepingTransaction) => void;
}) {
  const quarters = ["Q1", "Q2", "Q3", "Q4"].map((q) => {
    const rows = summary.rows.filter((t) => t.mtd_quarter === q || quarterForDate(t.transaction_date) === q);
    const income = rows.reduce((s, r) => s + Number(r.allowable_income || 0), 0);
    const expenses = rows.reduce((s, r) => s + Number(r.allowable_expense || 0), 0);
    return { q, income, expenses, profit: income - expenses };
  });
  const stockValue = stock.filter((s) => s.status !== "Sold").reduce((sum, s) => sum + Number(s.purchase_price || 0), 0);
  return (
    <>
      {needsStoredTotalRepair ? (
        <Panel title="Imported rows need total repair" subtitle="The transactions imported, but their allowable income/expense totals are blank. Receipts are not the reason. Click once to recalculate them in Supabase.">
          <button className="btn-primary" onClick={repairAllowables}>Repair imported totals</button>
        </Panel>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <button className="text-left" onClick={() => openRows("transactions")}><KpiCard label="Business income" value={formatGBP(summary.income)} accent="green" hint="Click to open transactions" /></button>
        <button className="text-left" onClick={() => openRows("transactions")}><KpiCard label="Allowable expenses" value={formatGBP(summary.expenses)} accent="rose" hint="Click to open transactions" /></button>
        <KpiCard label="Profit recorded so far" value={formatGBP(summary.profit)} accent="blue" />
        <KpiCard label="Suggested tax reserve" value={formatGBP(summary.taxReserve)} accent="amber" />
        <button className="text-left" onClick={() => openRows("missing_receipts")}><KpiCard label="Missing receipts" value={String(summary.missingReceipts)} accent="rose" hint="Click to show missing receipt transactions" /></button>
        <button className="text-left" onClick={() => openRows("review")}><KpiCard label="Needs Review" value={String(summary.needsReview)} accent="amber" hint="Click to show the review queue" /></button>
        <KpiCard label="Latest bank balance" value={formatGBP(summary.latestBalance)} accent="slate" />
        <KpiCard label="Motorcycle stock value" value={formatGBP(stockValue)} accent="green" />
      </div>
      <Panel title="Quarterly MTD updates" subtitle="Quarterly MTD updates are reporting updates and are not quarterly tax bills.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[...quarters, { q: "Full year", income: summary.income, expenses: summary.expenses, profit: summary.profit }].map((q) => (
            <div key={q.q} className="rounded-2xl bg-white/[0.04] p-4">
              <p className="font-semibold">{q.q}</p>
              <p className="text-sm text-slate-400">Income {formatGBP(q.income)}</p>
              <p className="text-sm text-slate-400">Expenses {formatGBP(q.expenses)}</p>
              <p className="mt-1 text-lime-200">{formatGBP(q.profit)}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Recent Activity" subtitle="Click any row to inspect or edit it."><TransactionList rows={transactions.slice(0, 8)} onClick={openTransaction} /></Panel>
    </>
  );
}

function Imports({ uploadImport, busy }: { uploadImport: (file: File, type: "workbook" | "hsbc") => void; busy: boolean }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Panel title="Import Existing Workbook" subtitle="Accepts .xlsx. Preview is handled server-side before rows are committed by hash duplicate detection.">
        <FileButton label="Import Existing Workbook" accept=".xlsx" busy={busy} onFile={(file) => uploadImport(file, "workbook")} />
      </Panel>
      <Panel title="Import HSBC CSV" subtitle="Signed Amount column. Positive is money in; negative is money out. Existing edits are never overwritten.">
        <FileButton label="Import HSBC CSV" accept=".csv" busy={busy} onFile={(file) => uploadImport(file, "hsbc")} />
      </Panel>
    </div>
  );
}

function ReviewQueue({ rows, setSelected }: { rows: BookkeepingTransaction[]; setSelected: (row: BookkeepingTransaction) => void }) {
  return (
    <Panel title={`Review Queue · ${rows.length}`} subtitle="These are the transactions that affect the dashboard's Needs Review count. Missing receipts live under the Missing Receipts filter instead.">
      {rows.length ? (
        <div className="grid gap-3">
          {rows.map((row) => (
            <button
              key={row.id}
              onClick={() => setSelected(row)}
              className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-left transition hover:bg-amber-300/15"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{row.description}</p>
                  <p className="mt-1 text-sm text-slate-400">{row.transaction_date} · {row.category || "No category"} · {formatGBP(row.original_amount)}</p>
                </div>
                <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-semibold text-black">Review</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {reviewReasons(row).map((reason) => (
                  <span key={reason} className="rounded-full bg-black/30 px-2 py-1 text-xs text-amber-100">{reason}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">Nothing needs bookkeeping review right now.</div>
      )}
    </Panel>
  );
}

function Transactions(props: {
  rows: BookkeepingTransaction[];
  query: string;
  setQuery: (v: string) => void;
  filters: Record<string, string | boolean>;
  setFilters: (v: { dateFrom: string; dateTo: string; category: string; business: string; receipt: string; quarter: string; needsReview: boolean; sort: string }) => void;
  selectedIds: Set<string>;
  setSelectedIds: (v: Set<string>) => void;
  setSelected: (v: BookkeepingTransaction) => void;
  bulkEdit: (field: string, value: string) => void;
}) {
  const [page, setPage] = useState(1);
  const perPage = 50;
  const paged = props.rows.slice((page - 1) * perPage, page * perPage);
  const hasActiveFilters = props.query || Object.entries(props.filters).some(([key, value]) => key !== "sort" && value !== "" && value !== "all" && value !== false);
  return (
    <Panel title="Transactions" subtitle="Live Supabase transactions with filters, bulk edit and click-to-edit.">
      <div className="space-y-3">
        <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="Search transactions..." className="input" />
        <details className="rounded-2xl border border-white/10 bg-black/20 p-3 md:open:bg-transparent" open={hasActiveFilters ? true : undefined}>
          <summary className="cursor-pointer select-none text-sm font-semibold text-slate-200">Filters & sorting</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <input type="date" value={String(props.filters.dateFrom)} onChange={(e) => props.setFilters({ ...props.filters, dateFrom: e.target.value } as never)} className="input" />
            <input type="date" value={String(props.filters.dateTo)} onChange={(e) => props.setFilters({ ...props.filters, dateTo: e.target.value } as never)} className="input" />
            <select value={String(props.filters.category)} onChange={(e) => props.setFilters({ ...props.filters, category: e.target.value } as never)} className="input"><option value="all">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={String(props.filters.business)} onChange={(e) => props.setFilters({ ...props.filters, business: e.target.value } as never)} className="input"><option value="all">Business/personal</option>{["Business", "Mixed", "Personal", "Exclude", "Review"].map((c) => <option key={c}>{c}</option>)}</select>
            <select value={String(props.filters.receipt)} onChange={(e) => props.setFilters({ ...props.filters, receipt: e.target.value } as never)} className="input"><option value="all">Receipt status</option>{["To find", "Not needed", "matched", "unmatched", "review_required"].map((c) => <option key={c}>{c}</option>)}</select>
            <select value={String(props.filters.quarter)} onChange={(e) => props.setFilters({ ...props.filters, quarter: e.target.value } as never)} className="input"><option value="all">MTD quarter</option>{["Q1", "Q2", "Q3", "Q4"].map((c) => <option key={c}>{c}</option>)}</select>
            <select value={String(props.filters.sort)} onChange={(e) => props.setFilters({ ...props.filters, sort: e.target.value } as never)} className="input"><option value="date_desc">Newest</option><option value="date_asc">Oldest</option><option value="amount_desc">Highest amount</option><option value="amount_asc">Lowest amount</option></select>
          </div>
        </details>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button className="btn-primary" onClick={() => props.setSelected(newTransaction())}>Add Transaction</button>
        <button className="btn-secondary" onClick={() => { props.setQuery(""); props.setFilters(emptyFilters()); }}>Clear filters</button>
        <BulkButton label="Bulk Category" options={categories} onApply={(v) => props.bulkEdit("category", v)} />
        <BulkButton label="Bulk Business" options={["Business", "Mixed", "Personal", "Exclude", "Review"]} onApply={(v) => props.bulkEdit("business_status", v)} />
        <BulkButton label="Bulk Allowable" options={["Yes", "No", "Stock", "Review"]} onApply={(v) => props.bulkEdit("allowable_status", v)} />
        <BulkButton label="Bulk Receipt" options={["To find", "Not needed", "matched", "review_required"]} onApply={(v) => props.bulkEdit("receipt_status", v)} />
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">
        Showing {props.rows.length} live Supabase rows{hasActiveFilters ? " after filters" : ""}. Select rows with checkboxes, then bulk edit.
      </div>
      <div className="mt-4"><TransactionList rows={paged} selectedIds={props.selectedIds} setSelectedIds={props.setSelectedIds} onClick={props.setSelected} /></div>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
        <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(Math.max(1, page - 1))}>Previous</button>
        <span>Page {page} · {props.rows.length} rows</span>
        <button className="btn-secondary" disabled={page * perPage >= props.rows.length} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </Panel>
  );
}

function Receipts({ receipts, transactions, reload }: { receipts: BookkeepingReceipt[]; transactions: BookkeepingTransaction[]; reload: () => void }) {
  async function upload(file: File, txId?: string) {
    const form = new FormData();
    form.set("file", file);
    form.set("receipt_date", currentDateKey());
    form.set("merchant", file.name);
    if (txId) form.set("transaction_id", txId);
    await fetch("/api/bookkeeping/receipts", { method: "POST", body: form });
    await reload();
  }
  return (
    <Panel title="Receipts" subtitle="Upload receipts before or after the bank transaction appears.">
      <FileButton label="Take Photo / Upload Receipt" accept="image/*,.pdf" onFile={(file) => upload(file)} />
      <h3 className="mt-6 font-semibold">Awaiting Transaction</h3>
      <div className="mt-3 grid gap-3">
        {receipts.map((r) => (
          <div key={r.id} className="rounded-2xl bg-white/[0.04] p-4">
            <p className="font-semibold">{r.merchant || "Receipt"}</p>
            <p className="text-sm text-slate-400">{r.receipt_date} · {formatGBP(r.total_amount)} · {r.status}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.signed_url ? <a className="btn-secondary" href={r.signed_url} target="_blank">View receipt</a> : null}
              {r.signed_url ? <a className="btn-secondary" href={r.signed_url} download>Download</a> : null}
              {r.transaction_id ? <button className="btn-secondary" onClick={async () => { await fetch("/api/bookkeeping/receipts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ receipt_id: r.id, action: "detach" }) }); reload(); }}>Detach receipt</button> : null}
            </div>
            {!r.transaction_id ? <select className="input mt-3" onChange={async (e) => { if (e.target.value) { await fetch("/api/bookkeeping/receipts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ receipt_id: r.id, transaction_id: e.target.value }) }); reload(); } }}>
                <option value="">Accept match / choose transaction</option>
                {transactions.slice(0, 100).map((t) => <option key={t.id} value={t.id}>{t.transaction_date} · {t.description} · {formatGBP(t.original_amount)}</option>)}
              </select> : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Mileage({ rows, reload }: { rows: BookkeepingMileage[]; reload: () => void }) {
  return <CrudPanel title="Mileage" table="bookkeeping_mileage" empty={{ journey_date: currentDateKey(), purpose: "", miles: 0, rate_per_mile: 0.45, claim_amount: 0 }} rows={rows} reload={reload} fields={["journey_date", "start_location", "end_location", "purpose", "miles", "rate_per_mile", "vehicle", "notes"]} />;
}

function BikeStock({ rows, reload }: { rows: BookkeepingBikeStock[]; transactions: BookkeepingTransaction[]; reload: () => void }) {
  return <CrudPanel title="Motorcycle Stock" table="bookkeeping_bike_stock" empty={{ purchase_date: currentDateKey(), registration: "", make: "", model: "", purchase_price: 0, status: "In stock" }} rows={rows} reload={reload} fields={["purchase_date", "registration", "make", "model", "year", "purchase_price", "sale_date", "sale_price", "buyer_or_seller", "status", "notes"]} />;
}

function Tax({ summary }: { summary: ReturnType<typeof summarise> }) {
  const quarters = ["Q1", "Q2", "Q3", "Q4"].map((q) => {
    const rows = summary.rows.filter((row) => row.mtd_quarter === q || quarterForDate(row.transaction_date) === q);
    const income = rows.reduce((sum, row) => sum + Number(row.allowable_income || 0), 0);
    const expenses = rows.reduce((sum, row) => sum + Number(row.allowable_expense || 0), 0);
    return { q, income, expenses, profit: income - expenses };
  });
  const latestDate = summary.rows.map((row) => row.transaction_date).sort().at(-1) || summary.taxYear.start;
  const taxYearStart = new Date(`${summary.taxYear.start}T00:00:00`);
  const latest = new Date(`${latestDate}T00:00:00`);
  const elapsedDays = Math.max(1, Math.floor((latest.getTime() - taxYearStart.getTime()) / 86_400_000) + 1);
  const projectedProfit = summary.profit > 0 ? (summary.profit / elapsedDays) * 365 : 0;
  return (
    <div className="space-y-5">
      <Panel title="Tax & MTD" subtitle={`Tax year ${summary.taxYear.label}: ${summary.taxYear.start} to ${summary.taxYear.end}. Estimates only, not final tax advice.`}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard label="Tax-year income" value={formatGBP(summary.income)} accent="green" />
          <KpiCard label="Tax-year expenses" value={formatGBP(summary.expenses)} accent="rose" />
          <KpiCard label="Tax-year profit" value={formatGBP(summary.profit)} accent="blue" />
          <KpiCard label="Projected annual profit" value={formatGBP(projectedProfit)} accent="slate" hint={`Run-rate from ${elapsedDays} recorded days`} />
        </div>
      </Panel>

      <Panel title="Recorded tax estimate so far" subtitle="This is based on recorded taxable profit only. It is not the same as cash in the bank.">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Income Tax estimate" value={formatGBP(summary.incomeTax)} accent="amber" />
        <KpiCard label="Class 4 NI estimate" value={formatGBP(summary.class4)} accent="amber" />
        <KpiCard label="Suggested tax reserve" value={formatGBP(summary.taxReserve)} accent="green" />
      </div>
      {summary.taxReserve === 0 ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
          The tax estimate is £0 because recorded profit so far is below the current £12,570 personal allowance / Class 4 NI lower limit used by the app.
          This can change as more income, expenses or other taxable income are added.
        </p>
      ) : null}
      </Panel>

      <Panel title="MTD quarterly position" subtitle="Quarterly MTD updates are reporting updates and are not quarterly tax bills.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[...quarters, { q: "Full year", income: summary.income, expenses: summary.expenses, profit: summary.profit }].map((quarter) => (
            <div key={quarter.q} className="rounded-2xl bg-white/[0.04] p-4">
              <p className="font-semibold">{quarter.q}</p>
              <p className="text-sm text-slate-400">Income {formatGBP(quarter.income)}</p>
              <p className="text-sm text-slate-400">Expenses {formatGBP(quarter.expenses)}</p>
              <p className="mt-1 text-lime-200">{formatGBP(quarter.profit)}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Reports({ transactions }: { transactions: BookkeepingTransaction[] }) {
  const byCategory = new Map<string, number>();
  transactions.forEach((t) => byCategory.set(t.category || "Uncategorised", (byCategory.get(t.category || "Uncategorised") || 0) + Math.abs(Number(t.original_amount || 0))));
  return (
    <Panel title="Reports" subtitle="Live reports from Supabase.">
      {[...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([category, amount]) => <div key={category} className="mb-3 rounded-2xl bg-white/[0.04] p-4 flex justify-between"><span>{category}</span><span>{formatGBP(amount)}</span></div>)}
      <a className="btn-secondary mt-4 inline-block" href={`data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(transactions))}`} download="transactions.csv">Export Transactions CSV</a>
    </Panel>
  );
}

function Settings({ rules, reload }: { rules: CategoryRule[]; reload: () => void }) {
  return <CrudPanel title="Category Rules" table="bookkeeping_category_rules" empty={{ match_text: "", match_type: "contains", category: "Needs Review", business_status: "Review", business_use_percent: 100, allowable_status: "Review", priority: 100, is_active: true }} rows={rules} reload={reload} fields={["match_text", "match_type", "category", "subcategory", "business_status", "business_use_percent", "allowable_status", "priority", "is_active"]} />;
}

function TransactionModal({ row, setRow, save, remove, reload }: { row: BookkeepingTransaction; setRow: (r: BookkeepingTransaction | null) => void; save: (r: BookkeepingTransaction) => void; remove: (id: string) => void; reload: () => void }) {
  const update = (field: keyof BookkeepingTransaction, value: string | number | null) => setRow({ ...row, [field]: value });
  async function uploadReceipt(file: File) {
    const form = new FormData();
    form.set("file", file);
    form.set("transaction_id", row.id);
    form.set("receipt_date", row.transaction_date);
    form.set("merchant", row.description);
    form.set("total_amount", String(Math.abs(row.original_amount)));
    form.set("category", row.category || "");
    await fetch("/api/bookkeeping/receipts", { method: "POST", body: form });
    await reload();
    setRow(null);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-0 backdrop-blur sm:items-center sm:p-4">
      <div className="mobile-sheet mx-auto max-h-[92dvh] w-full max-w-2xl overflow-auto rounded-t-[2rem] border border-white/10 bg-[#0b1018] p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl shadow-black/60 sm:rounded-[2rem] sm:p-5">
        <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between border-b border-white/10 bg-[#0b1018]/95 px-4 py-4 backdrop-blur sm:-mx-5 sm:-mt-5 sm:px-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-lime-300">Transaction</p>
            <h2 className="text-lg font-semibold sm:text-xl">{row.id ? "Edit Transaction" : "Add Transaction"}</h2>
          </div>
          <button className="mobile-tap rounded-full bg-white/10 px-4 py-2 text-lg" onClick={() => setRow(null)}>✕</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="input" type="date" value={row.transaction_date} onChange={(e) => update("transaction_date", e.target.value)} />
          <input className="input" type="number" step="0.01" value={row.original_amount} onChange={(e) => update("original_amount", Number(e.target.value))} />
          <input className="input md:col-span-2" value={row.description} onChange={(e) => update("description", e.target.value)} />
          <Select value={row.direction} options={["Income", "Expense", "Transfer"]} onChange={(v) => update("direction", v)} />
          <input className="input" value={row.payment_method || ""} onChange={(e) => update("payment_method", e.target.value)} />
          <Select value={row.category || ""} options={categories} onChange={(v) => update("category", v)} />
          <input className="input" value={row.subcategory || ""} onChange={(e) => update("subcategory", e.target.value)} />
          <Select value={row.business_status || ""} options={["Business", "Mixed", "Personal", "Exclude", "Review"]} onChange={(v) => update("business_status", v)} />
          <input className="input" type="number" value={normaliseBusinessUsePercent(row.business_use_percent)} onChange={(e) => update("business_use_percent", Number(e.target.value))} />
          <Select value={row.allowable_status || ""} options={["Yes", "No", "Stock", "Review"]} onChange={(v) => update("allowable_status", v)} />
          <input className="input" value={row.vat_treatment || ""} onChange={(e) => update("vat_treatment", e.target.value)} />
          <Select value={row.receipt_status || ""} options={["To find", "Not needed", "matched", "unmatched", "review_required"]} onChange={(v) => update("receipt_status", v)} />
          <input className="input" value={row.bike_job_reference || ""} onChange={(e) => update("bike_job_reference", e.target.value)} />
          <Select value={row.accountant_review || ""} options={["Not reviewed", "Reviewed", "Query for accountant", "Adjusted"]} onChange={(v) => update("accountant_review", v)} />
          <textarea className="input md:col-span-2" value={row.notes || ""} onChange={(e) => update("notes", e.target.value)} />
        </div>
        <div className="sticky bottom-0 -mx-4 mt-5 grid grid-cols-1 gap-2 border-t border-white/10 bg-[#0b1018]/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:-mx-5 sm:grid-cols-3 sm:px-5">
          <button className="btn-primary mobile-tap" onClick={() => save(row)}>Save Transaction</button>
          {row.id ? <FileButton label="Upload Receipt" accept="image/*,.pdf" onFile={uploadReceipt} /> : null}
          {row.id ? <button className="btn-secondary mobile-tap" onClick={() => remove(row.id)}>Delete</button> : null}
        </div>
      </div>
    </div>
  );
}

function CrudPanel({ title, table, rows, empty, fields, reload }: { title: string; table: string; rows: Record<string, unknown>[]; empty: Record<string, unknown>; fields: string[]; reload: () => void }) {
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  async function save() {
    if (!editing) return;
    const payload = { ...editing };
    if (table === "bookkeeping_mileage") payload.claim_amount = Number(payload.miles || 0) * Number(payload.rate_per_mile || 0);
    if (payload.id) await supabase.from(table).update(payload).eq("id", payload.id);
    else await supabase.from(table).insert(payload);
    setEditing(null);
    await reload();
  }
  async function remove(id: string) {
    if (!confirm("Delete this record?")) return;
    await supabase.from(table).delete().eq("id", id);
    await reload();
  }
  return (
    <Panel title={title}><button className="btn-primary mb-4" onClick={() => setEditing(empty)}>Add {title}</button>
      {editing ? <div className="mb-4 grid gap-3 rounded-2xl bg-white/[0.04] p-4 md:grid-cols-2">{fields.map((f) => <input key={f} className="input" placeholder={f} value={String(editing[f] ?? "")} onChange={(e) => setEditing({ ...editing, [f]: e.target.value })} />)}<button className="btn-primary md:col-span-2" onClick={save}>Save</button></div> : null}
      <div className="grid gap-3">{rows.map((r) => <div key={String(r.id)} className="grid gap-3 rounded-2xl bg-white/[0.04] p-4 sm:flex sm:items-center sm:justify-between"><button className="min-w-0 text-left" onClick={() => setEditing(r)}>{fields.slice(0, 3).map((f) => String(r[f] ?? "")).filter(Boolean).join(" · ") || "Record"}</button><button className="btn-secondary w-full sm:w-auto" onClick={() => remove(String(r.id))}>Delete</button></div>)}</div>
    </Panel>
  );
}

function TransactionList({ rows, selectedIds, setSelectedIds, onClick }: { rows: BookkeepingTransaction[]; selectedIds?: Set<string>; setSelectedIds?: (v: Set<string>) => void; onClick: (r: BookkeepingTransaction) => void }) {
  return <div className="grid gap-3">{rows.map((row) => <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06] sm:p-4">
    <div className="flex items-start gap-3">
      {selectedIds && setSelectedIds ? <input className="mt-1 h-5 w-5 shrink-0 accent-lime-300" type="checkbox" checked={selectedIds.has(row.id)} onChange={(e) => { const next = new Set(selectedIds); if (e.target.checked) next.add(row.id); else next.delete(row.id); setSelectedIds(next); }} /> : null}
      <button className="min-w-0 flex-1 text-left" onClick={() => onClick(row)}>
        <div className="grid gap-1 sm:flex sm:justify-between sm:gap-3"><p className="min-w-0 break-words font-semibold leading-snug">{row.description}</p><p className={`font-semibold sm:shrink-0 ${Number(row.original_amount) >= 0 ? "text-lime-300" : "text-rose-300"}`}>{formatGBP(row.original_amount)}</p></div>
        <p className="mt-1 text-xs text-slate-400">{row.transaction_date} · {row.category} · {row.receipt_status}</p>
        <div className="mt-2 flex flex-wrap gap-2">{badges(row).map((b) => <span key={b} className="rounded-full bg-white/10 px-2 py-1 text-xs">{b}</span>)}</div>
      </button>
    </div>
  </div>)}</div>;
}

function badges(row: BookkeepingTransaction) {
  return [
    isReviewNeeded(row) ? "Needs Review" : "",
    isMissingReceipt(row) ? "Missing Receipt" : "",
    row.business_status === "Personal" ? "Personal" : "",
    row.business_status === "Exclude" ? "Excluded" : "",
    row.receipt_id ? "Matched Receipt" : "",
    row.accountant_review === "Query for accountant" ? "Accountant Query" : "",
  ].filter(Boolean);
}

function isReviewNeeded(row: BookkeepingTransaction) {
  return (
    row.category === "Needs Review" ||
    row.business_status === "Review" ||
    row.allowable_status === "Review" ||
    row.accountant_review === "Query for accountant"
  );
}

function isMissingReceipt(row: BookkeepingTransaction) {
  return row.receipt_status === "To find" || row.receipt_status === "review_required";
}

function reviewReasons(row: BookkeepingTransaction) {
  return [
    row.category === "Needs Review" ? "Category needs review" : "",
    row.business_status === "Review" ? "Business status needs review" : "",
    row.allowable_status === "Review" ? "Allowable status needs review" : "",
    row.accountant_review === "Query for accountant" ? "Accountant query" : "",
  ].filter(Boolean);
}

function filterTransactions(rows: BookkeepingTransaction[], query: string, filters: { dateFrom: string; dateTo: string; category: string; business: string; receipt: string; quarter: string; needsReview: boolean; sort: string }) {
  const needle = query.toLowerCase();
  const filtered = rows.filter((r) =>
    (!needle || `${r.description} ${r.category} ${r.notes} ${r.bike_job_reference}`.toLowerCase().includes(needle)) &&
    (!filters.dateFrom || r.transaction_date >= filters.dateFrom) &&
    (!filters.dateTo || r.transaction_date <= filters.dateTo) &&
    (filters.category === "all" || r.category === filters.category) &&
    (filters.business === "all" || r.business_status === filters.business) &&
    (filters.receipt === "all" || r.receipt_status === filters.receipt) &&
    (filters.quarter === "all" || r.mtd_quarter === filters.quarter || quarterForDate(r.transaction_date) === filters.quarter) &&
    (!filters.needsReview || badges(r).includes("Needs Review"))
  );
  return filtered.sort((a, b) => filters.sort === "date_asc" ? a.transaction_date.localeCompare(b.transaction_date) : filters.sort === "amount_desc" ? Math.abs(b.original_amount) - Math.abs(a.original_amount) : filters.sort === "amount_asc" ? Math.abs(a.original_amount) - Math.abs(b.original_amount) : b.transaction_date.localeCompare(a.transaction_date));
}

function newTransaction(): BookkeepingTransaction {
  return {
    id: "",
    transaction_date: currentDateKey(),
    bank_type: null,
    description: "",
    original_amount: 0,
    direction: "Expense",
    payment_method: "Bank Transfer",
    category: "Needs Review",
    subcategory: null,
    business_status: "Review",
    business_use_percent: 100,
    allowable_status: "Review",
    allowable_income: 0,
    allowable_expense: 0,
    vat_treatment: "No VAT registered",
    receipt_status: "To find",
    receipt_file_url: null,
    receipt_id: null,
    bike_job_reference: null,
    mtd_quarter: "",
    notes: null,
    accountant_review: "Not reviewed",
    bank_balance: null,
    source_type: "manual",
    source_filename: null,
    source_row_number: null,
    transaction_hash: null,
  };
}

function needsStoredTotalRepair(transactions: BookkeepingTransaction[]) {
  return transactions.some((row) => {
    const calculated = calculateAllowables(row);
    return (
      Math.abs(Number(row.allowable_income || 0) - calculated.allowable_income) > 0.009 ||
      Math.abs(Number(row.allowable_expense || 0) - calculated.allowable_expense) > 0.009 ||
      Number(row.business_use_percent ?? 100) !== normaliseBusinessUsePercent(row.business_use_percent)
    );
  });
}

async function withSignedReceiptUrls(rows: BookkeepingReceipt[]) {
  return Promise.all(rows.map(async (receipt) => {
    if (!receipt.storage_path) return receipt;
    const { data } = await supabase.storage.from("bookkeeping-receipts").createSignedUrl(receipt.storage_path, 60 * 10);
    return { ...receipt, signed_url: data?.signedUrl ?? null };
  }));
}

function FileButton({ label, accept, busy, onFile }: { label: string; accept: string; busy?: boolean; onFile: (file: File) => void }) {
  return <label className="btn-primary inline-flex cursor-pointer"><input type="file" accept={accept} className="hidden" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); e.currentTarget.value = ""; }} />{busy ? "Working..." : label}</label>;
}

function BulkButton({ label, options, onApply }: { label: string; options: string[]; onApply: (v: string) => void }) {
  return <select className="input max-w-52" defaultValue="" onChange={(e) => { onApply(e.target.value); e.currentTarget.value = ""; }}><option value="">{label}</option>{options.map((o) => <option key={o}>{o}</option>)}</select>;
}

function Select({ value, options, onChange }: { value: string | null | undefined; options: string[]; onChange: (v: string) => void }) {
  return <select className="input" value={value || ""} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 backdrop-blur"><div className="mb-5"><h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>{subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}</div>{children}</section>;
}

function toCsv(rows: BookkeepingTransaction[]) {
  const keys = ["transaction_date", "bank_type", "description", "original_amount", "direction", "category", "business_status", "allowable_income", "allowable_expense", "receipt_status", "notes"];
  return [keys.join(","), ...rows.map((row) => keys.map((key) => `"${String(row[key as keyof BookkeepingTransaction] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
}
