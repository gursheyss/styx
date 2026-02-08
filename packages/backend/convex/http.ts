import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { createHealthHttpHandlers } from "./healthHttpHandlers";

export const ingestHealth = httpAction(async (ctx, request) => {
  const handlers = createHealthHttpHandlers({
    getExpectedBearerToken: () => process.env.PRIVATE_API_BEARER_TOKEN,
    ingest: (payload) => ctx.runMutation(internal.healthInternal.upsertRawSamples, payload),
  });

  return handlers.handleIngest(request);
});

export const getDailyHealth = httpAction(async (ctx, request) => {
  const handlers = createHealthHttpHandlers({
    getExpectedBearerToken: () => process.env.PRIVATE_API_BEARER_TOKEN,
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
    getExpectedBearerToken: () => process.env.PRIVATE_API_BEARER_TOKEN,
    listRaw: (args) => ctx.runQuery(internal.healthInternal.listRaw, args),
  });

  return handlers.handleRaw(request);
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

export default http;
