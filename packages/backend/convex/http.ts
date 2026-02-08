import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { createHealthHttpHandlers } from "./healthHttpHandlers";
import { buildHealthOpenApiDocument } from "./healthOpenApi";
import { createHealthSummaryHttpHandlers } from "./healthSummaryHttpHandlers";
import { createHealthWriteIntentHttpHandlers } from "./healthWriteIntentHttpHandlers";

const getExpectedBearerToken = (): string | undefined => process.env.PRIVATE_API_BEARER_TOKEN;

export const ingestHealth = httpAction(async (ctx, request) => {
  const handlers = createHealthHttpHandlers({
    getExpectedBearerToken,
    ingest: (payload) => ctx.runMutation(internal.healthInternal.upsertRawSamples, payload),
  });

  return handlers.handleIngest(request);
});

export const getDailyHealth = httpAction(async (ctx, request) => {
  const handlers = createHealthHttpHandlers({
    getExpectedBearerToken,
    listDaily: async (args) => {
      const rows = await ctx.runQuery(internal.healthInternal.listDaily, args);
      return {
        items: rows,
      };
    },
  });

  return handlers.handleDaily(request);
});

export const getRawHealth = httpAction(async (ctx, request) => {
  const handlers = createHealthHttpHandlers({
    getExpectedBearerToken,
    listRaw: (args) => ctx.runQuery(internal.healthInternal.listRaw, args),
  });

  return handlers.handleRaw(request);
});

export const getHealthDailySummary = httpAction(async (ctx, request) => {
  const handlers = createHealthSummaryHttpHandlers({
    getExpectedBearerToken,
    getDailySummary: (args) => ctx.runQuery(internal.healthSummaryInternal.getDailySummary, args),
    getRangeSummary: (args) => ctx.runQuery(internal.healthSummaryInternal.getRangeSummary, args),
    getYesterdaySummary: (args) => ctx.runQuery(internal.healthSummaryInternal.getYesterdaySummary, args),
  });

  return handlers.handleDailySummary(request);
});

export const getHealthRangeSummary = httpAction(async (ctx, request) => {
  const handlers = createHealthSummaryHttpHandlers({
    getExpectedBearerToken,
    getDailySummary: (args) => ctx.runQuery(internal.healthSummaryInternal.getDailySummary, args),
    getRangeSummary: (args) => ctx.runQuery(internal.healthSummaryInternal.getRangeSummary, args),
    getYesterdaySummary: (args) => ctx.runQuery(internal.healthSummaryInternal.getYesterdaySummary, args),
  });

  return handlers.handleRangeSummary(request);
});

export const getHealthYesterdaySummary = httpAction(async (ctx, request) => {
  const handlers = createHealthSummaryHttpHandlers({
    getExpectedBearerToken,
    getDailySummary: (args) => ctx.runQuery(internal.healthSummaryInternal.getDailySummary, args),
    getRangeSummary: (args) => ctx.runQuery(internal.healthSummaryInternal.getRangeSummary, args),
    getYesterdaySummary: (args) => ctx.runQuery(internal.healthSummaryInternal.getYesterdaySummary, args),
  });

  return handlers.handleYesterdaySummary(request);
});

export const queryHealth = httpAction(async (ctx, request) => {
  const handlers = createHealthSummaryHttpHandlers({
    getExpectedBearerToken,
    getDailySummary: (args) => ctx.runQuery(internal.healthSummaryInternal.getDailySummary, args),
    getRangeSummary: (args) => ctx.runQuery(internal.healthSummaryInternal.getRangeSummary, args),
    getYesterdaySummary: (args) => ctx.runQuery(internal.healthSummaryInternal.getYesterdaySummary, args),
  });

  return handlers.handleQuery(request);
});

export const getHealthCapabilities = httpAction(async (_ctx, request) => {
  const handlers = createHealthSummaryHttpHandlers({
    getExpectedBearerToken,
    getDailySummary: async () => {
      throw new Error("unreachable");
    },
    getRangeSummary: async () => {
      throw new Error("unreachable");
    },
    getYesterdaySummary: async () => {
      throw new Error("unreachable");
    },
  });

  return handlers.handleCapabilities(request);
});

export const upsertHealthWriteIntent = httpAction(async (ctx, request) => {
  const handlers = createHealthWriteIntentHttpHandlers({
    getExpectedBearerToken,
    upsertWriteIntent: (args) => ctx.runMutation(internal.healthWriteIntentsInternal.upsertWriteIntent, args),
    listPendingWriteIntents: (args) =>
      ctx.runQuery(internal.healthWriteIntentsInternal.listPendingWriteIntents, args),
    ackWriteIntent: (args) => ctx.runMutation(internal.healthWriteIntentsInternal.ackWriteIntent, args),
  });

  return handlers.handleCreateIntent(request);
});

export const listPendingHealthWriteIntents = httpAction(async (ctx, request) => {
  const handlers = createHealthWriteIntentHttpHandlers({
    getExpectedBearerToken,
    upsertWriteIntent: (args) => ctx.runMutation(internal.healthWriteIntentsInternal.upsertWriteIntent, args),
    listPendingWriteIntents: (args) =>
      ctx.runQuery(internal.healthWriteIntentsInternal.listPendingWriteIntents, args),
    ackWriteIntent: (args) => ctx.runMutation(internal.healthWriteIntentsInternal.ackWriteIntent, args),
  });

  return handlers.handleListPending(request);
});

export const ackHealthWriteIntent = httpAction(async (ctx, request) => {
  const handlers = createHealthWriteIntentHttpHandlers({
    getExpectedBearerToken,
    upsertWriteIntent: (args) => ctx.runMutation(internal.healthWriteIntentsInternal.upsertWriteIntent, args),
    listPendingWriteIntents: (args) =>
      ctx.runQuery(internal.healthWriteIntentsInternal.listPendingWriteIntents, args),
    ackWriteIntent: (args) => ctx.runMutation(internal.healthWriteIntentsInternal.ackWriteIntent, args),
  });

  return handlers.handleAckIntent(request);
});

export const getHealthOpenApiJson = httpAction(async (_ctx, request) => {
  const baseUrl = new URL(request.url).origin;
  return new Response(JSON.stringify(buildHealthOpenApiDocument(baseUrl), null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
    },
  });
});

const http = httpRouter();

http.route({
  path: "/health/ingest",
  method: "POST",
  handler: ingestHealth,
});

http.route({
  path: "/health/daily",
  method: "GET",
  handler: getDailyHealth,
});

http.route({
  path: "/health/raw",
  method: "GET",
  handler: getRawHealth,
});

http.route({
  path: "/health/summary/daily",
  method: "GET",
  handler: getHealthDailySummary,
});

http.route({
  path: "/health/summary/range",
  method: "GET",
  handler: getHealthRangeSummary,
});

http.route({
  path: "/health/summary/yesterday",
  method: "GET",
  handler: getHealthYesterdaySummary,
});

http.route({
  path: "/health/query",
  method: "POST",
  handler: queryHealth,
});

http.route({
  path: "/health/capabilities",
  method: "GET",
  handler: getHealthCapabilities,
});

http.route({
  path: "/health/write-intents",
  method: "POST",
  handler: upsertHealthWriteIntent,
});

http.route({
  path: "/health/write-intents/pending",
  method: "GET",
  handler: listPendingHealthWriteIntents,
});

http.route({
  path: "/health/write-intents/ack",
  method: "POST",
  handler: ackHealthWriteIntent,
});

http.route({
  path: "/health/openapi.json",
  method: "GET",
  handler: getHealthOpenApiJson,
});

export default http;
