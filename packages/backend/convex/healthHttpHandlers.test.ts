import { describe, expect, test } from "bun:test";

import { createHealthHttpHandlers } from "./healthHttpHandlers";
import type { HealthIngestRequest, HealthIngestSample, HealthMetric } from "./healthTypes";

type InMemoryState = {
  raw: HealthIngestSample[];
  daily: {
    dayKey: string;
    inserted: number;
  }[];
};

function sample(metric: HealthMetric, sampleKey: string, startTimeMs: number): HealthIngestSample {
  if (metric === "sleep_segment") {
    return {
      sampleKey,
      metric,
      startTimeMs,
      endTimeMs: startTimeMs + 60_000,
      categoryValue: "asleep",
      unit: "ms",
      timezone: "UTC",
    };
  }

  return {
    sampleKey,
    metric,
    startTimeMs,
    endTimeMs: startTimeMs + 60_000,
    valueNumber: 1,
    unit: "count",
    timezone: "UTC",
  };
}

function dayKeyFromMs(timestampMs: number): string {
  const date = new Date(timestampMs);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createHandlers(state: InMemoryState, token = "test-token") {
  return createHealthHttpHandlers({
    getExpectedBearerToken: () => token,
    ingest: async (request: HealthIngestRequest) => {
      let inserted = 0;
      let deduped = 0;
      const recomputedDays = new Set<string>();

      for (const incoming of request.samples) {
        const exists = state.raw.some((existing) => existing.sampleKey === incoming.sampleKey);
        if (exists) {
          deduped += 1;
          continue;
        }

        state.raw.push(incoming);
        inserted += 1;
        recomputedDays.add(dayKeyFromMs(incoming.startTimeMs));
      }

      for (const dayKey of recomputedDays) {
        const dayCount = state.raw.filter((entry) => dayKeyFromMs(entry.startTimeMs) === dayKey).length;
        const existing = state.daily.find((entry) => entry.dayKey === dayKey);
        if (existing === undefined) {
          state.daily.push({ dayKey, inserted: dayCount });
        } else {
          existing.inserted = dayCount;
        }
      }

      state.daily.sort((left, right) => left.dayKey.localeCompare(right.dayKey));

      return {
        inserted,
        deduped,
        recomputedDays: Array.from(recomputedDays).sort(),
        serverTimeMs: Date.now(),
      };
    },
    listDaily: async (args) => ({
      items: state.daily
        .filter((entry) => entry.dayKey >= args.from && entry.dayKey <= args.to)
        .sort((left, right) => left.dayKey.localeCompare(right.dayKey)),
    }),
    listRaw: async (args) => {
      const filtered = state.raw
        .filter(
          (item) =>
            item.metric === args.metric &&
            item.startTimeMs >= args.fromMs &&
            item.startTimeMs <= args.toMs,
        )
        .sort((left, right) => left.startTimeMs - right.startTimeMs);

      const startIndex = args.cursor === undefined ? 0 : Number(args.cursor);
      const slice = filtered.slice(startIndex, startIndex + args.limit);
      const nextCursor =
        startIndex + args.limit >= filtered.length ? null : String(startIndex + args.limit);

      return {
        items: slice,
        nextCursor,
      };
    },
  });
}

function authHeaders(token?: string): HeadersInit {
  if (token === undefined) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

describe("health HTTP handlers auth", () => {
  test("returns 401 when token is missing", async () => {
    const state: InMemoryState = { raw: [], daily: [] };
    const handlers = createHandlers(state);

    const response = await handlers.handleDaily(
      new Request("https://example.com/health/daily?from=2025-01-01&to=2025-01-02"),
    );

    expect(response.status).toBe(401);
  });

  test("returns 403 when token is invalid", async () => {
    const state: InMemoryState = { raw: [], daily: [] };
    const handlers = createHandlers(state);

    const response = await handlers.handleDaily(
      new Request("https://example.com/health/daily?from=2025-01-01&to=2025-01-02", {
        headers: authHeaders("wrong-token"),
      }),
    );

    expect(response.status).toBe(403);
  });

  test("returns 200 when token is valid", async () => {
    const state: InMemoryState = { raw: [], daily: [] };
    const handlers = createHandlers(state);

    const response = await handlers.handleDaily(
      new Request("https://example.com/health/daily?from=2025-01-01&to=2025-01-02", {
        headers: authHeaders("test-token"),
      }),
    );

    expect(response.status).toBe(200);
  });
});

describe("health ingest idempotency", () => {
  test("dedupes duplicate sample keys on second ingest", async () => {
    const state: InMemoryState = { raw: [], daily: [] };
    const handlers = createHandlers(state);
    const requestBody = {
      deviceId: "ios-device-1",
      samples: [sample("step_count", "sample-key-1", Date.UTC(2025, 0, 1, 10, 0, 0))],
    };

    const first = await handlers.handleIngest(
      new Request("https://example.com/health/ingest", {
        method: "POST",
        headers: authHeaders("test-token"),
        body: JSON.stringify(requestBody),
      }),
    );

    const second = await handlers.handleIngest(
      new Request("https://example.com/health/ingest", {
        method: "POST",
        headers: authHeaders("test-token"),
        body: JSON.stringify(requestBody),
      }),
    );

    const firstJson = await first.json();
    const secondJson = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstJson.inserted).toBe(1);
    expect(firstJson.deduped).toBe(0);
    expect(secondJson.inserted).toBe(0);
    expect(secondJson.deduped).toBe(1);
  });
});

describe("health daily list behavior", () => {
  test("respects range bounds and returns day order", async () => {
    const state: InMemoryState = {
      raw: [],
      daily: [
        { dayKey: "2025-01-03", inserted: 3 },
        { dayKey: "2025-01-01", inserted: 1 },
        { dayKey: "2025-01-02", inserted: 2 },
      ],
    };
    const handlers = createHandlers(state);

    const response = await handlers.handleDaily(
      new Request("https://example.com/health/daily?from=2025-01-01&to=2025-01-02", {
        headers: authHeaders("test-token"),
      }),
    );

    const parsed = await response.json();

    expect(response.status).toBe(200);
    expect(parsed.items).toEqual([
      { dayKey: "2025-01-01", inserted: 1 },
      { dayKey: "2025-01-02", inserted: 2 },
    ]);
  });
});

describe("health raw pagination behavior", () => {
  test("returns nextCursor and paginates deterministically", async () => {
    const start = Date.UTC(2025, 0, 1, 0, 0, 0);
    const state: InMemoryState = {
      raw: [
        sample("step_count", "s-1", start),
        sample("step_count", "s-2", start + 60_000),
        sample("step_count", "s-3", start + 120_000),
      ],
      daily: [],
    };
    const handlers = createHandlers(state);

    const first = await handlers.handleRaw(
      new Request(
        `https://example.com/health/raw?metric=step_count&fromMs=${start}&toMs=${start + 500_000}&limit=2`,
        {
          headers: authHeaders("test-token"),
        },
      ),
    );

    const firstJson = await first.json();
    expect(first.status).toBe(200);
    expect(firstJson.items.length).toBe(2);
    expect(firstJson.nextCursor).toBe("2");

    const second = await handlers.handleRaw(
      new Request(
        `https://example.com/health/raw?metric=step_count&fromMs=${start}&toMs=${start + 500_000}&limit=2&cursor=${firstJson.nextCursor}`,
        {
          headers: authHeaders("test-token"),
        },
      ),
    );

    const secondJson = await second.json();
    expect(second.status).toBe(200);
    expect(secondJson.items.length).toBe(1);
    expect(secondJson.nextCursor).toBeNull();
  });
});
