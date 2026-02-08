import type { HealthIngestSample, HealthMetric, SleepCategoryValue } from "./types";

type NumericMetric = Exclude<HealthMetric, "sleep_segment">;

const SLEEP_VALUE_IN_BED = 0;
const SLEEP_VALUE_ASLEEP_UNSPECIFIED = 1;
const SLEEP_VALUE_AWAKE = 2;
const SLEEP_VALUE_ASLEEP_CORE = 3;
const SLEEP_VALUE_ASLEEP_DEEP = 4;
const SLEEP_VALUE_ASLEEP_REM = 5;

type SourceRevisionLike = {
  source: {
    name: string;
    bundleIdentifier: string;
  };
};

type QuantitySampleLike = {
  uuid: string;
  startDate: Date;
  endDate: Date;
  quantity: number;
  unit: string;
  sourceRevision: SourceRevisionLike;
};

type SleepSampleLike = {
  uuid: string;
  startDate: Date;
  endDate: Date;
  value: number;
  sourceRevision: SourceRevisionLike;
};

function toMs(value: Date): number {
  return value.getTime();
}

function sourceName(sample: { sourceRevision: { source: { name: string } } }): string {
  return sample.sourceRevision.source.name;
}

function sourceBundleId(sample: {
  sourceRevision: { source: { bundleIdentifier: string } };
}): string {
  return sample.sourceRevision.source.bundleIdentifier;
}

function buildSampleKey(metric: HealthMetric, sampleUuid: string): string {
  return `${metric}:${sampleUuid}`;
}

export function mapSleepCategoryValue(value: number): SleepCategoryValue | null {
  if (value === SLEEP_VALUE_IN_BED) {
    return "inBed";
  }

  if (value === SLEEP_VALUE_AWAKE) {
    return "awake";
  }

  if (value === SLEEP_VALUE_ASLEEP_CORE) {
    return "asleepCore";
  }

  if (value === SLEEP_VALUE_ASLEEP_DEEP) {
    return "asleepDeep";
  }

  if (value === SLEEP_VALUE_ASLEEP_REM) {
    return "asleepREM";
  }

  if (value === SLEEP_VALUE_ASLEEP_UNSPECIFIED) {
    return "asleep";
  }

  return null;
}

export function normalizeQuantitySamples(
  metric: NumericMetric,
  samples: readonly QuantitySampleLike[],
  timezone: string,
): HealthIngestSample[] {
  return samples
    .map((sample): HealthIngestSample | null => {
      const startTimeMs = toMs(sample.startDate);
      const endTimeMs = toMs(sample.endDate);
      if (!Number.isFinite(startTimeMs) || !Number.isFinite(endTimeMs) || endTimeMs < startTimeMs) {
        return null;
      }

      return {
        sampleKey: buildSampleKey(metric, sample.uuid),
        metric,
        startTimeMs,
        endTimeMs,
        valueNumber: sample.quantity,
        unit: sample.unit,
        sourceName: sourceName(sample),
        sourceBundleId: sourceBundleId(sample),
        timezone,
      };
    })
    .filter((sample): sample is HealthIngestSample => sample !== null);
}

export function normalizeSleepSamples(
  samples: readonly SleepSampleLike[],
  timezone: string,
): HealthIngestSample[] {
  const normalized: HealthIngestSample[] = [];

  for (const sample of samples) {
    const startTimeMs = toMs(sample.startDate);
    const endTimeMs = toMs(sample.endDate);
    if (!Number.isFinite(startTimeMs) || !Number.isFinite(endTimeMs) || endTimeMs < startTimeMs) {
      continue;
    }

    const mappedCategory = mapSleepCategoryValue(sample.value);
    if (mappedCategory === null) {
      continue;
    }

    normalized.push({
      sampleKey: buildSampleKey("sleep_segment", sample.uuid),
      metric: "sleep_segment",
      startTimeMs,
      endTimeMs,
      categoryValue: mappedCategory,
      unit: "ms",
      sourceName: sourceName(sample),
      sourceBundleId: sourceBundleId(sample),
      timezone,
    });
  }

  return normalized;
}
