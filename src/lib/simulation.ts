import type { CleaningEvent, RestroomLocation, SensorReading } from "./types";

/**
 * Realistic IoT sensor simulation.
 *
 * The signal is driven by a daily traffic curve (people produce odor + CO2),
 * a weekly pattern (weekends are quieter), a per-restroom personality, and
 * an Ornstein–Uhlenbeck style random walk so values move smoothly instead of
 * looking like white noise.
 */

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** 0..1 traffic level for a given timestamp. */
function trafficLevel(t: Date, baseline: number): number {
  const hour = t.getHours() + t.getMinutes() / 60;
  const dow = t.getDay(); // 0=Sun..6=Sat
  const weekend = dow === 0 || dow === 6 ? 0.35 : 1;

  // morning + lunch + late-afternoon peaks for a campus
  const peak = (h: number, mu: number, sigma: number) =>
    Math.exp(-((h - mu) ** 2) / (2 * sigma * sigma));
  const morning = peak(hour, 9.5, 1.2);
  const lunch = peak(hour, 12.5, 0.9);
  const after = peak(hour, 15.5, 1.4);
  const nightFloor = 0.05;

  let base = nightFloor + 1.05 * morning + 1.25 * lunch + 0.9 * after;
  // some restrooms simply get more traffic than others
  base *= 0.6 + baseline * 0.9;
  base *= weekend;
  return clamp(base / 2.3, 0, 1);
}

const STATE = new Map<
  string,
  {
    mq135: number;
    mq136: number;
    mq137: number;
    temperature: number;
    humidity: number;
    /** time of last janitorial reset */
    lastReset: number;
  }
>();

function nextOU(prev: number, target: number, theta: number, sigma: number): number {
  // dX = theta*(target - X)dt + sigma * dW
  return prev + theta * (target - prev) + sigma * (Math.random() - 0.5) * 2;
}

export interface TickResult {
  reading: SensorReading;
  cleaning: CleaningEvent | null;
}

