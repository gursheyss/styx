import {
  isFiniteNumber,
  isIntegerNumber,
  isNonEmptyString,
  isRecord,
  jsonResponse,
  parseIntegerQueryParam,
  requireBearerToken,
} from "./healthApiCommon";
import {
  MAX_WRITE_INTENT_PAGE_SIZE,
  type HealthWriteIntent,
  type HealthWriteIntentAckRequest,
  type HealthWriteIntentPayload,
} from "./healthTypes";

type WriteIntentDependencies = {
  getExpectedBearerToken: () => string | undefined;
  upsertWriteIntent: (args: { intent: HealthWriteIntentPayload }) => Promise<{
    created: boolean;
    intent: HealthWriteIntent;
  }>;
  listPendingWriteIntents: (args: {
    limit: number;
    cursor?: string;
  }) => Promise<{
    items: HealthWriteIntent[];
    nextCursor: string | null;
  }>;
  ackWriteIntent: (args: HealthWriteIntentAckRequest) => Promise<{
    intent: HealthWriteIntent;
  }>;
};

function isWriteMetric(value: string): value is "active_energy_kcal" | "dietary_energy_kcal" {
  return value === "active_energy_kcal" || value === "dietary_energy_kcal";
}

function isAckStatus(value: string): value is "applied" | "failed" | "skipped" {
  return value === "applied" || value === "failed" || value === "skipped";
}

function parseTags(value: unknown): string[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const tags: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      return null;
    }
    tags.push(entry);
  }

  return tags;
}

function parseCreateBody(value: unknown): { ok: true; value: HealthWriteIntentPayload } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Body must be an object" };
  }

  const externalId = value.externalId;
  const metric = value.metric;
  const startTimeMs = value.startTimeMs;
  const endTimeMs = value.endTimeMs;
  const valueNumber = value.valueNumber;
  const unit = value.unit;
  const timezone = value.timezone;

  if (!isNonEmptyString(externalId)) {
    return { ok: false, error: "externalId is required" };
  }

  if (!isNonEmptyString(metric) || !isWriteMetric(metric)) {
    return { ok: false, error: "metric must be active_energy_kcal or dietary_energy_kcal" };
  }

  if (!isIntegerNumber(startTimeMs) || !isIntegerNumber(endTimeMs)) {
    return { ok: false, error: "startTimeMs and endTimeMs must be integers" };
  }

  if (endTimeMs < startTimeMs) {
    return { ok: false, error: "endTimeMs must be >= startTimeMs" };
  }

  if (!isFiniteNumber(valueNumber)) {
    return { ok: false, error: "valueNumber must be a finite number" };
  }

  if (!isNonEmptyString(unit)) {
    return { ok: false, error: "unit is required" };
  }

  if (!isNonEmptyString(timezone)) {
    return { ok: false, error: "timezone is required" };
  }

  const tags = parseTags(value.tags);
  if (tags === null) {
    return { ok: false, error: "tags must be an array of strings" };
  }

  const noteRaw = value.note;
  if (noteRaw !== undefined && typeof noteRaw !== "string") {
    return { ok: false, error: "note must be a string" };
  }

  const sourceNameRaw = value.sourceName;
  if (sourceNameRaw !== undefined && typeof sourceNameRaw !== "string") {
    return { ok: false, error: "sourceName must be a string" };
  }

  const sourceBundleIdRaw = value.sourceBundleId;
  if (sourceBundleIdRaw !== undefined && typeof sourceBundleIdRaw !== "string") {
    return { ok: false, error: "sourceBundleId must be a string" };
  }

  return {
    ok: true,
    value: {
      externalId,
      metric,
      startTimeMs,
      endTimeMs,
      valueNumber,
      unit,
      timezone,
      note: noteRaw,
      sourceName: sourceNameRaw,
      sourceBundleId: sourceBundleIdRaw,
      tags,
    },
  };
}

