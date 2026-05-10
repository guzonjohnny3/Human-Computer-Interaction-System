"use client";

import { STATUS_STYLES } from "@/lib/status";
import type { RestroomState } from "@/lib/types";
import { Sparkline } from "./Sparkline";

interface Props {
  states: RestroomState[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}

export function StatusCards({ states, onSelect, selectedId }: Props) {
  // Sort: worst first
  const sorted = [...states].sort(
    (a, b) => STATUS_STYLES[b.status].rank - STATUS_STYLES[a.status].rank || b.current.odor - a.current.odor,
  );
  const top = sorted.slice(0, 8);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {top.map((s) => {
        const style = STATUS_STYLES[s.status];
        const sel = selectedId === s.location.id;
        return (
          <button
            key={s.location.id}
            onClick={() => onSelect(s.location.id)}
            className={`group relative overflow-hidden rounded-xl border bg-slate-900/40 p-3 text-left backdrop-blur-md transition-all hover:bg-slate-900/70 ${
              sel ? "border-cyan-400/60 ring-1 ring-cyan-400/40" : "border-white/5"
            }`}
          >
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
              style={{ background: style.color }}
            />
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400">
                  {s.location.buildingName}
                </div>
                <div className="text-sm font-semibold text-white">
                  {s.location.type} CR
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${style.chip}`}>
                {style.label}
              </span>
            </div>

            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="font-mono text-3xl font-bold text-white leading-none">
                  {s.current.airQuality.toFixed(0)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">AQ Score</div>
              </div>
              <Sparkline
                values={s.history.slice(-40).map((h) => h.odor)}
                min={0}
                max={100}
                color={style.color}
                width={80}
                height={30}
              />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-slate-400">
              <Metric k="MQ135" v={s.current.mq135.toFixed(0)} />
              <Metric k="MQ136" v={s.current.mq136.toFixed(0)} />
              <Metric k="MQ137" v={s.current.mq137.toFixed(0)} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md bg-slate-950/40 px-2 py-1 font-mono ring-1 ring-white/5">
      <span className="text-slate-500">{k}</span> <span className="text-slate-200">{v}</span>
    </div>
  );
}
