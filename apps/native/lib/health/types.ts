export type HealthMetric =
  | "step_count"
  | "active_energy_kcal"
  | "resting_heart_rate_bpm"
  | "hrv_sdnn_ms"
  | "body_mass_kg"
  | "body_fat_percent"
  | "sleep_segment";

export const HEALTH_METRICS: readonly HealthMetric[] = [
  "step_count",
  "active_energy_kcal",
  "resting_heart_rate_bpm",
  "hrv_sdnn_ms",
  "body_mass_kg",
  "body_fat_percent",
  "sleep_segment",
];

export type SleepCategoryValue =
  | "inBed"
  | "asleep"
  | "awake"
  | "asleepREM"
  | "asleepCore"
  | "asleepDeep";

export type HealthIngestSample = {
  sampleKey: string;
  metric: HealthMetric;
  startTimeMs: number;
  endTimeMs: number;
  valueNumber?: number;
  categoryValue?: SleepCategoryValue;
  unit: string;
  sourceName?: string;
  sourceBundleId?: string;
  timezone: string;
};

export type HealthIngestRequest = {
  deviceId: string;
  samples: HealthIngestSample[];
};

export type HealthIngestResponse = {
  inserted: number;
  deduped: number;
  recomputedDays: string[];
  serverTimeMs: number;
};

export type HealthSyncMetricStats = {
  metric: HealthMetric;
  fetched: number;
  uploaded: number;
  inserted: number;
  deduped: number;
  cursorStartMs: number;
  cursorEndMs: number;
};

export type HealthSyncSummary = {
  startedAtMs: number;
  completedAtMs: number;
  inserted: number;
  deduped: number;
  recomputedDays: string[];
  metrics: HealthSyncMetricStats[];
};

export const HEALTH_SYNC_BATCH_SIZE = 500;
export const HEALTH_CURSOR_OVERLAP_MS = 24 * 60 * 60 * 1000;
