import type {
  AIPrediction,
  RestroomState,
  SanitationRecommendation,
  StatusLevel,
  Urgency,
} from "./types";

const ALL_TOOLS = [
  "Mop",
  "Disinfectant Spray",
  "Air Freshener",
  "Bleach Solution",
  "Trash Bag",
  "Floor Cleaner",
  "Ventilation Fan",
  "Brush and Scrubber",
] as const;

const ALL_SAFETY = ["Face Mask", "Gloves", "Eye Protection", "Protective Apron"] as const;

interface RecArgs {
  state: RestroomState;
  prediction?: AIPrediction;
}

/** Decide which sensor channel is driving the problem. */
function dominantConcern(s: RestroomState): SanitationRecommendation["primaryConcern"] {
  const r = s.current;
  const scores = {
    ammonia: r.mq137 / 25,
    sulfur: r.mq136 / 18,
    voc: Math.max(0, r.mq135 - 70) / 30,
    humidity: Math.max(0, r.humidity - 85) / 10,
  };
  let best: keyof typeof scores = "ammonia";
  let bestVal = -Infinity;
  for (const k of Object.keys(scores) as (keyof typeof scores)[]) {
    if (scores[k] > bestVal) {
      bestVal = scores[k];
      best = k;
    }
  }
  if (bestVal < 0.4) return "general";
  return best;
}

function urgencyFor(status: StatusLevel, predictedStatus?: StatusLevel): Urgency {
  // Worst of current vs predicted drives urgency.
  const rank = (s: StatusLevel): number =>
    ({ safe: 0, moderate: 1, poor: 2, hazardous: 3, critical: 4 })[s];
  const worst = predictedStatus
    ? rank(status) >= rank(predictedStatus)
      ? status
      : predictedStatus
    : status;
  switch (worst) {
    case "critical":
      return "critical";
    case "hazardous":
      return "high";
    case "poor":
      return "medium";
    default:
      return "low";
  }
}

