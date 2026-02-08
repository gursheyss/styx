import { v } from "convex/values";

import { internalQuery } from "./_generated/server";
import { assertValidDayKey } from "./healthDomain";
import { summarizeDay, summarizeRange, yesterdayDayKey } from "./healthSummary";
import type { HealthDailyMetricsRecord } from "./healthTypes";

function emptyDailyMetricsRecord(dayKey: string, timezone: string, nowMs: number): HealthDailyMetricsRecord {
  return {
    dayKey,
    timezone,
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
    sleepAsleepMs: 0,
    sleepAwakeMs: 0,
    sleepAsleepRemMs: 0,
    sleepAsleepCoreMs: 0,
    sleepAsleepDeepMs: 0,
    sleepTotalAsleepMs: 0,
    recomputedAtMs: nowMs,
  };
}

function nextDayKey(dayKey: string): string {
  const [yearRaw, monthRaw, dayRaw] = dayKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  const timestamp = Date.UTC(year, month - 1, day) + 24 * 60 * 60 * 1000;
  const nextDate = new Date(timestamp);

  const nextYear = String(nextDate.getUTCFullYear());
  const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(nextDate.getUTCDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function buildDayRange(from: string, to: string): string[] {
  const days: string[] = [];
  let current = from;
  while (current <= to) {
    days.push(current);
    current = nextDayKey(current);
  }
  return days;
}

function toMetricsRecord(
  row: {
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
  },
): HealthDailyMetricsRecord {
  return {
    dayKey: row.dayKey,
    timezone: row.timezone,
    stepCountTotal: row.stepCountTotal,
    stepCountSamples: row.stepCountSamples,
    activeEnergyKcalTotal: row.activeEnergyKcalTotal,
    activeEnergyKcalSamples: row.activeEnergyKcalSamples,
    dietaryEnergyKcalTotal: row.dietaryEnergyKcalTotal,
    dietaryEnergyKcalSamples: row.dietaryEnergyKcalSamples,
    restingHeartRateAvg: row.restingHeartRateAvg,
    restingHeartRateMin: row.restingHeartRateMin,
    restingHeartRateMax: row.restingHeartRateMax,
    restingHeartRateSamples: row.restingHeartRateSamples,
    hrvSdnnAvg: row.hrvSdnnAvg,
    hrvSdnnMin: row.hrvSdnnMin,
    hrvSdnnMax: row.hrvSdnnMax,
    hrvSdnnSamples: row.hrvSdnnSamples,
    bodyMassKgAvg: row.bodyMassKgAvg,
    bodyMassKgMin: row.bodyMassKgMin,
    bodyMassKgMax: row.bodyMassKgMax,
    bodyMassKgSamples: row.bodyMassKgSamples,
    bodyFatPercentAvg: row.bodyFatPercentAvg,
    bodyFatPercentMin: row.bodyFatPercentMin,
    bodyFatPercentMax: row.bodyFatPercentMax,
    bodyFatPercentSamples: row.bodyFatPercentSamples,
    sleepSampleCount: row.sleepSampleCount,
    sleepInBedMs: row.sleepInBedMs,
    sleepAsleepMs: row.sleepAsleepMs,
    sleepAwakeMs: row.sleepAwakeMs,
    sleepAsleepRemMs: row.sleepAsleepRemMs,
    sleepAsleepCoreMs: row.sleepAsleepCoreMs,
    sleepAsleepDeepMs: row.sleepAsleepDeepMs,
    sleepTotalAsleepMs: row.sleepTotalAsleepMs,
    recomputedAtMs: row.recomputedAtMs,
  };
}

function assertTimezone(timezone: string): void {
  if (timezone.trim().length === 0) {
    throw new Error("timezone is required");
  }
}

function assertRange(from: string, to: string): void {
  assertValidDayKey(from);
  assertValidDayKey(to);
  if (from > to) {
    throw new Error("from must be <= to");
  }
}

export const getDailySummary = internalQuery({
  args: {
    day: v.string(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    assertValidDayKey(args.day);
    assertTimezone(args.timezone);

    const row = await ctx.db
      .query("healthDailyMetrics")
      .withIndex("by_day", (q) => q.eq("dayKey", args.day))
      .first();

    const record =
      row === null
        ? emptyDailyMetricsRecord(args.day, args.timezone, Date.now())
        : toMetricsRecord(row);

    return summarizeDay(record);
  },
});

export const getRangeSummary = internalQuery({
  args: {
    from: v.string(),
    to: v.string(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    assertRange(args.from, args.to);
    assertTimezone(args.timezone);

    const rows = await ctx.db
      .query("healthDailyMetrics")
      .withIndex("by_day", (q) => q.gte("dayKey", args.from).lte("dayKey", args.to))
      .collect();

    const rowsByDay = new Map<string, HealthDailyMetricsRecord>();
    for (const row of rows) {
      const record = toMetricsRecord(row);
      rowsByDay.set(record.dayKey, record);
    }

    const nowMs = Date.now();
    const records = buildDayRange(args.from, args.to).map(
      (dayKey) => rowsByDay.get(dayKey) ?? emptyDailyMetricsRecord(dayKey, args.timezone, nowMs),
    );

    return summarizeRange(records, args.from, args.to, args.timezone);
  },
});

export const getYesterdaySummary = internalQuery({
  args: {
    timezone: v.string(),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertTimezone(args.timezone);

    const nowMs = args.nowMs ?? Date.now();
    const day = yesterdayDayKey(args.timezone, nowMs);

    const row = await ctx.db
      .query("healthDailyMetrics")
      .withIndex("by_day", (q) => q.eq("dayKey", day))
      .first();

    const record = row === null ? emptyDailyMetricsRecord(day, args.timezone, nowMs) : toMetricsRecord(row);

    return summarizeDay(record);
  },
});
