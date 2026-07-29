# Backend documentation

This documentation describes the implemented backend as of 2026-07-29. It
covers the three Go deployables and their Redis and ClickHouse dependencies.
Flutter is shown only where it crosses a backend boundary.

## Diagram set

| View | Use it to answer |
| --- | --- |
| [Backend architecture](architecture.md) | Which processes exist, how are they deployed, and where are the module boundaries? |
| [Backend data flows](data-flow.md) | How do maps, sessions, live presence, Journey lifecycle, ingestion, and analytics requests move through the system? |
| [Backend schema flow](schema-flow.md) | Which logical records exist, where are they retained, and how do wire events become ClickHouse rows? |

All diagrams are written as Mermaid source inside Markdown so they remain
reviewable and version controlled with the implementation.

## Scope and terminology

The runtime has three Go deployables:

1. **Presence Gateway** — the public backend boundary for map delivery,
   anonymous sessions, authenticated WebSockets, Journey commands, presence,
   and live-floor projections.
2. **Trajectory Worker** — one process containing two independent Redis Stream
   ingestion pipelines: trajectory observations and Journey lifecycle events.
3. **Analytics API** — a read-only aggregate query service over ClickHouse.

Redis and ClickHouse are private infrastructure. The production Compose model
publishes only the Presence Gateway to host loopback; the worker, Analytics
API, Redis, and ClickHouse stay on the internal application network. The
Analytics API is implemented but is not connected to Flutter in the current
stage.

Capitalized **Journey** terms use the definitions in the repository
[domain language](../../CONTEXT.md). In particular, a session authenticates a
client connection, while a Journey represents one navigation attempt.

## Sources of truth

The diagrams summarize code and contracts; they do not replace them:

- Presence protocol: [`services/presence-gateway/api`](../../services/presence-gateway/api)
- Analytics contract: [`contracts/analytics/v1/openapi.yaml`](../../contracts/analytics/v1/openapi.yaml)
- Event contracts: [`contracts/trajectory/v1`](../../contracts/trajectory/v1)
  and [`contracts/journey/v1`](../../contracts/journey/v1)
- Redis keys and atomicity:
  [`services/presence-gateway/docs/redis-keyspace.md`](../../services/presence-gateway/docs/redis-keyspace.md)
- ClickHouse DDL:
  [`services/trajectory-worker/migrations`](../../services/trajectory-worker/migrations)
- Deployment:
  [`deploy/compose.production.yaml`](../../deploy/compose.production.yaml)

The longer
[implemented schema and redesign context](../architecture/current-schema-flow-and-redesign-context.md)
records rationale, compatibility behavior, limitations, and future derived
facts. Future-state ideas from that document are intentionally excluded from
the diagrams here.
