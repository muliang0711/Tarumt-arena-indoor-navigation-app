# Redis keyspace and lifecycle

Redis is private infrastructure shared by all Presence Gateway instances. The
Flutter application never connects to it. Identifiers are Base64URL-encoded by
the keyspace adapter before they become key segments.

The default namespace is `campus:presence:v1` and can be changed with
`PRESENCE_REDIS_KEY_PREFIX`.

| Key shape | Type | Purpose |
| --- | --- | --- |
| `<prefix>:session:<session>` | String/JSON | Temporary anonymous session |
| `<prefix>:sessions:active` | Sorted set | Session ID scored by last-seen milliseconds |
| `<prefix>:sessions:expires` | Sorted set | Session ID scored by absolute expiry |
| `<prefix>:presence:<session>` | Hash | Latest presence payload and atomic sequence metadata |
| `<prefix>:presences:active` | Sorted set | Presence session ID scored by last-seen milliseconds |
| `<prefix>:building:<building>:active` | Sorted set | Active presence index for a building |
| `<prefix>:building:<building>:floors` | Set | Known encoded floor IDs for occupancy projection |
| `<prefix>:floor:<building>:<floor>:active` | Sorted set | Active presence index for one floor |
| `<prefix>:floor:<building>:<floor>:representatives` | Sorted set | Stable anonymous representative rank |
| `<prefix>:floor:<building>:<floor>:edges` | Set | Known canonical physical edge IDs for the floor |
| `<prefix>:floor:<building>:<floor>:edge:<edge>:active` | Sorted set | Active sessions on one direction-independent physical edge |
| `<prefix>:floor:<building>:<floor>:events` | Pub/Sub channel | Ephemeral cross-gateway floor events |
| `<prefix>:trajectory:events` | Stream | Privacy-safe accepted movement events for analytics consumers |
| `<prefix>:trajectory:dead-letter` | Stream | Permanently invalid events isolated by the trajectory worker |
| `<prefix>:journey:active:<device>` | String/JSON | One operational Active Journey for a private device reference |
| `<prefix>:journeys:active` | Sorted set | Active device references scored by their next expiry deadline |
| `<prefix>:journey:idempotency:<device>:<client-event>` | String/JSON | Cached command result for retry-safe ACKs |
| `<prefix>:journey:ended:<journey>` | String | Ended tombstone that prevents a Journey reopening |
| `<prefix>:journey:lifecycle:events` | Stream | Privacy-safe, append-only Journey lifecycle events |

## TTL and stale activity

Session records expire at their absolute session expiry. Presence records use a
longer safety-net TTL than the online stale threshold. User counts always query
sorted-set scores at or after `now - PRESENCE_STALE_AFTER`, so an overdue cleanup
cannot inflate an occupancy response.

The expiry service reads small stale batches from the global presence index and
uses an atomic removal script that rechecks last-seen time. Concurrent gateway
sweepers are safe: only the first successful removal returns the old presence
and publishes `presence_left`.

Occupancy reads prune stale session, building, floor, and edge index members. The
representative-selection script also removes stale rank members before choosing
up to ten active actors. This repairs secondary indexes after a prolonged Redis
or gateway outage even if a presence safety-net TTL expired first.

## Atomic writes

The embedded Lua scripts own operations that must not become separate network
round trips:

- Session creation writes the record, active index, and expiry index together.
- Session touch preserves absolute TTL and advances its active score.
- Presence apply rejects a non-increasing sequence and updates old/new floor
  and canonical physical-edge indexes in one Redis operation. A reversed
  `from_node_id`/`to_node_id` pair identifies the same edge. The same script preserves the active journey
  ID and appends its privacy-safe trajectory event to the Stream, so hot state
  and durable ingestion cannot disagree about an accepted update.
- Presence removal rechecks its cutoff and removes all known indexes together.
- Journey start, route recalculation, end, and expiry each execute as one Lua
  operation. Start can append an old `superseded` event and a new start
  together. End/expiry remove Presence and every occupancy index in the same
  operation as the lifecycle event and ended tombstone.
- Canonical location apply verifies the Active Journey, updates its freshness,
  writes Presence, and appends the trajectory event in one Lua operation. This
  prevents a concurrent end from racing a position back into the live map.

The trajectory Stream is shared by all gateway instances, just like the other
Redis state. `PRESENCE_TRAJECTORY_STREAM_KEY` can place it under a dedicated
key, while `PRESENCE_TRAJECTORY_STREAM_MAX_LENGTH` applies approximate bounded
retention. Only the analytics worker reads the Stream; Flutter continues
to communicate exclusively with the Go gateway. The independently deployed
trajectory worker uses a Redis Consumer Group and acknowledges entries only
after ClickHouse accepts its batch.

The Stage 3 scripts target a single Redis primary or a replicated/managed Redis
service. They intentionally do not claim Redis Cluster multi-slot compatibility.

## Pub/Sub recovery

One gateway floor hub owns one Redis subscription regardless of how many local
WebSocket clients watch that floor. If the Pub/Sub connection is interrupted,
the hub reconnects with exponential backoff, resubscribes, and emits an internal
`resync_required` event. The WebSocket layer then sends a fresh authoritative
`floor_snapshot`; Redis events are not replayed.
