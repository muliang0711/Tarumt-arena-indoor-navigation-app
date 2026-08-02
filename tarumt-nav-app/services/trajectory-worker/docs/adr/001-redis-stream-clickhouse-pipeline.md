# ADR 001: Redis Stream worker and ClickHouse raw warehouse

## Status

Accepted for Stage 5.3; extended for Journey lifecycle events in Stage 6.5.

## Context

The Presence Gateway owns latency-sensitive anonymous sessions, occupancy, and
WebSocket updates. Accepted route-relative movement is also useful for later
traffic, route, and congestion analytics, but ClickHouse availability must not
become part of Flutter request handling.

ADR 003 originally forecast Kafka and PostgreSQL before the event shape and
query workload were known. The concrete workload is append-heavy, time-based,
and aggregation-oriented. The gateway also already updates Redis hot state with
an atomic Lua script.

## Decision

Run a separate Go Trajectory Worker. The gateway atomically appends versioned,
privacy-safe events to a shared Redis Stream. A Redis Consumer Group distributes
events across worker replicas. Workers validate and batch-insert into a
ClickHouse `ReplacingMergeTree`, acknowledge only after a successful insert,
and reclaim abandoned pending messages after crashes.

The worker is a separate module and deployment unit. It does not import the
gateway's internal packages. The services share only the versioned JSON schema
under `contracts/trajectory/v1`.

Delivery is explicitly at least once. Redis acknowledgement failure can cause a
successful ClickHouse batch to be inserted again. Event ID is therefore carried
through every layer, raw queries use deduplication, and no component claims
exactly-once behavior.

Permanently invalid input moves to a dead-letter Stream through one Lua
operation with the source acknowledgement. The dead-letter record stores only
hash fingerprints and diagnostic metadata, never the rejected raw payload.

Journey lifecycle events reuse this infrastructure choice but not the same
queue. They have an independent Redis Stream, consumer group, bounded
micro-batch, ClickHouse repository, raw table, and metrics namespace inside the
existing worker process. This retains three Go deployables while preventing
high-frequency trajectory ingestion from owning lifecycle ACKs or lag. The raw
lifecycle table has a 30-day TTL and contains no session or device identity.

## Why not Kafka now

Redis Streams provides the currently required consumer groups, pending recovery,
bounded replay, and backpressure without introducing a Redis-to-Kafka dual-write
boundary. Kafka remains a valid later source adapter because the application
depends on `EventSource`, not Redis APIs.

Kafka adoption requires measured evidence such as:

- sustained lag after batch and worker-replica tuning;
- Stream trimming while the group has lag or pending messages;
- retention or replay requirements that exceed safe Redis memory/disk limits;
- multiple independent consumer products with different replay lifecycles;
- throughput that creates unacceptable gateway latency or Redis contention;
- regional durability requirements that the selected Redis deployment cannot
  satisfy.

## Why ClickHouse instead of PostgreSQL

Trajectory history is append-heavy and queried primarily by time range,
building, floor, route edge, and aggregate. ClickHouse columnar storage,
compression, partition pruning, and batch ingestion match this workload better
than a transactional row store. PostgreSQL remains appropriate for future
relational metadata, but it is not the raw event warehouse.

## Consequences

- Flutter and the public Gateway API remain unchanged.
- Gateway and Worker replicas scale independently.
- ClickHouse outages create visible Stream lag instead of blocking a worker
  from acknowledging data; the worker retries the same batch before reading
  more new events.
- Production Redis requires persistence, replication/failover, and lag/memory
  alerts. The local Compose environment is intentionally ephemeral.
- The first tuning sequence is batch size, worker replica count, ClickHouse
  insert capacity, and Redis resource limits. Infrastructure is changed only
  after metrics and load tests identify the limiting resource.
