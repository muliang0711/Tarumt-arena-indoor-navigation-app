# ADR 003: One shared Redis backend for multiple Go gateways

## Status

Accepted for Stage 3.

## Context

The Stage 2 memory adapters work while every client connects to one Go process.
With multiple gateway processes, each process would otherwise have a different
session list, presence snapshot, floor count, and event broker. A session
created through one gateway could not be authenticated by another gateway.

Redis must remain a private backend implementation detail. Flutter should not
contain a Redis client, credentials, key names, or knowledge of the selected
storage backend.

## Decision

Multiple Go gateway instances use one shared logical Redis service. Flutter
continues to communicate only through the existing Go HTTP and WebSocket APIs.
Go application services depend on storage and broker ports; only the Redis
infrastructure package imports `go-redis`.

Redis stores temporary anonymous sessions, the latest presence per session,
sorted-set activity indexes, floor counts, and stable representative ranks.
Lua scripts atomically compare sequence numbers and update presence indexes.
Redis Pub/Sub carries ephemeral floor events between gateway instances, while
each gateway retains only its own live WebSocket connection registry.

Pub/Sub delivery is not treated as durable. A gateway that reconnects its
Redis floor subscription emits an internal resynchronization event, causing
its WebSocket clients to receive a fresh authoritative floor snapshot.

## Consequences

- A session created through gateway A can be authenticated by gateway B.
- Users connected to different gateways receive the same floor updates.
- Flutter remains unchanged if memory, Redis, or a future adapter is selected.
- Redis credentials and ports remain private and must not be exposed publicly.
- Redis is an operational dependency in multi-instance mode; readiness returns
  unavailable when Redis or an active Pub/Sub subscription is unhealthy.
- A production Redis deployment may use replication or a managed failover
  service while remaining one logical backend. Redis Cluster hash-slot support
  is not part of Stage 3 because the atomic Lua scripts update multiple keys.
- Durable history and analytics remain the responsibility of Kafka and
  PostgreSQL in a later stage.
