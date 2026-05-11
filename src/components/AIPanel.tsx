"use client";

import { dayName, hourLabel } from "@/lib/ai";
import { STATUS_STYLES } from "@/lib/status";
import type { AIPrediction, RestroomState } from "@/lib/types";

interface Props {
  states: RestroomState[];
  predictions: Map<string, AIPrediction>;
  onSelect: (id: string) => void;
}

export function AIPanel({ states, predictions, onSelect }: Props) {
  const ranked = [...states]
    .map((s) => ({ s, p: predictions.get(s.location.id) }))
    .filter((x): x is { s: RestroomState; p: AIPrediction } => Boolean(x.p))
    .sort((a, b) => b.p.predictedOdor1h - a.p.predictedOdor1h);

  const top = ranked.slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="inline-grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-fuchsia-500/40 to-cyan-500/30 ring-1 ring-fuchsia-400/40">
            <BrainIcon />
          </span>
          AI Predictions
          <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-fuchsia-300 ring-1 ring-fuchsia-500/30">
            MLR + LSTM
          </span>
        </h3>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">1-hour horizon</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {top.map(({ s, p }) => {
          const style = STATUS_STYLES[p.predictedStatus1h];
          return (
            <button
              key={s.location.id}
              onClick={() => onSelect(s.location.id)}
              className="group relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-slate-900/70 to-slate-950/60 p-3 text-left backdrop-blur-md transition-all hover:border-fuchsia-400/40"
            >
              <div
                className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl"
                style={{ background: style.color }}
              />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">
                    {s.location.buildingName}
                  </div>
                  <div className="text-sm font-semibold text-white">{s.location.type} Comfort Room</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${style.chip}`}>
                  PRED · {style.label}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{p.narrative}</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                <Stat label="Peak Hour" value={hourLabel(p.peakHour)} />
                <Stat label="Worst Day" value={dayName(p.worstDay)} />
                <Stat label="MLR R²" value={p.confidence.toFixed(2)} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Hazardous window</span>
                <span className="font-mono text-amber-300">{p.hazardousWindow}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-950/60 px-2 py-1 ring-1 ring-white/5">
      <div className="text-[9px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="font-mono text-[11px] text-slate-100">{value}</div>
    </div>
  );
}

function BrainIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-fuchsia-200" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-3 3v1a3 3 0 0 0 1.5 2.6A3 3 0 0 0 3 15a3 3 0 0 0 3 3v0a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3 3 3 0 0 0 3-3 3 3 0 0 0-1.5-2.4A3 3 0 0 0 21 10V9a3 3 0 0 0-3-3 3 3 0 0 0-3-3 3 3 0 0 0-3 1.5A3 3 0 0 0 9 3Z" />
    </svg>
  );
}
