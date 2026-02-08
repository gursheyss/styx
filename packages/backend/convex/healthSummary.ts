import { dayKeyFromTimestamp } from "./healthDomain";
import type { HealthDailyMetricsRecord, HealthDailySummary, HealthSummaryRange } from "./healthTypes";

function roundTo(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function hoursFromMs(milliseconds: number): number {
  return roundTo(milliseconds / (60 * 60 * 1000), 2);
}

function sleepBand(asleepHours: number): "short" | "target" | "extended" {
  if (asleepHours < 7) {
    return "short";
  }
  if (asleepHours > 9) {
    return "extended";
  }
  return "target";
}

function activityBand(activeCaloriesKcal: number): "low" | "moderate" | "high" {
  if (activeCaloriesKcal < 300) {
    return "low";
  }
  if (activeCaloriesKcal > 800) {
    return "high";
  }
  return "moderate";
}

export function summarizeDay(record: HealthDailyMetricsRecord): HealthDailySummary {
  const inBedHours = hoursFromMs(record.sleepInBedMs);
  const asleepHours = hoursFromMs(record.sleepTotalAsleepMs);
  const awakeHours = hoursFromMs(record.sleepAwakeMs);
  const remHours = hoursFromMs(record.sleepAsleepRemMs);
  const coreHours = hoursFromMs(record.sleepAsleepCoreMs);
  const deepHours = hoursFromMs(record.sleepAsleepDeepMs);

  const sleepEfficiency =
    record.sleepInBedMs > 0 ? roundTo(record.sleepTotalAsleepMs / record.sleepInBedMs, 3) : 0;

  const calorieBalanceKcal = roundTo(record.dietaryEnergyKcalTotal - record.activeEnergyKcalTotal, 2);
  const derivedSleepBand = sleepBand(asleepHours);
  const derivedActivityBand = activityBand(record.activeEnergyKcalTotal);

  const insights: HealthDailySummary["insights"] = [];
  const hasAnyData =
    record.stepCountSamples > 0 ||
    record.activeEnergyKcalSamples > 0 ||
    record.dietaryEnergyKcalSamples > 0 ||
    record.sleepSampleCount > 0 ||
    record.restingHeartRateSamples > 0 ||
    record.hrvSdnnSamples > 0 ||
    record.bodyMassKgSamples > 0 ||
    record.bodyFatPercentSamples > 0;

  if (derivedSleepBand === "short") {
    insights.push({
      code: "sleep_below_target",
      severity: "watch",
      message: "Sleep was below 7 hours. Consider prioritizing recovery today.",
    });
  }

  if (derivedSleepBand === "target") {
    insights.push({
      code: "sleep_on_target",
      severity: "good",
      message: "Sleep duration was within the target range.",
    });
  }

  if (derivedActivityBand === "high") {
    insights.push({
      code: "high_activity",
      severity: "good",
      message: "Active calorie burn was high.",
    });
  }

  if (derivedActivityBand === "low") {
    insights.push({
      code: "low_activity",
      severity: "info",
      message: "Active calorie burn was low.",
    });
  }

  if (record.restingHeartRateSamples > 0 && record.restingHeartRateAvg > 70) {
    insights.push({
      code: "elevated_resting_hr",
      severity: "watch",
      message: "Average resting heart rate was elevated.",
    });
  }

  if (record.hrvSdnnSamples > 0 && record.hrvSdnnAvg >= 40) {
    insights.push({
      code: "healthy_hrv",
      severity: "good",
      message: "HRV was in a strong range.",
    });
  }

  if (!hasAnyData) {
    insights.push({
      code: "no_data",
      severity: "info",
      message: "No health data was available for this day.",
    });
  }

  return {
    dayKey: record.dayKey,
    timezone: record.timezone,
    metrics: {
      sleep: {
        sampleCount: record.sleepSampleCount,
        inBedHours,
        asleepHours,
        awakeHours,
        remHours,
        coreHours,
        deepHours,
        sleepEfficiency,
      },
      activity: {
        stepCount: roundTo(record.stepCountTotal, 2),
        activeCaloriesKcal: roundTo(record.activeEnergyKcalTotal, 2),
        dietaryCaloriesKcal: roundTo(record.dietaryEnergyKcalTotal, 2),
      },
      recovery: {
        restingHeartRateBpm: {
          average: roundTo(record.restingHeartRateAvg, 2),
          min: roundTo(record.restingHeartRateMin, 2),
          max: roundTo(record.restingHeartRateMax, 2),
          sampleCount: record.restingHeartRateSamples,
        },
        hrvSdnnMs: {
          average: roundTo(record.hrvSdnnAvg, 2),
          min: roundTo(record.hrvSdnnMin, 2),
          max: roundTo(record.hrvSdnnMax, 2),
          sampleCount: record.hrvSdnnSamples,
        },
      },
      body: {
        bodyMassKg: {
          average: roundTo(record.bodyMassKgAvg, 2),
          min: roundTo(record.bodyMassKgMin, 2),
          max: roundTo(record.bodyMassKgMax, 2),
          sampleCount: record.bodyMassKgSamples,
        },
        bodyFatPercent: {
          average: roundTo(record.bodyFatPercentAvg, 2),
          min: roundTo(record.bodyFatPercentMin, 2),
          max: roundTo(record.bodyFatPercentMax, 2),
          sampleCount: record.bodyFatPercentSamples,
        },
      },
    },
    derived: {
      calorieBalanceKcal,
      activeCaloriesBand: derivedActivityBand,
      sleepBand: derivedSleepBand,
    },
    insights,
    recomputedAtMs: record.recomputedAtMs,
  };
}

export function summarizeRange(
  records: HealthDailyMetricsRecord[],
  from: string,
  to: string,
  timezone: string,
): HealthSummaryRange {
  const days = records.map((record) => summarizeDay(record));

  let totalSteps = 0;
  let totalActiveCaloriesKcal = 0;
  let totalDietaryCaloriesKcal = 0;
  let totalSleepHours = 0;
  let totalSleepEfficiency = 0;

  for (const day of days) {
    totalSteps += day.metrics.activity.stepCount;
    totalActiveCaloriesKcal += day.metrics.activity.activeCaloriesKcal;
    totalDietaryCaloriesKcal += day.metrics.activity.dietaryCaloriesKcal;
    totalSleepHours += day.metrics.sleep.asleepHours;
    totalSleepEfficiency += day.metrics.sleep.sleepEfficiency;
  }

  const dayCount = days.length;

  return {
    from,
    to,
    timezone,
    days,
    totals: {
      days: dayCount,
      totalSteps: roundTo(totalSteps, 2),
      totalActiveCaloriesKcal: roundTo(totalActiveCaloriesKcal, 2),
      totalDietaryCaloriesKcal: roundTo(totalDietaryCaloriesKcal, 2),
      averageSleepHours: dayCount > 0 ? roundTo(totalSleepHours / dayCount, 2) : 0,
      averageSleepEfficiency: dayCount > 0 ? roundTo(totalSleepEfficiency / dayCount, 3) : 0,
    },
  };
}

function subtractOneDayFromDayKey(dayKey: string): string {
  const [yearRaw, monthRaw, dayRaw] = dayKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  const timestamp = Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000;
  const date = new Date(timestamp);
  const resultYear = String(date.getUTCFullYear());
  const resultMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const resultDay = String(date.getUTCDate()).padStart(2, "0");

  return `${resultYear}-${resultMonth}-${resultDay}`;
}

export function yesterdayDayKey(timezone: string, nowMs: number): string {
  const currentDayKey = dayKeyFromTimestamp(nowMs, timezone);
  return subtractOneDayFromDayKey(currentDayKey);
}
