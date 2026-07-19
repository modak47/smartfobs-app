import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
  accent = "slate",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "green" | "blue" | "amber" | "rose" | "slate";
  icon?: ReactNode;
}) {
  const accents = {
    green: "from-emerald-400/20 to-lime-400/5 ring-emerald-300/20",
    blue: "from-sky-400/20 to-cyan-400/5 ring-sky-300/20",
    amber: "from-amber-400/20 to-orange-400/5 ring-amber-300/20",
    rose: "from-rose-400/20 to-red-400/5 ring-rose-300/20",
    slate: "from-slate-400/15 to-white/5 ring-white/10",
  };

  return (
    <div className={`rounded-3xl bg-gradient-to-br ${accents[accent]} p-px shadow-2xl shadow-black/20 ring-1`}>
      <div className="h-full rounded-3xl bg-[#0b1018]/90 p-5">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-slate-400">{label}</p>
          {icon ? <div className="text-slate-400">{icon}</div> : null}
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
        {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );
}
