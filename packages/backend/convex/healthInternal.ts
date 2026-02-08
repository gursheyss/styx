import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  assertValidDayKey,
  buildDailyAggregateRecord,
  validateAndPrepareSample,
  type PreparedHealthSample,
} from "./healthDomain";
import {
  HEALTH_METRICS,
  MAX_INGEST_BATCH_SIZE,
  MAX_RAW_PAGE_SIZE,
  type HealthIngestResponse,
} from "./healthTypes";

const healthMetricValidator = v.union(
  v.literal("step_count"),
  v.literal("active_energy_kcal"),
  v.literal("dietary_energy_kcal"),
  v.literal("resting_heart_rate_bpm"),
  v.literal("hrv_sdnn_ms"),
  v.literal("body_mass_kg"),
  v.literal("body_fat_percent"),
  v.literal("sleep_segment"),
);

const sleepCategoryValidator = v.union(
  v.literal("inBed"),
  v.literal("asleep"),
  v.literal("awake"),
  v.literal("asleepREM"),
  v.literal("asleepCore"),
  v.literal("asleepDeep"),
);

const ingestSampleValidator = v.object({
  sampleKey: v.string(),
  metric: healthMetricValidator,
  startTimeMs: v.number(),
  endTimeMs: v.number(),
  valueNumber: v.optional(v.number()),
  categoryValue: v.optional(sleepCategoryValidator),
  unit: v.string(),
  sourceName: v.optional(v.string()),
  sourceBundleId: v.optional(v.string()),
  timezone: v.string(),
});

async function getDailyMetricIdByDayKey(
  db: MutationCtx["db"],
  dayKey: string,
): Promise<Id<"healthDailyMetrics"> | null> {
  const existing = await db
    .query("healthDailyMetrics")
    .withIndex("by_day", (q) => q.eq("dayKey", dayKey))
    .first();

  if (existing === null) {
    return null;
  }

  return existing._id;
}

async function collectPreparedSamplesForDay(
  db: MutationCtx["db"],
  dayKey: string,
): Promise<PreparedHealthSample[]> {
  const prepared: PreparedHealthSample[] = [];

  for (const metric of HEALTH_METRICS) {
    const rawSamples = await db
      .query("healthRawSamples")
      .withIndex("by_day_and_metric", (q) => q.eq("dayKey", dayKey).eq("metric", metric))
      .collect();

    for (const rawSample of rawSamples) {
      const preparedSample = validateAndPrepareSample({
        sampleKey: rawSample.sampleKey,
        metric: rawSample.metric,
        startTimeMs: rawSample.startTimeMs,
        endTimeMs: rawSample.endTimeMs,
        valueNumber: rawSample.valueNumber,
        categoryValue: rawSample.categoryValue,
        unit: rawSample.unit,
        sourceName: rawSample.sourceName,
        sourceBundleId: rawSample.sourceBundleId,
        timezone: rawSample.timezone,
      });
      prepared.push(preparedSample);
    }
  }

  return prepared;
}

function assertDayRange(from: string, to: string): void {
  assertValidDayKey(from);
  assertValidDayKey(to);
  if (from > to) {
    throw new Error("from must be <= to");
  }
}

export const upsertRawSamples = internalMutation({
  args: {
    deviceId: v.string(),
    samples: v.array(ingestSampleValidator),
  },
  handler: async (ctx, args): Promise<HealthIngestResponse> => {
    if (args.samples.length > MAX_INGEST_BATCH_SIZE) {
      throw new Error(`Batch exceeds maximum size of ${MAX_INGEST_BATCH_SIZE}`);
    }

    const serverTimeMs = Date.now();
    let inserted = 0;
    let deduped = 0;
    const affectedDays = new Set<string>();

    for (const sample of args.samples) {
      const preparedSample = validateAndPrepareSample(sample);
      const existing = await ctx.db
        .query("healthRawSamples")
        .withIndex("by_sample_key", (q) => q.eq("sampleKey", preparedSample.sampleKey))
        .first();

      if (existing !== null) {
        deduped += 1;
        continue;
      }

      await ctx.db.insert("healthRawSamples", {
        sampleKey: preparedSample.sampleKey,
        deviceId: args.deviceId,
        metric: preparedSample.metric,
        startTimeMs: preparedSample.startTimeMs,
        endTimeMs: preparedSample.endTimeMs,
        valueNumber: preparedSample.valueNumber,
        categoryValue: preparedSample.categoryValue,
        unit: preparedSample.unit,
        sourceName: preparedSample.sourceName,
        sourceBundleId: preparedSample.sourceBundleId,
        timezone: preparedSample.timezone,
        dayKey: preparedSample.dayKey,
        ingestedAtMs: serverTimeMs,
      });

      inserted += 1;
      affectedDays.add(preparedSample.dayKey);
    }

    const recomputedDays = Array.from(affectedDays).sort();

    for (const dayKey of recomputedDays) {
      const daySamples = await collectPreparedSamplesForDay(ctx.db, dayKey);
      if (daySamples.length === 0) {
        const existingId = await getDailyMetricIdByDayKey(ctx.db, dayKey);
        if (existingId !== null) {
          await ctx.db.delete(existingId);
        }
        continue;
      }

      const aggregate = buildDailyAggregateRecord(
        dayKey,
        daySamples[0].timezone,
        daySamples,
        serverTimeMs,
      );

      const existingId = await getDailyMetricIdByDayKey(ctx.db, dayKey);
      if (existingId === null) {
        await ctx.db.insert("healthDailyMetrics", aggregate);
      } else {
        await ctx.db.patch(existingId, aggregate);
      }
    }

    return {
      inserted,
      deduped,
      recomputedDays,
      serverTimeMs,
    };
  },
});

