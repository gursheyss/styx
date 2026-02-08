export type HealthMetric =
  | "step_count"
  | "active_energy_kcal"
  | "dietary_energy_kcal"
  | "resting_heart_rate_bpm"
  | "hrv_sdnn_ms"
  | "body_mass_kg"
  | "body_fat_percent"
  | "sleep_segment";

export const HEALTH_METRICS: readonly HealthMetric[] = [
  "step_count",
  "active_energy_kcal",
  "dietary_energy_kcal",
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
  dietaryEnergyKcalTotal: number;
  dietaryEnergyKcalSamples: number;
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

export type HealthSummaryInsightSeverity = "info" | "watch" | "good";

export type HealthSummaryInsight = {
  code: string;
  severity: HealthSummaryInsightSeverity;
  message: string;
};

export type HealthDailySummary = {
  dayKey: string;
  timezone: string;
  metrics: {
    sleep: {
      sampleCount: number;
      inBedHours: number;
      asleepHours: number;
      awakeHours: number;
      remHours: number;
      coreHours: number;
      deepHours: number;
      sleepEfficiency: number;
    };
    activity: {
      stepCount: number;
      activeCaloriesKcal: number;
      dietaryCaloriesKcal: number;
    };
    recovery: {
      restingHeartRateBpm: {
        average: number;
        min: number;
        max: number;
        sampleCount: number;
      };
      hrvSdnnMs: {
        average: number;
        min: number;
        max: number;
        sampleCount: number;
      };
    };
    body: {
      bodyMassKg: {
        average: number;
        min: number;
        max: number;
        sampleCount: number;
      };
      bodyFatPercent: {
        average: number;
        min: number;
        max: number;
        sampleCount: number;
      };
    };
  };
  derived: {
    calorieBalanceKcal: number;
    activeCaloriesBand: "low" | "moderate" | "high";
    sleepBand: "short" | "target" | "extended";
  };
  insights: HealthSummaryInsight[];
  recomputedAtMs: number;
};

export type HealthSummaryRange = {
  from: string;
  to: string;
  timezone: string;
  days: HealthDailySummary[];
  totals: {
    days: number;
    totalSteps: number;
    totalActiveCaloriesKcal: number;
    totalDietaryCaloriesKcal: number;
    averageSleepHours: number;
    averageSleepEfficiency: number;
  };
};

export type HealthWriteMetric = "active_energy_kcal" | "dietary_energy_kcal";

export const HEALTH_WRITE_METRICS: readonly HealthWriteMetric[] = [
  "active_energy_kcal",
  "dietary_energy_kcal",
];

export type HealthWriteIntentStatus = "pending" | "applied" | "failed" | "skipped";

export const HEALTH_WRITE_INTENT_STATUSES: readonly HealthWriteIntentStatus[] = [
  "pending",
  "applied",
  "failed",
  "skipped",
];

export type HealthWriteIntentPayload = {
  externalId: string;
  metric: HealthWriteMetric;
  startTimeMs: number;
  endTimeMs: number;
  valueNumber: number;
  unit: string;
  timezone: string;
  note?: string;
  sourceName?: string;
  sourceBundleId?: string;
  tags?: string[];
};

export type HealthWriteIntent = HealthWriteIntentPayload & {
  intentId: string;
  status: HealthWriteIntentStatus;
  attemptCount: number;
  createdAtMs: number;
  updatedAtMs: number;
  nextRetryAtMs: number;
  lastAttemptAtMs?: number;
  healthkitUuid?: string;
  failureCode?: string;
  failureMessage?: string;
  appliedAtMs?: number;
};

export type HealthWriteIntentAckStatus = "applied" | "failed" | "skipped";

export type HealthWriteIntentAckRequest = {
  externalId: string;
  status: HealthWriteIntentAckStatus;
  appliedAtMs?: number;
  healthkitUuid?: string;
  errorCode?: string;
  errorMessage?: string;
};

export const MAX_INGEST_BATCH_SIZE = 500;
export const MAX_RAW_PAGE_SIZE = 500;
export const MAX_WRITE_INTENT_PAGE_SIZE = 200;