export function recommendFor({ state, prediction }: RecArgs): SanitationRecommendation {
  const r = state.current;
  const concern = dominantConcern(state);
  const urgency = urgencyFor(state.status, prediction?.predictedStatus1h);

  // Defaults — all tools always listed, but flagged as required only when relevant
  // so the janitor knows what is actually critical for this specific situation.
  const tools: SanitationRecommendation["tools"] = ALL_TOOLS.map((name) => ({
    name,
    required: false,
  }));
  const safety: SanitationRecommendation["safety"] = ALL_SAFETY.map((name) => ({
    name,
    required: false,
  }));

  // Base requirements every cleaning needs.
  setReq(tools, "Mop", true);
  setReq(tools, "Trash Bag", true);
  setReq(tools, "Floor Cleaner", urgency !== "low");
  setReq(tools, "Air Freshener", true);
  setReq(safety, "Gloves", true);
  setReq(safety, "Face Mask", urgency !== "low");

  const procedure: string[] = [];
  const aiNotes: string[] = [];

  // Channel-specific tailoring — this is what the user sees as "AI-aware".
  switch (concern) {
    case "ammonia":
      setReq(tools, "Bleach Solution", false, "Do NOT mix bleach with ammonia residues");
      setReq(tools, "Disinfectant Spray", true, "Use ammonia-safe disinfectant (e.g., quaternary ammonium)");
      setReq(tools, "Ventilation Fan", true, "Force-vent the restroom before entry");
      setReq(safety, "Face Mask", true, "Required — high NH3 concentration detected");
      setReq(safety, "Eye Protection", true, "Ammonia is a strong eye irritant");
      procedure.push(
        "Open windows and run portable ventilation fan for 3–5 minutes before entry",
        "Apply ammonia-safe disinfectant on all urinals and toilet bowls",
        "Inspect and flush drainage system to clear uric scale buildup",
        "Wipe down surfaces with neutral pH cleaner",
        "Re-test air quality after 10 minutes",
      );
      aiNotes.push(
        `MQ137 reading at ${r.mq137.toFixed(1)} ppm indicates dangerous ammonia concentration.`,
        "Use ammonia-safe (not bleach) disinfectant to avoid releasing toxic chloramine gas.",
      );
      break;
    case "sulfur":
      setReq(tools, "Bleach Solution", true, "Bleach neutralises sulfur compounds");
      setReq(tools, "Brush and Scrubber", true, "Scrub drains where H2S accumulates");
      setReq(tools, "Ventilation Fan", true);
      setReq(safety, "Face Mask", true, "H2S has very low odor tolerance");
      procedure.push(
        "Identify and clean drains/U-bends — sulfur smells almost always originate there",
        "Apply diluted bleach in trap pipes and flush after 5 minutes",
        "Scrub tile grout where moisture has accumulated",
        "Empty all bins and double-bag waste",
        "Run ventilation for 10 minutes post-cleaning",
      );
      aiNotes.push(
        `MQ136 reading at ${r.mq136.toFixed(1)} ppm indicates elevated H2S / sulfur compounds.`,
      );
      break;
    case "voc":
      setReq(tools, "Disinfectant Spray", true);
      setReq(tools, "Ventilation Fan", true);
      setReq(tools, "Air Freshener", true);
      procedure.push(
        "Open all windows; run ventilation fan continuously during cleaning",
        "Wipe surfaces with low-VOC neutral cleaner",
        "Replace any aerosol fresheners with passive odor absorbers",
        "Check trash bins — overflowing bins are the most common VOC source",
      );
      aiNotes.push(
        `MQ135 reading at ${r.mq135.toFixed(1)} ppm indicates elevated VOCs / CO2.`,
        "Prioritise ventilation over chemical masking.",
      );
      break;
    case "humidity":
      setReq(tools, "Ventilation Fan", true);
      setReq(tools, "Floor Cleaner", true);
      procedure.push(
        "Dry all standing water on the floor and around fixtures",
        "Run dehumidifier or fan for at least 15 minutes",
        "Inspect for leaking pipes or faulty flush valves",
        "Wipe condensation from mirrors and walls",
      );
      aiNotes.push(
        `Humidity at ${r.humidity.toFixed(1)}% creates a microbial growth environment.`,
        "Address moisture before sanitising — disinfectant evaporates faster on dry surfaces.",
      );
      break;
    case "general":
    default:
      procedure.push(
        "Empty and replace trash bags",
        "Wipe down sinks, mirrors and counters",
        "Mop floor with neutral cleaner",
        "Refill consumables (soap, tissue)",
      );
      aiNotes.push(
        "No single dominant pollutant detected — scheduled maintenance cleaning is sufficient.",
      );
  }

  if (urgency === "critical") {
    procedure.unshift("⚠️ Place 'Out of Service' signage and lock entrance");
    aiNotes.push("Immediate sanitation required — temporary closure recommended until air quality recovers.");
    setReq(safety, "Protective Apron", true);
    setReq(safety, "Eye Protection", true);
    setReq(tools, "Ventilation Fan", true);
  }

  if (prediction) {
    if (
      prediction.predictedStatus1h === "hazardous" ||
      prediction.predictedStatus1h === "critical"
    ) {
      aiNotes.push(
        `LSTM forecast: condition expected to escalate to ${prediction.predictedStatus1h} within 1h — escalate cleaning now.`,
      );
    } else if (urgency === "low") {
      aiNotes.push(
        `LSTM forecast: peak smell hour ~${pad(prediction.peakHour)}:00 — schedule next maintenance before then.`,
      );
    }
  }

  const estimatedMinutes = estimateMinutes(urgency, concern);
  const closureRecommended = urgency === "critical" || (urgency === "high" && concern === "ammonia");

  return {
    urgency,
    estimatedMinutes,
    closureRecommended,
    primaryConcern: concern,
    tools,
    safety,
    procedure,
    aiNotes,
  };
}

function estimateMinutes(u: Urgency, concern: SanitationRecommendation["primaryConcern"]): number {
  const base = { low: 8, medium: 15, high: 25, critical: 35 }[u];
  const concernBonus = concern === "ammonia" ? 10 : concern === "sulfur" ? 8 : concern === "humidity" ? 5 : 0;
  return base + concernBonus;
}

function setReq(
  list: SanitationRecommendation["tools"],
  name: string,
  required: boolean,
  reason?: string,
): void {
  const t = list.find((x) => x.name === name);
  if (t) {
    t.required = required;
    if (reason) t.reason = reason;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function urgencyLabel(u: Urgency): string {
  switch (u) {
    case "critical":
      return "CRITICAL";
    case "high":
      return "HIGH";
    case "medium":
      return "MEDIUM";
    default:
      return "LOW";
  }
}

export function urgencyChipClass(u: Urgency): string {
  switch (u) {
    case "critical":
      return "bg-red-900/40 text-red-200 ring-1 ring-red-700/60 animate-pulse";
    case "high":
      return "bg-red-500/15 text-red-200 ring-1 ring-red-500/40";
    case "medium":
      return "bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/40";
    default:
      return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40";
  }
}
