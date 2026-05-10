"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RESTROOMS } from "@/lib/buildings";
import { forceClean, injectHazard, seedHistory, tickRestroom } from "@/lib/simulation";
import { statusOf } from "@/lib/status";
import type {
  AIPrediction,
  AlertEvent,
  AlertSeverity,
  CleaningEvent,
  RestroomState,
  StatusLevel,
} from "@/lib/types";
import { predictForRestroom } from "@/lib/ai";

const TICK_MS = 5000;
const HISTORY_CAP = 240; // ~20 minutes at 5s
const SEED_HOURS = 3; // seed enough history for MLR + AI
const ALERT_CAP = 60;
const CLEANING_CAP = 80;

interface RestroomData {
  states: RestroomState[];
  predictions: Map<string, AIPrediction>;
  alerts: AlertEvent[];
  cleanings: CleaningEvent[];
  lastTick: number;
  tickMs: number;
  acknowledgeAlert: (alertId: string) => void;
  dispatchJanitor: (restroomId: string) => CleaningEvent | null;
  injectDemoHazard: (level?: "hazardous" | "critical") => RestroomState | null;
}

function severityFromStatus(s: StatusLevel): AlertSeverity {
  if (s === "critical" || s === "hazardous") return "CRITICAL";
  if (s === "poor") return "WARNING";
  return "INFO";
}

function severityRank(s: AlertSeverity): number {
  return { INFO: 0, WARNING: 1, CRITICAL: 2 }[s];
}

function statusRank(l: StatusLevel): number {
  return { safe: 0, moderate: 1, poor: 2, hazardous: 3, critical: 4 }[l];
}

function alertMessageFor(level: StatusLevel, type: string, building: string): string {
  switch (level) {
    case "critical":
      return `CRITICAL — ${type} CR at ${building}: ammonia spike, immediate sanitation required.`;
    case "hazardous":
      return `HAZARDOUS — ${type} CR at ${building}: dangerous ammonia concentration detected.`;
    case "poor":
      return `POOR ventilation — ${type} CR at ${building}: strong odor detected.`;
    case "moderate":
      return `MODERATE odor — ${type} CR at ${building}: monitor for escalation.`;
    default:
      return `${type} CR at ${building} status changed to ${level}.`;
  }
}

