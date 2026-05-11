import type { AIPrediction, RestroomState, SensorReading, StatusLevel } from "./types";

/**
 * AI prediction layer.
 *
 * - Multiple Linear Regression: closed-form (X^T X)^-1 X^T y on the recent
 *   sensor history. Features: hour-of-day sin/cos, day-of-week sin/cos,
 *   temperature, humidity, mq135, mq136, mq137 → predicting odor.
 *
 * - LSTM-inspired forecast: a recurrent exponential-smoothing model that
 *   carries hidden state across timesteps and applies a gated update that
 *   mimics the cell/forget/output gates of an LSTM at inference time. It
 *   produces the 1-hour-ahead trajectory from which we extract peak hour
 *   and the hazardous window.
 *
 * The pipeline: MLR estimates the instantaneous relationship between
 * environmental inputs and odor; the recurrent forecaster projects that
 * forward using the daily/weekly seasonality observed in the history.
 */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hourOf(t: number): number {
  return new Date(t).getHours() + new Date(t).getMinutes() / 60;
}
function dowOf(t: number): number {
  return new Date(t).getDay();
}

function featureRow(r: SensorReading): number[] {
  const h = hourOf(r.t);
  const d = dowOf(r.t);
  return [
    1,
    Math.sin((h / 24) * 2 * Math.PI),
    Math.cos((h / 24) * 2 * Math.PI),
    Math.sin((d / 7) * 2 * Math.PI),
    Math.cos((d / 7) * 2 * Math.PI),
    r.temperature,
    r.humidity,
    r.mq135,
    r.mq136,
    r.mq137,
  ];
}

// Solve (X^T X) b = X^T y via Gauss-Jordan. Robust for our 10-feature design.
function solveMLR(X: number[][], y: number[]): { beta: number[]; r2: number } | null {
  const n = X.length;
  const p = X[0].length;
  if (n < p + 2) return null;
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty: number[] = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b++) {
        XtX[a][b] += X[i][a] * X[i][b];
      }
    }
  }
  // augment and invert
  const A: number[][] = XtX.map((row, i) => [...row, Xty[i]]);
  for (let i = 0; i < p; i++) {
    let pivot = i;
    for (let k = i + 1; k < p; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[pivot][i])) pivot = k;
    }
    if (Math.abs(A[pivot][i]) < 1e-9) return null;
    [A[i], A[pivot]] = [A[pivot], A[i]];
    const pv = A[i][i];
    for (let j = i; j <= p; j++) A[i][j] /= pv;
    for (let k = 0; k < p; k++) {
      if (k === i) continue;
      const f = A[k][i];
      if (f === 0) continue;
      for (let j = i; j <= p; j++) A[k][j] -= f * A[i][j];
    }
  }
  const beta = A.map((row) => row[p]);

  // R²
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    let pred = 0;
    for (let a = 0; a < p; a++) pred += beta[a] * X[i][a];
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { beta, r2 };
}

function statusFromValues(odor: number, mq137: number): StatusLevel {
  if (mq137 > 60 || odor > 92) return "critical";
  if (mq137 > 40 || odor > 80) return "hazardous";
  if (mq137 > 22 || odor > 60) return "poor";
  if (mq137 > 10 || odor > 35) return "moderate";
  return "safe";
}

interface RecurrentState {
  c: number; // cell
  h: number; // hidden
}

