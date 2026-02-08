import { describe, expect, test } from "bun:test";

import { summarizeDay, summarizeRange, yesterdayDayKey } from "./healthSummary";
import type { HealthDailyMetricsRecord } from "./healthTypes";

function record(overrides: Partial<HealthDailyMetricsRecord>): HealthDailyMetricsRecord {
  return {
    dayKey: "2025-01-01",
    timezone: "America/Los_Angeles",
    stepCountTotal: 8_500,
    stepCountSamples: 12,
    activeEnergyKcalTotal: 550,
    activeEnergyKcalSamples: 6,
    dietaryEnergyKcalTotal: 2_100,
    dietaryEnergyKcalSamples: 4,
    restingHeartRateAvg: 58,
    restingHeartRateMin: 55,
    restingHeartRateMax: 63,
    restingHeartRateSamples: 3,
    hrvSdnnAvg: 45,
    hrvSdnnMin: 41,
    hrvSdnnMax: 50,
    hrvSdnnSamples: 3,
    bodyMassKgAvg: 80,
    bodyMassKgMin: 79.8,
    bodyMassKgMax: 80.2,
    bodyMassKgSamples: 2,
    bodyFatPercentAvg: 16.5,
    bodyFatPercentMin: 16.2,
    bodyFatPercentMax: 16.8,
    bodyFatPercentSamples: 2,
    sleepSampleCount: 5,
    sleepInBedMs: 8 * 60 * 60 * 1000,
    sleepAsleepMs: 0,
    sleepAwakeMs: 20 * 60 * 1000,
    sleepAsleepRemMs: 90 * 60 * 1000,
    sleepAsleepCoreMs: 5 * 60 * 60 * 1000,
    sleepAsleepDeepMs: 90 * 60 * 1000,
    sleepTotalAsleepMs: 8 * 60 * 60 * 1000,
    recomputedAtMs: 1_735_689_600_000,
    ...overrides,
  };
}

describe("summarizeDay", () => {
  test("returns deterministic day summary with dietary calorie balance", () => {
    const summary = summarizeDay(record({}));

    expect(summary.dayKey).toBe("2025-01-01");
    expect(summary.metrics.activity.stepCount).toBe(8_500);
    expect(summary.metrics.activity.activeCaloriesKcal).toBe(550);
    expect(summary.metrics.activity.dietaryCaloriesKcal).toBe(2_100);
    expect(summary.derived.calorieBalanceKcal).toBe(1_550);
    expect(summary.derived.sleepBand).toBe("target");
    expect(summary.derived.activeCaloriesBand).toBe("moderate");
  });

  test("returns no_data insight when all metrics are empty", () => {
    const summary = summarizeDay(
      record({
        stepCountTotal: 0,
        stepCountSamples: 0,
        activeEnergyKcalTotal: 0,
        activeEnergyKcalSamples: 0,
        dietaryEnergyKcalTotal: 0,
        dietaryEnergyKcalSamples: 0,
        restingHeartRateAvg: 0,
        restingHeartRateMin: 0,
        restingHeartRateMax: 0,
        restingHeartRateSamples: 0,
        hrvSdnnAvg: 0,
        hrvSdnnMin: 0,
        hrvSdnnMax: 0,
        hrvSdnnSamples: 0,
        bodyMassKgAvg: 0,
        bodyMassKgMin: 0,
        bodyMassKgMax: 0,
        bodyMassKgSamples: 0,
        bodyFatPercentAvg: 0,
        bodyFatPercentMin: 0,
        bodyFatPercentMax: 0,
        bodyFatPercentSamples: 0,
        sleepSampleCount: 0,
        sleepInBedMs: 0,
        sleepAwakeMs: 0,
        sleepAsleepRemMs: 0,
        sleepAsleepCoreMs: 0,
        sleepAsleepDeepMs: 0,
        sleepTotalAsleepMs: 0,
      }),
    );

    expect(summary.insights.some((insight) => insight.code === "no_data")).toBe(true);
  });
});

describe("summarizeRange", () => {
  test("aggregates totals and averages across days", () => {
    const result = summarizeRange(
      [
        record({ dayKey: "2025-01-01", stepCountTotal: 8_000, sleepTotalAsleepMs: 7 * 60 * 60 * 1000 }),
        record({ dayKey: "2025-01-02", stepCountTotal: 10_000, sleepTotalAsleepMs: 9 * 60 * 60 * 1000 }),
      ],
      "2025-01-01",
      "2025-01-02",
      "America/Los_Angeles",
    );

    expect(result.totals.days).toBe(2);
    expect(result.totals.totalSteps).toBe(18_000);
    expect(result.totals.totalActiveCaloriesKcal).toBe(1_100);
    expect(result.totals.totalDietaryCaloriesKcal).toBe(4_200);
    expect(result.totals.averageSleepHours).toBe(8);
  });
});

describe("yesterdayDayKey", () => {
  test("uses timezone day boundary then subtracts one day", () => {
    const nowMs = Date.UTC(2025, 0, 2, 5, 30, 0);
    expect(yesterdayDayKey("America/Los_Angeles", nowMs)).toBe("2024-12-31");
  });
});