export function useRestroomData(): RestroomData {
  const [states, setStates] = useState<RestroomState[]>(() =>
    RESTROOMS.map((loc) => {
      const history = seedHistory(loc, SEED_HOURS, 60_000);
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
  const [cleanings, setCleanings] = useState<CleaningEvent[]>([]);
  const [lastTick, setLastTick] = useState<number>(() => Date.now());
  const lastStatusRef = useRef<Map<string, StatusLevel>>(
    new Map(states.map((s) => [s.location.id, s.status] as const)),
  );
  const lastAIAlertRef = useRef<Map<string, number>>(new Map());
  const predictionsRef = useRef<Map<string, AIPrediction>>(predictions);
  useEffect(() => {
    predictionsRef.current = predictions;
  }, [predictions]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const newAlerts: AlertEvent[] = [];
      const newCleanings: CleaningEvent[] = [];

      setStates((prev) => {
        const next = prev.map((s) => {
          const tick = tickRestroom(s.location, now, { recordCleaning: true });
          if (tick.cleaning) newCleanings.push(tick.cleaning);
          const history = [...s.history, tick.reading].slice(-HISTORY_CAP);
          return {
            ...s,
            current: tick.reading,
            history,
            status: statusOf(tick.reading),
          };
        });

        for (const s of next) {
          const prevStatus = lastStatusRef.current.get(s.location.id);
          const cur = s.status;
          if (prevStatus && statusRank(cur) > statusRank(prevStatus)) {
            // sensor-driven alert on escalation
            const prediction = predictionsRef.current.get(s.location.id);
            const severity = severityFromStatus(cur);
            // only meaningful from moderate up
            if (severityRank(severity) >= severityRank("INFO") && cur !== "safe") {
              newAlerts.push({
                id: `${s.location.id}-${now.getTime()}-sensor`,
                t: now.getTime(),
                restroomId: s.location.id,
                buildingName: s.location.buildingName,
                restroomType: s.location.type,
                level: cur,
                severity,
                source: "sensor",
                message: alertMessageFor(cur, s.location.type, s.location.buildingName),
                reading: s.current,
                prediction,
                acknowledged: false,
              });
            }
          }
          lastStatusRef.current.set(s.location.id, cur);

          // AI-driven alert if a prediction says we'll escalate to hazardous/critical
          const pred = predictionsRef.current.get(s.location.id);
          if (
            pred &&
            (pred.predictedStatus1h === "hazardous" || pred.predictedStatus1h === "critical")
          ) {
            const last = lastAIAlertRef.current.get(s.location.id) ?? 0;
            // throttle AI alerts: at most once per 60s per restroom
            if (now.getTime() - last > 60_000 && statusRank(pred.predictedStatus1h) > statusRank(cur)) {
              newAlerts.push({
                id: `${s.location.id}-${now.getTime()}-ai`,
                t: now.getTime(),
                restroomId: s.location.id,
                buildingName: s.location.buildingName,
                restroomType: s.location.type,
                level: pred.predictedStatus1h,
                severity: severityFromStatus(pred.predictedStatus1h),
                source: "ai",
                message: `AI: ${pred.narrative}`,
                reading: s.current,
                prediction: pred,
                acknowledged: false,
              });
              lastAIAlertRef.current.set(s.location.id, now.getTime());
            }
          }
        }

        return next;
      });

      if (newAlerts.length) {
        setAlerts((prev) => [...newAlerts, ...prev].slice(0, ALERT_CAP));
      }
      if (newCleanings.length) {
        setCleanings((prev) => [...newCleanings, ...prev].slice(0, CLEANING_CAP));
      }
      setLastTick(now.getTime());
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  // Re-run AI predictions periodically.
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

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)),
    );
  }, []);

  const dispatchJanitor = useCallback(
    (restroomId: string): CleaningEvent | null => {
      const loc = RESTROOMS.find((r) => r.id === restroomId);
      if (!loc) return null;
      const now = new Date();
      const tick = forceClean(loc, now);
      setStates((prev) =>
        prev.map((s) =>
          s.location.id === restroomId
            ? {
                ...s,
                current: tick.reading,
                history: [...s.history, tick.reading].slice(-HISTORY_CAP),
                status: statusOf(tick.reading),
              }
            : s,
        ),
      );
      // mark all alerts for this restroom as acknowledged
      setAlerts((prev) =>
        prev.map((a) => (a.restroomId === restroomId ? { ...a, acknowledged: true } : a)),
      );
      if (tick.cleaning) {
        setCleanings((prev) => [tick.cleaning as CleaningEvent, ...prev].slice(0, CLEANING_CAP));
        return tick.cleaning;
      }
      return null;
    },
    [],
  );

  const injectDemoHazard = useCallback(
    (level: "hazardous" | "critical" = "critical"): RestroomState | null => {
      // pick a deterministic-but-visible target: rotate through restrooms
      // currently in the lowest-risk state to make the demo visible.
      const safeOnes = states.filter((s) => s.status === "safe" || s.status === "moderate");
      const pool = safeOnes.length > 0 ? safeOnes : states;
      const target = pool[Math.floor(Math.random() * pool.length)];
      const reading = injectHazard(target.location, level);
      setStates((prev) =>
        prev.map((s) =>
          s.location.id === target.location.id
            ? {
                ...s,
                current: reading,
                history: [...s.history, reading].slice(-HISTORY_CAP),
                status: statusOf(reading),
              }
            : s,
        ),
      );
      return { ...target, current: reading, status: statusOf(reading) };
    },
    [states],
  );

  return {
    states,
    predictions,
    alerts,
    cleanings,
    lastTick,
    tickMs: TICK_MS,
    acknowledgeAlert,
    dispatchJanitor,
    injectDemoHazard,
  };
}
