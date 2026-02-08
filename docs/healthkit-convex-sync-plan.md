---
read_when:
  - Implementing or modifying iOS HealthKit sync
  - Changing Convex health ingest/read APIs
  - Adjusting token auth, cursor semantics, or daily aggregation rules
---

# iOS HealthKit -> Convex Sync + Secret-Protected Personal API

## Summary
- Platform: iOS only in Expo native app.
- Scope: `step_count`, `sleep_segment`, `body_mass_kg`, `body_fat_percent`, `resting_heart_rate_bpm`, `hrv_sdnn_ms`, `active_energy_kcal`.
- Storage: raw samples plus day-level aggregates.
- Sync strategy: app open, manual sync, and best-effort background sync.
- First sync: backfill full available history.
- Day boundary: device local timezone at ingestion.
- API auth: bearer token for both ingest and reads.
- Native E2E UI automation: out of scope.

## Contracts
### Environment
- `.env.local`
  - `EXPO_PUBLIC_HEALTH_API_BASE_URL`
  - `EXPO_PUBLIC_HEALTH_API_TOKEN`
  - `PRIVATE_API_BEARER_TOKEN`
- Validation in `packages/env/src/native.ts`
  - `EXPO_PUBLIC_HEALTH_API_BASE_URL: z.url()`
  - `EXPO_PUBLIC_HEALTH_API_TOKEN: z.string().min(1)`

### Canonical metric type
- `step_count`
- `active_energy_kcal`
- `resting_heart_rate_bpm`
- `hrv_sdnn_ms`
- `body_mass_kg`
- `body_fat_percent`
- `sleep_segment`

### Ingest sample
- `sampleKey: string`
- `metric: HealthMetric`
- `startTimeMs: number`
- `endTimeMs: number`
- `valueNumber?: number`
- `categoryValue?: inBed | asleep | awake | asleepREM | asleepCore | asleepDeep`
- `unit: string`
- `sourceName?: string`
- `sourceBundleId?: string`
- `timezone: string`

### HTTP API
- `POST /health/ingest` (protected)
  - Upserts raw samples by `sampleKey`, dedupes idempotently.
  - Recomputes affected day aggregates.
  - Rejects oversized batches with `413`.
- `GET /health/daily?from=YYYY-MM-DD&to=YYYY-MM-DD` (protected)
  - Returns daily aggregates ordered by `dayKey` ascending.
- `GET /health/raw?metric=...&fromMs=...&toMs=...&limit=...&cursor=...` (protected)
  - Returns paginated raw samples with `nextCursor`.

## Backend design
- `healthRawSamples`
  - Unique sample key index (`by_sample_key`).
  - Query indexes: `by_metric_and_start`, `by_day_and_metric`.
- `healthDailyMetrics`
  - One row per day key.
  - Index: `by_day`.
- Internal-only convex functions expose ingest/list behavior.
- Public convex query/mutation surface does not expose health write/read data.

## Native behavior
- Non-iOS: show unsupported UI and skip HealthKit work.
- Cursor: per metric `lastSuccessfulEndTimeMs` in SecureStore.
- Windowing: always overlap by 24h; server dedupe handles duplicates.
- Retry: exponential backoff, max 3 attempts, transient failures only.
- Cursor update happens only after successful server ingest.

## Security assumptions
- Single-user personal deployment.
- One shared bearer token for reads/writes.
- Token comes from local `.env.local` in sideloaded builds.
- No OAuth/user auth in this phase.
