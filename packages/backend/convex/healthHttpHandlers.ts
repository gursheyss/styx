import { isHealthMetric, isSleepCategoryValue } from "./healthDomain";
import {
  MAX_INGEST_BATCH_SIZE,
  MAX_RAW_PAGE_SIZE,
  type HealthIngestRequest,
  type HealthIngestResponse,
  type HealthIngestSample,
  type HealthMetric,
} from "./healthTypes";

type ValidationResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

const JSON_HEADERS = {
  "content-type": "application/json",
};

type DailyQueryResult = {
  items: unknown[];
};

type RawQueryArgs = {
  metric: HealthMetric;
  fromMs: number;
  toMs: number;
  limit: number;
  cursor?: string;
};

type RawQueryResult = {
  items: unknown[];
  nextCursor: string | null;
};

export type HealthHttpDependencies = {
  getExpectedBearerToken: () => string | undefined;
  ingest?: (request: HealthIngestRequest) => Promise<HealthIngestResponse>;
  listDaily?: (args: { from: string; to: string }) => Promise<DailyQueryResult>;
  listRaw?: (args: RawQueryArgs) => Promise<RawQueryResult>;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIntegerNumber(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function parseOptionalString(value: unknown): ValidationResult<string | undefined> {
  if (value === undefined) {
    return {
      ok: true,
      value: undefined,
    };
  }
  if (typeof value === "string") {
    return {
      ok: true,
      value,
    };
  }
  return {
    ok: false,
    error: "Optional source fields must be strings",
    status: 400,
  };
}

function parseIngestSample(value: unknown): ValidationResult<HealthIngestSample> {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Each sample must be an object",
      status: 400,
    };
  }

  const metricValue = value.metric;
  if (!isNonEmptyString(metricValue) || !isHealthMetric(metricValue)) {
    return {
      ok: false,
      error: "Invalid metric",
      status: 400,
    };
  }

  const sampleKey = value.sampleKey;
  const startTimeMs = value.startTimeMs;
  const endTimeMs = value.endTimeMs;
  const unit = value.unit;
  const timezone = value.timezone;

  if (!isNonEmptyString(sampleKey)) {
    return {
      ok: false,
      error: "sampleKey is required",
      status: 400,
    };
  }

  if (!isIntegerNumber(startTimeMs) || !isIntegerNumber(endTimeMs)) {
    return {
      ok: false,
      error: "startTimeMs and endTimeMs must be integer timestamps",
      status: 400,
    };
  }

  if (!isNonEmptyString(unit) || !isNonEmptyString(timezone)) {
    return {
      ok: false,
      error: "unit and timezone are required",
      status: 400,
    };
  }

  if (endTimeMs < startTimeMs) {
    return {
      ok: false,
      error: "endTimeMs must be >= startTimeMs",
      status: 400,
    };
  }

  const sourceName = parseOptionalString(value.sourceName);
  if (!sourceName.ok) {
    return sourceName;
  }

  const sourceBundleId = parseOptionalString(value.sourceBundleId);
  if (!sourceBundleId.ok) {
    return sourceBundleId;
  }

  const valueNumberRaw = value.valueNumber;
  const categoryValueRaw = value.categoryValue;

  if (metricValue === "sleep_segment") {
    if (!isNonEmptyString(categoryValueRaw) || !isSleepCategoryValue(categoryValueRaw)) {
      return {
        ok: false,
        error: "categoryValue is required for sleep_segment",
        status: 400,
      };
    }

    return {
      ok: true,
      value: {
        sampleKey,
        metric: metricValue,
        startTimeMs,
        endTimeMs,
        categoryValue: categoryValueRaw,
        unit,
        sourceName: sourceName.value,
        sourceBundleId: sourceBundleId.value,
        timezone,
      },
    };
  }

  if (!isFiniteNumber(valueNumberRaw)) {
    return {
      ok: false,
      error: "valueNumber is required for numeric metrics",
      status: 400,
    };
  }

  return {
    ok: true,
    value: {
      sampleKey,
      metric: metricValue,
      startTimeMs,
      endTimeMs,
      valueNumber: valueNumberRaw,
      unit,
      sourceName: sourceName.value,
      sourceBundleId: sourceBundleId.value,
      timezone,
    },
  };
}

