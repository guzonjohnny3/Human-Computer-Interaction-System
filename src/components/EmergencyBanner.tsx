"use client";

import type { RestroomState } from "@/lib/types";

interface Props {
  states: RestroomState[];
  onSelect: (id: string) => void;
}

export function EmergencyBanner({ states, onSelect }: Props) {
  const critical = states.filter((s) => s.status === "critical");
  const hazardous = states.filter((s) => s.status === "hazardous");

  if (critical.length === 0 && hazardous.length === 0) return null;

  const tone = critical.length > 0 ? "critical" : "hazardous";
  const list = critical.length > 0 ? critical : hazardous;
  const headline =
    tone === "critical"
      ? `${critical.length} RESTROOM${critical.length === 1 ? "" : "S"} IN CRITICAL CONDITION — IMMEDIATE SANITATION REQUIRED`
      : `${hazardous.length} HAZARDOUS RESTROOM${hazardous.length === 1 ? "" : "S"} — DANGEROUS AMMONIA CONCENTRATION`;

  return (
    <div
      role="alert"
      className={`relative z-40 overflow-hidden border-b ${
        tone === "critical"
          ? "border-red-700 bg-red-950/80"
          : "border-red-600/70 bg-red-900/40"
      } px-6 py-2.5 backdrop-blur-md`}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${
          tone === "critical"
            ? "animate-pulse bg-gradient-to-r from-red-700/30 via-red-500/20 to-red-700/30"
            : "bg-gradient-to-r from-red-700/10 via-red-500/10 to-red-700/10"
        }`}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex h-3 w-3 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-80" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-400" />
          </span>
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-red-200">
            {tone === "critical" ? "🚨 Red Alert" : "⚠️ Hazard"}
          </span>
          <span className="hidden text-[11px] font-bold uppercase tracking-wider text-red-100 sm:inline">
            {headline}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-100 sm:hidden">
            {tone === "critical" ? "Critical" : "Hazardous"}: {list.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {list.slice(0, 4).map((s) => (
            <button
              key={s.location.id}
              onClick={() => onSelect(s.location.id)}
              className="rounded-full bg-red-950/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-100 ring-1 ring-red-500/50 transition-colors hover:bg-red-900"
            >
              {s.location.buildingName} · {s.location.type}
            </button>
          ))}
          {list.length > 4 && (
            <span className="text-[10px] text-red-200/70">+{list.length - 4} more</span>
          )}
        </div>
      </div>
    </div>
  );
}
