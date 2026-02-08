import { ackHealthWriteIntent, listPendingHealthWriteIntents } from "./api";
import { applyWriteIntentToHealthKit, requestHealthKitWritePermissions } from "./healthkit-client";
import { runHealthWriteBackWithDependencies, type HealthWriteBackResult } from "./writeback-core";

export type { HealthWriteBackResult };

export async function runHealthWriteBack(): Promise<HealthWriteBackResult> {
  return runHealthWriteBackWithDependencies({
    requestWritePermissions: requestHealthKitWritePermissions,
    listPending: listPendingHealthWriteIntents,
    applyToHealthKit: applyWriteIntentToHealthKit,
    ack: ackHealthWriteIntent,
  });
}
