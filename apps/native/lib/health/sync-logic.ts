import { HealthApiError } from "./errors";
import { HEALTH_CURSOR_OVERLAP_MS } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function buildCursorWindow(lastSuccessfulEndTimeMs: number, nowMs: number): {
  fromMs: number;
  toMs: number;
} {
  if (lastSuccessfulEndTimeMs <= 0) {
    return {
      fromMs: 0,
      toMs: nowMs,
    };
  }

  const fromMs = Math.max(0, lastSuccessfulEndTimeMs - HEALTH_CURSOR_OVERLAP_MS);
  return {
    fromMs,
    toMs: nowMs,
  };
}

export function shouldRetryHealthError(error: unknown): boolean {
  if (error instanceof HealthApiError) {
    if (error.statusCode === null) {
      return true;
    }

    if (error.statusCode === 408 || error.statusCode === 425 || error.statusCode === 429) {
      return true;
    }

    return error.statusCode >= 500;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("temporar") ||
      message.includes("failed to fetch")
    );
  }

  return false;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
): Promise<T> {
  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxAttempts || !shouldRetryHealthError(error)) {
        throw error;
      }

      const waitMs = Math.min(8000, 500 * 2 ** (attempt - 1));
      await sleep(waitMs);
    }
  }
}
