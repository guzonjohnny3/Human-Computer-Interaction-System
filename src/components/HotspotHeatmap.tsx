"use client";

import { useMemo, useState } from "react";
import { BUILDINGS } from "@/lib/buildings";
import { STATUS_STYLES } from "@/lib/status";
import type { RestroomState } from "@/lib/types";

interface Props {
  states: RestroomState[];
  onSelect: (id: string) => void;
}

export function HotspotHeatmap({ states, onSelect }: Props) {
  const byBuilding = useMemo(() => {
    const m = new Map<string, { Male?: RestroomState; Female?: RestroomState }>();
    for (const s of states) {
      const entry = m.get(s.location.buildingId) ?? {};
      entry[s.location.type] = s;
      m.set(s.location.buildingId, entry);
    }
    return m;
  }, [states]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="inline-grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-rose-500/30 to-orange-500/30 ring-1 ring-rose-400/40">
            🔥
          </span>
          Restroom Hotspot Heatmap
        </h3>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">
          Odor intensity per restroom
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[10px]">
          <thead>
            <tr className="text-slate-500">
              <th className="px-1 py-1 font-semibold uppercase tracking-widest">Building</th>
              <th className="px-1 py-1 text-center font-semibold uppercase tracking-widest">
                Male
              </th>
              <th className="px-1 py-1 text-center font-semibold uppercase tracking-widest">
                Female
              </th>
            </tr>
          </thead>
          <tbody>
            {BUILDINGS.map((b) => {
              const e = byBuilding.get(b.id) ?? {};
              return (
                <tr key={b.id} className="border-t border-white/5">
                  <td className="px-1 py-1.5 text-[11px] text-slate-200">
                    {b.name}
                  </td>
                  <td className="px-1 py-1.5">
                    <HeatCell s={e.Male} onSelect={onSelect} />
                  </td>
                  <td className="px-1 py-1.5">
                    <HeatCell s={e.Female} onSelect={onSelect} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeatCell({
  s,
  onSelect,
}: {
  s: RestroomState | undefined;
  onSelect: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  if (!s) return <span className="text-slate-700">—</span>;
  const odor = s.current.odor;
  // map 0..100 odor → green → yellow → orange → red blend
  const style = STATUS_STYLES[s.status];
  return (
    <button
      onClick={() => onSelect(s.location.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative flex w-full items-center gap-1.5 rounded-md border border-white/5 px-2 py-1 ring-1 ring-transparent transition-all hover:ring-cyan-400/40"
      style={{
        background: `linear-gradient(90deg, ${style.color}33 0%, ${style.color}11 ${Math.min(
          100,
          odor,
        )}%, rgba(15,23,42,0.4) ${Math.min(100, odor)}%)`,
      }}
      title={`${s.location.buildingName} · ${s.location.type} · odor ${odor.toFixed(0)}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${s.status === "critical" ? "animate-pulse" : ""}`}
        style={{ background: style.color, boxShadow: `0 0 6px ${style.color}` }}
      />
      <span className="font-mono text-[10px] text-slate-100">{odor.toFixed(0)}</span>
      <span className="ml-auto text-[9px] uppercase tracking-widest text-slate-400">
        {style.label}
      </span>
      {hover && (
        <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950/95 px-2 py-1 text-[10px] text-slate-200 ring-1 ring-white/10">
          NH3 {s.current.mq137.toFixed(0)} · AQ {s.current.airQuality.toFixed(0)}
        </span>
      )}
    </button>
  );
}
