import type { SensorReading, StatusLevel } from "./types";

export interface StatusStyle {
  label: string;
  /** marker fill */
  color: string;
  /** marker glow */
  glow: string;
  /** Tailwind text token, e.g. "text-emerald-400" */
  text: string;
  /** Tailwind bg token for chips */
  chip: string;
  blink: boolean;
  rank: number; // higher = worse
}

export const STATUS_STYLES: Record<StatusLevel, StatusStyle> = {
  safe: {
    label: "SAFE",
    color: "#22c55e",
    glow: "rgba(34,197,94,0.65)",
    text: "text-emerald-300",
    chip: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40",
    blink: false,
    rank: 0,
  },
  moderate: {
    label: "MODERATE",
    color: "#eab308",
    glow: "rgba(234,179,8,0.7)",
    text: "text-yellow-300",
    chip: "bg-yellow-500/15 text-yellow-200 ring-1 ring-yellow-500/40",
    blink: false,
    rank: 1,
  },
  poor: {
    label: "POOR",
    color: "#f97316",
    glow: "rgba(249,115,22,0.75)",
    text: "text-orange-300",
    chip: "bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/40",
    blink: false,
    rank: 2,
  },
  hazardous: {
    label: "HAZARDOUS",
    color: "#ef4444",
    glow: "rgba(239,68,68,0.8)",
    text: "text-red-300",
    chip: "bg-red-500/15 text-red-200 ring-1 ring-red-500/40",
    blink: false,
    rank: 3,
  },
  critical: {
    label: "CRITICAL",
    color: "#7f1d1d",
    glow: "rgba(127,29,29,0.95)",
    text: "text-red-400",
    chip: "bg-red-900/40 text-red-200 ring-1 ring-red-700 animate-pulse",
    blink: true,
    rank: 4,
  },
};

/** Compute status from a single reading. */
export function statusOf(r: SensorReading): StatusLevel {
  // ammonia (MQ137) is the strongest signal for restroom emergencies
  if (r.mq137 > 60 || r.odor > 92 || r.airQuality < 12) return "critical";
  if (r.mq137 > 40 || r.odor > 80 || r.airQuality < 25 || r.mq136 > 35) return "hazardous";
  if (r.mq137 > 22 || r.odor > 60 || r.airQuality < 45 || r.mq135 > 110) return "poor";
  if (r.mq137 > 10 || r.odor > 35 || r.airQuality < 65) return "moderate";
  return "safe";
}

export function statusLabel(level: StatusLevel): string {
  return STATUS_STYLES[level].label;
}