function parseAckBody(value: unknown): { ok: true; value: HealthWriteIntentAckRequest } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Body must be an object" };
  }

  const externalId = value.externalId;
  const status = value.status;

  if (!isNonEmptyString(externalId)) {
    return { ok: false, error: "externalId is required" };
  }

  if (!isNonEmptyString(status) || !isAckStatus(status)) {
    return { ok: false, error: "status must be applied, failed, or skipped" };
  }

  const appliedAtMsRaw = value.appliedAtMs;
  if (appliedAtMsRaw !== undefined && !isIntegerNumber(appliedAtMsRaw)) {
    return { ok: false, error: "appliedAtMs must be an integer timestamp" };
  }

  const healthkitUuidRaw = value.healthkitUuid;
  if (healthkitUuidRaw !== undefined && typeof healthkitUuidRaw !== "string") {
    return { ok: false, error: "healthkitUuid must be a string" };
  }

  const errorCodeRaw = value.errorCode;
  if (errorCodeRaw !== undefined && typeof errorCodeRaw !== "string") {
    return { ok: false, error: "errorCode must be a string" };
  }

  const errorMessageRaw = value.errorMessage;
  if (errorMessageRaw !== undefined && typeof errorMessageRaw !== "string") {
    return { ok: false, error: "errorMessage must be a string" };
  }

  return {
    ok: true,
    value: {
      externalId,
      status,
      appliedAtMs: appliedAtMsRaw,
      healthkitUuid: healthkitUuidRaw,
      errorCode: errorCodeRaw,
      errorMessage: errorMessageRaw,
    },
  };
}

function dataResponse(data: unknown, meta: Record<string, string | number | boolean>): Response {
  return jsonResponse(200, {
    data,
    meta,
  });
}

export function createHealthWriteIntentHttpHandlers(dependencies: WriteIntentDependencies): {
  handleCreateIntent: (request: Request) => Promise<Response>;
  handleListPending: (request: Request) => Promise<Response>;
  handleAckIntent: (request: Request) => Promise<Response>;
} {
  const handleCreateIntent = async (request: Request): Promise<Response> => {
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

    const parsed = parseCreateBody(body);
    if (!parsed.ok) {
      return jsonResponse(400, { error: parsed.error });
    }

    try {
      const result = await dependencies.upsertWriteIntent({
        intent: parsed.value,
      });

      return dataResponse(result, {
        query: "upsert_write_intent",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upsert write intent";
      return jsonResponse(400, { error: message });
    }
  };

  const handleListPending = async (request: Request): Promise<Response> => {
    const auth = requireBearerToken(request, dependencies.getExpectedBearerToken);
    if (!auth.ok) {
      return jsonResponse(auth.status, { error: auth.error });
    }

    const url = new URL(request.url);
    const parsedLimit = parseIntegerQueryParam(url.searchParams.get("limit"), "limit", {
      min: 1,
      max: MAX_WRITE_INTENT_PAGE_SIZE,
    });

    if (!parsedLimit.ok) {
      return jsonResponse(parsedLimit.status, { error: parsedLimit.error });
    }

    const cursorRaw = url.searchParams.get("cursor");
    const cursor = cursorRaw === null || cursorRaw.length === 0 ? undefined : cursorRaw;

    try {
      const result = await dependencies.listPendingWriteIntents({
        limit: parsedLimit.value,
        cursor,
      });

      return dataResponse(result, {
        query: "pending_write_intents",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list pending write intents";
      return jsonResponse(400, { error: message });
    }
  };

  const handleAckIntent = async (request: Request): Promise<Response> => {
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

    const parsed = parseAckBody(body);
    if (!parsed.ok) {
      return jsonResponse(400, { error: parsed.error });
    }

    try {
      const result = await dependencies.ackWriteIntent(parsed.value);
      return dataResponse(result, {
        query: "ack_write_intent",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to ack write intent";
      return jsonResponse(400, { error: message });
    }
  };

  return {
    handleCreateIntent,
    handleListPending,
    handleAckIntent,
  };
}
