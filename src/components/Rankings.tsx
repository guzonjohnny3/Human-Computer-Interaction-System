"use client";

import { STATUS_STYLES } from "@/lib/status";
import type { RestroomState } from "@/lib/types";

interface Props {
  states: RestroomState[];
  onSelect: (id: string) => void;
}

export function Rankings({ states, onSelect }: Props) {
  const sorted = [...states].sort((a, b) => b.current.odor - a.current.odor);
  const worst = sorted.slice(0, 5);
  const best = sorted.slice(-5).reverse();
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Column title="Worst Restrooms" rows={worst} onSelect={onSelect} medalColor="text-red-300" />
      <Column title="Cleanest Restrooms" rows={best} onSelect={onSelect} medalColor="text-emerald-300" />
    </div>
  );
}

function Column({
  title,
  rows,
  onSelect,
  medalColor,
}: {
  title: string;
  rows: RestroomState[];
  onSelect: (id: string) => void;
  medalColor: string;
}) {
  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{title}</h4>
      <ol className="space-y-1.5">
        {rows.map((s, i) => {
          const style = STATUS_STYLES[s.status];
          return (
            <li key={s.location.id}>
              <button
                onClick={() => onSelect(s.location.id)}
                className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-slate-900/40 px-2.5 py-1.5 text-left backdrop-blur-sm transition-colors hover:bg-slate-900/70"
              >
                <span className={`w-5 font-mono text-[11px] font-bold ${medalColor}`}>#{i + 1}</span>
                <span className="flex-1 truncate text-[11px] text-slate-200">
                  {s.location.buildingName} · {s.location.type}
                </span>
                <span className="font-mono text-[10px] text-slate-400">odor {s.current.odor.toFixed(0)}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${style.chip}`}>
                  {style.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
