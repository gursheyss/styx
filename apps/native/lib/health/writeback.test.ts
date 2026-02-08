import { describe, expect, test } from "bun:test";

import type { HealthWriteIntent } from "./types";
import { runHealthWriteBackWithDependencies } from "./writeback-core";

function intent(overrides: Partial<HealthWriteIntent>): HealthWriteIntent {
  return {
    intentId: "intent-1",
    externalId: "ext-1",
    metric: "dietary_energy_kcal",
    startTimeMs: 1_700_000_000_000,
    endTimeMs: 1_700_000_030_000,
    valueNumber: 400,
    unit: "kcal",
    timezone: "America/Los_Angeles",
    tags: [],
    status: "pending",
    attemptCount: 0,
    createdAtMs: 1_700_000_000_000,
    updatedAtMs: 1_700_000_000_000,
    nextRetryAtMs: 1_700_000_000_000,
    ...overrides,
  };
}

describe("runHealthWriteBackWithDependencies", () => {
  test("returns zero counters when write permissions are denied", async () => {
    const result = await runHealthWriteBackWithDependencies({
      requestWritePermissions: async () => false,
      listPending: async () => ({
        data: {
          items: [],
          nextCursor: null,
        },
      }),
      applyToHealthKit: async () => ({
        status: "skipped",
      }),
      ack: async () => ({
        data: {
          intent: intent({}),
        },
        meta: {},
      }),
    });

    expect(result).toEqual({
      totalPulled: 0,
      applied: 0,
      failed: 0,
      skipped: 0,
    });
  });

  test("processes paginated intents and acknowledges each apply result", async () => {
    const pendingPages: Record<string, { items: HealthWriteIntent[]; nextCursor: string | null }> = {
      start: {
        items: [
          intent({ intentId: "i-1", externalId: "e-1" }),
          intent({ intentId: "i-2", externalId: "e-2" }),
        ],
        nextCursor: "cursor-2",
      },
      "cursor-2": {
        items: [intent({ intentId: "i-3", externalId: "e-3" })],
        nextCursor: null,
      },
    };

    const acknowledged: string[] = [];

    const result = await runHealthWriteBackWithDependencies({
      requestWritePermissions: async () => true,
      listPending: async (args) => ({
        data: pendingPages[args.cursor ?? "start"] ?? {
          items: [],
          nextCursor: null,
        },
      }),
      applyToHealthKit: async (writeIntent) => {
        if (writeIntent.externalId === "e-1") {
          return {
            status: "applied",
            healthkitUuid: "hk-1",
          };
        }

        if (writeIntent.externalId === "e-2") {
          return {
            status: "failed",
            errorCode: "mock_failure",
            errorMessage: "mock failed apply",
          };
        }

        return {
          status: "skipped",
          errorCode: "mock_skipped",
          errorMessage: "mock skipped apply",
        };
      },
      ack: async (request) => {
        acknowledged.push(`${request.externalId}:${request.status}`);
        return {
          data: {
            intent: intent({
              externalId: request.externalId,
              status: request.status,
            }),
          },
          meta: {},
        };
      },
    });

    expect(result).toEqual({
      totalPulled: 3,
      applied: 1,
      failed: 1,
      skipped: 1,
    });
    expect(acknowledged).toEqual(["e-1:applied", "e-2:failed", "e-3:skipped"]);
  });
});
