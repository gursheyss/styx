import { env } from "@styx/env/native";

import { HealthApiError } from "./errors";
import type {
  HealthIngestRequest,
  HealthIngestResponse,
  HealthDailySummary,
  HealthSummaryRange,
  HealthMetric,
  HealthWriteIntent,
  HealthWriteIntentAckRequest,
  HealthWriteIntentPayload,
} from "./types";

const DEFAULT_HEADERS = {
  Authorization: `Bearer ${env.EXPO_PUBLIC_HEALTH_API_TOKEN}`,
};

type RawRequestArgs = {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
};

function normalizeBaseUrl(rawUrl: string): string {
  return rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const parsed = await response.json();
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof parsed.error === "string"
    ) {
      return parsed.error;
    }
    return `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

async function requestJson<T>(args: RawRequestArgs): Promise<T> {
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
  };

  let bodyString: string | undefined;
  if (args.body !== undefined) {
    headers["content-type"] = "application/json";
    bodyString = JSON.stringify(args.body);
  }

  let response: Response;
  try {
    response = await fetch(`${normalizeBaseUrl(env.EXPO_PUBLIC_HEALTH_API_BASE_URL)}${args.path}`, {
      method: args.method,
      headers,
      body: bodyString,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new HealthApiError(message, null);
  }

  if (!response.ok) {
    throw new HealthApiError(await parseErrorMessage(response), response.status);
  }

  const parsedResponse: T = await response.json();
  return parsedResponse;
}

export async function ingestHealth(
  payload: HealthIngestRequest,
): Promise<HealthIngestResponse> {
  return requestJson<HealthIngestResponse>({
    path: "/health/ingest",
    method: "POST",
    body: payload,
  });
}

export type HealthDailyResponse = {
  items: {
    dayKey: string;
    timezone: string;
    metrics: Record<string, unknown>;
    recomputedAtMs: number;
  }[];
};

export async function getDailyHealth(from: string, to: string): Promise<HealthDailyResponse> {
  return requestJson<HealthDailyResponse>({
    path: `/health/daily?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    method: "GET",
  });
}

export type HealthDataEnvelope<T> = {
  data: T;
  meta: Record<string, string | number | boolean>;
};

export type HealthDailySummaryResponse = HealthDataEnvelope<HealthDailySummary>;
export type HealthRangeSummaryResponse = HealthDataEnvelope<HealthSummaryRange>;
export type HealthCapabilitiesResponse = HealthDataEnvelope<Record<string, unknown>>;

export type StructuredHealthQueryRequest =
  | {
      intent: "daily_summary";
      day: string;
      timezone?: string;
      utterance?: string;
    }
  | {
      intent: "range_summary";
      from: string;
      to: string;
      timezone?: string;
      utterance?: string;
    }
  | {
      intent: "yesterday_summary";
      timezone?: string;
      utterance?: string;
    };

export type StructuredHealthQueryResponse = HealthDataEnvelope<{
  intent: StructuredHealthQueryRequest["intent"];
  utterance?: string;
  summary: HealthDailySummary | HealthSummaryRange;
}>;

export async function getHealthDailySummary(day: string, timezone?: string): Promise<HealthDailySummaryResponse> {
  const query = new URLSearchParams({
    day,
  });
  if (timezone !== undefined) {
    query.set("timezone", timezone);
  }

  return requestJson<HealthDailySummaryResponse>({
    path: `/health/summary/daily?${query.toString()}`,
    method: "GET",
  });
}

export async function getHealthRangeSummary(
  from: string,
  to: string,
  timezone?: string,
): Promise<HealthRangeSummaryResponse> {
  const query = new URLSearchParams({
    from,
    to,
  });
  if (timezone !== undefined) {
    query.set("timezone", timezone);
  }

  return requestJson<HealthRangeSummaryResponse>({
    path: `/health/summary/range?${query.toString()}`,
    method: "GET",
  });
}

export async function getHealthYesterdaySummary(timezone?: string): Promise<HealthDailySummaryResponse> {
  const query = new URLSearchParams();
  if (timezone !== undefined) {
    query.set("timezone", timezone);
  }

  const queryString = query.toString();
  const path =
    queryString.length > 0 ? `/health/summary/yesterday?${queryString}` : "/health/summary/yesterday";

  return requestJson<HealthDailySummaryResponse>({
    path,
    method: "GET",
  });
}

export async function queryHealth(
  request: StructuredHealthQueryRequest,
): Promise<StructuredHealthQueryResponse> {
  return requestJson<StructuredHealthQueryResponse>({
    path: "/health/query",
    method: "POST",
    body: request,
  });
}

export type HealthRawResponse = {
  items: {
    sampleKey: string;
    metric: HealthMetric;
    startTimeMs: number;
    endTimeMs: number;
    valueNumber?: number;
    categoryValue?: string;
    unit: string;
    sourceName?: string;
    sourceBundleId?: string;
    timezone: string;
    dayKey: string;
    ingestedAtMs: number;
    deviceId: string;
  }[];
  nextCursor: string | null;
};

export async function getRawHealth(args: {
  metric: HealthMetric;
  fromMs: number;
  toMs: number;
  limit?: number;
  cursor?: string;
}): Promise<HealthRawResponse> {
  const query = new URLSearchParams({
    metric: args.metric,
    fromMs: String(args.fromMs),
    toMs: String(args.toMs),
    limit: String(args.limit ?? 100),
  });

  if (args.cursor !== undefined) {
    query.set("cursor", args.cursor);
  }

  return requestJson<HealthRawResponse>({
    path: `/health/raw?${query.toString()}`,
    method: "GET",
  });
}

export type HealthWriteIntentUpsertResponse = HealthDataEnvelope<{
  created: boolean;
  intent: HealthWriteIntent;
}>;

export async function upsertHealthWriteIntent(
  intent: HealthWriteIntentPayload,
): Promise<HealthWriteIntentUpsertResponse> {
  return requestJson<HealthWriteIntentUpsertResponse>({
    path: "/health/write-intents",
    method: "POST",
    body: intent,
  });
}

export type HealthPendingWriteIntentResponse = HealthDataEnvelope<{
  items: HealthWriteIntent[];
  nextCursor: string | null;
}>;

export async function listPendingHealthWriteIntents(args: {
  limit: number;
  cursor?: string;
}): Promise<HealthPendingWriteIntentResponse> {
  const query = new URLSearchParams({
    limit: String(args.limit),
  });

  if (args.cursor !== undefined) {
    query.set("cursor", args.cursor);
  }

  return requestJson<HealthPendingWriteIntentResponse>({
    path: `/health/write-intents/pending?${query.toString()}`,
    method: "GET",
  });
}

export type HealthAckWriteIntentResponse = HealthDataEnvelope<{
  intent: HealthWriteIntent;
}>;

export async function ackHealthWriteIntent(
  request: HealthWriteIntentAckRequest,
): Promise<HealthAckWriteIntentResponse> {
  return requestJson<HealthAckWriteIntentResponse>({
    path: "/health/write-intents/ack",
    method: "POST",
    body: request,
  });
}

export async function getHealthOpenApiDocument(): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>({
    path: "/health/openapi.json",
    method: "GET",
  });
}

export async function getHealthCapabilities(): Promise<HealthCapabilitiesResponse> {
  return requestJson<HealthCapabilitiesResponse>({
    path: "/health/capabilities",
    method: "GET",
  });
}
