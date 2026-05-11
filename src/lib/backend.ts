/**
 * Thin client for the CSUCC Django REST backend.
 *
 * Configure with `NEXT_PUBLIC_BACKEND_URL` at build time (e.g.
 * `https://user:pass@host`). The frontend will fall back to the client-side
 * simulation whenever the backend is unreachable.
 */

import type {
  AIPrediction,
  AlertEvent,
  AlertSeverity,
  AlertSource,
  CleaningEvent,
  RestroomLocation,
  RestroomState,
  SensorReading,
  StatusLevel,
} from "./types";

const RAW_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();

/** Returns null when no backend is configured. */
export function backendUrl(): string | null {
  if (!RAW_URL) return null;
  try {
    // Strip any embedded basic-auth credentials from the URL (we send them
    // via the Authorization header instead — some browsers refuse to forward
    // user:pass@ to fetch).
    const u = new URL(RAW_URL);
    u.username = "";
    u.password = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function authHeader(): Record<string, string> {
  if (!RAW_URL) return {};
  try {
    const u = new URL(RAW_URL);
    if (u.username) {
      const token = `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`;
      // btoa is available in browsers; safe-encode UTF-8 via TextEncoder fallback.
      const encoded = typeof btoa === "function" ? btoa(token) : Buffer.from(token).toString("base64");
      return { Authorization: `Basic ${encoded}` };
    }
  } catch {
    // ignore
  }
  return {};
}

export interface BackendSnapshotRow {
  restroom: {
    id: number;
    code: string;
    restroom_type: "Male" | "Female";
    lat: number;
    lng: number;
    baseline: number;
    building: {
      id: number;
      code: string;
      name: string;
      short_name: string;
      lat: number;
      lng: number;
    };
  };
  current: {
    id: number;
    restroom_code: string;
    t: string;
    mq135: number;
    mq136: number;
    mq137: number;
    temperature: number;
    humidity: number;
    odor: number;
    air_quality: number;
    status: StatusLevel;
  };
  prediction: {
    id: number;
    restroom_code: string;
    t: string;
    predicted_odor_1h: number;
    predicted_status_1h: StatusLevel;
    peak_hour: number;
    worst_day: number;
    hazardous_window: string;
    narrative: string;
    confidence: number;
  } | null;
}

export interface BackendAlertRow {
  id: number;
  t: string;
  restroom_code: string;
  building_name: string;
  restroom_type: "Male" | "Female";
  level: StatusLevel;
  severity: AlertSeverity;
  source: AlertSource;
  message: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
}

export interface BackendCleaningRow {
  id: number;
  t: string;
  restroom_code: string;
  building_name: string;
  restroom_type: "Male" | "Female";
  trigger: "scheduled" | "reactive" | "manual";
  duration_min: number;
  odor_before: number;
  odor_after: number;
}

async function getJson<T>(path: string): Promise<T> {
  const base = backendUrl();
  if (!base) throw new Error("backend not configured");
  const res = await fetch(`${base}${path}`, {
    method: "GET",
    headers: { ...authHeader() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = backendUrl();
  if (!base) throw new Error("backend not configured");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const backend = {
  configured: () => backendUrl() !== null,
  health: () => getJson<{ ok: boolean }>("/api/health/"),
  snapshot: () => getJson<BackendSnapshotRow[]>("/api/snapshot/"),
  alerts: () => getJson<BackendAlertRow[]>("/api/alerts/"),
  cleanings: () => getJson<BackendCleaningRow[]>("/api/cleanings/"),
  dispatchJanitor: (restroom: string) =>
    postJson<{ ok: boolean; cleaning: BackendCleaningRow | null }>(
      "/api/cleanings/dispatch/",
      { restroom },
    ),
  injectHazard: (level: "hazardous" | "critical") =>
    postJson<{ ok: boolean; restroom: string }>("/api/hazard/inject/", { level }),
  acknowledge: (alertId: number) =>
    postJson<BackendAlertRow>(`/api/alerts/${alertId}/ack/`, {}),
};

export function rowToLocation(row: BackendSnapshotRow): RestroomLocation {
  return {
    id: row.restroom.code,
    buildingId: row.restroom.building.code,
    buildingName: row.restroom.building.name,
    type: row.restroom.restroom_type,
    lat: row.restroom.lat,
    lng: row.restroom.lng,
    baseline: row.restroom.baseline,
  };
}

export function rowToReading(row: BackendSnapshotRow): SensorReading {
  const c = row.current;
  return {
    t: new Date(c.t).getTime(),
    mq135: c.mq135,
    mq136: c.mq136,
    mq137: c.mq137,
    temperature: c.temperature,
    humidity: c.humidity,
    odor: c.odor,
    airQuality: c.air_quality,
  };
}

export function rowToPrediction(row: BackendSnapshotRow): AIPrediction | null {
  if (!row.prediction) return null;
  const p = row.prediction;
  return {
    restroomId: row.restroom.code,
    predictedOdor1h: p.predicted_odor_1h,
    predictedStatus1h: p.predicted_status_1h,
    peakHour: p.peak_hour,
    worstDay: p.worst_day,
    hazardousWindow: p.hazardous_window,
    narrative: p.narrative,
    confidence: p.confidence,
  };
}

export function rowToAlert(row: BackendAlertRow): AlertEvent {
  return {
    id: `srv-${row.id}`,
    t: new Date(row.t).getTime(),
    restroomId: row.restroom_code,
    buildingName: row.building_name,
    restroomType: row.restroom_type,
    level: row.level,
    severity: row.severity,
    source: row.source,
    message: row.message,
    reading: {
      t: new Date(row.t).getTime(),
      mq135: 0,
      mq136: 0,
      mq137: 0,
      temperature: 0,
      humidity: 0,
      odor: 0,
      airQuality: 0,
    },
    acknowledged: row.acknowledged,
  };
}

export function rowToCleaning(row: BackendCleaningRow): CleaningEvent {
  return {
    id: `srv-${row.id}`,
    t: new Date(row.t).getTime(),
    restroomId: row.restroom_code,
    buildingName: row.building_name,
    restroomType: row.restroom_type,
    trigger: row.trigger,
    durationMin: row.duration_min,
    odorBefore: row.odor_before,
    odorAfter: row.odor_after,
  };
}

export type SnapshotToState = {
  state: RestroomState;
  prediction: AIPrediction | null;
};

export function snapshotToStates(rows: BackendSnapshotRow[]): SnapshotToState[] {
  return rows.map((row) => {
    const loc = rowToLocation(row);
    const reading = rowToReading(row);
    return {
      state: {
        location: loc,
        current: reading,
        history: [reading],
        status: row.current.status,
      },
      prediction: rowToPrediction(row),
    };
  });
}
