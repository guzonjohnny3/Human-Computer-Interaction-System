"use client";

import { useEffect, useState } from "react";

interface Summary {
  total: number;
  safe: number;
  moderate: number;
  poor: number;
  hazardous: number;
  critical: number;
}

interface Props {
  summary: Summary;
  lastTick: number;
  tickMs: number;
}

export function Header({ summary, lastTick, tickMs }: Props) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secsAgo = Math.max(0, Math.floor((now - lastTick) / 1000));
  const nextIn = Math.max(0, Math.ceil(tickMs / 1000) - secsAgo);
  const time = new Date(now).toLocaleTimeString();

  return (
    <header className="relative z-30 flex flex-wrap items-center justify-between gap-4 border-b border-cyan-500/15 bg-slate-950/70 px-6 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/40 via-blue-600/30 to-purple-600/30 ring-1 ring-cyan-400/40">
          <span className="text-lg font-black tracking-tight text-cyan-200">C</span>
          <span className="absolute -inset-px rounded-xl bg-cyan-400/10 blur-md" />
        </div>
        <div className="leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-300/70">
            CSUCC · Smart Campus
          </div>
          <h1 className="text-base font-semibold text-white sm:text-lg">
            Restroom Air Quality Monitoring — AI Command Center
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip label="SAFE" value={summary.safe} cls="bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" />
        <Chip label="MOD" value={summary.moderate} cls="bg-yellow-500/10 text-yellow-200 ring-yellow-500/30" />
        <Chip label="POOR" value={summary.poor} cls="bg-orange-500/10 text-orange-200 ring-orange-500/30" />
        <Chip label="HAZ" value={summary.hazardous} cls="bg-red-500/10 text-red-200 ring-red-500/30" />
        <Chip
          label="CRIT"
          value={summary.critical}
          cls="bg-red-900/30 text-red-200 ring-red-700/50 animate-pulse"
        />
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          LIVE
        </span>
        <span className="hidden sm:inline">{time}</span>
        <span className="rounded-md bg-slate-800/60 px-2 py-1 font-mono text-[10px] text-slate-300 ring-1 ring-slate-700/60">
          next tick in {nextIn}s
        </span>
      </div>
    </header>
  );
}

function Chip({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ${cls}`}
    >
      <span>{label}</span>
      <span className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-white/90">{value}</span>
    </span>
  );
}
