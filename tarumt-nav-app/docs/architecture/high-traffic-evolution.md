# High-traffic architecture evolution

The system evolves from measurements, not from a predetermined list of
infrastructure products.

## Current architecture

```text
Flutter
  | HTTP + WebSocket
  v
Presence Gateway ---- Redis presence + Pub/Sub
  |
  +---- Redis Stream ---- trajectory worker ---- ClickHouse
                                                ^
                                                |
                                         Analytics API
```

Flutter never connects to Redis or ClickHouse. The Gateway owns realtime
commands and privacy-safe event creation. The worker owns asynchronous
ingestion. The Analytics API owns read-only aggregate queries.

Redis presence data and Pub/Sub are ephemeral realtime state. Redis Stream is
the current bounded handoff buffer. ClickHouse is the durable analytical store
in the current server design. The local performance Compose stack itself
disables production durability and must not be copied as a production data
configuration.

## Evolution checkpoints

### 1. Bound realtime fan-out

The first local stress test exposed same-floor broadcast amplification before
worker lag or Analytics API latency became the limiting signal. Optimize
snapshot sharing, delta coalescing, representative selection, and backpressure.

Stage 5.6 implements one shared floor projection per active Gateway/floor,
membership-only snapshot refresh, stable representative filtering, and
latest-wins movement coalescing. The identical stress workload reached 100%
ACK completion and reduced client-received WebSocket messages by 78.2%. The
additional accepted volume then exposed ineffective worker micro-batching and
ClickHouse tiny-part growth as the next measured boundary.

### 2. Scale stateless Gateway capacity

After fan-out is bounded, add multiple Gateway instances and a WebSocket-aware
load balancer when connection, CPU, memory, or availability evidence requires
it. All instances use the same Redis service and distinct instance IDs.

### 3. Harden Redis availability

Enable persistence suitable for the recovery objective, replicas, automatic
failover, backups, restore tests, and alerting. This is a production-readiness
requirement independent of whether more throughput is needed.

### 4. Scale ingestion from observed lag

Tune batching first, then add workers in the existing Consumer Group when
sustained lag and recovery time require it. Re-evaluate Kafka only when replay,
retention, durability, partitioning, or multiple independent consumers exceed
what Redis Streams can safely provide.

Stage 5.7 adds bounded application-level micro-batching: Redis still records
each accepted event independently, while the worker groups delivered messages
until a size or time boundary before one ClickHouse insert. ClickHouse success
still precedes `XACK`, and pre-ACK crashes remain recoverable from the Consumer
Group pending list.

### 5. Reduce analytical scan amplification

Use ClickHouse query statistics to add projections or materialized aggregates
for proven hot query shapes. Add caching for repeated windows and read replicas
for concurrent read saturation. Keep privacy thresholds in the application
boundary regardless of storage optimization.

## Why Kafka and PostgreSQL are deferred

Kafka adds a durable distributed event-log operating model but does not solve
the currently observed floor-broadcast bottleneck. Redis Streams already pass
the tested burst and worker-recovery workloads, so Kafka has no measured
benefit yet.

PostgreSQL is valuable for transactional relational data, but the current
trajectory workload is append-heavy and the read workload is aggregate-heavy.
ClickHouse matches that workload and exposes scan-cost evidence. PostgreSQL can
be introduced later for account, campus-management, or configuration data
without replacing the analytical pipeline.
