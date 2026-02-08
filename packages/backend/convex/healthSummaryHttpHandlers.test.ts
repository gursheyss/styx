import { describe, expect, test } from "bun:test";

import { createHealthSummaryHttpHandlers } from "./healthSummaryHttpHandlers";
import type { HealthDailySummary, HealthSummaryRange } from "./healthTypes";

function summary(dayKey: string): HealthDailySummary {
  return {
    dayKey,
    timezone: "America/Los_Angeles",
    metrics: {
      sleep: {
        sampleCount: 4,
        inBedHours: 8.2,
        asleepHours: 7.6,
        awakeHours: 0.3,
        remHours: 1.8,
        coreHours: 4.5,
        deepHours: 1.3,
        sleepEfficiency: 0.927,
      },
      activity: {
        stepCount: 10_200,
        activeCaloriesKcal: 700,
        dietaryCaloriesKcal: 2_250,
      },
      recovery: {
        restingHeartRateBpm: {
          average: 58,
          min: 55,
          max: 63,
          sampleCount: 3,
        },
        hrvSdnnMs: {
          average: 46,
          min: 40,
          max: 52,
          sampleCount: 3,
        },
      },
      body: {
        bodyMassKg: {
          average: 80.1,
          min: 79.9,
          max: 80.2,
          sampleCount: 2,
        },
        bodyFatPercent: {
          average: 15.8,
          min: 15.6,
          max: 16,
          sampleCount: 2,
        },
      },
    },
    derived: {
      calorieBalanceKcal: 1_550,
      activeCaloriesBand: "moderate",
      sleepBand: "target",
    },
    insights: [
      {
        code: "sleep_on_target",
        severity: "good",
        message: "Sleep duration was within the target range.",
      },
    ],
    recomputedAtMs: 1_735_689_600_000,
  };
}

function rangeSummary(from: string, to: string): HealthSummaryRange {
  return {
    from,
    to,
    timezone: "America/Los_Angeles",
    days: [summary(from), summary(to)],
    totals: {
      days: 2,
      totalSteps: 20_400,
      totalActiveCaloriesKcal: 1_400,
      totalDietaryCaloriesKcal: 4_500,
      averageSleepHours: 7.6,
      averageSleepEfficiency: 0.927,
    },
  };
}

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

const handlers = createHealthSummaryHttpHandlers({
  getExpectedBearerToken: () => "test-token",
  getDailySummary: async (args) => summary(args.day),
  getRangeSummary: async (args) => rangeSummary(args.from, args.to),
  getYesterdaySummary: async () => summary("2025-01-04"),
});

describe("health summary handler auth", () => {
  test("returns 401 for missing bearer token", async () => {
    const response = await handlers.handleDailySummary(
      new Request("https://example.com/health/summary/daily?day=2025-01-05"),
    );
    expect(response.status).toBe(401);
  });
});

describe("structured health query endpoint", () => {
  test("resolves daily summary intent", async () => {
    const response = await handlers.handleQuery(
      new Request("https://example.com/health/query", {
        method: "POST",
        headers: authHeaders("test-token"),
        body: JSON.stringify({
          intent: "daily_summary",
          day: "2025-01-05",
          timezone: "America/Los_Angeles",
          utterance: "How did I do yesterday?",
        }),
      }),
    );

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.intent).toBe("daily_summary");
    expect(json.data.summary.dayKey).toBe("2025-01-05");
    expect(json.meta.intent).toBe("daily_summary");
  });

  test("validates range intent boundaries", async () => {
    const response = await handlers.handleQuery(
      new Request("https://example.com/health/query", {
        method: "POST",
        headers: authHeaders("test-token"),
        body: JSON.stringify({
          intent: "range_summary",
          from: "2025-01-07",
          to: "2025-01-05",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(typeof json.error === "string" && json.error.includes("from must be <= to")).toBe(true);
  });

  test("rejects unknown intent values", async () => {
    const response = await handlers.handleQuery(
      new Request("https://example.com/health/query", {
        method: "POST",
        headers: authHeaders("test-token"),
        body: JSON.stringify({
          intent: "something_else",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });
});

describe("capabilities endpoint", () => {
  test("includes structured query capability", async () => {
    const response = await handlers.handleCapabilities(
      new Request("https://example.com/health/capabilities", {
        headers: authHeaders("test-token"),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.query.endpoint).toBe("/health/query");
    expect(json.data.summaries.length > 0).toBe(true);
    expect(json.data.writes.length > 0).toBe(true);
  });

  test("requires bearer auth", async () => {
    const response = await handlers.handleCapabilities(
      new Request("https://example.com/health/capabilities"),
    );
    expect(response.status).toBe(401);
  });
});
