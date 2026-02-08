import { describe, expect, test } from "bun:test";

import {
  mapSleepCategoryValue,
  normalizeQuantitySamples,
  normalizeSleepSamples,
} from "./normalize";

const BASE_SOURCE = {
  sourceRevision: {
    source: {
      name: "Apple Watch",
      bundleIdentifier: "com.apple.health",
    },
  },
};

describe("mapSleepCategoryValue", () => {
  test("maps known HealthKit values to canonical values", () => {
    expect(mapSleepCategoryValue(0)).toBe("inBed");
    expect(mapSleepCategoryValue(1)).toBe("asleep");
    expect(mapSleepCategoryValue(2)).toBe("awake");
    expect(mapSleepCategoryValue(3)).toBe("asleepCore");
    expect(mapSleepCategoryValue(4)).toBe("asleepDeep");
    expect(mapSleepCategoryValue(5)).toBe("asleepREM");
  });

  test("returns null for unknown value", () => {
    expect(mapSleepCategoryValue(99)).toBeNull();
  });
});

describe("normalizeQuantitySamples", () => {
  test("converts quantity samples to ingest payload", () => {
    const samples = normalizeQuantitySamples(
      "step_count",
      [
        {
          uuid: "quantity-1",
          startDate: new Date(Date.UTC(2025, 0, 1, 10, 0, 0)),
          endDate: new Date(Date.UTC(2025, 0, 1, 10, 5, 0)),
          quantity: 250,
          unit: "count",
          ...BASE_SOURCE,
        },
      ],
      "America/Los_Angeles",
    );

    expect(samples).toHaveLength(1);
    expect(samples[0]).toEqual({
      sampleKey: "step_count:quantity-1",
      metric: "step_count",
      startTimeMs: Date.UTC(2025, 0, 1, 10, 0, 0),
      endTimeMs: Date.UTC(2025, 0, 1, 10, 5, 0),
      valueNumber: 250,
      unit: "count",
      sourceName: "Apple Watch",
      sourceBundleId: "com.apple.health",
      timezone: "America/Los_Angeles",
    });
  });
});

describe("normalizeSleepSamples", () => {
  test("converts sleep categories and skips unknown categories", () => {
    const start = Date.UTC(2025, 0, 1, 0, 0, 0);
    const samples = normalizeSleepSamples(
      [
        {
          uuid: "sleep-1",
          startDate: new Date(start),
          endDate: new Date(start + 60_000),
          value: 5,
          ...BASE_SOURCE,
        },
        {
          uuid: "sleep-2",
          startDate: new Date(start + 60_000),
          endDate: new Date(start + 120_000),
          value: 99,
          ...BASE_SOURCE,
        },
      ],
      "UTC",
    );

    expect(samples).toHaveLength(1);
    expect(samples[0].categoryValue).toBe("asleepREM");
    expect(samples[0].sampleKey).toBe("sleep_segment:sleep-1");
  });
});
