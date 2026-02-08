import {
  CategoryValueSleepAnalysis,
  type CategorySampleTyped,
  type QuantitySample,
} from "@kingstinct/react-native-healthkit";

import type { HealthIngestSample, HealthMetric, SleepCategoryValue } from "./types";

const SLEEP_IDENTIFIER = "HKCategoryTypeIdentifierSleepAnalysis";

type NumericMetric = Exclude<HealthMetric, "sleep_segment">;

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
  if (value === CategoryValueSleepAnalysis.inBed) {
    return "inBed";
  }

  if (value === CategoryValueSleepAnalysis.awake) {
    return "awake";
  }

  if (value === CategoryValueSleepAnalysis.asleepCore) {
    return "asleepCore";
  }

  if (value === CategoryValueSleepAnalysis.asleepDeep) {
    return "asleepDeep";
  }

  if (value === CategoryValueSleepAnalysis.asleepREM) {
    return "asleepREM";
  }

  if (value === CategoryValueSleepAnalysis.asleepUnspecified) {
    return "asleep";
  }

  return null;
}

export function normalizeQuantitySamples(
  metric: NumericMetric,
  samples: readonly QuantitySample[],
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
  samples: readonly CategorySampleTyped<typeof SLEEP_IDENTIFIER>[],
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
