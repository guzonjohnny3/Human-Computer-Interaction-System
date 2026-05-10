"use client";

import { useEffect, useRef, useState } from "react";
import { RESTROOMS } from "@/lib/buildings";
import { seedHistory, tickRestroom } from "@/lib/simulation";
import { statusOf } from "@/lib/status";
import type { AlertEvent, RestroomState, StatusLevel } from "@/lib/types";
import { predictForRestroom } from "@/lib/ai";
import type { AIPrediction } from "@/lib/types";

const TICK_MS = 5000;
const HISTORY_CAP = 240; // ~20 minutes at 5s
const SEED_HOURS = 3; // seed enough history for MLR + AI

interface RestroomData {
  states: RestroomState[];
  predictions: Map<string, AIPrediction>;
  alerts: AlertEvent[];
  lastTick: number;
  tickMs: number;
}

export function useRestroomData(): RestroomData {
  const [states, setStates] = useState<RestroomState[]>(() =>
    RESTROOMS.map((loc) => {
      const history = seedHistory(loc, SEED_HOURS, 60_000); // 1-min granularity seed
      const current = history[history.length - 1];
      return {
        location: loc,
        current,
        history,
        status: statusOf(current),
      } satisfies RestroomState;
    }),
  );

  const [predictions, setPredictions] = useState<Map<string, AIPrediction>>(() => {
    const m = new Map<string, AIPrediction>();
    for (const s of states) m.set(s.location.id, predictForRestroom(s));
    return m;
  });

  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [lastTick, setLastTick] = useState<number>(() => Date.now());
  const lastStatusRef = useRef<Map<string, StatusLevel>>(
    new Map(states.map((s) => [s.location.id, s.status] as const)),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setStates((prev) => {
        const next = prev.map((s) => {
          const reading = tickRestroom(s.location, now);
          const history = [...s.history, reading].slice(-HISTORY_CAP);
          return {
            ...s,
            current: reading,
            history,
            status: statusOf(reading),
          };
        });

        // Emit alerts on status escalation.
        const newAlerts: AlertEvent[] = [];
        for (const s of next) {
          const prevStatus = lastStatusRef.current.get(s.location.id);
          const cur = s.status;
          if (
            prevStatus &&
            severity(cur) > severity(prevStatus) &&
            (cur === "hazardous" || cur === "critical" || cur === "poor")
          ) {
            newAlerts.push({
              id: `${s.location.id}-${now.getTime()}`,
              t: now.getTime(),
              restroomId: s.location.id,
              buildingName: s.location.buildingName,
              restroomType: s.location.type,
              level: cur,
              message: alertMessage(cur, s.location.type, s.location.buildingName),
            });
          }
          lastStatusRef.current.set(s.location.id, cur);
        }
        if (newAlerts.length > 0) {
          setAlerts((a) => [...newAlerts, ...a].slice(0, 30));
        }

        return next;
      });
      setLastTick(now.getTime());
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  // Re-run AI predictions periodically (every 6 ticks ≈ 30s) — cheaper than every tick.
  useEffect(() => {
    const interval = setInterval(() => {
      setPredictions((prev) => {
        const m = new Map(prev);
        for (const s of states) m.set(s.location.id, predictForRestroom(s));
        return m;
      });
    }, TICK_MS * 6);
    return () => clearInterval(interval);
  }, [states]);

  return { states, predictions, alerts, lastTick, tickMs: TICK_MS };
}

function severity(l: StatusLevel): number {
  return { safe: 0, moderate: 1, poor: 2, hazardous: 3, critical: 4 }[l];
}

function alertMessage(l: StatusLevel, type: string, building: string): string {
  switch (l) {
    case "critical":
      return `CRITICAL — ${type} CR at ${building}: ammonia spike, immediate sanitation required.`;
    case "hazardous":
      return `HAZARDOUS — ${type} CR at ${building}: dangerous ammonia concentration detected.`;
    case "poor":
      return `POOR ventilation — ${type} CR at ${building}: strong odor detected.`;
    default:
      return `${type} CR at ${building} status changed to ${l}.`;
  }
}
