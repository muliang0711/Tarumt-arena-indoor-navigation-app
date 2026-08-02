# Presence Gateway

The Presence Gateway is the realtime backend for Campus Navigator's live map.
It creates privacy-preserving anonymous sessions, maintains the latest
presence state, and streams floor-scoped snapshots and deltas over a versioned
WebSocket protocol. It supports process-local memory and a shared Redis backend
for multiple Go gateway instances.

## Architecture boundaries

```text
HTTP / WebSocket transport
        ↓ typed commands
Application services
        ↓ ports
Domain rules and ports
        ↑ implemented by
Memory or shared Redis adapters
```

- `internal/domain` contains pure session, position, occupancy, Journey, and
  lifecycle event rules.
- `internal/application` coordinates use cases and depends only on ports.
- `internal/infrastructure/memory` is the single-instance development adapter.
- `internal/infrastructure/redis` is the multi-instance store and Pub/Sub
  adapter. It is private server infrastructure and is never accessed by Flutter.
- `internal/composition` selects one backend without changing application code.
- `internal/transport/protocol` owns the stable WebSocket v1 wire contract.
- `internal/transport/websocket` owns connection lifetime, bounded queues,
  subscription switching, and graceful disconnect behavior.
- `internal/mapbundle` publishes and reads immutable, content-addressed map
  resources. Its Catalog Interface hides filesystem layout, allow-list checks,
  and integrity verification from HTTP transport.
- `api/openapi.yaml` documents HTTP endpoints.
- `api/asyncapi.yaml` documents WebSocket message flow.
- `docs/redis-keyspace.md` documents shared keys, TTL, and cleanup behavior.

The service sends route-relative positions rather than rendered pixels. Flutter
converts `from_node_id`, `to_node_id`, and `edge_progress` into map coordinates
and interpolates between network updates.

`subscribe_floor` selects the floor a connection observes. It does not claim
that the sender is physically on that floor. `location_update` independently
describes the sender's actual building and floor, so a person can navigate on
Floor 2 while inspecting the live map for Floor 3.

Flutter communicates only with the Go HTTP and WebSocket endpoints. Go validates
commands and decides what to store or publish. Redis URLs, credentials, keys,
Lua scripts, and channels never appear in the Flutter application.

## Local run

Two independent secrets are required. They must each contain at least 32
characters and must not be committed.

```sh
export PRESENCE_JWT_SECRET='replace-with-at-least-32-characters'
export PRESENCE_IDENTITY_HMAC_SECRET='replace-with-a-different-32-char-secret'
go run ./cmd/presence-gateway
```

The service listens on `:8080` by default.

For a same-Wi-Fi Android phone test, run this helper from the workspace root.
It generates temporary development secrets and listens on all interfaces:

```sh
./dev/run-phone-test-server.sh
```

The helper uses the in-memory backend unless `PRESENCE_BACKEND=redis` is
supplied.

The current Main Campus Map Bundle can be inspected locally with:

```sh
curl -i http://localhost:8080/v1/maps/main-campus/current
```

The response manifest names immutable assets below
`/v1/maps/main-campus/revisions/{bundle_revision}/`. The current manifest uses
`ETag` revalidation; revision assets use one-year immutable caching and support
HTTP byte ranges.

Operational endpoints are `GET /health/live`, `GET /health/ready`, and
`GET /metrics`. The Prometheus endpoint reports bounded-label HTTP latency and
status, active/opened/closed WebSockets, termination reasons, and accepted,
rejected, or failed message handling. It contains no installation IDs, session
IDs, actor IDs, building IDs, or floor IDs.

Create an anonymous session:

```sh
curl -sS http://localhost:8080/v1/anonymous-sessions \
  -H 'Content-Type: application/json' \
  -d '{"installation_id":"8f912e7e-918b-4455-9561-f4494c44ff75"}'
```

The raw installation ID is validated, transformed with HMAC-SHA256, and then
discarded. Logs and domain stores only see the derived reference.

### Shared Redis backend

Start the development Redis 8.4 service:

```sh
make redis-up
```

Run one gateway with Redis:

```sh
export PRESENCE_BACKEND=redis
export PRESENCE_REDIS_URL='redis://127.0.0.1:16379/0'
export PRESENCE_JWT_SECRET='replace-with-at-least-32-characters'
export PRESENCE_IDENTITY_HMAC_SECRET='replace-with-a-different-32-char-secret'
go run ./cmd/presence-gateway
```

Multiple gateway processes must use the same Redis URL, key prefix, JWT secret,
and identity secret. Each gateway should use a different `PRESENCE_INSTANCE_ID`.
Redis is one shared logical service, not one isolated Redis per gateway.

The Redis adapter stores temporary sessions, latest route-relative positions,
active Journeys, retry-safe command results, active-user indexes, floor counts,
and representative ranks. Redis Pub/Sub
relays ephemeral floor events between gateway instances. WebSocket connections
remain local to the gateway process that accepted them.

