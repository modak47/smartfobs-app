"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const today = new Date().toISOString().slice(0, 10);

export default function HomePage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [view, setView] = useState<"home" | "jobs" | "expenses" | "reports">("home");
  const [showForm, setShowForm] = useState<"job" | "expense" | null>(null);

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

    setJobs(jobsData || []);
    setExpenses(expensesData || []);
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

    const { error } = await supabase.from("smartfobs_expenses").insert({
      ...expense,
      amount: Number(expense.amount),
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
    });

    setShowForm(null);
    loadData();
  }

  const totals = useMemo(() => {
    const income = jobs.reduce((sum, j) => sum + Number(j.amount_charged || 0), 0);
    const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const todayIncome = jobs
      .filter((j) => j.job_date === today)
      .reduce((sum, j) => sum + Number(j.amount_charged || 0), 0);

    const todayExpenses = expenses
      .filter((e) => e.expense_date === today)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return {
      income,
      expenseTotal,
      profit: income - expenseTotal,
      todayIncome,
      todayExpenses,
      todayProfit: todayIncome - todayExpenses,
      jobCount: jobs.length,
    };
  }, [jobs, expenses]);

  function money(value: number) {
    return value.toLocaleString("en-GB", {
      style: "currency",
      currency: "GBP",
    });
  }

  return (
    <main className="min-h-screen bg-black text-white pb-28">
      <div className="mx-auto max-w-5xl p-4 space-y-5">
        <header className="pt-2">
          <p className="text-xs font-bold tracking-[0.25em] text-orange-400">SMARTFOBS</p>
          <h1 className="text-3xl font-black">
            {view === "home" && "Home"}
            {view === "jobs" && "Jobs"}
            {view === "expenses" && "Expenses"}
            {view === "reports" && "Reports"}
          </h1>
          <p className="text-sm text-zinc-400">Fast records for jobs, expenses and tax.</p>
        </header>

        {view === "home" && (
          <>
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-sm text-zinc-400">Today</p>
              <p className="mt-1 text-4xl font-black text-orange-400">
                {money(totals.todayIncome)}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Profit today: {money(totals.todayProfit)}
              </p>
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
              <JobList jobs={jobs.slice(0, 5)} money={money} />
            </Panel>
          </>
        )}

        {view === "jobs" && (
          <>
            <button onClick={() => setShowForm("job")} className="w-full rounded-2xl bg-orange-500 p-4 font-black text-black">
              + Add Job
            </button>
            <Panel title="All Jobs">
              <JobList jobs={jobs} money={money} />
            </Panel>
          </>
        )}

        {view === "expenses" && (
          <>
            <button onClick={() => setShowForm("expense")} className="w-full rounded-2xl bg-orange-500 p-4 font-black text-black">
              + Add Expense
            </button>
            <Panel title="All Expenses">
              <ExpenseList expenses={expenses} money={money} />
            </Panel>
          </>
        )}

        {view === "reports" && (
          <div className="space-y-4">
            <section className="grid grid-cols-2 gap-3">
              <Kpi title="Total Income" value={money(totals.income)} />
              <Kpi title="Expenses" value={money(totals.expenseTotal)} />
              <Kpi title="Profit" value={money(totals.profit)} />
              <Kpi title="Jobs" value={String(totals.jobCount)} />
            </section>

            <Panel title="Tax record summary">
              <div className="space-y-3 text-sm text-zinc-300">
                <p>Total business income recorded: <b>{money(totals.income)}</b></p>
                <p>Total expenses recorded: <b>{money(totals.expenseTotal)}</b></p>
                <p>Estimated profit: <b>{money(totals.profit)}</b></p>
              </div>
            </Panel>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/80 p-4">
          <div className="mx-auto max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">{showForm === "job" ? "New Job" : "New Expense"}</h2>
              <button onClick={() => setShowForm(null)} className="rounded-full bg-zinc-800 px-3 py-1 font-bold">✕</button>
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
                <button onClick={addJob} className="w-full rounded-2xl bg-orange-500 p-4 font-black text-black">Save Job</button>
              </div>
            ) : (
              <div className="space-y-3">
                <Input label="Date" type="date" value={expense.expense_date} onChange={(v) => setExpense({ ...expense, expense_date: v })} />
                <Input label="Supplier" value={expense.supplier} onChange={(v) => setExpense({ ...expense, supplier: v })} />
                <Select label="Category" value={expense.category} onChange={(v) => setExpense({ ...expense, category: v })} options={["Keys / Stock", "Postage", "Fuel", "Tools", "Software", "Phone", "Insurance", "Other"]} />
                <Input label="Amount £" type="number" value={expense.amount} onChange={(v) => setExpense({ ...expense, amount: v })} />
                <Input label="Description" value={expense.description} onChange={(v) => setExpense({ ...expense, description: v })} />
                <button onClick={addExpense} className="w-full rounded-2xl bg-orange-500 p-4 font-black text-black">Save Expense</button>
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-800 bg-zinc-950 p-3">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-2">
          <NavButton active={view === "home"} onClick={() => setView("home")} label="Home" />
          <NavButton active={view === "jobs"} onClick={() => setView("jobs")} label="Jobs" />
          <NavButton active={view === "expenses"} onClick={() => setView("expenses")} label="Expenses" />
          <NavButton active={view === "reports"} onClick={() => setView("reports")} label="Reports" />
        </div>
      </nav>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs text-zinc-400">{title}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function Quick({ label, onClick, dark = false }: any) {
  return (
    <button
      onClick={onClick}
      className={
        dark
          ? "rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left font-black active:scale-[0.98]"
          : "rounded-2xl bg-orange-500 p-4 text-left font-black text-black active:scale-[0.98]"
      }
    >
      + {label}
    </button>
  );
}

function Panel({ title, children }: any) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <h2 className="mb-3 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

function JobList({ jobs, money }: any) {
  if (!jobs.length) return <p className="text-zinc-500">No jobs added yet.</p>;

  return (
    <div className="space-y-3">
      {jobs.map((j: any) => (
        <div key={j.id} className="rounded-xl bg-black p-3">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-bold">{j.customer_name || j.dealer_name || "Unnamed job"}</p>
              <p className="text-sm text-zinc-400">{j.job_date} · {j.vehicle || "No vehicle"}</p>
              <p className="text-xs text-zinc-500">{j.job_type || "No job type"}</p>
            </div>
            <p className="font-black text-orange-400">{money(Number(j.amount_charged || 0))}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpenseList({ expenses, money }: any) {
  if (!expenses.length) return <p className="text-zinc-500">No expenses added yet.</p>;

  return (
    <div className="space-y-3">
      {expenses.map((e: any) => (
        <div key={e.id} className="rounded-xl bg-black p-3">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-bold">{e.supplier || "Expense"}</p>
              <p className="text-sm text-zinc-400">{e.expense_date} · {e.category || "Other"}</p>
              <p className="text-xs text-zinc-500">{e.description}</p>
            </div>
            <p className="font-black text-red-400">-{money(Number(e.amount || 0))}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function NavButton({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-2xl bg-orange-500 px-3 py-3 text-xs font-black text-black"
          : "rounded-2xl bg-black px-3 py-3 text-xs font-bold text-zinc-400"
      }
    >
      {label}
    </button>
  );
}

function Input({ label, value, onChange, type = "text" }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-zinc-800 bg-black p-4 text-lg text-white outline-none focus:border-orange-500"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-zinc-800 bg-black p-4 text-lg text-white outline-none focus:border-orange-500"
      >
        {options.map((option: string) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}