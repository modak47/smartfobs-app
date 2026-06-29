"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Job = {
  id: string;
  job_date: string;
  customer_name: string | null;
  dealer_name: string | null;
  contact: string | null;
  vehicle: string | null;
  registration: string | null;
  job_type: string | null;
  source: string | null;
  payment_method: string | null;
  payment_status: string | null;
  amount_charged: number | null;
  notes: string | null;
  shopify_order_id: string | null;
};

type Expense = {
  id: string;
  expense_date: string;
  supplier: string | null;
  category: string | null;
  description: string | null;
  amount: number | null;
  payment_method: string | null;
  notes: string | null;
};

const today = new Date().toISOString().slice(0, 10);

export default function SmartFobsPage() {
  const [tab, setTab] = useState<"jobs" | "expenses">("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState("");

  const [jobForm, setJobForm] = useState({
    job_date: today,
    customer_name: "",
    dealer_name: "",
    contact: "",
    vehicle: "",
    registration: "",
    job_type: "",
    source: "Manual",
    payment_method: "Bank Transfer",
    payment_status: "Paid",
    amount_charged: "",
    notes: "",
  });

  const [expenseForm, setExpenseForm] = useState({
    expense_date: today,
    supplier: "",
    category: "Keys / Stock",
    description: "",
    amount: "",
    payment_method: "Bank Transfer",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: jobsData } = await supabase
      .from("smartfobs_jobs")
      .select("*")
      .order("job_date", { ascending: false });

    const { data: expensesData } = await supabase
      .from("smartfobs_expenses")
      .select("*")
      .order("expense_date", { ascending: false });

    setJobs((jobsData || []) as Job[]);
    setExpenses((expensesData || []) as Expense[]);
  }

  async function addJob() {
    if (!jobForm.job_date || !jobForm.amount_charged) return alert("Date and amount required");

    const { error } = await supabase.from("smartfobs_jobs").insert({
      ...jobForm,
      amount_charged: Number(jobForm.amount_charged),
    });

    if (error) return alert(error.message);

    setJobForm({
      job_date: today,
      customer_name: "",
      dealer_name: "",
      contact: "",
      vehicle: "",
      registration: "",
      job_type: "",
      source: "Manual",
      payment_method: "Bank Transfer",
      payment_status: "Paid",
      amount_charged: "",
      notes: "",
    });

    loadData();
  }

  async function addExpense() {
    if (!expenseForm.expense_date || !expenseForm.amount) return alert("Date and amount required");

    const { error } = await supabase.from("smartfobs_expenses").insert({
      ...expenseForm,
      amount: Number(expenseForm.amount),
    });

    if (error) return alert(error.message);

    setExpenseForm({
      expense_date: today,
      supplier: "",
      category: "Keys / Stock",
      description: "",
      amount: "",
      payment_method: "Bank Transfer",
      notes: "",
    });

    loadData();
  }

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

  const totals = useMemo(() => {
    const income = jobs.reduce((sum, j) => sum + Number(j.amount_charged || 0), 0);
    const expensesTotal = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return {
      income,
      expenses: expensesTotal,
      profit: income - expensesTotal,
      jobCount: jobs.length,
    };
  }, [jobs, expenses]);

  function money(n: number) {
    return n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
  }

  function exportCSV() {
    const rows =
      tab === "jobs"
        ? filteredJobs.map((j) => ({
            date: j.job_date,
            customer: j.customer_name,
            dealer: j.dealer_name,
            vehicle: j.vehicle,
            registration: j.registration,
            job_type: j.job_type,
            source: j.source,
            payment_method: j.payment_method,
            payment_status: j.payment_status,
            amount: j.amount_charged,
            notes: j.notes,
          }))
        : filteredExpenses.map((e) => ({
            date: e.expense_date,
            supplier: e.supplier,
            category: e.category,
            description: e.description,
            amount: e.amount,
            payment_method: e.payment_method,
            notes: e.notes,
          }));

    const csv = [
      Object.keys(rows[0] || {}).join(","),
      ...rows.map((r) =>
        Object.values(r)
          .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartfobs-${tab}.csv`;
    a.click();
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-black">SmartFobs Records</h1>
          <p className="text-zinc-400">Jobs, expenses and accountant-ready exports.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi title="Income" value={money(totals.income)} />
          <Kpi title="Expenses" value={money(totals.expenses)} />
          <Kpi title="Profit" value={money(totals.profit)} />
          <Kpi title="Jobs" value={String(totals.jobCount)} />
        </div>

        <div className="flex gap-2">
          <button onClick={() => setTab("jobs")} className={tab === "jobs" ? activeBtn : btn}>
            Jobs
          </button>
          <button onClick={() => setTab("expenses")} className={tab === "expenses" ? activeBtn : btn}>
            Expenses
          </button>
          <button onClick={exportCSV} className="ml-auto rounded-xl bg-white text-black px-4 py-2 font-bold">
            Export CSV
          </button>
        </div>

        <input
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {tab === "jobs" && (
          <>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 grid md:grid-cols-4 gap-3">
              <Input label="Date" type="date" value={jobForm.job_date} onChange={(v) => setJobForm({ ...jobForm, job_date: v })} />
              <Input label="Customer" value={jobForm.customer_name} onChange={(v) => setJobForm({ ...jobForm, customer_name: v })} />
              <Input label="Dealer" value={jobForm.dealer_name} onChange={(v) => setJobForm({ ...jobForm, dealer_name: v })} />
              <Input label="Contact" value={jobForm.contact} onChange={(v) => setJobForm({ ...jobForm, contact: v })} />
              <Input label="Vehicle" value={jobForm.vehicle} onChange={(v) => setJobForm({ ...jobForm, vehicle: v })} />
              <Input label="Reg" value={jobForm.registration} onChange={(v) => setJobForm({ ...jobForm, registration: v.toUpperCase() })} />
              <Input label="Job Type" value={jobForm.job_type} onChange={(v) => setJobForm({ ...jobForm, job_type: v })} />
              <Input label="Amount" type="number" value={jobForm.amount_charged} onChange={(v) => setJobForm({ ...jobForm, amount_charged: v })} />
              <Select label="Payment" value={jobForm.payment_method} onChange={(v) => setJobForm({ ...jobForm, payment_method: v })} options={["Bank Transfer", "Shopify", "Cash", "SumUp"]} />
              <Select label="Status" value={jobForm.payment_status} onChange={(v) => setJobForm({ ...jobForm, payment_status: v })} options={["Paid", "Unpaid", "Part Paid"]} />
              <Input label="Notes" value={jobForm.notes} onChange={(v) => setJobForm({ ...jobForm, notes: v })} />
              <button onClick={addJob} className="rounded-xl bg-orange-500 text-black font-black px-4 py-3 self-end">
                Add Job
              </button>
            </section>

            <div className="grid gap-3">
              {filteredJobs.map((j) => (
                <div key={j.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-400">{j.job_date}</p>
                      <h3 className="text-xl font-bold">{j.customer_name || j.dealer_name || "Unnamed job"}</h3>
                      <p className="text-zinc-300">{j.vehicle} {j.registration ? `• ${j.registration}` : ""}</p>
                      <p className="text-zinc-500">{j.job_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-orange-400">{money(Number(j.amount_charged || 0))}</p>
                      <p className="text-sm text-zinc-400">{j.payment_method} • {j.payment_status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "expenses" && (
          <>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 grid md:grid-cols-4 gap-3">
              <Input label="Date" type="date" value={expenseForm.expense_date} onChange={(v) => setExpenseForm({ ...expenseForm, expense_date: v })} />
              <Input label="Supplier" value={expenseForm.supplier} onChange={(v) => setExpenseForm({ ...expenseForm, supplier: v })} />
              <Select label="Category" value={expenseForm.category} onChange={(v) => setExpenseForm({ ...expenseForm, category: v })} options={["Keys / Stock", "Postage", "Fuel", "Tools", "Software", "Phone", "Insurance", "Other"]} />
              <Input label="Amount" type="number" value={expenseForm.amount} onChange={(v) => setExpenseForm({ ...expenseForm, amount: v })} />
              <Input label="Description" value={expenseForm.description} onChange={(v) => setExpenseForm({ ...expenseForm, description: v })} />
              <Input label="Notes" value={expenseForm.notes} onChange={(v) => setExpenseForm({ ...expenseForm, notes: v })} />
              <button onClick={addExpense} className="rounded-xl bg-orange-500 text-black font-black px-4 py-3 self-end">
                Add Expense
              </button>
            </section>

            <div className="grid gap-3">
              {filteredExpenses.map((e) => (
                <div key={e.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 flex justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">{e.expense_date}</p>
                    <h3 className="text-xl font-bold">{e.supplier || "Expense"}</h3>
                    <p className="text-zinc-400">{e.category} • {e.description}</p>
                  </div>
                  <p className="text-2xl font-black text-red-400">{money(Number(e.amount || 0))}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-zinc-400 text-sm">{title}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

const btn = "rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2 font-bold";
const activeBtn = "rounded-xl bg-orange-500 text-black px-4 py-2 font-black";

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm text-zinc-400">{label}</span>
      <input
        type={type}
        className="w-full rounded-xl bg-black border border-zinc-800 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm text-zinc-400">{label}</span>
      <select
        className="w-full rounded-xl bg-black border border-zinc-800 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}