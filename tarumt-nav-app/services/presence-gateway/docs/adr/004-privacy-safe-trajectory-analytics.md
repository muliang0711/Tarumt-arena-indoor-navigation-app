# ADR 004: Privacy-safe trajectory analytics boundary

## Status

Accepted for Stage 5.1.

## Context

Realtime presence retains only the latest route-relative position. Stage 5
adds durable trajectory analytics, but anonymous installation identity must not
become a permanent tracking identifier. Analytics failures must also remain
outside the WebSocket, occupancy, and Redis hot-state boundaries.

## Decision

The durable contract is `domain.TrajectoryEvent`. It contains an opaque event
ID, an opaque journey ID, route-relative location, movement state, and UTC
observation/ingestion timestamps. It never contains installation ID, device
reference, session ID, access token, IP address, or raw Wi-Fi/sensor samples.

A journey begins when a device first publishes presence after having no active
presence and ends on `leave`, expiry, or disconnect cleanup. Its random
128-bit identifier is retained only for correlating points inside that journey;
it is never reused for a later navigation. Stage 5.2 persists this ID as
internal hot-state metadata and appends the accepted event to Redis Streams.
The ID is deliberately omitted from public presence JSON.

Application code depends only on application ports. `PresenceStore` owns the
combined hot-state/trajectory mutation needed for one atomic acceptance point,
while `TrajectoryEventLog` remains the narrow append boundary. Redis Streams
and the ClickHouse warehouse remain infrastructure adapters. Stream
delivery is at least once, so event ID is the idempotency identity used by the
warehouse consumer.

The warehouse's raw trajectory retention defaults to 30 days. Public query
APIs expose only time-bucketed aggregates and suppress cohorts
smaller than five journeys. Operational logs and metrics may contain event IDs
but not journey IDs.

This decision selects Redis Streams and ClickHouse for Stage 5, superseding the
non-binding Kafka/PostgreSQL forecast in ADR 003.

## Consequences

- Flutter continues to communicate only with Go HTTP/WebSocket APIs.
- Authentication identity cannot be joined directly to durable trajectories.
- Journey generation and stream append must share the accepted presence
  lifecycle so reconnects do not create long-lived cross-journey identity.
- At-least-once duplicates are expected and removed by event ID downstream.
- Individual trajectory query endpoints are forbidden; only aggregates leave
  the analytics service boundary.
