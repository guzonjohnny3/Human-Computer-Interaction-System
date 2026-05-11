"use client";

import { useEffect, useState } from "react";
import { recommendFor, urgencyChipClass, urgencyLabel } from "@/lib/janitor";
import { STATUS_STYLES } from "@/lib/status";
import type { AIPrediction, CleaningEvent, RestroomState } from "@/lib/types";

interface Props {
  state: RestroomState | null;
  prediction?: AIPrediction;
  onClose: () => void;
  onDispatch: (restroomId: string) => CleaningEvent | null;
}

/**
 * The parent should give this component a stable `key` per opening so internal
 * state (dispatched) resets cleanly without needing setState-in-effect tricks.
 */
export function JanitorModal({ state, prediction, onClose, onDispatch }: Props) {
  const [dispatched, setDispatched] = useState<CleaningEvent | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!state) return null;

  const rec = recommendFor({ state, prediction });
  const statusStyle = STATUS_STYLES[state.status];

  const handleDispatch = () => {
    const ev = onDispatch(state.location.id);
    if (ev) setDispatched(ev);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal
    >
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-red-500/40 bg-slate-950/95 shadow-[0_0_80px_rgba(239,68,68,0.35)]">
        {/* header */}
        <div className="relative overflow-hidden border-b border-red-500/30 bg-gradient-to-r from-red-950/70 via-red-900/40 to-red-950/70 p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-red-500/30 blur-3xl" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-red-400/60 ${
                  rec.urgency === "critical" ? "animate-pulse bg-red-700/40" : "bg-red-900/40"
                }`}
              >
                <span className="text-xl">🚨</span>
              </span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-300">
                  Janitor Response · AI Recommendation
                </div>
                <h2 className="text-lg font-bold text-white">
                  {state.location.type} Comfort Room — {state.location.buildingName}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusStyle.chip}`}>
                    STATUS · {statusStyle.label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${urgencyChipClass(
                      rec.urgency,
                    )}`}
                  >
                    URGENCY · {urgencyLabel(rec.urgency)}
                  </span>
                  <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 ring-1 ring-white/10">
                    Est. {rec.estimatedMinutes} min
                  </span>
                  {rec.closureRecommended && (
                    <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200 ring-1 ring-red-700/60">
                      CLOSE RESTROOM
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800/60 text-slate-300 ring-1 ring-white/10 transition-colors hover:bg-slate-700 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* body */}
        <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-2">
          {/* current reading + AI notes */}
          <section className="lg:col-span-2">
            <SectionTitle>AI Recommendation</SectionTitle>
            <div className="space-y-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">
                Primary Concern: {rec.primaryConcern.toUpperCase()}
              </div>
              <ul className="space-y-1.5 text-xs text-fuchsia-100">
                {rec.aiNotes.map((note, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-fuchsia-300">▸</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] sm:grid-cols-6">
                <Stat k="MQ135" v={state.current.mq135.toFixed(1)} />
                <Stat k="MQ136" v={state.current.mq136.toFixed(1)} />
                <Stat k="MQ137" v={state.current.mq137.toFixed(1)} hot={state.current.mq137 > 40} />
                <Stat k="Odor" v={state.current.odor.toFixed(1)} hot={state.current.odor > 70} />
                <Stat k="Temp" v={state.current.temperature.toFixed(1) + "°"} />
                <Stat k="Humid" v={state.current.humidity.toFixed(1) + "%"} />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle>Required Cleaning Tools</SectionTitle>
            <ul className="grid grid-cols-1 gap-1.5">
              {rec.tools.map((t) => (
                <li
                  key={t.name}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 ${
                    t.required
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-white/5 bg-slate-900/40"
                  }`}
                >
                  <Check on={t.required} />
                  <div className="flex-1">
                    <div
                      className={`text-xs font-semibold ${
                        t.required ? "text-emerald-100" : "text-slate-300"
                      }`}
                    >
                      {t.name}
                    </div>
                    {t.reason && (
                      <div className="text-[10px] text-slate-400">{t.reason}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionTitle>Required Safety Equipment</SectionTitle>
            <ul className="grid grid-cols-1 gap-1.5">
              {rec.safety.map((t) => (
                <li
                  key={t.name}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 ${
                    t.required
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-white/5 bg-slate-900/40"
                  }`}
                >
                  <Check on={t.required} />
                  <div className="flex-1">
                    <div
                      className={`text-xs font-semibold ${
                        t.required ? "text-amber-100" : "text-slate-300"
                      }`}
                    >
                      {t.name}
                    </div>
                    {t.reason && (
                      <div className="text-[10px] text-slate-400">{t.reason}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="lg:col-span-2">
            <SectionTitle>Recommended Sanitation Procedure</SectionTitle>
            <ol className="space-y-1.5">
              {rec.procedure.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-white/5 bg-slate-900/40 px-3 py-2"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-200 ring-1 ring-cyan-400/40">
                    {i + 1}
                  </span>
                  <span className="text-xs leading-relaxed text-slate-200">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/80 p-4">
          <div className="text-[10px] text-slate-400">
            {dispatched ? (
              <span className="text-emerald-300">
                ✓ Janitor dispatched · cleaning recorded ({dispatched.durationMin} min) · odor{" "}
                {dispatched.odorBefore.toFixed(0)} → {dispatched.odorAfter.toFixed(0)}
              </span>
            ) : (
              "Acknowledging will mark alerts resolved and record a cleaning event."
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Close
            </button>
            <button
              onClick={handleDispatch}
              disabled={Boolean(dispatched)}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wider ring-1 transition-all ${
                dispatched
                  ? "cursor-not-allowed bg-emerald-700/30 text-emerald-200 ring-emerald-500/40"
                  : "bg-red-600 text-white ring-red-400/60 hover:bg-red-500"
              }`}
            >
              {dispatched ? "Dispatched" : "Dispatch Janitor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
      {children}
    </h3>
  );
}

function Stat({ k, v, hot = false }: { k: string; v: string; hot?: boolean }) {
  return (
    <div
      className={`rounded-md px-2 py-1 text-center ring-1 ${
        hot ? "bg-red-900/40 text-red-100 ring-red-500/40" : "bg-slate-900/60 text-slate-200 ring-white/5"
      }`}
    >
      <div className="text-[9px] uppercase tracking-widest text-slate-400">{k}</div>
      <div className="font-mono text-[11px]">{v}</div>
    </div>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded ring-1 ${
        on ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40" : "bg-slate-800/60 text-slate-600 ring-white/5"
      }`}
    >
      {on ? "✓" : ""}
    </span>
  );
}
