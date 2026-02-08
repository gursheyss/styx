import * as SecureStore from "expo-secure-store";

import { ingestHealth } from "./api";
import {
  deviceTimezone,
  fetchMetricSamples,
  isHealthKitAvailable,
  isHealthKitSupportedPlatform,
  requestHealthKitReadPermissions,
} from "./healthkit-client";
import { buildCursorWindow, retryWithBackoff } from "./sync-logic";
import {
  HEALTH_METRICS,
  HEALTH_SYNC_BATCH_SIZE,
  type HealthIngestSample,
  type HealthMetric,
  type HealthSyncMetricStats,
  type HealthSyncSummary,
} from "./types";
import { runHealthWriteBack } from "./writeback";

const CURSOR_KEY_PREFIX = "health-sync-cursor:";
const LAST_SYNC_SUMMARY_KEY = "health-last-sync-summary";
const DEVICE_ID_KEY = "health-device-id";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cursorKey(metric: HealthMetric): string {
  return `${CURSOR_KEY_PREFIX}${metric}`;
}

function parseNumberOrNull(rawValue: string | null): number | null {
  if (rawValue === null) {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function isHealthMetricValue(value: unknown): value is HealthMetric {
  if (typeof value !== "string") {
    return false;
  }
  for (const metric of HEALTH_METRICS) {
    if (metric === value) {
      return true;
    }
  }
  return false;
}

function chunkSamples(samples: readonly HealthIngestSample[], batchSize: number): HealthIngestSample[][] {
  const batches: HealthIngestSample[][] = [];
  let index = 0;

  while (index < samples.length) {
    batches.push(samples.slice(index, index + batchSize));
    index += batchSize;
  }

  return batches;
}

async function readCursor(metric: HealthMetric): Promise<number> {
  const stored = await SecureStore.getItemAsync(cursorKey(metric));
  const parsed = parseNumberOrNull(stored);
  if (parsed === null) {
    return 0;
  }
  return parsed;
}

async function writeCursor(metric: HealthMetric, endTimeMs: number): Promise<void> {
  await SecureStore.setItemAsync(cursorKey(metric), String(endTimeMs));
}

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing !== null && existing.trim().length > 0) {
    return existing;
  }

  const generated = `ios-device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}

function toMetricStatsBase(metric: HealthMetric, cursorStartMs: number, cursorEndMs: number): HealthSyncMetricStats {
  return {
    metric,
    fetched: 0,
    uploaded: 0,
    inserted: 0,
    deduped: 0,
    cursorStartMs,
    cursorEndMs,
  };
}

function parseSummary(rawValue: string | null): HealthSyncSummary | null {
  if (rawValue === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!isRecord(parsed)) {
      return null;
    }

    const startedAtMs = toFiniteNumber(parsed.startedAtMs);
    const completedAtMs = toFiniteNumber(parsed.completedAtMs);
    const inserted = toFiniteNumber(parsed.inserted);
    const deduped = toFiniteNumber(parsed.deduped);
    const recomputedDays = parsed.recomputedDays;
    const metrics = parsed.metrics;
    const writeBack = parsed.writeBack;

    if (
      startedAtMs === null ||
      completedAtMs === null ||
      inserted === null ||
      deduped === null ||
      !Array.isArray(recomputedDays) ||
      !Array.isArray(metrics)
    ) {
      return null;
    }

    let writeBackSummary: HealthSyncSummary["writeBack"] = {
      totalPulled: 0,
      applied: 0,
      failed: 0,
      skipped: 0,
    };
    if (isRecord(writeBack)) {
      const totalPulled = toFiniteNumber(writeBack.totalPulled);
      const applied = toFiniteNumber(writeBack.applied);
      const failed = toFiniteNumber(writeBack.failed);
      const skipped = toFiniteNumber(writeBack.skipped);

      if (
        totalPulled !== null &&
        applied !== null &&
        failed !== null &&
        skipped !== null
      ) {
        writeBackSummary = {
          totalPulled,
          applied,
          failed,
          skipped,
        };
      }
    }

    const parsedMetrics: HealthSyncMetricStats[] = [];
    for (const metric of metrics) {
      if (!isRecord(metric)) {
        continue;
      }

      if (!isHealthMetricValue(metric.metric)) {
        continue;
      }

      const fetched = toFiniteNumber(metric.fetched);
      const uploaded = toFiniteNumber(metric.uploaded);
      const metricInserted = toFiniteNumber(metric.inserted);
      const metricDeduped = toFiniteNumber(metric.deduped);
      const cursorStartMs = toFiniteNumber(metric.cursorStartMs);
      const cursorEndMs = toFiniteNumber(metric.cursorEndMs);

      if (
        fetched === null ||
        uploaded === null ||
        metricInserted === null ||
        metricDeduped === null ||
        cursorStartMs === null ||
        cursorEndMs === null
      ) {
        continue;
      }

      parsedMetrics.push({
        metric: metric.metric,
        fetched,
        uploaded,
        inserted: metricInserted,
        deduped: metricDeduped,
        cursorStartMs,
        cursorEndMs,
      });
    }

    return {
      startedAtMs,
      completedAtMs,
      inserted,
      deduped,
      recomputedDays: recomputedDays.filter((day): day is string => typeof day === "string"),
      metrics: parsedMetrics,
      writeBack: writeBackSummary,
    };
  } catch {
    return null;
  }
}

export async function getLastSyncSummary(): Promise<HealthSyncSummary | null> {
  return parseSummary(await SecureStore.getItemAsync(LAST_SYNC_SUMMARY_KEY));
}

async function saveLastSyncSummary(summary: HealthSyncSummary): Promise<void> {
  await SecureStore.setItemAsync(LAST_SYNC_SUMMARY_KEY, JSON.stringify(summary));
}

export type HealthSyncRunResult = {
  supported: boolean;
  authorized: boolean;
  summary?: HealthSyncSummary;
  error?: string;
};

export async function runHealthSync(): Promise<HealthSyncRunResult> {
  if (!isHealthKitSupportedPlatform()) {
    return {
      supported: false,
      authorized: false,
      error: "HealthKit sync is only available on iOS",
    };
  }

  const available = await isHealthKitAvailable();
  if (!available) {
    return {
      supported: true,
      authorized: false,
      error: "Health data is not available on this device",
    };
  }

  const authorized = await requestHealthKitReadPermissions();
  if (!authorized) {
    return {
      supported: true,
      authorized: false,
      error: "Health permissions were not granted",
    };
  }

  const deviceId = await getOrCreateDeviceId();
  const timezone = deviceTimezone();
  const startedAtMs = Date.now();

  const metrics: HealthSyncMetricStats[] = [];
  let totalInserted = 0;
  let totalDeduped = 0;
  const recomputedDays = new Set<string>();

  for (const metric of HEALTH_METRICS) {
    const previousCursor = await readCursor(metric);
    const window = buildCursorWindow(previousCursor, Date.now());
    const metricStats = toMetricStatsBase(metric, previousCursor, window.toMs);

    const samples = await fetchMetricSamples(metric, window.fromMs, window.toMs, timezone);
    metricStats.fetched = samples.length;

    const batches = chunkSamples(samples, HEALTH_SYNC_BATCH_SIZE);
    for (const batch of batches) {
      const response = await retryWithBackoff(
        () =>
          ingestHealth({
            deviceId,
            samples: batch,
          }),
        3,
      );

      metricStats.uploaded += batch.length;
      metricStats.inserted += response.inserted;
      metricStats.deduped += response.deduped;
      totalInserted += response.inserted;
      totalDeduped += response.deduped;

      for (const day of response.recomputedDays) {
        recomputedDays.add(day);
      }
    }

    await writeCursor(metric, window.toMs);
    metrics.push(metricStats);
  }

  let writeBack: HealthSyncSummary["writeBack"] = {
    totalPulled: 0,
    applied: 0,
    failed: 0,
    skipped: 0,
  };
  try {
    writeBack = await runHealthWriteBack();
  } catch {
    // Read sync succeeded; keep write-back best effort.
  }

  const summary: HealthSyncSummary = {
    startedAtMs,
    completedAtMs: Date.now(),
    inserted: totalInserted,
    deduped: totalDeduped,
    recomputedDays: Array.from(recomputedDays).sort(),
    metrics,
    writeBack,
  };

  await saveLastSyncSummary(summary);

  return {
    supported: true,
    authorized: true,
    summary,
  };
}
