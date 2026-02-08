import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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

export default defineSchema({
  healthRawSamples: defineTable({
    sampleKey: v.string(),
    deviceId: v.string(),
    metric: healthMetricValidator,
    startTimeMs: v.number(),
    endTimeMs: v.number(),
    valueNumber: v.optional(v.number()),
    categoryValue: v.optional(sleepCategoryValidator),
    unit: v.string(),
    sourceName: v.optional(v.string()),
    sourceBundleId: v.optional(v.string()),
    timezone: v.string(),
    dayKey: v.string(),
    ingestedAtMs: v.number(),
  })
    .index("by_sample_key", ["sampleKey"])
    .index("by_metric_and_start", ["metric", "startTimeMs"])
    .index("by_day_and_metric", ["dayKey", "metric"]),
  healthDailyMetrics: defineTable({
    dayKey: v.string(),
    timezone: v.string(),
    stepCountTotal: v.number(),
    stepCountSamples: v.number(),
    activeEnergyKcalTotal: v.number(),
    activeEnergyKcalSamples: v.number(),
    dietaryEnergyKcalTotal: v.number(),
    dietaryEnergyKcalSamples: v.number(),
    restingHeartRateAvg: v.number(),
    restingHeartRateMin: v.number(),
    restingHeartRateMax: v.number(),
    restingHeartRateSamples: v.number(),
    hrvSdnnAvg: v.number(),
    hrvSdnnMin: v.number(),
    hrvSdnnMax: v.number(),
    hrvSdnnSamples: v.number(),
    bodyMassKgAvg: v.number(),
    bodyMassKgMin: v.number(),
    bodyMassKgMax: v.number(),
    bodyMassKgSamples: v.number(),
    bodyFatPercentAvg: v.number(),
    bodyFatPercentMin: v.number(),
    bodyFatPercentMax: v.number(),
    bodyFatPercentSamples: v.number(),
    sleepSampleCount: v.number(),
    sleepInBedMs: v.number(),
    sleepAsleepMs: v.number(),
    sleepAwakeMs: v.number(),
    sleepAsleepRemMs: v.number(),
    sleepAsleepCoreMs: v.number(),
    sleepAsleepDeepMs: v.number(),
    sleepTotalAsleepMs: v.number(),
    recomputedAtMs: v.number(),
  }).index("by_day", ["dayKey"]),
  healthWriteIntents: defineTable({
    externalId: v.string(),
    metric: v.union(v.literal("active_energy_kcal"), v.literal("dietary_energy_kcal")),
    startTimeMs: v.number(),
    endTimeMs: v.number(),
    valueNumber: v.number(),
    unit: v.string(),
    timezone: v.string(),
    note: v.optional(v.string()),
    sourceName: v.optional(v.string()),
    sourceBundleId: v.optional(v.string()),
    tags: v.array(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("applied"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    attemptCount: v.number(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
    nextRetryAtMs: v.number(),
    lastAttemptAtMs: v.optional(v.number()),
    healthkitUuid: v.optional(v.string()),
    failureCode: v.optional(v.string()),
    failureMessage: v.optional(v.string()),
    appliedAtMs: v.optional(v.number()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_status_and_created", ["status", "createdAtMs"])
    .index("by_status_and_retry_time", ["status", "nextRetryAtMs"]),
});
