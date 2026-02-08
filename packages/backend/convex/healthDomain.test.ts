import { describe, expect, test } from "bun:test";

import {
  assertValidSampleKey,
  buildDailyAggregateRecord,
  dayKeyFromTimestamp,
  validateAndPrepareSample,
  type PreparedHealthSample,
} from "./healthDomain";

function preparedSample(overrides: Partial<PreparedHealthSample>): PreparedHealthSample {
  return {
    sampleKey: "sample-1",
    metric: "step_count",
    startTimeMs: Date.UTC(2025, 0, 1, 10, 0, 0),
    endTimeMs: Date.UTC(2025, 0, 1, 10, 10, 0),
    valueNumber: 100,
    unit: "count",
    timezone: "America/Los_Angeles",
    dayKey: "2025-01-01",
    ...overrides,
  };
}

describe("dayKeyFromTimestamp", () => {
  test("uses provided timezone boundary", () => {
    const ts = Date.UTC(2024, 0, 1, 7, 59, 59);
    const dayKey = dayKeyFromTimestamp(ts, "America/Los_Angeles");
    expect(dayKey).toBe("2023-12-31");
  });
});

describe("sample key validation", () => {
  test("accepts expected sample key format", () => {
    expect(() => assertValidSampleKey("step|abc-123:ios.source")).not.toThrow();
  });

  test("rejects invalid sample key", () => {
    expect(() => assertValidSampleKey("invalid key with spaces")).toThrow();
  });
});

describe("validateAndPrepareSample", () => {
  test("requires numeric value for numeric metrics", () => {
    expect(() =>
      validateAndPrepareSample({
        sampleKey: "bad-1",
        metric: "step_count",
        startTimeMs: Date.now(),
        endTimeMs: Date.now(),
        unit: "count",
        timezone: "UTC",
      }),
    ).toThrow();
  });

  test("requires category value for sleep", () => {
    expect(() =>
      validateAndPrepareSample({
        sampleKey: "bad-2",
        metric: "sleep_segment",
        startTimeMs: Date.now(),
        endTimeMs: Date.now() + 60000,
        unit: "ms",
        timezone: "UTC",
      }),
    ).toThrow();
  });
});

describe("buildDailyAggregateRecord", () => {
  test("aggregates numeric totals and averages", () => {
    const daySamples: PreparedHealthSample[] = [
      preparedSample({ metric: "step_count", valueNumber: 120 }),
      preparedSample({ metric: "step_count", valueNumber: 80 }),
      preparedSample({ metric: "active_energy_kcal", valueNumber: 50, unit: "kcal" }),
      preparedSample({ metric: "resting_heart_rate_bpm", valueNumber: 55, unit: "count/min" }),
      preparedSample({ metric: "resting_heart_rate_bpm", valueNumber: 65, unit: "count/min" }),
    ];

    const aggregate = buildDailyAggregateRecord(
      "2025-01-01",
      "America/Los_Angeles",
      daySamples,
      1735689600000,
    );

    expect(aggregate.stepCountTotal).toBe(200);
    expect(aggregate.stepCountSamples).toBe(2);
    expect(aggregate.activeEnergyKcalTotal).toBe(50);
    expect(aggregate.restingHeartRateAvg).toBe(60);
    expect(aggregate.restingHeartRateMin).toBe(55);
    expect(aggregate.restingHeartRateMax).toBe(65);
  });

  test("rolls up sleep stages", () => {
    const start = Date.UTC(2025, 0, 1, 0, 0, 0);
    const samples: PreparedHealthSample[] = [
      preparedSample({
        metric: "sleep_segment",
        categoryValue: "inBed",
        startTimeMs: start,
        endTimeMs: start + 30 * 60 * 1000,
        unit: "ms",
        valueNumber: undefined,
      }),
      preparedSample({
        metric: "sleep_segment",
        categoryValue: "asleepCore",
        startTimeMs: start + 30 * 60 * 1000,
        endTimeMs: start + 90 * 60 * 1000,
        unit: "ms",
        valueNumber: undefined,
      }),
      preparedSample({
        metric: "sleep_segment",
        categoryValue: "asleepREM",
        startTimeMs: start + 90 * 60 * 1000,
        endTimeMs: start + 120 * 60 * 1000,
        unit: "ms",
        valueNumber: undefined,
      }),
      preparedSample({
        metric: "sleep_segment",
        categoryValue: "awake",
        startTimeMs: start + 120 * 60 * 1000,
        endTimeMs: start + 130 * 60 * 1000,
        unit: "ms",
        valueNumber: undefined,
      }),
    ];

    const aggregate = buildDailyAggregateRecord("2025-01-01", "UTC", samples, 1735689600000);

    expect(aggregate.sleepInBedMs).toBe(30 * 60 * 1000);
    expect(aggregate.sleepAsleepCoreMs).toBe(60 * 60 * 1000);
    expect(aggregate.sleepAsleepRemMs).toBe(30 * 60 * 1000);
    expect(aggregate.sleepAwakeMs).toBe(10 * 60 * 1000);
    expect(aggregate.sleepTotalAsleepMs).toBe(90 * 60 * 1000);
    expect(aggregate.sleepSampleCount).toBe(4);
  });
});