## Configuration

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `PRESENCE_ADDRESS` | `:8080` | HTTP listen address |
| `PRESENCE_BACKEND` | `memory` | `memory` or `redis` infrastructure adapter |
| `PRESENCE_JWT_SECRET` | required | Signs short-lived access tokens |
| `PRESENCE_IDENTITY_HMAC_SECRET` | required | Derives private device references |
| `PRESENCE_TOKEN_TTL` | `30m` | Access token lifetime |
| `PRESENCE_SESSION_TTL` | `8h` | Absolute anonymous session lifetime |
| `PRESENCE_HEARTBEAT_INTERVAL` | `15s` | Client heartbeat guidance |
| `PRESENCE_STALE_AFTER` | `45s` | Online/presence inactivity threshold |
| `PRESENCE_EXPIRY_SWEEP_INTERVAL` | `5s` | Stale-presence cleanup interval |
| `PRESENCE_WEBSOCKET_QUEUE_SIZE` | `64` | Per-client bounded output queue |
| `PRESENCE_BROKER_QUEUE_SIZE` | `64` | Per-floor subscriber event queue |
| `PRESENCE_PROJECTION_SUBSCRIBER_QUEUE_SIZE` | `64` | Shared floor projection to WebSocket queue |
| `PRESENCE_MOVEMENT_COALESCE_INTERVAL` | `200ms` | Latest-wins representative movement window |
| `PRESENCE_MEMBERSHIP_DEBOUNCE_INTERVAL` | `50ms` | Coalesces related membership events before one snapshot |
| `PRESENCE_MAX_REQUEST_BYTES` | `16384` | Anonymous-session request limit |
| `PRESENCE_MAX_WEBSOCKET_BYTES` | `16384` | WebSocket envelope limit |
| `PRESENCE_ALLOWED_ORIGINS` | same-origin | Optional comma-separated browser origins |
| `PRESENCE_MAP_DATA_ROOT` | `../../map-data` | Root containing published Map Bundle directories |
| `PRESENCE_REDIS_URL` | `redis://localhost:6379/0` | Shared Redis connection URL; supports `rediss://` |
| `PRESENCE_REDIS_KEY_PREFIX` | `campus:presence:v1` | Namespace for all service-owned Redis keys |
| `PRESENCE_REDIS_POOL_SIZE` | `20` | Redis connection pool capacity per gateway |
| `PRESENCE_REDIS_MIN_IDLE_CONNECTIONS` | `2` | Warm idle Redis connections |
| `PRESENCE_REDIS_DIAL_TIMEOUT` | `3s` | Redis connection timeout |
| `PRESENCE_REDIS_READ_TIMEOUT` | `2s` | Redis command read timeout |
| `PRESENCE_REDIS_WRITE_TIMEOUT` | `2s` | Redis command write timeout |
| `PRESENCE_REDIS_MAX_RETRIES` | `2` | Retry limit for Redis commands |
| `PRESENCE_REDIS_PRESENCE_TTL` | `3m` | Safety-net TTL for latest-presence records |
| `PRESENCE_TRAJECTORY_ENABLED` | `true` | Atomically append accepted movement events |
| `PRESENCE_TRAJECTORY_STREAM_KEY` | derived from key prefix | Optional Redis Stream key override |
| `PRESENCE_TRAJECTORY_STREAM_MAX_LENGTH` | `1000000` | Approximate retained Stream entry limit |
| `PRESENCE_JOURNEY_LIFECYCLE_STREAM_KEY` | derived from key prefix | Optional separate Journey lifecycle Stream key |
| `PRESENCE_JOURNEY_LIFECYCLE_STREAM_MAX_LENGTH` | `1000000` | Approximate lifecycle Stream entry limit |
| `PRESENCE_JOURNEY_IDEMPOTENCY_TTL` | `24h` | Retry result lifetime for `client_event_id` |
| `PRESENCE_JOURNEY_ENDED_TOMBSTONE_TTL` | `24h` | Prevents an ended Journey from reopening |
| `PRESENCE_JOURNEY_FIRST_POSITION_TIMEOUT` | `1m` | Expires a start that never publishes a position |
| `PRESENCE_INSTANCE_ID` | generated UUID | Distinguishes gateway event origins |

## Verification

```sh
make verify
```

This runs formatting, `go vet`, unit and integration tests, the race detector,
and a production binary build.

Run the real Redis and multi-gateway WebSocket integration suite:

```sh
make redis-up
make redis-test
make redis-down
```

The Redis suite verifies shared sessions, Lua sequence atomicity, floor-index
movement, privacy-safe trajectory Stream writes, duplicate rejection, stable
representative limits, Pub/Sub multiplexing, floor isolation, and two
independent HTTP/WebSocket gateways sharing one Redis service.

## Current limitations

- Redis Pub/Sub intentionally does not retain missed events; reconnect recovery
  sends a fresh floor snapshot.
- Stage 5.2 atomically appends every accepted movement update to a bounded
  Redis Stream using the privacy-safe contract in
  `docs/adr/004-privacy-safe-trajectory-analytics.md`. Stage 5.3 adds the
  independently deployable `../trajectory-worker` and raw ClickHouse storage;
  Stage 5.4 adds privacy-safe aggregate queries through `../analytics-api`.
- Stage 5.5 showed that the original same-floor event path amplified work
  across every subscriber and records that boundary in
  `../../docs/performance/stage-5.5-baseline.md`; Stage 5.6 replaces per-client
  raw processing with a shared floor projection and records the measured
  improvement in
  `../../docs/performance/stage-5.6-gateway-projection-improvement.md`.