function parseIngestRequest(value: unknown): ValidationResult<HealthIngestRequest> {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Body must be an object",
      status: 400,
    };
  }

  const deviceId = value.deviceId;
  if (!isNonEmptyString(deviceId)) {
    return {
      ok: false,
      error: "deviceId is required",
      status: 400,
    };
  }

  const samplesValue = value.samples;
  if (!Array.isArray(samplesValue)) {
    return {
      ok: false,
      error: "samples must be an array",
      status: 400,
    };
  }

  if (samplesValue.length > MAX_INGEST_BATCH_SIZE) {
    return {
      ok: false,
      error: `Batch exceeds maximum size of ${MAX_INGEST_BATCH_SIZE}`,
      status: 413,
    };
  }

  const parsedSamples: HealthIngestSample[] = [];
  for (const sample of samplesValue) {
    const parsed = parseIngestSample(sample);
    if (!parsed.ok) {
      return parsed;
    }
    parsedSamples.push(parsed.value);
  }

  return {
    ok: true,
    value: {
      deviceId,
      samples: parsedSamples,
    },
  };
}

function parseDayKey(rawValue: string | null): ValidationResult<string> {
  if (rawValue === null) {
    return {
      ok: false,
      error: "from and to query parameters are required",
      status: 400,
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return {
      ok: false,
      error: "Invalid day key format. Expected YYYY-MM-DD",
      status: 400,
    };
  }

  return {
    ok: true,
    value: rawValue,
  };
}

function parseIntegerQueryParam(
  value: string | null,
  name: string,
  options?: { min?: number; max?: number },
): ValidationResult<number> {
  if (value === null) {
    return {
      ok: false,
      error: `${name} is required`,
      status: 400,
    };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return {
      ok: false,
      error: `${name} must be an integer`,
      status: 400,
    };
  }

  const min = options?.min;
  if (min !== undefined && parsed < min) {
    return {
      ok: false,
      error: `${name} must be >= ${min}`,
      status: 400,
    };
  }

  const max = options?.max;
  if (max !== undefined && parsed > max) {
    return {
      ok: false,
      error: `${name} must be <= ${max}`,
      status: 400,
    };
  }

  return {
    ok: true,
    value: parsed,
  };
}

function secureTokenMatches(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }

  return mismatch === 0;
}

function requireBearerToken(
  request: Request,
  getExpectedBearerToken: () => string | undefined,
): ValidationResult<void> {
  const configuredToken = getExpectedBearerToken();
  if (!isNonEmptyString(configuredToken)) {
    return {
      ok: false,
      error: "PRIVATE_API_BEARER_TOKEN is not configured",
      status: 500,
    };
  }

  const authHeader = request.headers.get("Authorization");
  if (!isNonEmptyString(authHeader)) {
    return {
      ok: false,
      error: "Missing Authorization header",
      status: 401,
    };
  }

  const bearerPrefix = "Bearer ";
  if (!authHeader.startsWith(bearerPrefix)) {
    return {
      ok: false,
      error: "Authorization header must use Bearer token",
      status: 401,
    };
  }

  const token = authHeader.slice(bearerPrefix.length).trim();
  if (!isNonEmptyString(token)) {
    return {
      ok: false,
      error: "Bearer token is required",
      status: 401,
    };
  }

  if (!secureTokenMatches(configuredToken, token)) {
    return {
      ok: false,
      error: "Invalid bearer token",
      status: 403,
    };
  }

  return {
    ok: true,
    value: undefined,
  };
}

