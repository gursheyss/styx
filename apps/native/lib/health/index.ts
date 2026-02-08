export { registerHealthBackgroundSync } from "./background";
export { runHealthSync, getLastSyncSummary } from "./sync";
export { runHealthWriteBack } from "./writeback";
export { buildCursorWindow, shouldRetryHealthError } from "./sync-logic";
export {
  applyWriteIntentToHealthKit,
  isHealthKitAvailable,
  isHealthKitSupportedPlatform,
  requestHealthKitReadPermissions,
  requestHealthKitWritePermissions,
} from "./healthkit-client";
export type { HealthSyncRunResult } from "./sync";
export type { HealthIngestSample, HealthMetric, HealthSyncSummary } from "./types";
