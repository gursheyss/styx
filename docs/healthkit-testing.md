---
summary: Test strategy and commands for HealthKit ingest, summaries, OpenAPI, and two-way write intent sync.
read_when:
  - Running or extending health sync tests
  - Validating ingest auth/idempotency/pagination behavior
  - Verifying iOS manual sync and background behavior
---

# HealthKit Sync Testing Notes

## Automated gates

### Backend domain unit tests
- Day key bucketing with timezone-aware boundaries.
- Metric aggregation correctness for numeric metrics.
- Sleep stage rollup correctness (`inBed`, `awake`, `asleep*`).
- Sample key validation behavior.

### Backend HTTP/integration tests
- Auth matrix:
  - missing bearer -> `401`
  - wrong bearer -> `403`
  - valid bearer -> `200`
- Capabilities + structured query:
  - `/health/capabilities` requires auth and advertises query/write affordances.
  - `/health/query` validates typed intents and range bounds.
- Ingest idempotency:
  - first post inserts
  - second post dedupes by `sampleKey`
- Daily query:
  - range bounds respected
  - ascending date order
- Raw query:
  - metric/range filtering
  - cursor pagination and `nextCursor`
- Write-intent queue:
  - create/upsert lifecycle by `externalId`
  - pending pagination
  - ack transitions (`applied`, `failed`, `skipped`)
- OpenAPI:
  - includes protected ingest/read/summary/write paths and schemas.

### Native pure TypeScript tests
- HealthKit sample normalization mapping to canonical ingest samples.
- Cursor overlap and update rules.
- Retry classifier behavior for transient/non-transient failures.
- Write-back orchestration pagination + ack behavior.

## Manual iOS verification checklist
- Permission flow succeeds and denied state is handled.
- First run performs full backfill.
- Second run performs incremental sync with 24h overlap dedupe.
- Background best-effort task can sync when iOS permits.
- Non-iOS platforms remain safe (unsupported UI, no crashes).

## Commands
- Root checks: `bun run check-types`
- Backend tests: `bun run -F @styx/backend test`
- Native pure logic tests: `bun run -F native test`
- Full health-focused suite: `bun run test:health`
