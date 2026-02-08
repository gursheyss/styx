import {
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryQuantitySamples,
  requestAuthorization,
  type ObjectTypeIdentifier,
  type QuantityTypeIdentifier,
} from "@kingstinct/react-native-healthkit";
import { Platform } from "react-native";

import { normalizeQuantitySamples, normalizeSleepSamples } from "./normalize";
import type { HealthIngestSample, HealthMetric } from "./types";

const SLEEP_IDENTIFIER = "HKCategoryTypeIdentifierSleepAnalysis";
const STEP_COUNT_IDENTIFIER = "HKQuantityTypeIdentifierStepCount";
const ACTIVE_ENERGY_IDENTIFIER = "HKQuantityTypeIdentifierActiveEnergyBurned";
const RESTING_HEART_RATE_IDENTIFIER = "HKQuantityTypeIdentifierRestingHeartRate";
const HRV_SDNN_IDENTIFIER = "HKQuantityTypeIdentifierHeartRateVariabilitySDNN";
const BODY_MASS_IDENTIFIER = "HKQuantityTypeIdentifierBodyMass";
const BODY_FAT_IDENTIFIER = "HKQuantityTypeIdentifierBodyFatPercentage";

const READ_IDENTIFIERS: readonly ObjectTypeIdentifier[] = [
  STEP_COUNT_IDENTIFIER,
  ACTIVE_ENERGY_IDENTIFIER,
  RESTING_HEART_RATE_IDENTIFIER,
  HRV_SDNN_IDENTIFIER,
  BODY_MASS_IDENTIFIER,
  BODY_FAT_IDENTIFIER,
  SLEEP_IDENTIFIER,
];

function queryDateFilter(fromMs: number, toMs: number): {
  filter: {
    date: {
      startDate: Date;
      endDate: Date;
    };
  };
} {
  return {
    filter: {
      date: {
        startDate: new Date(fromMs),
        endDate: new Date(toMs),
      },
    },
  };
}

async function queryNumericMetric(
  quantityIdentifier: QuantityTypeIdentifier,
  metric: Exclude<HealthMetric, "sleep_segment">,
  unit: string,
  fromMs: number,
  toMs: number,
  timezone: string,
): Promise<HealthIngestSample[]> {
  const samples = await queryQuantitySamples(quantityIdentifier, {
    limit: -1,
    ascending: true,
    unit,
    ...queryDateFilter(fromMs, toMs),
  });

  return normalizeQuantitySamples(metric, samples, timezone);
}

export function isHealthKitSupportedPlatform(): boolean {
  return Platform.OS === "ios";
}

export async function isHealthKitAvailable(): Promise<boolean> {
  if (!isHealthKitSupportedPlatform()) {
    return false;
  }

  try {
    return await isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

export async function requestHealthKitReadPermissions(): Promise<boolean> {
  if (!isHealthKitSupportedPlatform()) {
    return false;
  }

  return requestAuthorization({
    toRead: READ_IDENTIFIERS,
  });
}

export function deviceTimezone(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timezone === undefined || timezone.trim().length === 0) {
    return "UTC";
  }
  return timezone;
}

export async function fetchMetricSamples(
  metric: HealthMetric,
  fromMs: number,
  toMs: number,
  timezone: string,
): Promise<HealthIngestSample[]> {
  if (metric === "step_count") {
    return queryNumericMetric(STEP_COUNT_IDENTIFIER, metric, "count", fromMs, toMs, timezone);
  }

  if (metric === "active_energy_kcal") {
    return queryNumericMetric(ACTIVE_ENERGY_IDENTIFIER, metric, "kcal", fromMs, toMs, timezone);
  }

  if (metric === "resting_heart_rate_bpm") {
    return queryNumericMetric(RESTING_HEART_RATE_IDENTIFIER, metric, "count/min", fromMs, toMs, timezone);
  }

  if (metric === "hrv_sdnn_ms") {
    return queryNumericMetric(HRV_SDNN_IDENTIFIER, metric, "ms", fromMs, toMs, timezone);
  }

  if (metric === "body_mass_kg") {
    return queryNumericMetric(BODY_MASS_IDENTIFIER, metric, "kg", fromMs, toMs, timezone);
  }

  if (metric === "body_fat_percent") {
    return queryNumericMetric(BODY_FAT_IDENTIFIER, metric, "%", fromMs, toMs, timezone);
  }

  const samples = await queryCategorySamples(SLEEP_IDENTIFIER, {
    limit: -1,
    ascending: true,
    ...queryDateFilter(fromMs, toMs),
  });
  return normalizeSleepSamples(samples, timezone);
}
