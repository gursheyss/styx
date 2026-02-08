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

export const SLEEP_CATEGORY_VALUES: readonly SleepCategoryValue[] = [
  "inBed",
  "asleep",
  "awake",
  "asleepREM",
  "asleepCore",
  "asleepDeep",
];

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

export type HealthDailyMetricsRecord = {
  dayKey: string;
  timezone: string;
  stepCountTotal: number;
  stepCountSamples: number;
  activeEnergyKcalTotal: number;
  activeEnergyKcalSamples: number;
  restingHeartRateAvg: number;
  restingHeartRateMin: number;
  restingHeartRateMax: number;
  restingHeartRateSamples: number;
  hrvSdnnAvg: number;
  hrvSdnnMin: number;
  hrvSdnnMax: number;
  hrvSdnnSamples: number;
  bodyMassKgAvg: number;
  bodyMassKgMin: number;
  bodyMassKgMax: number;
  bodyMassKgSamples: number;
  bodyFatPercentAvg: number;
  bodyFatPercentMin: number;
  bodyFatPercentMax: number;
  bodyFatPercentSamples: number;
  sleepSampleCount: number;
  sleepInBedMs: number;
  sleepAsleepMs: number;
  sleepAwakeMs: number;
  sleepAsleepRemMs: number;
  sleepAsleepCoreMs: number;
  sleepAsleepDeepMs: number;
  sleepTotalAsleepMs: number;
  recomputedAtMs: number;
};

export const MAX_INGEST_BATCH_SIZE = 500;
export const MAX_RAW_PAGE_SIZE = 500;
