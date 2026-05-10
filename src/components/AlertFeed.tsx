"use client";

import { STATUS_STYLES } from "@/lib/status";
import type { AlertEvent } from "@/lib/types";

interface Props {
  alerts: AlertEvent[];
  onSelect: (id: string) => void;
}

export function AlertFeed({ alerts, onSelect }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
          </span>
          Active Alerts
        </h3>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">{alerts.length} recent</span>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <div className="grid h-full place-items-center rounded-lg border border-dashed border-slate-700/50 text-center text-xs text-slate-500">
            No active alerts — campus operating within nominal range
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => {
              const style = STATUS_STYLES[a.level];
              const t = new Date(a.t).toLocaleTimeString();
              return (
                <li key={a.id}>
                  <button
                    onClick={() => onSelect(a.restroomId)}
                    className="group w-full rounded-lg border border-white/5 bg-slate-900/40 p-2.5 text-left backdrop-blur-md transition-colors hover:border-white/15 hover:bg-slate-900/70"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${style.chip}`}>
                        {style.label}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">{t}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-snug text-slate-200">{a.message}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
