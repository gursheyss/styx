import {
  HEALTH_METRICS,
  SLEEP_CATEGORY_VALUES,
  type HealthDailyMetricsRecord,
  type HealthIngestSample,
  type HealthMetric,
  type SleepCategoryValue,
} from "./healthTypes";

const SAMPLE_KEY_PATTERN = /^[A-Za-z0-9._:|\-]{1,200}$/;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isHealthMetric(metric: string): metric is HealthMetric {
  for (const candidate of HEALTH_METRICS) {
    if (candidate === metric) {
      return true;
    }
  }
  return false;
}

export function isSleepCategoryValue(value: string): value is SleepCategoryValue {
  for (const candidate of SLEEP_CATEGORY_VALUES) {
    if (candidate === value) {
      return true;
    }
  }
  return false;
}

export function dayKeyFromTimestamp(timestampMs: number, timezone: string): string {
  if (!Number.isFinite(timestampMs)) {
    throw new Error("timestampMs must be finite");
  }

  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    throw new Error("timestampMs must produce a valid date");
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

export function assertValidSampleKey(sampleKey: string): void {
  if (!SAMPLE_KEY_PATTERN.test(sampleKey)) {
    throw new Error("Invalid sampleKey format");
  }
}

export function assertValidDayKey(dayKey: string): void {
  if (!DAY_KEY_PATTERN.test(dayKey)) {
    throw new Error("Invalid day key format, expected YYYY-MM-DD");
  }
}

function assertFiniteMs(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer millisecond timestamp`);
  }
}

export type PreparedHealthSample = HealthIngestSample & { dayKey: string };

export function validateAndPrepareSample(sample: HealthIngestSample): PreparedHealthSample {
  assertValidSampleKey(sample.sampleKey);

  if (!isHealthMetric(sample.metric)) {
    throw new Error("Invalid metric");
  }

  assertFiniteMs(sample.startTimeMs, "startTimeMs");
  assertFiniteMs(sample.endTimeMs, "endTimeMs");

  if (sample.endTimeMs < sample.startTimeMs) {
    throw new Error("endTimeMs must be >= startTimeMs");
  }

  if (sample.unit.trim().length === 0) {
    throw new Error("unit is required");
  }

  if (sample.timezone.trim().length === 0) {
    throw new Error("timezone is required");
  }

  if (sample.metric === "sleep_segment") {
    if (sample.categoryValue === undefined) {
      throw new Error("categoryValue is required for sleep_segment");
    }
    if (!isSleepCategoryValue(sample.categoryValue)) {
      throw new Error("Invalid sleep category value");
    }
  } else {
    if (sample.valueNumber === undefined || !Number.isFinite(sample.valueNumber)) {
      throw new Error("valueNumber is required and must be finite for numeric metrics");
    }
  }

  const dayKey = dayKeyFromTimestamp(sample.startTimeMs, sample.timezone);
  return {
    ...sample,
    dayKey,
  };
}

type NumericAccumulator = {
  sum: number;
  min: number;
  max: number;
  count: number;
};

type DailyAccumulator = {
  dayKey: string;
  timezone: string;
  stepCountTotal: number;
  stepCountSamples: number;
  activeEnergyKcalTotal: number;
  activeEnergyKcalSamples: number;
  restingHeartRate: NumericAccumulator;
  hrvSdnn: NumericAccumulator;
  bodyMassKg: NumericAccumulator;
  bodyFatPercent: NumericAccumulator;
  sleepSampleCount: number;
  sleepInBedMs: number;
  sleepAsleepMs: number;
  sleepAwakeMs: number;
  sleepAsleepRemMs: number;
  sleepAsleepCoreMs: number;
  sleepAsleepDeepMs: number;
};

function createNumericAccumulator(): NumericAccumulator {
  return {
    sum: 0,
    min: 0,
    max: 0,
    count: 0,
  };
}

function applyNumeric(accumulator: NumericAccumulator, value: number): void {
  if (!Number.isFinite(value)) {
    return;
  }

  const nextCount = accumulator.count + 1;
  accumulator.sum += value;
  accumulator.min = nextCount === 1 ? value : Math.min(accumulator.min, value);
  accumulator.max = nextCount === 1 ? value : Math.max(accumulator.max, value);
  accumulator.count = nextCount;
}

function createAccumulator(dayKey: string, timezone: string): DailyAccumulator {
  return {
    dayKey,
    timezone,
    stepCountTotal: 0,
    stepCountSamples: 0,
    activeEnergyKcalTotal: 0,
    activeEnergyKcalSamples: 0,
    restingHeartRate: createNumericAccumulator(),
    hrvSdnn: createNumericAccumulator(),
    bodyMassKg: createNumericAccumulator(),
    bodyFatPercent: createNumericAccumulator(),
    sleepSampleCount: 0,
    sleepInBedMs: 0,
    sleepAsleepMs: 0,
    sleepAwakeMs: 0,
    sleepAsleepRemMs: 0,
    sleepAsleepCoreMs: 0,
    sleepAsleepDeepMs: 0,
  };
}

function durationMs(sample: PreparedHealthSample): number {
  return Math.max(0, sample.endTimeMs - sample.startTimeMs);
}

function addSleepSegment(accumulator: DailyAccumulator, sample: PreparedHealthSample): void {
  const category = sample.categoryValue;
  if (category === undefined) {
    return;
  }

  const sampleDurationMs = durationMs(sample);
  accumulator.sleepSampleCount += 1;

  if (category === "inBed") {
    accumulator.sleepInBedMs += sampleDurationMs;
    return;
  }

  if (category === "awake") {
    accumulator.sleepAwakeMs += sampleDurationMs;
    return;
  }

  if (category === "asleep") {
    accumulator.sleepAsleepMs += sampleDurationMs;
    return;
  }

  if (category === "asleepREM") {
    accumulator.sleepAsleepRemMs += sampleDurationMs;
    return;
  }

  if (category === "asleepCore") {
    accumulator.sleepAsleepCoreMs += sampleDurationMs;
    return;
  }

  accumulator.sleepAsleepDeepMs += sampleDurationMs;
}

function averageFromAccumulator(accumulator: NumericAccumulator): number {
  if (accumulator.count === 0) {
    return 0;
  }
  return accumulator.sum / accumulator.count;
}

export function buildDailyAggregateRecord(
  dayKey: string,
  timezone: string,
  samples: PreparedHealthSample[],
  recomputedAtMs: number,
): HealthDailyMetricsRecord {
  const accumulator = createAccumulator(dayKey, timezone);

  for (const sample of samples) {
    if (sample.metric === "step_count" && sample.valueNumber !== undefined) {
      accumulator.stepCountTotal += sample.valueNumber;
      accumulator.stepCountSamples += 1;
      continue;
    }

    if (sample.metric === "active_energy_kcal" && sample.valueNumber !== undefined) {
      accumulator.activeEnergyKcalTotal += sample.valueNumber;
      accumulator.activeEnergyKcalSamples += 1;
      continue;
    }

    if (sample.metric === "resting_heart_rate_bpm" && sample.valueNumber !== undefined) {
      applyNumeric(accumulator.restingHeartRate, sample.valueNumber);
      continue;
    }

    if (sample.metric === "hrv_sdnn_ms" && sample.valueNumber !== undefined) {
      applyNumeric(accumulator.hrvSdnn, sample.valueNumber);
      continue;
    }

    if (sample.metric === "body_mass_kg" && sample.valueNumber !== undefined) {
      applyNumeric(accumulator.bodyMassKg, sample.valueNumber);
      continue;
    }

    if (sample.metric === "body_fat_percent" && sample.valueNumber !== undefined) {
      applyNumeric(accumulator.bodyFatPercent, sample.valueNumber);
      continue;
    }

    if (sample.metric === "sleep_segment") {
      addSleepSegment(accumulator, sample);
    }
  }

  const sleepTotalAsleepMs =
    accumulator.sleepAsleepMs +
    accumulator.sleepAsleepRemMs +
    accumulator.sleepAsleepCoreMs +
    accumulator.sleepAsleepDeepMs;

  return {
    dayKey,
    timezone,
    stepCountTotal: accumulator.stepCountTotal,
    stepCountSamples: accumulator.stepCountSamples,
    activeEnergyKcalTotal: accumulator.activeEnergyKcalTotal,
    activeEnergyKcalSamples: accumulator.activeEnergyKcalSamples,
    restingHeartRateAvg: averageFromAccumulator(accumulator.restingHeartRate),
    restingHeartRateMin: accumulator.restingHeartRate.min,
    restingHeartRateMax: accumulator.restingHeartRate.max,
    restingHeartRateSamples: accumulator.restingHeartRate.count,
    hrvSdnnAvg: averageFromAccumulator(accumulator.hrvSdnn),
    hrvSdnnMin: accumulator.hrvSdnn.min,
    hrvSdnnMax: accumulator.hrvSdnn.max,
    hrvSdnnSamples: accumulator.hrvSdnn.count,
    bodyMassKgAvg: averageFromAccumulator(accumulator.bodyMassKg),
    bodyMassKgMin: accumulator.bodyMassKg.min,
    bodyMassKgMax: accumulator.bodyMassKg.max,
    bodyMassKgSamples: accumulator.bodyMassKg.count,
    bodyFatPercentAvg: averageFromAccumulator(accumulator.bodyFatPercent),
    bodyFatPercentMin: accumulator.bodyFatPercent.min,
    bodyFatPercentMax: accumulator.bodyFatPercent.max,
    bodyFatPercentSamples: accumulator.bodyFatPercent.count,
    sleepSampleCount: accumulator.sleepSampleCount,
    sleepInBedMs: accumulator.sleepInBedMs,
    sleepAsleepMs: accumulator.sleepAsleepMs,
    sleepAwakeMs: accumulator.sleepAwakeMs,
    sleepAsleepRemMs: accumulator.sleepAsleepRemMs,
    sleepAsleepCoreMs: accumulator.sleepAsleepCoreMs,
    sleepAsleepDeepMs: accumulator.sleepAsleepDeepMs,
    sleepTotalAsleepMs,
    recomputedAtMs,
  };
}
