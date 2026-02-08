import {
  isRecord,
  isNonEmptyString,
  jsonResponse,
  parseDayKey,
  requireBearerToken,
  type ValidationResult,
} from "./healthApiCommon";
import type { HealthDailySummary, HealthSummaryRange } from "./healthTypes";

type HealthSummaryDependencies = {
  getExpectedBearerToken: () => string | undefined;
  getDailySummary: (args: { day: string; timezone: string }) => Promise<HealthDailySummary>;
  getRangeSummary: (args: { from: string; to: string; timezone: string }) => Promise<HealthSummaryRange>;
  getYesterdaySummary: (args: { timezone: string }) => Promise<HealthDailySummary>;
};

type StructuredHealthSummaryQuery =
  | {
      intent: "daily_summary";
      day: string;
      timezone: string;
      utterance?: string;
    }
  | {
      intent: "range_summary";
      from: string;
      to: string;
      timezone: string;
      utterance?: string;
    }
  | {
      intent: "yesterday_summary";
      timezone: string;
      utterance?: string;
    };

function parseTimezone(rawValue: string | null): string {
  if (rawValue === null || rawValue.trim().length === 0) {
    return "UTC";
  }

  return rawValue;
}

function parseTimezoneInput(rawValue: unknown): ValidationResult<string> {
  if (rawValue === undefined) {
    return {
      ok: true,
      value: "UTC",
    };
  }

  if (!isNonEmptyString(rawValue)) {
    return {
      ok: false,
      error: "timezone must be a non-empty string",
      status: 400,
    };
  }

  return {
    ok: true,
    value: rawValue,
  };
}

function optionalString(rawValue: unknown): ValidationResult<string | undefined> {
  if (rawValue === undefined) {
    return {
      ok: true,
      value: undefined,
    };
  }

  if (typeof rawValue !== "string") {
    return {
      ok: false,
      error: "utterance must be a string",
      status: 400,
    };
  }

  return {
    ok: true,
    value: rawValue,
  };
}

function parseStructuredQuery(value: unknown): ValidationResult<StructuredHealthSummaryQuery> {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Body must be an object",
      status: 400,
    };
  }

  const intent = value.intent;
  if (!isNonEmptyString(intent)) {
    return {
      ok: false,
      error: "intent is required",
      status: 400,
    };
  }

  const utterance = optionalString(value.utterance);
  if (!utterance.ok) {
    return utterance;
  }

  const timezone = parseTimezoneInput(value.timezone);
  if (!timezone.ok) {
    return timezone;
  }

  if (intent === "daily_summary") {
    const day = parseDayKey(typeof value.day === "string" ? value.day : null);
    if (!day.ok) {
      return day;
    }

    return {
      ok: true,
      value: {
        intent,
        day: day.value,
        timezone: timezone.value,
        utterance: utterance.value,
      },
    };
  }

  if (intent === "range_summary") {
    const from = parseDayKey(typeof value.from === "string" ? value.from : null);
    if (!from.ok) {
      return from;
    }

    const to = parseDayKey(typeof value.to === "string" ? value.to : null);
    if (!to.ok) {
      return to;
    }

    if (from.value > to.value) {
      return {
        ok: false,
        error: "from must be <= to",
        status: 400,
      };
    }

    return {
      ok: true,
      value: {
        intent,
        from: from.value,
        to: to.value,
        timezone: timezone.value,
        utterance: utterance.value,
      },
    };
  }

  if (intent === "yesterday_summary") {
    return {
      ok: true,
      value: {
        intent,
        timezone: timezone.value,
        utterance: utterance.value,
      },
    };
  }

  return {
    ok: false,
    error: "intent must be daily_summary, range_summary, or yesterday_summary",
    status: 400,
  };
}

function dataResponse(data: unknown, meta: Record<string, string | number | boolean>): Response {
  return jsonResponse(200, {
    data,
    meta,
  });
}

function errorResponse(result: { ok: false; error: string; status: number }): Response {
  return jsonResponse(result.status, {
    error: result.error,
  });
}

