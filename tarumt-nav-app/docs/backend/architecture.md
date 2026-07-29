# Backend architecture

This view shows the current service boundaries, deployment topology, and
internal dependency direction. See [data flows](data-flow.md) for runtime
sequences and [schema flow](schema-flow.md) for storage details.

## System context

```mermaid
flowchart LR
    Mobile["Flutter mobile app"]
    Operator["Operator / monitoring"]
    Consumer["Approved analytics consumer<br/>(future connection)"]

    subgraph Backend["Campus Navigator backend"]
        Gateway["Presence Gateway"]
        Worker["Trajectory Worker"]
        Analytics["Analytics API"]
        Redis[("Redis")]
        ClickHouse[("ClickHouse")]
    end

    Mobile -->|"HTTPS maps + anonymous session<br/>authenticated WebSocket"| Gateway
    Operator -->|"health and Prometheus metrics"| Gateway
    Operator -->|"private health and metrics"| Worker
    Operator -->|"private health and metrics"| Analytics
    Consumer -.->|"aggregate HTTPS queries<br/>not wired to Flutter today"| Analytics

    Gateway -->|"hot state, Pub/Sub,<br/>trajectory + lifecycle Streams"| Redis
    Redis -->|"Consumer Groups"| Worker
    Worker -->|"batch inserts"| ClickHouse
    Analytics -->|"SELECT-only aggregate queries"| ClickHouse
```

The solid client edge is implemented and deployed. The dashed analytics-client
edge marks the intended caller boundary; exposing it is a deployment decision,
not part of the current Flutter integration.

## Deployable and network topology

```mermaid
flowchart TB
    Internet["Tailscale Funnel / ingress"]

    subgraph Host["Single-host CMP deployment"]
        Loopback["127.0.0.1:8080"]

        subgraph IngressNet["ingress network"]
            Gateway["presence-gateway :8080"]
        end

        subgraph AppNet["internal application network"]
            Redis[("redis :6379")]
            Worker["trajectory-worker :9091"]
            ClickHouse[("clickhouse :9000")]
            Analytics["analytics-api :9092"]
        end

        MapData[("read-only map-data volume")]
        CHData[("ClickHouse volume")]
    end

    Internet --> Loopback --> Gateway
    Gateway --> Redis
    Gateway --> MapData
    Worker --> Redis
    Worker --> ClickHouse
    Analytics --> ClickHouse
    ClickHouse --> CHData
```

Only the Gateway joins both networks. Redis, ClickHouse, the Worker operational
server, and the Analytics API have no host-published port in the production
Compose file. ClickHouse uses a named volume. The current single-host Compose
configuration deliberately runs Redis without AOF or snapshots on `tmpfs`, so
its hot state and unconsumed Stream entries do not survive a Redis container or
host restart; the deployment runbook records this durability limit.

## Presence Gateway modules

```mermaid
flowchart LR
    subgraph Transport["Transport adapters"]
        HTTP["HTTP router<br/>maps, sessions, health, metrics"]
        WS["WebSocket handler + session runner"]
        Protocol["versioned protocol codec"]
    end

    subgraph Application["Application services"]
        Sessions["SessionService"]
        Journeys["JourneyService"]
        Presences["PresenceService"]
        Occupancy["OccupancyService"]
        Projections["LiveFloorProjectionManager"]
        Expiry["ExpiryService"]
    end

    subgraph Domain["Domain and validation"]
        Models["Session, Journey, Presence,<br/>Position, Occupancy"]
        MapGraph["canonical map graph registry"]
    end

    subgraph Ports["Application ports"]
        StorePorts["session, Journey, presence,<br/>occupancy stores"]
        BrokerPort["realtime broker"]
        ServicePorts["identity, token, clock, ID"]
    end

    subgraph Infrastructure["Infrastructure adapters"]
        RedisAdapters["Redis stores + Lua scripts<br/>+ Pub/Sub broker"]
        MemoryAdapters["in-memory backend<br/>(development/tests)"]
        Auth["HMAC identity + JWT"]
        MapCatalog["map bundle catalog"]
    end

    HTTP --> Sessions
    HTTP --> MapCatalog
    WS --> Protocol
    WS --> Sessions
    WS --> Journeys
    WS --> Presences
    WS --> Projections
    Expiry --> Journeys
    Expiry --> Presences
    Projections --> Occupancy

    Sessions --> Models
    Journeys --> Models
    Journeys --> MapGraph
    Presences --> Models
    Occupancy --> Models

    Sessions --> StorePorts
    Journeys --> StorePorts
    Presences --> StorePorts
    Presences --> BrokerPort
    Occupancy --> StorePorts
    Projections --> BrokerPort
    Sessions --> ServicePorts

    StorePorts --> RedisAdapters
    StorePorts --> MemoryAdapters
    BrokerPort --> RedisAdapters
    BrokerPort --> MemoryAdapters
    ServicePorts --> Auth
```

