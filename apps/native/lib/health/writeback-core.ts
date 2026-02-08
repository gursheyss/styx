import type { HealthWriteIntent } from "./types";

export type HealthWriteBackResult = {
  totalPulled: number;
  applied: number;
  failed: number;
  skipped: number;
};

type WriteBackDependencies = {
  requestWritePermissions: () => Promise<boolean>;
  listPending: (args: { limit: number; cursor?: string }) => Promise<{
    data: {
      items: HealthWriteIntent[];
      nextCursor: string | null;
    };
  }>;
  applyToHealthKit: (intent: HealthWriteIntent) => Promise<{
    status: "applied" | "failed" | "skipped";
    healthkitUuid?: string;
    errorCode?: string;
    errorMessage?: string;
  }>;
  ack: (request: {
    externalId: string;
    status: "applied" | "failed" | "skipped";
    appliedAtMs?: number;
    healthkitUuid?: string;
    errorCode?: string;
    errorMessage?: string;
  }) => Promise<unknown>;
};

const DEFAULT_PAGE_SIZE = 50;

export async function runHealthWriteBackWithDependencies(
  dependencies: WriteBackDependencies,
): Promise<HealthWriteBackResult> {
  const permissionsGranted = await dependencies.requestWritePermissions();
  if (!permissionsGranted) {
    return {
      totalPulled: 0,
      applied: 0,
      failed: 0,
      skipped: 0,
    };
  }

  let cursor: string | undefined;
  let isDone = false;

  let totalPulled = 0;
  let applied = 0;
  let failed = 0;
  let skipped = 0;

  while (!isDone) {
    const page = await dependencies.listPending({
      limit: DEFAULT_PAGE_SIZE,
      cursor,
    });

    const intents = page.data.items;
    totalPulled += intents.length;

    for (const intent of intents) {
      const applyResult = await dependencies.applyToHealthKit(intent);
      await dependencies.ack({
        externalId: intent.externalId,
        status: applyResult.status,
        appliedAtMs: applyResult.status === "applied" ? Date.now() : undefined,
        healthkitUuid: applyResult.healthkitUuid,
        errorCode: applyResult.errorCode,
        errorMessage: applyResult.errorMessage,
      });

      if (applyResult.status === "applied") {
        applied += 1;
      } else if (applyResult.status === "failed") {
        failed += 1;
      } else {
        skipped += 1;
      }
    }

    cursor = page.data.nextCursor === null ? undefined : page.data.nextCursor;
    isDone = cursor === undefined;
  }

  return {
    totalPulled,
    applied,
    failed,
    skipped,
  };
}