export function createHealthSummaryHttpHandlers(dependencies: HealthSummaryDependencies): {
  handleDailySummary: (request: Request) => Promise<Response>;
  handleRangeSummary: (request: Request) => Promise<Response>;
  handleYesterdaySummary: (request: Request) => Promise<Response>;
  handleQuery: (request: Request) => Promise<Response>;
  handleCapabilities: (request: Request) => Promise<Response>;
} {
  const handleDailySummary = async (request: Request): Promise<Response> => {
    const auth = requireBearerToken(request, dependencies.getExpectedBearerToken);
    if (!auth.ok) {
      return errorResponse(auth);
    }

    const url = new URL(request.url);
    const day = parseDayKey(url.searchParams.get("day"));
    if (!day.ok) {
      return errorResponse(day);
    }

    const timezone = parseTimezone(url.searchParams.get("timezone"));

    try {
      const summary = await dependencies.getDailySummary({
        day: day.value,
        timezone,
      });
      return dataResponse(summary, {
        query: "daily_summary",
        timezone,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch daily summary";
      return jsonResponse(400, { error: message });
    }
  };

  const handleRangeSummary = async (request: Request): Promise<Response> => {
    const auth = requireBearerToken(request, dependencies.getExpectedBearerToken);
    if (!auth.ok) {
      return errorResponse(auth);
    }

    const url = new URL(request.url);
    const from = parseDayKey(url.searchParams.get("from"));
    if (!from.ok) {
      return errorResponse(from);
    }

    const to = parseDayKey(url.searchParams.get("to"));
    if (!to.ok) {
      return errorResponse(to);
    }

    if (from.value > to.value) {
      return jsonResponse(400, { error: "from must be <= to" });
    }

    const timezone = parseTimezone(url.searchParams.get("timezone"));

    try {
      const summary = await dependencies.getRangeSummary({
        from: from.value,
        to: to.value,
        timezone,
      });

      return dataResponse(summary, {
        query: "range_summary",
        timezone,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch range summary";
      return jsonResponse(400, { error: message });
    }
  };

  const handleYesterdaySummary = async (request: Request): Promise<Response> => {
    const auth = requireBearerToken(request, dependencies.getExpectedBearerToken);
    if (!auth.ok) {
      return errorResponse(auth);
    }

    const url = new URL(request.url);
    const timezone = parseTimezone(url.searchParams.get("timezone"));

    try {
      const summary = await dependencies.getYesterdaySummary({
        timezone,
      });

      return dataResponse(summary, {
        query: "yesterday_summary",
        timezone,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch yesterday summary";
      return jsonResponse(400, { error: message });
    }
  };

  const handleQuery = async (request: Request): Promise<Response> => {
    const auth = requireBearerToken(request, dependencies.getExpectedBearerToken);
    if (!auth.ok) {
      return errorResponse(auth);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }

    const structuredQuery = parseStructuredQuery(body);
    if (!structuredQuery.ok) {
      return jsonResponse(structuredQuery.status, { error: structuredQuery.error });
    }

    try {
      const query = structuredQuery.value;

      if (query.intent === "daily_summary") {
        const summary = await dependencies.getDailySummary({
          day: query.day,
          timezone: query.timezone,
        });

        return dataResponse(
          {
            intent: query.intent,
            utterance: query.utterance,
            summary,
          },
          {
            query: "structured_health_query",
            intent: query.intent,
            timezone: query.timezone,
          },
        );
      }

      if (query.intent === "range_summary") {
        const summary = await dependencies.getRangeSummary({
          from: query.from,
          to: query.to,
          timezone: query.timezone,
        });

        return dataResponse(
          {
            intent: query.intent,
            utterance: query.utterance,
            summary,
          },
          {
            query: "structured_health_query",
            intent: query.intent,
            timezone: query.timezone,
          },
        );
      }

      const summary = await dependencies.getYesterdaySummary({
        timezone: query.timezone,
      });

      return dataResponse(
        {
          intent: query.intent,
          utterance: query.utterance,
          summary,
        },
        {
          query: "structured_health_query",
          intent: query.intent,
          timezone: query.timezone,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to execute structured health query";
      return jsonResponse(400, { error: message });
    }
  };

  const handleCapabilities = async (request: Request): Promise<Response> => {
    const auth = requireBearerToken(request, dependencies.getExpectedBearerToken);
    if (!auth.ok) {
      return errorResponse(auth);
    }

    const capabilities = {
      query: {
        name: "structured_health_query",
        endpoint: "/health/query",
        description:
          "Single intent-based endpoint for AI assistants. Use intent + typed parameters instead of free-form parsing.",
        intents: [
          {
            name: "daily_summary",
            required: ["day"],
          },
          {
            name: "range_summary",
            required: ["from", "to"],
          },
          {
            name: "yesterday_summary",
            required: [],
          },
        ],
      },
      summaries: [
        {
          name: "daily_summary",
          endpoint: "/health/summary/daily",
          description: "Get a deterministic summary for a single day.",
          input: {
            day: "YYYY-MM-DD",
            timezone: "IANA timezone (optional, default UTC)",
          },
        },
        {
          name: "range_summary",
          endpoint: "/health/summary/range",
          description: "Get multi-day summaries and totals.",
          input: {
            from: "YYYY-MM-DD",
            to: "YYYY-MM-DD",
            timezone: "IANA timezone (optional, default UTC)",
          },
        },
        {
          name: "yesterday_summary",
          endpoint: "/health/summary/yesterday",
          description: "Get yesterday's performance summary for morning briefing automations.",
          input: {
            timezone: "IANA timezone (optional, default UTC)",
          },
        },
      ],
      writes: [
        {
          name: "queue_calorie_write",
          endpoint: "/health/write-intents",
          description: "Queue an idempotent calorie write intent using externalId.",
        },
        {
          name: "list_pending_write_intents",
          endpoint: "/health/write-intents/pending",
          description: "List pending intents to be applied on iOS HealthKit.",
        },
        {
          name: "ack_write_intent",
          endpoint: "/health/write-intents/ack",
          description: "Acknowledge apply status (applied, failed, skipped).",
        },
      ],
    };

    return dataResponse(capabilities, {
      query: "capabilities",
      version: 2,
    });
  };

  return {
    handleDailySummary,
    handleRangeSummary,
    handleYesterdaySummary,
    handleQuery,
    handleCapabilities,
  };
}
