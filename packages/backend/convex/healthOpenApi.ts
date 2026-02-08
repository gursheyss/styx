function serverUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (trimmed.length === 0) {
    return "https://example.convex.site";
  }
  return trimmed;
}

export function buildHealthOpenApiDocument(baseUrl: string): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Styx Health API",
      summary: "Health ingestion, summaries, and two-way write intent orchestration.",
      description:
        "Machine-consumable health API with deterministic summary endpoints and idempotent write-intent queue for HealthKit apply.",
      version: "2.0.0",
    },
    servers: [
      {
        url: serverUrl(baseUrl),
      },
    ],
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: "ingest",
        description: "Raw ingest and raw/daily reads.",
      },
      {
        name: "summary",
        description: "Deterministic NLP-friendly summaries.",
      },
      {
        name: "write-intents",
        description: "Two-way sync queue for HealthKit write-back.",
      },
      {
        name: "meta",
        description: "API discovery and capabilities.",
      },
    ],
    paths: {
      "/health/ingest": {
        post: {
          tags: ["ingest"],
          summary: "Upsert raw health samples",
          operationId: "healthIngest",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthIngestRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Ingest result",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/HealthIngestResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/health/daily": {
        get: {
          tags: ["ingest"],
          summary: "List daily aggregates",
          operationId: "healthDaily",
          parameters: [
            {
              name: "from",
              in: "query",
              required: true,
              schema: {
                type: "string",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              },
            },
            {
              name: "to",
              in: "query",
              required: true,
              schema: {
                type: "string",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              },
            },
          ],
          responses: {
            "200": {
              description: "Daily aggregates",
            },
          },
        },
      },
      "/health/raw": {
        get: {
          tags: ["ingest"],
          summary: "List raw samples",
          operationId: "healthRaw",
          parameters: [
            {
              name: "metric",
              in: "query",
              required: true,
              schema: {
                $ref: "#/components/schemas/HealthMetric",
              },
            },
            {
              name: "fromMs",
              in: "query",
              required: true,
              schema: {
                type: "integer",
              },
            },
            {
              name: "toMs",
              in: "query",
              required: true,
              schema: {
                type: "integer",
              },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: {
                type: "integer",
              },
            },
            {
              name: "cursor",
              in: "query",
              required: false,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Raw samples",
            },
          },
        },
      },
      "/health/summary/daily": {
        get: {
          tags: ["summary"],
          summary: "Get deterministic daily summary",
          operationId: "healthSummaryDaily",
          parameters: [
            {
              name: "day",
              in: "query",
              required: true,
              schema: {
                type: "string",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              },
            },
            {
              name: "timezone",
              in: "query",
              required: false,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Daily summary",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/DataEnvelope",
                  },
                },
              },
            },
          },
        },
      },
      "/health/summary/range": {
        get: {
          tags: ["summary"],
          summary: "Get deterministic range summary",
          operationId: "healthSummaryRange",
          parameters: [
            {
              name: "from",
              in: "query",
              required: true,
              schema: {
                type: "string",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              },
            },
            {
              name: "to",
              in: "query",
              required: true,
              schema: {
                type: "string",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              },
            },
            {
              name: "timezone",
              in: "query",
              required: false,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Range summary",
            },
          },
        },
      },
      "/health/summary/yesterday": {
        get: {
          tags: ["summary"],
          summary: "Get yesterday summary",
          operationId: "healthSummaryYesterday",
          parameters: [
            {
              name: "timezone",
              in: "query",
              required: false,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Yesterday summary",
            },
          },
        },
      },
      "/health/query": {
        post: {
          tags: ["summary"],
          summary: "Execute an intent-based health query",
          description:
            "AI-ergonomic endpoint. Send a structured intent + typed parameters for deterministic summaries.",
          operationId: "healthQuery",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthStructuredQueryRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Structured query result",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/DataEnvelope",
                  },
                },
              },
            },
          },
        },
      },
      "/health/write-intents": {
        post: {
          tags: ["write-intents"],
          summary: "Upsert a write intent",
          operationId: "healthWriteIntentUpsert",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthWriteIntentPayload",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Upserted write intent",
            },
          },
        },
      },
      "/health/write-intents/pending": {
        get: {
          tags: ["write-intents"],
          summary: "List pending write intents",
          operationId: "healthWriteIntentPending",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: true,
              schema: {
                type: "integer",
              },
            },
            {
              name: "cursor",
              in: "query",
              required: false,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Pending write intents",
            },
          },
        },
      },
      "/health/write-intents/ack": {
        post: {
          tags: ["write-intents"],
          summary: "Acknowledge write intent apply result",
          operationId: "healthWriteIntentAck",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthWriteIntentAckRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Acknowledged write intent",
            },
          },
        },
      },
      "/health/capabilities": {
        get: {
          tags: ["meta"],
          summary: "Discover summary and write capabilities",
          operationId: "healthCapabilities",
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            "200": {
              description: "Capabilities",
            },
          },
        },
      },
      "/health/openapi.json": {
        get: {
          tags: ["meta"],
          summary: "Get OpenAPI specification",
          operationId: "healthOpenApi",
          security: [],
          responses: {
            "200": {
              description: "OpenAPI document",
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
      schemas: {
        HealthMetric: {
          type: "string",
          enum: [
            "step_count",
            "active_energy_kcal",
            "dietary_energy_kcal",
            "resting_heart_rate_bpm",
            "hrv_sdnn_ms",
            "body_mass_kg",
            "body_fat_percent",
            "sleep_segment",
          ],
        },
        DataEnvelope: {
          type: "object",
          properties: {
            data: {
              type: "object",
            },
            meta: {
              type: "object",
            },
          },
          required: ["data", "meta"],
        },
        HealthIngestSample: {
          type: "object",
          required: ["sampleKey", "metric", "startTimeMs", "endTimeMs", "unit", "timezone"],
          properties: {
            sampleKey: { type: "string" },
            metric: { $ref: "#/components/schemas/HealthMetric" },
            startTimeMs: { type: "integer" },
            endTimeMs: { type: "integer" },
            valueNumber: { type: "number" },
            categoryValue: {
              type: "string",
              enum: ["inBed", "asleep", "awake", "asleepREM", "asleepCore", "asleepDeep"],
            },
            unit: { type: "string" },
            sourceName: { type: "string" },
            sourceBundleId: { type: "string" },
            timezone: { type: "string" },
          },
        },
        HealthIngestRequest: {
          type: "object",
          required: ["deviceId", "samples"],
          properties: {
            deviceId: { type: "string" },
            samples: {
              type: "array",
              items: { $ref: "#/components/schemas/HealthIngestSample" },
            },
          },
        },
        HealthIngestResponse: {
          type: "object",
          required: ["inserted", "deduped", "recomputedDays", "serverTimeMs"],
          properties: {
            inserted: { type: "integer" },
            deduped: { type: "integer" },
            recomputedDays: { type: "array", items: { type: "string" } },
            serverTimeMs: { type: "integer" },
          },
        },
        HealthWriteIntentPayload: {
          type: "object",
          required: [
            "externalId",
            "metric",
            "startTimeMs",
            "endTimeMs",
            "valueNumber",
            "unit",
            "timezone",
          ],
          properties: {
            externalId: { type: "string" },
            metric: {
              type: "string",
              enum: ["active_energy_kcal", "dietary_energy_kcal"],
            },
            startTimeMs: { type: "integer" },
            endTimeMs: { type: "integer" },
            valueNumber: { type: "number" },
            unit: { type: "string" },
            timezone: { type: "string" },
            note: { type: "string" },
            sourceName: { type: "string" },
            sourceBundleId: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
        HealthStructuredQueryRequest: {
          oneOf: [
            {
              type: "object",
              required: ["intent", "day"],
              properties: {
                intent: {
                  type: "string",
                  const: "daily_summary",
                },
                day: {
                  type: "string",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                },
                timezone: {
                  type: "string",
                },
                utterance: {
                  type: "string",
                },
              },
            },
            {
              type: "object",
              required: ["intent", "from", "to"],
              properties: {
                intent: {
                  type: "string",
                  const: "range_summary",
                },
                from: {
                  type: "string",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                },
                to: {
                  type: "string",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                },
                timezone: {
                  type: "string",
                },
                utterance: {
                  type: "string",
                },
              },
            },
            {
              type: "object",
              required: ["intent"],
              properties: {
                intent: {
                  type: "string",
                  const: "yesterday_summary",
                },
                timezone: {
                  type: "string",
                },
                utterance: {
                  type: "string",
                },
              },
            },
          ],
        },
        HealthWriteIntentAckRequest: {
          type: "object",
          required: ["externalId", "status"],
          properties: {
            externalId: { type: "string" },
            status: { type: "string", enum: ["applied", "failed", "skipped"] },
            appliedAtMs: { type: "integer" },
            healthkitUuid: { type: "string" },
            errorCode: { type: "string" },
            errorMessage: { type: "string" },
          },
        },
      },
    },
  };
}