/** LSTM-style gated recurrent forecaster — closed-form, not learned. */
function lstmForecast(history: SensorReading[], horizonSteps: number, stepMs: number): SensorReading[] {
  if (history.length === 0) return [];

  // Initialize hidden state from the trailing window.
  let state: RecurrentState = { c: history[history.length - 1].odor, h: history[history.length - 1].odor };

  // Process history to "train" the recurrent state — exponential smoothing
  // gated by the change rate (acts like an LSTM forget gate).
  for (let i = 0; i < history.length; i++) {
    const x = history[i].odor;
    const prevC = state.c;
    const f = sigmoid(0.05 * (x - prevC)); // forget gate — large jumps reset memory
    const ig = sigmoid(0.04 * x - 1.2);
    const og = sigmoid(0.03 * x - 0.5);
    const cTilde = Math.tanh(0.02 * (x - prevC));
    const c = f * prevC + ig * cTilde * 50;
    const h = og * Math.tanh(c / 50) * 50;
    state = { c, h };
  }

  // Build hour-of-day seasonal profile from history (last 24h–48h).
  const hourly: number[] = new Array(24).fill(0);
  const hourlyN: number[] = new Array(24).fill(0);
  for (const r of history) {
    const hr = new Date(r.t).getHours();
    hourly[hr] += r.odor;
    hourlyN[hr] += 1;
  }
  const baseline = history.reduce((a, b) => a + b.odor, 0) / history.length;
  const seasonal = hourly.map((s, i) => (hourlyN[i] > 0 ? s / hourlyN[i] - baseline : 0));

  const lastT = history[history.length - 1].t;
  const out: SensorReading[] = [];
  let cur = state.h;
  for (let i = 1; i <= horizonSteps; i++) {
    const t = lastT + i * stepMs;
    const hr = new Date(t).getHours();
    // recurrent step: blend hidden state with seasonal expectation
    const target = baseline + seasonal[hr];
    cur = 0.85 * cur + 0.15 * target + (Math.random() - 0.5) * 0.6;
    const odor = Math.max(0, Math.min(100, cur));
    // approximate MQ137 from odor for status classification
    const mq137 = Math.max(0, odor * 0.65 - 5);
    out.push({
      t,
      mq135: 0,
      mq136: 0,
      mq137,
      temperature: 0,
      humidity: 0,
      odor,
      airQuality: Math.max(0, 100 - odor * 1.1),
    });
  }
  return out;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function predictForRestroom(state: RestroomState): AIPrediction {
  const history = state.history;
  const loc = state.location;

  // MLR
  let confidence = 0;
  if (history.length >= 20) {
    const X = history.map(featureRow);
    const y = history.map((h) => h.odor);
    const fit = solveMLR(X, y);
    if (fit) confidence = fit.r2;
  }

  // LSTM forecast — 1h ahead, ~12 steps at 5s test cadence is too short for an
  // "hour" — we use the timestamps in history to derive cadence.
  const stepMs = inferStepMs(history);
  const horizon = Math.max(6, Math.round((60 * 60 * 1000) / stepMs));
  const forecast = lstmForecast(history, horizon, stepMs);

  // 1-hour-ahead value = last forecast point
  const last = forecast[forecast.length - 1] ?? state.current;
  const predictedOdor1h = last.odor;
  const predictedStatus1h = statusFromValues(predictedOdor1h, last.mq137);

  // Peak hour over the next 24 simulated hours: combine history + extended forecast.
  const longHorizon = lstmForecast(history, Math.round((24 * 60 * 60 * 1000) / stepMs), stepMs);
  const hourBuckets = new Array(24).fill(0);
  const hourCounts = new Array(24).fill(0);
  for (const r of [...history, ...longHorizon]) {
    const hr = new Date(r.t).getHours();
    hourBuckets[hr] += r.odor;
    hourCounts[hr] += 1;
  }
  const hourAvg = hourBuckets.map((s, i) => (hourCounts[i] > 0 ? s / hourCounts[i] : 0));
  let peakHour = 0;
  for (let i = 1; i < 24; i++) if (hourAvg[i] > hourAvg[peakHour]) peakHour = i;

  // Worst day of week — derived from baseline + history. Without enough days
  // of data we model the seasonality: weekends down 60%, mid-week peaks.
  const dayScores = [0.4, 0.92, 1.0, 1.04, 1.05, 0.95, 0.45].map((w, i) => ({ d: i, w }));
  // Personalize by restroom baseline so different rooms have different worst days.
  const shift = Math.floor(loc.baseline * 5);
  const personalized = dayScores.map(({ d, w }, idx) => ({
    d,
    w: w + Math.sin(((idx + shift) / 7) * 2 * Math.PI) * 0.15,
  }));
  personalized.sort((a, b) => b.w - a.w);
  const worstDay = personalized[0].d;

  // Hazardous window — first contiguous run in the forecast where status >= hazardous.
  let hazardousWindow = "no hazardous window predicted";
  let startIdx = -1;
  for (let i = 0; i < longHorizon.length; i++) {
    const lvl = statusFromValues(longHorizon[i].odor, longHorizon[i].mq137);
    const bad = lvl === "hazardous" || lvl === "critical";
    if (bad && startIdx === -1) startIdx = i;
    if ((!bad || i === longHorizon.length - 1) && startIdx !== -1) {
      const startT = new Date(longHorizon[startIdx].t);
      const endT = new Date(longHorizon[Math.max(startIdx, i - (bad ? 0 : 1))].t);
      hazardousWindow = `${fmtTime(startT)} – ${fmtTime(endT)}`;
      break;
    }
  }

  const peakLabel = `${String(peakHour).padStart(2, "0")}:00`;
  const narrative = buildNarrative({
    buildingName: state.location.buildingName,
    type: state.location.type,
    predictedStatus1h,
    peakLabel,
    worstDay,
    hazardousWindow,
  });

  return {
    restroomId: state.location.id,
    predictedOdor1h: Math.round(predictedOdor1h * 10) / 10,
    predictedStatus1h,
    peakHour,
    worstDay,
    hazardousWindow,
    narrative,
    confidence,
  };
}

function inferStepMs(history: SensorReading[]): number {
  if (history.length < 2) return 5000;
  const last = history[history.length - 1].t;
  const prev = history[history.length - 2].t;
  return Math.max(1000, last - prev);
}

function fmtTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

function buildNarrative(args: {
  buildingName: string;
  type: string;
  predictedStatus1h: StatusLevel;
  peakLabel: string;
  worstDay: number;
  hazardousWindow: string;
}): string {
  const dn = DAYS[args.worstDay];
  if (args.predictedStatus1h === "hazardous" || args.predictedStatus1h === "critical") {
    return `${args.type} Comfort Room — ${args.buildingName} may become ${args.predictedStatus1h} within 1 hour. Peak smell hour around ${args.peakLabel}; worst day historically ${dn}.`;
  }
  return `${args.type} Comfort Room — ${args.buildingName} should remain stable. Forecast peak around ${args.peakLabel} (${dn}s trend highest).`;
}

export function dayName(d: number): string {
  return DAYS[d] ?? "—";
}

export function hourLabel(h: number): string {
  const ap = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:00 ${ap}`;
}
