import { describe, expect, test } from "bun:test";

import { createHealthWriteIntentHttpHandlers } from "./healthWriteIntentHttpHandlers";
import type { HealthWriteIntent } from "./healthTypes";

function authHeaders(token?: string): HeadersInit {
  if (token === undefined) {
    return {
      "content-type": "application/json",
    };
  }

  return {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

function seedIntent(overrides: Partial<HealthWriteIntent>): HealthWriteIntent {
  return {
    intentId: "intent-1",
    externalId: "external-1",
    metric: "dietary_energy_kcal",
    startTimeMs: 1_735_689_600_000,
    endTimeMs: 1_735_690_200_000,
    valueNumber: 500,
    unit: "kcal",
    timezone: "America/Los_Angeles",
    tags: [],
    status: "pending",
    attemptCount: 0,
    createdAtMs: 1_735_689_600_000,
    updatedAtMs: 1_735_689_600_000,
    nextRetryAtMs: 1_735_689_600_000,
    ...overrides,
  };
}

describe("health write-intent handlers", () => {
  test("supports upsert, pending list and ack lifecycle", async () => {
    const intents = new Map<string, HealthWriteIntent>();

    const handlers = createHealthWriteIntentHttpHandlers({
      getExpectedBearerToken: () => "test-token",
      upsertWriteIntent: async ({ intent }) => {
        const existing = intents.get(intent.externalId);
        const nextIntent = seedIntent({
          ...existing,
          ...intent,
          intentId: existing?.intentId ?? `intent-${intents.size + 1}`,
          status: "pending",
          updatedAtMs: Date.now(),
        });
        intents.set(nextIntent.externalId, nextIntent);
        return {
          created: existing === undefined,
          intent: nextIntent,
        };
      },
      listPendingWriteIntents: async ({ limit, cursor }) => {
        const start = cursor === undefined ? 0 : Number(cursor);
        const pending = Array.from(intents.values()).filter((intent) => intent.status === "pending");
        const items = pending.slice(start, start + limit);
        const nextCursor = start + limit >= pending.length ? null : String(start + limit);
        return {
          items,
          nextCursor,
        };
      },
      ackWriteIntent: async (args) => {
        const intent = intents.get(args.externalId);
        if (intent === undefined) {
          throw new Error("Intent not found");
        }

        const updated: HealthWriteIntent =
          args.status === "applied"
            ? {
                ...intent,
                status: "applied",
                appliedAtMs: args.appliedAtMs ?? Date.now(),
                healthkitUuid: args.healthkitUuid,
                updatedAtMs: Date.now(),
              }
            : args.status === "skipped"
              ? {
                  ...intent,
                  status: "skipped",
                  updatedAtMs: Date.now(),
                }
              : {
                  ...intent,
                  status: "pending",
                  attemptCount: intent.attemptCount + 1,
                  failureCode: args.errorCode,
                  failureMessage: args.errorMessage,
                  updatedAtMs: Date.now(),
                };

        intents.set(updated.externalId, updated);
        return {
          intent: updated,
        };
      },
    });

    const upsert = await handlers.handleCreateIntent(
      new Request("https://example.com/health/write-intents", {
        method: "POST",
        headers: authHeaders("test-token"),
        body: JSON.stringify({
          externalId: "external-1",
          metric: "dietary_energy_kcal",
          startTimeMs: 1_735_689_600_000,
          endTimeMs: 1_735_690_200_000,
          valueNumber: 650,
          unit: "kcal",
          timezone: "America/Los_Angeles",
        }),
      }),
    );
    expect(upsert.status).toBe(200);

    const pending = await handlers.handleListPending(
      new Request("https://example.com/health/write-intents/pending?limit=10", {
        headers: authHeaders("test-token"),
      }),
    );
    expect(pending.status).toBe(200);
    const pendingJson = await pending.json();
    expect(pendingJson.data.items.length).toBe(1);

    const ack = await handlers.handleAckIntent(
      new Request("https://example.com/health/write-intents/ack", {
        method: "POST",
        headers: authHeaders("test-token"),
        body: JSON.stringify({
          externalId: "external-1",
          status: "applied",
          healthkitUuid: "hk-sample-uuid",
        }),
      }),
    );
    expect(ack.status).toBe(200);
    const ackJson = await ack.json();
    expect(ackJson.data.intent.status).toBe("applied");
    expect(ackJson.data.intent.healthkitUuid).toBe("hk-sample-uuid");
  });

  test("returns 401 when auth token is missing", async () => {
    const handlers = createHealthWriteIntentHttpHandlers({
      getExpectedBearerToken: () => "test-token",
      upsertWriteIntent: async () => {
        throw new Error("unused");
      },
      listPendingWriteIntents: async () => ({
        items: [],
        nextCursor: null,
      }),
      ackWriteIntent: async () => {
        throw new Error("unused");
      },
    });

    const response = await handlers.handleListPending(
      new Request("https://example.com/health/write-intents/pending?limit=10"),
    );

    expect(response.status).toBe(401);
  });
});
