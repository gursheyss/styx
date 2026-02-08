import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  MAX_WRITE_INTENT_PAGE_SIZE,
  type HealthWriteIntent,
  type HealthWriteIntentAckStatus,
  type HealthWriteIntentPayload,
} from "./healthTypes";

const writeMetricValidator = v.union(
  v.literal("active_energy_kcal"),
  v.literal("dietary_energy_kcal"),
);

const writeIntentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("applied"),
  v.literal("failed"),
  v.literal("skipped"),
);

const writeIntentPayloadValidator = v.object({
  externalId: v.string(),
  metric: writeMetricValidator,
  startTimeMs: v.number(),
  endTimeMs: v.number(),
  valueNumber: v.number(),
  unit: v.string(),
  timezone: v.string(),
  note: v.optional(v.string()),
  sourceName: v.optional(v.string()),
  sourceBundleId: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
});

function assertPayload(payload: HealthWriteIntentPayload): void {
  if (payload.externalId.trim().length === 0) {
    throw new Error("externalId is required");
  }

  if (!Number.isInteger(payload.startTimeMs) || !Number.isInteger(payload.endTimeMs)) {
    throw new Error("startTimeMs and endTimeMs must be integer timestamps");
  }

  if (payload.endTimeMs < payload.startTimeMs) {
    throw new Error("endTimeMs must be >= startTimeMs");
  }

  if (!Number.isFinite(payload.valueNumber)) {
    throw new Error("valueNumber must be a finite number");
  }

  if (payload.unit.trim().length === 0) {
    throw new Error("unit is required");
  }

  if (payload.timezone.trim().length === 0) {
    throw new Error("timezone is required");
  }
}

function backoffMs(attemptCount: number): number {
  const base = 5 * 60 * 1000;
  const multiplier = 2 ** Math.min(attemptCount, 6);
  return Math.min(24 * 60 * 60 * 1000, base * multiplier);
}

function toIntent(
  row: {
    _id: Id<"healthWriteIntents">;
    externalId: string;
    metric: "active_energy_kcal" | "dietary_energy_kcal";
    startTimeMs: number;
    endTimeMs: number;
    valueNumber: number;
    unit: string;
    timezone: string;
    note?: string;
    sourceName?: string;
    sourceBundleId?: string;
    tags: string[];
    status: "pending" | "applied" | "failed" | "skipped";
    attemptCount: number;
    createdAtMs: number;
    updatedAtMs: number;
    nextRetryAtMs: number;
    lastAttemptAtMs?: number;
    healthkitUuid?: string;
    failureCode?: string;
    failureMessage?: string;
    appliedAtMs?: number;
  },
): HealthWriteIntent {
  return {
    intentId: row._id,
    externalId: row.externalId,
    metric: row.metric,
    startTimeMs: row.startTimeMs,
    endTimeMs: row.endTimeMs,
    valueNumber: row.valueNumber,
    unit: row.unit,
    timezone: row.timezone,
    note: row.note,
    sourceName: row.sourceName,
    sourceBundleId: row.sourceBundleId,
    tags: row.tags,
    status: row.status,
    attemptCount: row.attemptCount,
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
    nextRetryAtMs: row.nextRetryAtMs,
    lastAttemptAtMs: row.lastAttemptAtMs,
    healthkitUuid: row.healthkitUuid,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    appliedAtMs: row.appliedAtMs,
  };
}

