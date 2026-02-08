import { describe, expect, test } from "bun:test";

import { HealthApiError } from "./errors";
import { buildCursorWindow, shouldRetryHealthError } from "./sync-logic";

describe("buildCursorWindow", () => {
  test("backfills from epoch on first sync", () => {
    const window = buildCursorWindow(0, 1_000_000);
    expect(window.fromMs).toBe(0);
    expect(window.toMs).toBe(1_000_000);
  });

  test("applies 24h overlap on incremental sync", () => {
    const lastCursor = 2 * 24 * 60 * 60 * 1000;
    const now = lastCursor + 60_000;
    const window = buildCursorWindow(lastCursor, now);

    expect(window.fromMs).toBe(24 * 60 * 60 * 1000);
    expect(window.toMs).toBe(now);
  });
});

describe("shouldRetryHealthError", () => {
  test("retries transient HTTP statuses", () => {
    expect(shouldRetryHealthError(new HealthApiError("rate limited", 429))).toBe(true);
    expect(shouldRetryHealthError(new HealthApiError("server error", 503))).toBe(true);
    expect(shouldRetryHealthError(new HealthApiError("timeout", 408))).toBe(true);
  });

  test("does not retry permanent HTTP statuses", () => {
    expect(shouldRetryHealthError(new HealthApiError("unauthorized", 401))).toBe(false);
    expect(shouldRetryHealthError(new HealthApiError("forbidden", 403))).toBe(false);
  });

  test("retries network-level errors", () => {
    expect(shouldRetryHealthError(new Error("Network request failed"))).toBe(true);
  });
});
