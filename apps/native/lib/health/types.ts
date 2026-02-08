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
  writeBack: {
    totalPulled: number;
    applied: number;
    failed: number;
    skipped: number;
  };
};

export type HealthWriteMetric = "active_energy_kcal" | "dietary_energy_kcal";
export type HealthWriteIntentStatus = "pending" | "applied" | "failed" | "skipped";

export type HealthWriteIntent = {
  intentId: string;
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
  tags: string[];
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

export type HealthWriteIntentAckRequest = {
  externalId: string;
  status: "applied" | "failed" | "skipped";
  appliedAtMs?: number;
  healthkitUuid?: string;
  errorCode?: string;
  errorMessage?: string;
};

export const HEALTH_SYNC_BATCH_SIZE = 500;
export const HEALTH_CURSOR_OVERLAP_MS = 24 * 60 * 60 * 1000;
