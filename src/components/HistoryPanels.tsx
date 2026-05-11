"use client";

import { useMemo, useState } from "react";
import { STATUS_STYLES } from "@/lib/status";
import type {
  AlertEvent,
  CleaningEvent,
  RestroomState,
} from "@/lib/types";

interface Props {
  alerts: AlertEvent[];
  cleanings: CleaningEvent[];
  states: RestroomState[];
  onSelect: (id: string) => void;
}

type Tab = "alerts" | "cleanings" | "ranking" | "analytics";

export function HistoryPanels({ alerts, cleanings, states, onSelect }: Props) {
  const [tab, setTab] = useState<Tab>("alerts");

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <TabBtn active={tab === "alerts"} onClick={() => setTab("alerts")}>
          Alert History · {alerts.length}
        </TabBtn>
        <TabBtn active={tab === "cleanings"} onClick={() => setTab("cleanings")}>
          Cleaning History · {cleanings.length}
        </TabBtn>
        <TabBtn active={tab === "ranking"} onClick={() => setTab("ranking")}>
          Hazard Ranking
        </TabBtn>
        <TabBtn active={tab === "analytics"} onClick={() => setTab("analytics")}>
          Predictive Sanitation
        </TabBtn>
      </div>
      <div className="max-h-[260px] overflow-y-auto">
        {tab === "alerts" && <AlertHistory alerts={alerts} onSelect={onSelect} />}
        {tab === "cleanings" && <CleaningHistory cleanings={cleanings} onSelect={onSelect} />}
        {tab === "ranking" && <HazardRanking states={states} onSelect={onSelect} />}
        {tab === "analytics" && <PredictiveSanitation states={states} cleanings={cleanings} />}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 transition-colors ${
        active
          ? "bg-cyan-500/20 text-cyan-100 ring-cyan-400/40"
          : "bg-slate-900/40 text-slate-400 ring-white/10 hover:bg-slate-800/60 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function AlertHistory({
  alerts,
  onSelect,
}: {
  alerts: AlertEvent[];
  onSelect: (id: string) => void;
}) {
  if (alerts.length === 0) {
    return <Empty>No alerts logged yet</Empty>;
  }
  return (
    <ul className="space-y-1">
      {alerts.map((a) => {
        const t = new Date(a.t).toLocaleTimeString();
        const status = STATUS_STYLES[a.level];
        return (
          <li key={a.id}>
            <button
              onClick={() => onSelect(a.restroomId)}
              className="grid w-full grid-cols-[60px_70px_1fr_60px] items-center gap-2 rounded-md border border-white/5 bg-slate-900/40 px-2 py-1 text-left text-[10px] hover:bg-slate-900/70"
            >
              <span className="font-mono text-[9px] text-slate-500">{t}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${status.chip}`}>
                {status.label}
              </span>
              <span className="truncate text-slate-200">
                {a.buildingName} · {a.restroomType}{" "}
                {a.source === "ai" && (
                  <span className="ml-1 rounded bg-fuchsia-500/15 px-1 py-0.5 text-[9px] font-bold text-fuchsia-200">
                    AI
                  </span>
                )}
              </span>
              <span className="text-right text-[9px] uppercase tracking-widest text-slate-500">
                {a.severity}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CleaningHistory({
  cleanings,
  onSelect,
}: {
  cleanings: CleaningEvent[];
  onSelect: (id: string) => void;
}) {
  if (cleanings.length === 0) {
    return (
      <Empty>
        No cleanings recorded yet — they appear automatically when the simulation triggers
        janitorial resets, or when you dispatch from a Red Alert
      </Empty>
    );
  }
  return (
    <ul className="space-y-1">
      {cleanings.map((c) => {
        const t = new Date(c.t).toLocaleTimeString();
        const delta = c.odorBefore - c.odorAfter;
        return (
          <li key={c.id}>
            <button
              onClick={() => onSelect(c.restroomId)}
              className="grid w-full grid-cols-[60px_70px_1fr_auto] items-center gap-2 rounded-md border border-white/5 bg-slate-900/40 px-2 py-1 text-left text-[10px] hover:bg-slate-900/70"
            >
              <span className="font-mono text-[9px] text-slate-500">{t}</span>
              <span className={triggerClass(c.trigger)}>{c.trigger.toUpperCase()}</span>
              <span className="truncate text-slate-200">
                {c.buildingName} · {c.restroomType}
              </span>
              <span className="text-right font-mono text-[10px] text-emerald-300">
                {c.durationMin}m · ↓{delta.toFixed(0)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function triggerClass(t: CleaningEvent["trigger"]): string {
  switch (t) {
    case "manual":
      return "rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-200 ring-1 ring-red-500/40";
    case "reactive":
      return "rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-200 ring-1 ring-amber-500/40";
    default:
      return "rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200 ring-1 ring-cyan-500/40";
  }
}

function HazardRanking({
  states,
  onSelect,
}: {
  states: RestroomState[];
  onSelect: (id: string) => void;
}) {
  const ranked = useMemo(() => {
    return [...states]
      .map((s) => {
        // hazard score: blend status rank, odor, mq137
        const r =
          { safe: 0, moderate: 1, poor: 2, hazardous: 3, critical: 4 }[s.status] * 25 +
          s.current.odor * 0.35 +
          s.current.mq137 * 0.45;
        return { s, r };
      })
      .sort((a, b) => b.r - a.r)
      .slice(0, 10);
  }, [states]);
  return (
    <ul className="space-y-1">
      {ranked.map(({ s, r }, i) => {
        const status = STATUS_STYLES[s.status];
        return (
          <li key={s.location.id}>
            <button
              onClick={() => onSelect(s.location.id)}
              className="grid w-full grid-cols-[28px_1fr_70px_60px] items-center gap-2 rounded-md border border-white/5 bg-slate-900/40 px-2 py-1 text-left text-[10px] hover:bg-slate-900/70"
            >
              <span className={`font-mono text-[11px] font-bold ${i < 3 ? "text-red-300" : "text-slate-400"}`}>
                #{i + 1}
              </span>
              <span className="truncate text-slate-200">
                {s.location.buildingName} · {s.location.type}
              </span>
              <span className="text-right font-mono text-[10px] text-slate-300">
                hazard {r.toFixed(0)}
              </span>
              <span className={`rounded-full px-1.5 py-0.5 text-center text-[9px] font-bold ${status.chip}`}>
                {status.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PredictiveSanitation({
  states,
  cleanings,
}: {
  states: RestroomState[];
  cleanings: CleaningEvent[];
}) {
  // Estimated cleanings needed in the next hour — bucket by status
  const buckets = { critical: 0, hazardous: 0, poor: 0, moderate: 0, safe: 0 };
  for (const s of states) buckets[s.status] += 1;
  const totalCleaningMin = cleanings.reduce((acc, c) => acc + c.durationMin, 0);
  const avgClean = cleanings.length ? totalCleaningMin / cleanings.length : 0;
  const projectedCleanings = buckets.critical * 2 + buckets.hazardous + Math.ceil(buckets.poor / 2);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Critical" value={buckets.critical.toString()} tone="critical" />
        <Stat label="Hazardous" value={buckets.hazardous.toString()} tone="hazardous" />
        <Stat label="Poor" value={buckets.poor.toString()} tone="poor" />
        <Stat label="Moderate" value={buckets.moderate.toString()} tone="moderate" />
        <Stat label="Safe" value={buckets.safe.toString()} tone="safe" />
      </div>
      <div className="grid grid-cols-1 gap-2 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 p-3 sm:grid-cols-3">
        <Insight
          title="Projected cleanings next 1h"
          value={projectedCleanings.toString()}
          desc="Sum of 2× critical + 1× hazardous + 0.5× poor"
        />
        <Insight
          title="Avg cleaning duration"
          value={`${avgClean.toFixed(1)} min`}
          desc={`Across ${cleanings.length} recorded cleaning${cleanings.length === 1 ? "" : "s"}`}
        />
        <Insight
          title="Sanitation load"
          value={`${(projectedCleanings * Math.max(15, avgClean)).toFixed(0)} min`}
          desc="Projected janitor-time in the next hour"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof STATUS_STYLES;
}) {
  const style = STATUS_STYLES[tone];
  return (
    <div className="rounded-lg border border-white/5 bg-slate-900/40 px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="font-mono text-base font-bold" style={{ color: style.color }}>
        {value}
      </div>
    </div>
  );
}

function Insight({
  title,
  value,
  desc,
}: {
  title: string;
  value: string;
  desc: string;
}) {
  return (
    <div className="rounded-md bg-slate-950/40 p-2 ring-1 ring-white/5">
      <div className="text-[9px] uppercase tracking-widest text-fuchsia-300">{title}</div>
      <div className="font-mono text-lg font-bold text-fuchsia-100">{value}</div>
      <div className="text-[10px] text-slate-400">{desc}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-32 place-items-center rounded-lg border border-dashed border-slate-700/50 p-3 text-center text-xs text-slate-500">
      {children}
    </div>
  );
}