export const upsertWriteIntent = internalMutation({
  args: {
    intent: writeIntentPayloadValidator,
  },
  handler: async (ctx, args) => {
    const payload: HealthWriteIntentPayload = {
      externalId: args.intent.externalId,
      metric: args.intent.metric,
      startTimeMs: args.intent.startTimeMs,
      endTimeMs: args.intent.endTimeMs,
      valueNumber: args.intent.valueNumber,
      unit: args.intent.unit,
      timezone: args.intent.timezone,
      note: args.intent.note,
      sourceName: args.intent.sourceName,
      sourceBundleId: args.intent.sourceBundleId,
      tags: args.intent.tags ?? [],
    };
    const tags = payload.tags ?? [];

    assertPayload(payload);

    const nowMs = Date.now();

    const existing = await ctx.db
      .query("healthWriteIntents")
      .withIndex("by_external_id", (q) => q.eq("externalId", payload.externalId))
      .first();

    if (existing === null) {
      const id = await ctx.db.insert("healthWriteIntents", {
        externalId: payload.externalId,
        metric: payload.metric,
        startTimeMs: payload.startTimeMs,
        endTimeMs: payload.endTimeMs,
        valueNumber: payload.valueNumber,
        unit: payload.unit,
        timezone: payload.timezone,
        note: payload.note,
        sourceName: payload.sourceName,
        sourceBundleId: payload.sourceBundleId,
        tags,
        status: "pending",
        attemptCount: 0,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
        nextRetryAtMs: nowMs,
      });

      const inserted = await ctx.db.get(id);
      if (inserted === null) {
        throw new Error("Failed to load inserted write intent");
      }

      return {
        created: true,
        intent: toIntent(inserted),
      };
    }

    await ctx.db.patch(existing._id, {
      metric: payload.metric,
      startTimeMs: payload.startTimeMs,
      endTimeMs: payload.endTimeMs,
      valueNumber: payload.valueNumber,
      unit: payload.unit,
      timezone: payload.timezone,
      note: payload.note,
      sourceName: payload.sourceName,
      sourceBundleId: payload.sourceBundleId,
      tags,
      status: "pending",
      attemptCount: 0,
      updatedAtMs: nowMs,
      nextRetryAtMs: nowMs,
      lastAttemptAtMs: undefined,
      healthkitUuid: undefined,
      failureCode: undefined,
      failureMessage: undefined,
      appliedAtMs: undefined,
    });

    const updated = await ctx.db.get(existing._id);
    if (updated === null) {
      throw new Error("Failed to load updated write intent");
    }

    return {
      created: false,
      intent: toIntent(updated),
    };
  },
});

export const listPendingWriteIntents = internalQuery({
  args: {
    limit: v.number(),
    cursor: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > MAX_WRITE_INTENT_PAGE_SIZE) {
      throw new Error(`limit must be between 1 and ${MAX_WRITE_INTENT_PAGE_SIZE}`);
    }

    const nowMs = args.nowMs ?? Date.now();

    const page = await ctx.db
      .query("healthWriteIntents")
      .withIndex("by_status_and_retry_time", (q) => q.eq("status", "pending").lte("nextRetryAtMs", nowMs))
      .paginate({
        numItems: args.limit,
        cursor: args.cursor ?? null,
      });

    return {
      items: page.page.map((item) => toIntent(item)),
      nextCursor: page.isDone ? null : page.continueCursor,
    };
  },
});

export const ackWriteIntent = internalMutation({
  args: {
    externalId: v.string(),
    status: v.union(v.literal("applied"), v.literal("failed"), v.literal("skipped")),
    appliedAtMs: v.optional(v.number()),
    healthkitUuid: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const intent = await ctx.db
      .query("healthWriteIntents")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
      .first();
    if (intent === null) {
      throw new Error("Intent not found");
    }

    const nowMs = Date.now();
    const status: HealthWriteIntentAckStatus = args.status;

    if (status === "applied") {
      await ctx.db.patch(intent._id, {
        status: "applied",
        updatedAtMs: nowMs,
        appliedAtMs: args.appliedAtMs ?? nowMs,
        healthkitUuid: args.healthkitUuid,
        failureCode: undefined,
        failureMessage: undefined,
        lastAttemptAtMs: nowMs,
      });
    } else if (status === "skipped") {
      await ctx.db.patch(intent._id, {
        status: "skipped",
        updatedAtMs: nowMs,
        lastAttemptAtMs: nowMs,
        failureCode: undefined,
        failureMessage: undefined,
      });
    } else {
      const nextAttemptCount = intent.attemptCount + 1;
      await ctx.db.patch(intent._id, {
        status: "pending",
        attemptCount: nextAttemptCount,
        updatedAtMs: nowMs,
        lastAttemptAtMs: nowMs,
        nextRetryAtMs: nowMs + backoffMs(nextAttemptCount),
        failureCode: args.errorCode,
        failureMessage: args.errorMessage,
      });
    }

    const updated = await ctx.db.get(intent._id);
    if (updated === null) {
      throw new Error("Intent not found after update");
    }

    return {
      intent: toIntent(updated),
    };
  },
});

export const listWriteIntentStatuses = internalQuery({
  args: {
    status: v.optional(writeIntentStatusValidator),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > MAX_WRITE_INTENT_PAGE_SIZE) {
      throw new Error(`limit must be between 1 and ${MAX_WRITE_INTENT_PAGE_SIZE}`);
    }

    const rows = await (async () => {
      if (args.status === undefined) {
        return ctx.db.query("healthWriteIntents").take(args.limit);
      }

      const status = args.status;
      return ctx.db
        .query("healthWriteIntents")
        .withIndex("by_status_and_created", (q) => q.eq("status", status))
        .take(args.limit);
    })();

    return rows.map((row) => toIntent(row));
  },
});
