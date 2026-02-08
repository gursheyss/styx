export { registerHealthBackgroundSync } from "./background";
export { runHealthSync, getLastSyncSummary } from "./sync";
export { buildCursorWindow, shouldRetryHealthError } from "./sync-logic";
export {
  isHealthKitAvailable,
  isHealthKitSupportedPlatform,
  requestHealthKitReadPermissions,
} from "./healthkit-client";
export type { HealthSyncRunResult } from "./sync";
export type { HealthIngestSample, HealthMetric, HealthSyncSummary } from "./types";