export const listDaily = internalQuery({
  args: {
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, args) => {
    assertDayRange(args.from, args.to);

    const rows = await ctx.db
      .query("healthDailyMetrics")
      .withIndex("by_day", (q) => q.gte("dayKey", args.from).lte("dayKey", args.to))
      .collect();

    return rows.map((row) => ({
      dayKey: row.dayKey,
      timezone: row.timezone,
      metrics: {
        step_count: {
          total: row.stepCountTotal,
          sampleCount: row.stepCountSamples,
          unit: "count",
        },
        active_energy_kcal: {
          total: row.activeEnergyKcalTotal,
          sampleCount: row.activeEnergyKcalSamples,
          unit: "kcal",
        },
        dietary_energy_kcal: {
          total: row.dietaryEnergyKcalTotal,
          sampleCount: row.dietaryEnergyKcalSamples,
          unit: "kcal",
        },
        resting_heart_rate_bpm: {
          average: row.restingHeartRateAvg,
          min: row.restingHeartRateMin,
          max: row.restingHeartRateMax,
          sampleCount: row.restingHeartRateSamples,
          unit: "count/min",
        },
        hrv_sdnn_ms: {
          average: row.hrvSdnnAvg,
          min: row.hrvSdnnMin,
          max: row.hrvSdnnMax,
          sampleCount: row.hrvSdnnSamples,
          unit: "ms",
        },
        body_mass_kg: {
          average: row.bodyMassKgAvg,
          min: row.bodyMassKgMin,
          max: row.bodyMassKgMax,
          sampleCount: row.bodyMassKgSamples,
          unit: "kg",
        },
        body_fat_percent: {
          average: row.bodyFatPercentAvg,
          min: row.bodyFatPercentMin,
          max: row.bodyFatPercentMax,
          sampleCount: row.bodyFatPercentSamples,
          unit: "%",
        },
        sleep_segment: {
          sampleCount: row.sleepSampleCount,
          inBedMs: row.sleepInBedMs,
          asleepMs: row.sleepAsleepMs,
          awakeMs: row.sleepAwakeMs,
          asleepRemMs: row.sleepAsleepRemMs,
          asleepCoreMs: row.sleepAsleepCoreMs,
          asleepDeepMs: row.sleepAsleepDeepMs,
          totalAsleepMs: row.sleepTotalAsleepMs,
          unit: "ms",
        },
      },
      recomputedAtMs: row.recomputedAtMs,
    }));
  },
});

export const listRaw = internalQuery({
  args: {
    metric: healthMetricValidator,
    fromMs: v.number(),
    toMs: v.number(),
    limit: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.fromMs) || !Number.isInteger(args.toMs)) {
      throw new Error("fromMs and toMs must be integer millisecond timestamps");
    }

    if (args.fromMs > args.toMs) {
      throw new Error("fromMs must be <= toMs");
    }

    if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > MAX_RAW_PAGE_SIZE) {
      throw new Error(`limit must be between 1 and ${MAX_RAW_PAGE_SIZE}`);
    }

    const page = await ctx.db
      .query("healthRawSamples")
      .withIndex("by_metric_and_start", (q) =>
        q.eq("metric", args.metric).gte("startTimeMs", args.fromMs).lte("startTimeMs", args.toMs),
      )
      .paginate({
        numItems: args.limit,
        cursor: args.cursor ?? null,
      });

    const items = page.page.map((row) => ({
      sampleKey: row.sampleKey,
      metric: row.metric,
      startTimeMs: row.startTimeMs,
      endTimeMs: row.endTimeMs,
      valueNumber: row.valueNumber,
      categoryValue: row.categoryValue,
      unit: row.unit,
      sourceName: row.sourceName,
      sourceBundleId: row.sourceBundleId,
      timezone: row.timezone,
      dayKey: row.dayKey,
      ingestedAtMs: row.ingestedAtMs,
      deviceId: row.deviceId,
    }));

    return {
      items,
      nextCursor: page.isDone ? null : page.continueCursor,
    };
  },
});