Application services depend on ports rather than Redis directly. Production
composition selects the Redis adapters; the memory backend supports isolated
development and tests. Redis Lua scripts own multi-key atomic transitions such
as Journey start/end and presence-plus-trajectory writes.

## Trajectory Worker modules

```mermaid
flowchart TB
    Runtime["composition.Runtime"]

    subgraph PipelineA["Trajectory pipeline"]
        TConsumer["Redis EventSource<br/>trajectory Consumer Group"]
        TIngestion["IngestionService<br/>strict validation + micro-batch"]
        TRepo["TrajectoryRepository"]
    end

    subgraph PipelineB["Journey lifecycle pipeline"]
        JConsumer["Redis EventSource<br/>lifecycle Consumer Group"]
        JIngestion["JourneyIngestionService<br/>strict validation + micro-batch"]
        JRepo["JourneyLifecycleRepository"]
    end

    Ops["Operational HTTP server<br/>live, ready, metrics"]
    Redis[("Redis Streams")]
    ClickHouse[("ClickHouse")]

    Runtime --> TIngestion
    Runtime --> JIngestion
    Runtime --> Ops
    Redis --> TConsumer --> TIngestion --> TRepo --> ClickHouse
    Redis --> JConsumer --> JIngestion --> JRepo --> ClickHouse
```

The two pipelines run concurrently inside one binary. They have separate
Stream keys, Consumer Groups, batch settings, repositories, dead-letter
Streams, and metrics. A failure returned by either pipeline or the operational
server cancels the shared runtime so the process can restart as one unit.

## Analytics API modules

```mermaid
flowchart LR
    Caller["Approved caller"]
    Router["HTTP router<br/>query parsing, deadlines,<br/>concurrency guard"]
    Service["AnalyticsService<br/>policy and response shaping"]
    Port["AnalyticsRepository port"]
    Adapter["ClickHouse adapter<br/>FINAL + uniqExact"]
    Warehouse[("trajectory_events_v1")]

    Caller --> Router --> Service --> Port --> Adapter --> Warehouse
```

Privacy controls exist at more than one layer: the transport rejects forbidden
identity filters, SQL suppresses cohorts below the server threshold, and the
application service repeats the threshold check before serialization. The
ClickHouse account used by this service is SELECT-only.

## Cross-cutting operational boundaries

| Concern | Presence Gateway | Trajectory Worker | Analytics API |
| --- | --- | --- | --- |
| Public application interface | maps, session HTTP, presence WebSocket | none | implemented aggregate HTTP; private in current deployment |
| Liveness | `/health/live` | `/health/live` | `/health/live` |
| Readiness dependency | Redis | Redis and both ClickHouse tables | ClickHouse trajectory table |
| Metrics | `/metrics` | `/metrics`, separate pipeline prefixes | `/metrics` |
| Scale unit | Gateway replica | Worker process; two internal pipelines | API replica |
| Primary failure isolation | realtime request path | asynchronous ingestion | read-only analytics |
