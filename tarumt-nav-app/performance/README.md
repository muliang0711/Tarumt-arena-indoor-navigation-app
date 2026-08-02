# Performance validation

This directory is a non-production test harness. It produces load and observes
the existing services; it does not sit in the Flutter or server request path.

## What is measured

- k6 owns offered load, client-visible errors, WebSocket acknowledgement
  latency, and HTTP p50/p95/p99.
- Presence Gateway metrics own HTTP status/latency, active WebSockets, and
  accepted/rejected/failed message handling.
- Worker metrics own Redis Stream lag/pending, recovery, insert throughput,
  and dead-letter or trim signals.
- Analytics API metrics own query duration, concurrency rejection, and
  ClickHouse rows/bytes scanned.
- Redis and ClickHouse exporters expose dependency-level evidence.

The existence of a metric does not mean a performance test has passed. A
capacity claim is valid only when a named scenario, parameters, machine, k6
summary, service metrics, and correctness checks are recorded together.

## Run

```sh
cd performance
make up
make smoke
make steady
make churn
make burst
make stress
make journey-stress
make analytics
make recovery
make verify
make down
```

`make baseline` runs steady, churn, burst, analytics, and the final correctness
check. Raw output is written under `results/` and intentionally ignored by Git
because results are machine-specific. The reviewed baseline is summarized in
`../docs/performance/stage-5.5-baseline.md`.
The shared floor projection before/after comparison and the downstream
worker/ClickHouse limit it exposed are recorded in
`../docs/performance/stage-5.6-gateway-projection-improvement.md`.
The bounded worker micro-batching change and its controlled before/after
evidence are recorded in
`../docs/performance/stage-5.7-worker-micro-batching-improvement.md`.
The canonical Journey lifecycle delivery and final Journey-aware stress result
are recorded in
`../docs/performance/stage-6-journey-lifecycle-delivery-report.md`.

Grafana is available at `http://127.0.0.1:23000` and Prometheus at
`http://127.0.0.1:29090`. Grafana anonymous viewer access is enabled only in
this loopback-bound local stack.

## Override load safely

Each scenario has a laptop-safe default. Override values through `K6_ENV`:

```sh
make run SCENARIO=presence_steady \
  K6_ENV="-e VUS=250 -e RAMP_UP=1m -e DURATION=5m -e RAMP_DOWN=30s"
```

Change one variable at a time when locating a saturation point. Do not compare
results from different machines or Docker resource limits as if they were the
same experiment.

## Profiles

- `presence_smoke`: protocol and instrumentation sanity check.
- `presence_steady`: stable concurrent navigation sessions.
- `presence_churn`: rapid session creation, connect, leave, and disconnect.
- `trajectory_burst`: update rate above steady state to expose Stream backlog.
- `trajectory_stress`: increasing arrival rate used to locate the first
  saturation signal; crossing a threshold is a valid experimental result.
- `journey_lifecycle_stress`: the same increasing arrival shape using the
  canonical Journey start, 20 route-relative locations, and Journey end.
- `analytics_reads`: concurrent privacy-safe aggregate queries.
- `recovery`: worker stopped during a bounded burst, restarted, then required
  to drain lag and pending entries.

The default thresholds are initial engineering budgets, not production capacity
guarantees. Stress results are allowed to cross a threshold when the purpose is
to find the saturation point; the report must state that explicitly.