/** Produce the next reading for a restroom at time `now`. */
export function tickRestroom(
  loc: RestroomLocation,
  now: Date,
  opts: { recordCleaning?: boolean } = {},
): TickResult {
  const k = loc.id;
  let s = STATE.get(k);
  if (!s) {
    s = {
      mq135: 40 + loc.baseline * 15,
      mq136: 8 + loc.baseline * 5,
      mq137: 4 + loc.baseline * 6,
      temperature: 28 + loc.baseline * 1.5,
      humidity: 70 + loc.baseline * 8,
      lastReset: now.getTime(),
    };
    STATE.set(k, s);
  }

  const traffic = trafficLevel(now, loc.baseline);

  // simulated janitorial cleaning — small probability when state is bad,
  // forced after enough time, drops values dramatically
  const sinceReset = (now.getTime() - s.lastReset) / 60000; // minutes
  const badness = s.mq137 + s.mq136 * 1.4;
  const cleanChance = Math.max(0, badness - 25) / 1500 + (sinceReset > 240 ? 0.01 : 0);
  let cleaning: CleaningEvent | null = null;
  if (Math.random() < cleanChance) {
    const odorBefore = clamp(s.mq137 * 1.1 + s.mq136 * 1.0 + Math.max(0, s.mq135 - 60) * 0.25, 0, 100);
    s.mq135 *= 0.45;
    s.mq136 *= 0.35;
    s.mq137 *= 0.3;
    s.humidity = clamp(s.humidity - 6, 55, 95);
    s.lastReset = now.getTime();
    const odorAfter = clamp(s.mq137 * 1.1 + s.mq136 * 1.0 + Math.max(0, s.mq135 - 60) * 0.25, 0, 100);
    if (opts.recordCleaning) {
      cleaning = {
        id: `${loc.id}-${now.getTime()}`,
        t: now.getTime(),
        restroomId: loc.id,
        buildingName: loc.buildingName,
        restroomType: loc.type,
        trigger: odorBefore > 70 ? "reactive" : "scheduled",
        durationMin: Math.round(8 + (odorBefore / 100) * 22),
        odorBefore: round1(odorBefore),
        odorAfter: round1(odorAfter),
      };
    }
  }

  // targets influenced by traffic
  const target135 = 55 + traffic * 90 + loc.baseline * 10;
  const target136 = 6 + traffic * 35 + loc.baseline * 4;
  const target137 = 3 + traffic * 55 + loc.baseline * 5;
  const targetTemp = 27.5 + traffic * 3 + Math.sin(now.getHours() / 24 * Math.PI * 2) * 1.2;
  const targetHum = 72 + traffic * 14 + Math.cos(now.getHours() / 24 * Math.PI * 2) * 3;

  s.mq135 = clamp(nextOU(s.mq135, target135, 0.18, 4), 0, 400);
  s.mq136 = clamp(nextOU(s.mq136, target136, 0.18, 2), 0, 200);
  s.mq137 = clamp(nextOU(s.mq137, target137, 0.18, 2.2), 0, 200);
  s.temperature = clamp(nextOU(s.temperature, targetTemp, 0.25, 0.15), 20, 40);
  s.humidity = clamp(nextOU(s.humidity, targetHum, 0.25, 0.6), 30, 100);

  // composite odor 0..100
  const odor = clamp(
    s.mq137 * 1.1 + s.mq136 * 1.0 + Math.max(0, s.mq135 - 60) * 0.25,
    0,
    100,
  );

  // air quality score 0..100 (higher = better)
  const air = clamp(
    100 - (s.mq137 * 1.2 + s.mq136 * 0.9 + Math.max(0, s.mq135 - 50) * 0.2 + odor * 0.15),
    0,
    100,
  );

  return {
    reading: {
      t: now.getTime(),
      mq135: round1(s.mq135),
      mq136: round1(s.mq136),
      mq137: round1(s.mq137),
      temperature: round1(s.temperature),
      humidity: round1(s.humidity),
      odor: round1(odor),
      airQuality: round1(air),
    },
    cleaning,
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Seed several hours of history so AI predictions have data immediately. */
export function seedHistory(loc: RestroomLocation, hours: number, stepMs: number): SensorReading[] {
  const out: SensorReading[] = [];
  const now = Date.now();
  const steps = Math.floor((hours * 3600 * 1000) / stepMs);
  for (let i = steps; i > 0; i--) {
    out.push(tickRestroom(loc, new Date(now - i * stepMs)).reading);
  }
  return out;
}

/** Force-clean a restroom (acknowledged janitor response). Returns the new reading. */
export function forceClean(loc: RestroomLocation, now: Date): TickResult {
  const s = STATE.get(loc.id);
  if (s) {
    s.mq135 *= 0.35;
    s.mq136 *= 0.25;
    s.mq137 *= 0.2;
    s.humidity = clamp(s.humidity - 8, 55, 95);
    s.lastReset = now.getTime();
  }
  const tick = tickRestroom(loc, now, { recordCleaning: true });
  if (tick.cleaning) tick.cleaning.trigger = "manual";
  return tick;
}

/** Inject a hazardous spike — used to demo the alert + janitor pipeline. */
export function injectHazard(loc: RestroomLocation, level: "hazardous" | "critical" = "critical"): SensorReading {
  const s = STATE.get(loc.id);
  if (s) {
    if (level === "critical") {
      s.mq137 = 70;
      s.mq136 = 38;
      s.mq135 = 180;
      s.humidity = clamp(s.humidity + 8, 55, 100);
    } else {
      s.mq137 = 45;
      s.mq136 = 28;
      s.mq135 = 140;
      s.humidity = clamp(s.humidity + 5, 55, 100);
    }
  }
  return tickRestroom(loc, new Date()).reading;
}
