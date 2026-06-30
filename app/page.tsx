"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const today = new Date().toISOString().slice(0, 10);

const theme = {
  page: "bg-[#252a34] text-[#f2f2f2]",
  card: "border border-[#3a404d] bg-[#111317]",
  cardSoft: "border border-[#3a404d] bg-[#1b2029]",
  accent: "bg-[#d7d7d7] text-[#111317]",
  accentText: "text-[#d7d7d7]",
  muted: "text-[#b8bcc6]",
  faint: "text-[#8d929e]",
};

export default function HomePage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [view, setView] = useState<"home" | "jobs" | "expenses" | "reports">("home");
  const [showForm, setShowForm] = useState<"job" | "expense" | null>(null);
  const [search, setSearch] = useState("");

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

  function money(value: number) {
    return value.toLocaleString("en-GB", {
      style: "currency",
      currency: "GBP",
    });
  }

  return (
    <main className={`min-h-screen ${theme.page} pb-28`}>
      <div className="mx-auto max-w-5xl p-4 space-y-5">
        <header className="pt-2">
          <p className={`text-xs font-bold tracking-[0.25em] ${theme.accentText}`}>
            SMARTFOBS
          </p>
          <h1 className="text-3xl font-black">
            {view === "home" && "Home"}
            {view === "jobs" && "Jobs"}
            {view === "expenses" && "Expenses"}
            {view === "reports" && "Reports"}
          </h1>
          <p className={`text-sm ${theme.muted}`}>Fast records for jobs, expenses and tax.</p>
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
                {money(totals.todayIncome)}
              </p>
              <p className={`mt-1 text-sm ${theme.faint}`}>
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
              <JobList jobs={filteredJobs.slice(0, 5)} money={money} deleteJob={deleteJob} />
            </Panel>
          </>
        )}

        {view === "jobs" && (
          <>
            <button onClick={() => setShowForm("job")} className={`w-full rounded-2xl ${theme.accent} p-4 font-black`}>
              + Add Job
            </button>
            <Panel title="All Jobs">
              <JobList jobs={filteredJobs} money={money} deleteJob={deleteJob} />
            </Panel>
          </>
        )}

        {view === "expenses" && (
          <>
            <button onClick={() => setShowForm("expense")} className={`w-full rounded-2xl ${theme.accent} p-4 font-black`}>
              + Add Expense
            </button>
            <Panel title="All Expenses">
              <ExpenseList expenses={filteredExpenses} money={money} deleteExpense={deleteExpense} />
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

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => exportCSV("jobs")} className={`rounded-2xl ${theme.accent} p-4 font-black`}>
                Export Jobs CSV
              </button>
              <button onClick={() => exportCSV("expenses")} className={`rounded-2xl ${theme.card} p-4 font-black`}>
                Export Expenses CSV
              </button>
            </div>

            <Panel title="Tax record summary">
              <div className={`space-y-3 text-sm ${theme.muted}`}>
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
          <div className={`mx-auto max-w-lg rounded-3xl ${theme.card} p-4 space-y-4`}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">{showForm === "job" ? "New Job" : "New Expense"}</h2>
              <button onClick={() => setShowForm(null)} className="rounded-full bg-[#252a34] px-3 py-1 font-bold">
                ✕
              </button>
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
                <button onClick={addJob} className={`w-full rounded-2xl ${theme.accent} p-4 font-black`}>
                  Save Job
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Input label="Date" type="date" value={expense.expense_date} onChange={(v) => setExpense({ ...expense, expense_date: v })} />
                <Input label="Supplier" value={expense.supplier} onChange={(v) => setExpense({ ...expense, supplier: v })} />
                <Select label="Category" value={expense.category} onChange={(v) => setExpense({ ...expense, category: v })} options={["Keys / Stock", "Postage", "Fuel", "Tools", "Software", "Phone", "Insurance", "Other"]} />
                <Input label="Amount £" type="number" value={expense.amount} onChange={(v) => setExpense({ ...expense, amount: v })} />
                <Input label="Description" value={expense.description} onChange={(v) => setExpense({ ...expense, description: v })} />
                <button onClick={addExpense} className={`w-full rounded-2xl ${theme.accent} p-4 font-black`}>
                  Save Expense
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <nav className={`fixed bottom-0 left-0 right-0 z-30 border-t border-[#3a404d] bg-[#111317] p-3`}>
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
    <div className={`rounded-2xl ${theme.card} p-4`}>
      <p className={`text-xs ${theme.muted}`}>{title}</p>
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
          ? `rounded-2xl ${theme.card} p-4 text-left font-black active:scale-[0.98]`
          : `rounded-2xl ${theme.accent} p-4 text-left font-black active:scale-[0.98]`
      }
    >
      + {label}
    </button>
  );
}

function Panel({ title, children }: any) {
  return (
    <section className={`rounded-2xl ${theme.card} p-4`}>
      <h2 className="mb-3 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

function JobList({ jobs, money, deleteJob }: any) {
  if (!jobs.length) return <p className={theme.faint}>No jobs found.</p>;

  return (
    <div className="space-y-3">
      {jobs.map((j: any) => (
        <div key={j.id} className="rounded-xl bg-[#252a34] p-3">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-bold">{j.customer_name || j.dealer_name || "Unnamed job"}</p>
              <p className={`text-sm ${theme.muted}`}>{j.job_date} · {j.vehicle || "No vehicle"}</p>
              <p className={`text-xs ${theme.faint}`}>{j.job_type || "No job type"}</p>
            </div>
            <div className="text-right">
              <p className={`font-black ${theme.accentText}`}>{money(Number(j.amount_charged || 0))}</p>
              {deleteJob && (
                <button onClick={() => deleteJob(j.id)} className="mt-2 text-xs text-red-300">
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpenseList({ expenses, money, deleteExpense }: any) {
  if (!expenses.length) return <p className={theme.faint}>No expenses found.</p>;

  return (
    <div className="space-y-3">
      {expenses.map((e: any) => (
        <div key={e.id} className="rounded-xl bg-[#252a34] p-3">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-bold">{e.supplier || "Expense"}</p>
              <p className={`text-sm ${theme.muted}`}>{e.expense_date} · {e.category || "Other"}</p>
              <p className={`text-xs ${theme.faint}`}>{e.description}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-red-300">-{money(Number(e.amount || 0))}</p>
              {deleteExpense && (
                <button onClick={() => deleteExpense(e.id)} className="mt-2 text-xs text-red-300">
                  Delete
                </button>
              )}
            </div>
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
          ? `rounded-2xl ${theme.accent} px-3 py-3 text-xs font-black`
          : "rounded-2xl bg-[#252a34] px-3 py-3 text-xs font-bold text-[#b8bcc6]"
      }
    >
      {label}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className={`mb-1 block text-sm ${theme.muted}`}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[#3a404d] bg-[#252a34] p-4 text-lg text-white outline-none focus:border-[#d7d7d7]"
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
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className={`mb-1 block text-sm ${theme.muted}`}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[#3a404d] bg-[#252a34] p-4 text-lg text-white outline-none focus:border-[#d7d7d7]"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}