export function createHealthHttpHandlers(dependencies: HealthHttpDependencies): {
  handleIngest: (request: Request) => Promise<Response>;
  handleDaily: (request: Request) => Promise<Response>;
  handleRaw: (request: Request) => Promise<Response>;
} {
  const handleIngest = async (request: Request): Promise<Response> => {
    const auth = requireBearerToken(request, dependencies.getExpectedBearerToken);
    if (!auth.ok) {
      return jsonResponse(auth.status, { error: auth.error });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }

    const parsed = parseIngestRequest(body);
    if (!parsed.ok) {
      return jsonResponse(parsed.status, { error: parsed.error });
    }

    if (dependencies.ingest === undefined) {
      return jsonResponse(500, { error: "Ingest handler is not configured" });
    }

    try {
      const result = await dependencies.ingest(parsed.value);
      return jsonResponse(200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ingest failed";
      const status = message.includes("Batch exceeds maximum size") ? 413 : 400;
      return jsonResponse(status, { error: message });
    }
  };

  const handleDaily = async (request: Request): Promise<Response> => {
    const auth = requireBearerToken(request, dependencies.getExpectedBearerToken);
    if (!auth.ok) {
      return jsonResponse(auth.status, { error: auth.error });
    }

    const { searchParams } = new URL(request.url);
    const from = parseDayKey(searchParams.get("from"));
    if (!from.ok) {
      return jsonResponse(from.status, { error: from.error });
    }

    const to = parseDayKey(searchParams.get("to"));
    if (!to.ok) {
      return jsonResponse(to.status, { error: to.error });
    }

    if (from.value > to.value) {
      return jsonResponse(400, { error: "from must be <= to" });
    }

    if (dependencies.listDaily === undefined) {
      return jsonResponse(500, { error: "Daily list handler is not configured" });
    }

    try {
      const rows = await dependencies.listDaily({
        from: from.value,
        to: to.value,
      });

      return jsonResponse(200, rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch daily metrics";
      return jsonResponse(400, { error: message });
    }
  };

  const handleRaw = async (request: Request): Promise<Response> => {
    const auth = requireBearerToken(request, dependencies.getExpectedBearerToken);
    if (!auth.ok) {
      return jsonResponse(auth.status, { error: auth.error });
    }

    const { searchParams } = new URL(request.url);
    const metric = searchParams.get("metric");
    if (!isNonEmptyString(metric) || !isHealthMetric(metric)) {
      return jsonResponse(400, { error: "metric must be a valid HealthMetric" });
    }

    const fromMs = parseIntegerQueryParam(searchParams.get("fromMs"), "fromMs");
    if (!fromMs.ok) {
      return jsonResponse(fromMs.status, { error: fromMs.error });
    }

    const toMs = parseIntegerQueryParam(searchParams.get("toMs"), "toMs");
    if (!toMs.ok) {
      return jsonResponse(toMs.status, { error: toMs.error });
    }

    if (fromMs.value > toMs.value) {
      return jsonResponse(400, { error: "fromMs must be <= toMs" });
    }

    const rawLimit = searchParams.get("limit");
    let limitResult: ValidationResult<number>;
    if (rawLimit === null) {
      limitResult = {
        ok: true,
        value: 100,
      };
    } else {
      limitResult = parseIntegerQueryParam(rawLimit, "limit", {
        min: 1,
        max: MAX_RAW_PAGE_SIZE,
      });
    }

    if (!limitResult.ok) {
      return jsonResponse(limitResult.status, { error: limitResult.error });
    }

    const cursor = searchParams.get("cursor");
    const parsedCursor = cursor === null || cursor.length === 0 ? undefined : cursor;

    if (dependencies.listRaw === undefined) {
      return jsonResponse(500, { error: "Raw list handler is not configured" });
    }

    try {
      const rows = await dependencies.listRaw({
        metric,
        fromMs: fromMs.value,
        toMs: toMs.value,
        limit: limitResult.value,
        cursor: parsedCursor,
      });

      return jsonResponse(200, rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch raw metrics";
      return jsonResponse(400, { error: message });
    }
  };

  return {
    handleIngest,
    handleDaily,
    handleRaw,
  };
}
