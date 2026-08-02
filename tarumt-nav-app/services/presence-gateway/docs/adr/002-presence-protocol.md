# ADR 002: Snapshot plus route-relative WebSocket deltas

## Status

Accepted for Stage 2.

## Context

Sending rendered coordinates every animation frame would create excessive
network traffic. Sending an entire future route to every client would move too
much simulation responsibility onto phones and would recover poorly after
disconnects.

The live map also needs occupancy for every floor while rendering no more than
ten stable anonymous representatives on the selected floor.

## Decision

The gateway sends an initial authoritative floor snapshot and then ordered
WebSocket deltas. A logical position contains building, floor, route-edge node
IDs, edge progress, heading, movement state, and a monotonic per-session
sequence. Flutter will resolve that position against its local map graph and
interpolate visually between updates.

The service deterministically selects at most ten representative sessions per
floor. It scopes subscriptions by building and floor, rejects stale sequences,
and uses bounded queues so slow clients cannot create unbounded process memory.

The observed floor and the sender's actual floor are independent. A
`subscribe_floor` message only selects which floor events the connection
receives. A `location_update` is routed according to the building and floor in
its position, even when the connection is observing another floor. The legacy
`change_floor` message remains a location-update alias for version 1 and no
longer changes the observation subscription.

## Consequences

- Reconnect recovery requires a new snapshot rather than event replay.
- Flutter and the gateway share node identifiers but not pixel coordinates.
- Movement traffic is lower than frame-by-frame server animation.
- Stage 3 can replace the in-process broker with Redis without changing the
  public protocol.
- Stage 4 must ignore per-actor deltas older than the actor's current sequence.
