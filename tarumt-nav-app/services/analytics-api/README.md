# Aggregate Analytics API

The Analytics API is an independently deployable, read-only Go service for
privacy-safe campus traffic aggregates. It queries ClickHouse and never reads
Redis, accepts raw trajectory identifiers, or participates in realtime
presence handling.

```text
Flutter or an internal dashboard -> Analytics API -> ClickHouse
```

It is not connected to Flutter in Stage 5.4. A reverse proxy can expose the
approved endpoints later without giving clients ClickHouse credentials or
access to individual trajectories.

## Public contract

The versioned OpenAPI document is
`../../contracts/analytics/v1/openapi.yaml`.

- `GET /v1/analytics/floor-traffic`
- `GET /v1/analytics/route-edges`

Both require `building_id`, `floor_id`, aligned RFC3339 `from`/`to` values, and
a fixed `bucket` of `15m`, `1h`, or `1d`. The default maximum window is seven
days. Results are never silently truncated: a query exceeding the server row
bound returns `422 result_too_large` so the caller can request a narrower
window.

Identity and trajectory parameters including `journey_id`, `event_id`,
`session_id`, `device_ref`, and arbitrary filters are rejected. ClickHouse SQL
suppresses groups below five distinct journeys, and the application layer
repeats that check before serialization.

## Query correctness

Queries read the raw `trajectory_events_v1` table with `FINAL`, group in UTC,
and use `uniqExact` for event and journey counts. This preserves correctness
under the worker's at-least-once insertion model. It is intentionally the
baseline implementation: no cache, materialized rollup, or projection is added
before measurements show a bottleneck.

The local Compose stack also gives this process a dedicated ClickHouse account
with `SELECT` permission only. Production must keep that credential boundary;
the Analytics API must never share the worker's write-capable account.

Traffic levels use server-owned thresholds:

- `quiet`: 5–9 journeys
- `moderate`: 10–24 journeys
- `busy`: 25 or more journeys

Clients cannot lower these or the privacy threshold.

## Operational endpoints

- `GET /health/live`
- `GET /health/ready` verifies ClickHouse and the configured raw table
- `GET /metrics` exposes Prometheus-format query metrics

Metrics include query duration histograms, failures, ClickHouse rows/bytes read,
result rows, defense-in-depth privacy filtering, total requests, and concurrency
rejections. These provide the evidence used in Stage 5.5 to decide whether a
projection, rollup table, cache, or additional replicas are justified.

## Local verification

```sh
make verify
make analytics-up
make integration-test
make api-up
# inspect http://127.0.0.1:19092/health/ready and /metrics
make analytics-down
```

The real ClickHouse test inserts duplicate raw events and separate four- and
five-journey route cohorts. It verifies exact deduplication, suppression of the
four-journey edge, visibility of the five-journey edge, and absence of identity
fields in the response.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANALYTICS_API_ADDRESS` | `:9092` | HTTP listener |
| `ANALYTICS_QUERY_TIMEOUT` | `3s` | Per-query deadline |
| `ANALYTICS_MAX_CONCURRENT_QUERIES` | `16` | ClickHouse concurrency guard |
| `ANALYTICS_MAX_QUERY_RANGE` | `168h` | Maximum requested window |
| `ANALYTICS_MAX_RESULT_ROWS` | `500` | Response row bound |
| `ANALYTICS_PRIVACY_THRESHOLD` | `5` | Minimum distinct journeys |
| `ANALYTICS_TRAFFIC_MODERATE_AT` | `10` | Moderate traffic threshold |
| `ANALYTICS_TRAFFIC_BUSY_AT` | `25` | Busy traffic threshold |
| `ANALYTICS_CLICKHOUSE_ADDRESS` | `localhost:9000` | Native ClickHouse endpoint |
| `ANALYTICS_CLICKHOUSE_DATABASE` | `campus_analytics` | Warehouse database |
| `ANALYTICS_CLICKHOUSE_USERNAME` | `default` | Warehouse user |
| `ANALYTICS_CLICKHOUSE_PASSWORD` | empty | Warehouse password |
| `ANALYTICS_CLICKHOUSE_TABLE` | `campus_analytics.trajectory_events_v1` | Raw source table |

Timeout, pool, and shutdown settings are defined in
`internal/config/config.go`. Invalid values fail startup.

## Current performance tradeoff

`FINAL` plus `uniqExact` is deliberately CPU- and scan-intensive compared with
pre-aggregated tables. Stage 5.5 will record p50/p95/p99 latency, scanned bytes,
concurrency saturation, and ClickHouse resource use. Optimization is approved
only when those measurements identify the limiting resource.
