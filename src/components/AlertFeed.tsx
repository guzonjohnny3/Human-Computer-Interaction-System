"use client";

import { STATUS_STYLES } from "@/lib/status";
import type { AlertEvent, AlertSeverity } from "@/lib/types";

interface Props {
  alerts: AlertEvent[];
  onOpenAlert: (a: AlertEvent) => void;
  onSelect: (id: string) => void;
}

const SEV_STYLE: Record<AlertSeverity, { chip: string; bar: string }> = {
  INFO: {
    chip: "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/30",
    bar: "bg-cyan-400/60",
  },
  WARNING: {
    chip: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30",
    bar: "bg-amber-400/70",
  },
  CRITICAL: {
    chip: "bg-red-600/20 text-red-100 ring-1 ring-red-500/50 animate-pulse",
    bar: "bg-red-500",
  },
};

export function AlertFeed({ alerts, onOpenAlert, onSelect }: Props) {
  const active = alerts.filter((a) => !a.acknowledged);
  const acknowledged = alerts.filter((a) => a.acknowledged);
  const criticalCount = active.filter((a) => a.severity === "CRITICAL").length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          {criticalCount > 0 ? (
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
            </span>
          ) : (
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          )}
          Admin Alert Panel
        </h3>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500">
          <SevPill severity="CRITICAL" count={active.filter((a) => a.severity === "CRITICAL").length} />
          <SevPill severity="WARNING" count={active.filter((a) => a.severity === "WARNING").length} />
          <SevPill severity="INFO" count={active.filter((a) => a.severity === "INFO").length} />
        </div>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {active.length === 0 ? (
          <div className="grid h-full place-items-center rounded-lg border border-dashed border-slate-700/50 p-3 text-center text-xs text-slate-500">
            No active alerts — campus operating within nominal range
          </div>
        ) : (
          active.map((a) => <AlertRow key={a.id} a={a} onOpenAlert={onOpenAlert} onSelect={onSelect} />)
        )}
        {acknowledged.length > 0 && (
          <details className="rounded-lg border border-white/5 bg-slate-900/30">
            <summary className="cursor-pointer select-none px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-200">
              Acknowledged ({acknowledged.length})
            </summary>
            <ul className="space-y-1 p-1.5 pt-0">
              {acknowledged.slice(0, 10).map((a) => (
                <AlertRow
                  key={a.id}
                  a={a}
                  onOpenAlert={onOpenAlert}
                  onSelect={onSelect}
                  muted
                />
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

function AlertRow({
  a,
  onOpenAlert,
  onSelect,
  muted = false,
}: {
  a: AlertEvent;
  onOpenAlert: (a: AlertEvent) => void;
  onSelect: (id: string) => void;
  muted?: boolean;
}) {
  const sev = SEV_STYLE[a.severity];
  const status = STATUS_STYLES[a.level];
  const t = new Date(a.t).toLocaleTimeString();
  const isCritical = a.severity === "CRITICAL" && !muted;
  return (
    <div
      className={`group relative overflow-hidden rounded-lg border bg-slate-900/40 backdrop-blur-md transition-colors ${
        isCritical
          ? "border-red-500/50 ring-1 ring-red-500/30"
          : "border-white/5 hover:border-white/15"
      } ${muted ? "opacity-50" : ""}`}
    >
      <span className={`absolute left-0 top-0 h-full w-0.5 ${sev.bar}`} />
      <div className="p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${sev.chip}`}>
              {a.severity}
            </span>
            {a.source === "ai" && (
              <span className="rounded-full bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] font-bold text-fuchsia-200 ring-1 ring-fuchsia-500/30">
                AI
              </span>
            )}
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${status.chip}`}>
              {status.label}
            </span>
          </div>
          <span className="font-mono text-[9px] text-slate-500">{t}</span>
        </div>
        <button
          onClick={() => onSelect(a.restroomId)}
          className="mt-1 text-left text-[11px] font-semibold text-white hover:text-cyan-200"
        >
          {a.buildingName} · {a.restroomType} CR
        </button>
        <p className="mt-0.5 text-[10px] leading-snug text-slate-300">{a.message}</p>
        {a.prediction && a.source === "sensor" && (
          <p className="mt-1 rounded bg-fuchsia-500/10 px-1.5 py-1 text-[10px] text-fuchsia-200 ring-1 ring-fuchsia-500/20">
            🧠 AI: {a.prediction.narrative}
          </p>
        )}
        {!muted && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[9px] uppercase tracking-widest text-slate-500">
              {a.source === "ai" ? "Predicted hazard" : "Sensor escalation"}
            </span>
            <button
              onClick={() => onOpenAlert(a)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                isCritical
                  ? "bg-red-600 text-white ring-1 ring-red-400/60 hover:bg-red-500"
                  : "bg-slate-800 text-slate-100 ring-1 ring-white/10 hover:bg-slate-700"
              }`}
            >
              {isCritical ? "🚨 Open Red Alert" : "Open Response"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SevPill({ severity, count }: { severity: AlertSeverity; count: number }) {
  const sev = SEV_STYLE[severity];
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${sev.chip}`}>
      {severity[0]}·{count}
    </span>
  );
}
