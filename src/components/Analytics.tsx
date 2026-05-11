"use client";

import type { RestroomState } from "@/lib/types";
import { Sparkline } from "./Sparkline";

interface Props {
  selected: RestroomState | null;
  states: RestroomState[];
}

export function Analytics({ selected, states }: Props) {
  // Campus aggregates
  const campusOdor: number[] = [];
  const campusAQ: number[] = [];
  if (states.length > 0) {
    const minLen = Math.min(...states.map((s) => s.history.length));
    for (let i = 0; i < minLen; i++) {
      let sumO = 0;
      let sumA = 0;
      for (const s of states) {
        sumO += s.history[s.history.length - minLen + i].odor;
        sumA += s.history[s.history.length - minLen + i].airQuality;
      }
      campusOdor.push(sumO / states.length);
      campusAQ.push(sumA / states.length);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3 backdrop-blur-md">
        <div className="mb-1 flex items-center justify-between">
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Campus Average Odor
          </h4>
          <span className="font-mono text-xs text-slate-300">
            {(campusOdor[campusOdor.length - 1] ?? 0).toFixed(1)}
          </span>
        </div>
        <Sparkline values={campusOdor} min={0} max={100} color="#f59e0b" width={400} height={70} />
      </div>
      <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3 backdrop-blur-md">
        <div className="mb-1 flex items-center justify-between">
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Campus Average Air Quality
          </h4>
          <span className="font-mono text-xs text-slate-300">
            {(campusAQ[campusAQ.length - 1] ?? 0).toFixed(1)}
          </span>
        </div>
        <Sparkline values={campusAQ} min={0} max={100} color="#22d3ee" width={400} height={70} />
      </div>

      {selected && (
        <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-3 backdrop-blur-md lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-cyan-200">
              {selected.location.buildingName} · {selected.location.type} CR — Sensor Trends
            </h4>
            <span className="font-mono text-[10px] text-slate-400">
              {selected.history.length} samples
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Trend
              label="MQ135"
              values={selected.history.map((h) => h.mq135)}
              cur={selected.current.mq135}
              color="#22d3ee"
            />
            <Trend
              label="MQ136"
              values={selected.history.map((h) => h.mq136)}
              cur={selected.current.mq136}
              color="#a78bfa"
            />
            <Trend
              label="MQ137"
              values={selected.history.map((h) => h.mq137)}
              cur={selected.current.mq137}
              color="#f87171"
            />
            <Trend
              label="Odor"
              values={selected.history.map((h) => h.odor)}
              cur={selected.current.odor}
              color="#f59e0b"
              max={100}
              min={0}
            />
            <Trend
              label="Temp °C"
              values={selected.history.map((h) => h.temperature)}
              cur={selected.current.temperature}
              color="#fb7185"
            />
            <Trend
              label="Humidity %"
              values={selected.history.map((h) => h.humidity)}
              cur={selected.current.humidity}
              color="#34d399"
              min={0}
              max={100}
            />
            <Trend
              label="Air Quality"
              values={selected.history.map((h) => h.airQuality)}
              cur={selected.current.airQuality}
              color="#67e8f9"
              min={0}
              max={100}
            />
            <Trend
              label="NH3 (MQ137)"
              values={selected.history.map((h) => h.mq137)}
              cur={selected.current.mq137}
              color="#fde047"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Trend({
  label,
  values,
  cur,
  color,
  min,
  max,
}: {
  label: string;
  values: number[];
  cur: number;
  color: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-slate-950/50 p-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-widest text-slate-400">{label}</span>
        <span className="font-mono text-xs text-white">{cur.toFixed(1)}</span>
      </div>
      <Sparkline values={values} min={min} max={max} color={color} width={140} height={32} />
    </div>
  );
}
