export type RestroomType = "Male" | "Female";

export type StatusLevel = "safe" | "moderate" | "poor" | "hazardous" | "critical";

export interface Building {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
}

export interface RestroomLocation {
  id: string;
  buildingId: string;
  buildingName: string;
  type: RestroomType;
  /** small offset from building for distinct markers */
  lat: number;
  lng: number;
  /** deterministic "personality" of this restroom — baseline traffic & cleanliness */
  baseline: number;
}

export interface SensorReading {
  /** ms since epoch */
  t: number;
  mq135: number; // ppm equivalent — CO2 / VOC / smoke
  mq136: number; // ppm equivalent — H2S sulfur compounds
  mq137: number; // ppm equivalent — NH3 ammonia
  temperature: number; // °C
  humidity: number; // %
  odor: number; // 0..100 composite odor
  airQuality: number; // 0..100 air quality SCORE (higher = better)
}

export interface RestroomState {
  location: RestroomLocation;
  current: SensorReading;
  history: SensorReading[]; // rolling buffer
  status: StatusLevel;
}

export interface AIPrediction {
  restroomId: string;
  /** predicted odor 1 hour ahead */
  predictedOdor1h: number;
  /** predicted status 1h ahead */
  predictedStatus1h: StatusLevel;
  /** peak hour of day (0..23) */
  peakHour: number;
  /** worst day of week (0=Sun..6=Sat) */
  worstDay: number;
  /** human-readable hazardous window */
  hazardousWindow: string;
  /** narrative the dashboard renders */
  narrative: string;
  /** confidence 0..1 from MLR R² */
  confidence: number;
}

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export type AlertSource = "sensor" | "ai";

export interface AlertEvent {
  id: string;
  t: number;
  restroomId: string;
  buildingName: string;
  restroomType: RestroomType;
  level: StatusLevel;
  severity: AlertSeverity;
  source: AlertSource;
  message: string;
  /** snapshot of the reading that triggered the alert */
  reading: SensorReading;
  /** optional AI prediction at the time of alert */
  prediction?: AIPrediction;
  /** acknowledgement state */
  acknowledged: boolean;
}

export interface CleaningEvent {
  id: string;
  t: number;
  restroomId: string;
  buildingName: string;
  restroomType: RestroomType;
  /** trigger that drove the cleaning */
  trigger: "scheduled" | "reactive" | "manual";
  /** approximate duration in minutes (simulated) */
  durationMin: number;
  /** average odor before vs after */
  odorBefore: number;
  odorAfter: number;
}

export type Urgency = "low" | "medium" | "high" | "critical";

export interface SanitationRecommendation {
  urgency: Urgency;
  /** estimated cleaning time in minutes */
  estimatedMinutes: number;
  /** whether the restroom should be temporarily closed */
  closureRecommended: boolean;
  /** dominant signal driving the recommendation */
  primaryConcern: "ammonia" | "sulfur" | "voc" | "humidity" | "general";
  tools: { name: string; required: boolean; reason?: string }[];
  safety: { name: string; required: boolean; reason?: string }[];
  procedure: string[];
  aiNotes: string[];
}
