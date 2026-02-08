import { env } from "@styx/env/native";

import { HealthApiError } from "./errors";
import type { HealthIngestRequest, HealthIngestResponse, HealthMetric } from "./types";

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
