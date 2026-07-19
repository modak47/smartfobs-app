import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function readEnv() {
  const env = {};
  const text = await readFile(".env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    env[key] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const tables = [
  "smartfobs_jobs",
  "smartfobs_expenses",
  "smartfobs_bank_transactions",
  "smartfobs_settings",
  "smartfobs_bank_import_batches",
  "smartfobs_bookkeeping_categories",
  "smartfobs_categorisation_rules",
];

function toPence(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function moneyFromPence(value) {
  return Number((value / 100).toFixed(2));
}

async function selectAll(supabase, table) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) {
      return { rows, error: error.message };
    }

    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { rows, error: null };
}

function summarise(table, rows, error) {
  const summary = { table, rowCount: rows.length, readable: !error, error };

  if (table === "smartfobs_jobs") {
    const total = rows.reduce((sum, row) => sum + toPence(row.amount_charged), 0);
    return { ...summary, totalIncome: moneyFromPence(total) };
  }

  if (table === "smartfobs_expenses") {
    const total = rows.reduce((sum, row) => sum + toPence(row.amount), 0);
    return { ...summary, totalExpenses: moneyFromPence(total) };
  }

  if (table === "smartfobs_bank_transactions") {
    const incoming = rows.filter((row) => Number(row.amount) > 0).reduce((sum, row) => sum + toPence(row.amount), 0);
    const outgoing = rows.filter((row) => Number(row.amount) < 0).reduce((sum, row) => sum + Math.abs(toPence(row.amount)), 0);
    const net = rows.reduce((sum, row) => sum + toPence(row.amount), 0);
    return {
      ...summary,
      moneyIn: moneyFromPence(incoming),
      moneyOut: moneyFromPence(outgoing),
      netMovement: moneyFromPence(net),
    };
  }

  return summary;
}

async function main() {
  const env = await readEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join("data", "backups", `phase-2-pre-rebuild-${timestamp}`);
  await mkdir(backupDir, { recursive: true });

  const summaries = [];
  for (const table of tables) {
    const { rows, error } = await selectAll(supabase, table);
    await writeFile(join(backupDir, `${table}.json`), JSON.stringify({ table, exportedAt: new Date().toISOString(), error, rows }, null, 2));
    summaries.push(summarise(table, rows, error));
  }

  const rollbackPlan = [
    "# SmartFobs Phase 2 Rollback Plan",
    "",
    `Backup created: ${new Date().toISOString()}`,
    "",
    "This backup was exported with the Supabase anon key available in `.env.local`.",
    "If a table is marked unreadable, use Supabase Studio or a service-role export before destructive changes.",
    "",
    "Rollback steps:",
    "",
    "1. Stop any import job or app deployment using the rebuilt schema.",
    "2. In Supabase, restore or recreate the old `smartfobs_*` tables from these JSON exports.",
    "3. Reapply the old application commit if needed.",
    "4. Re-run the old reports and compare the row counts/totals in `summary.json`.",
    "5. Only resume Phase 2 once the restored counts match.",
    "",
    "Important: this script does not delete or alter database records.",
  ].join("\n");

  await writeFile(join(backupDir, "summary.json"), JSON.stringify({ backupDir, summaries }, null, 2));
  await writeFile(join(backupDir, "ROLLBACK_PLAN.md"), rollbackPlan);

  console.log(JSON.stringify({ backupDir, summaries }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
