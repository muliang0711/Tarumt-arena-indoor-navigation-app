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

    subgraph Monitoring["Infrastructure monitoring"]
        Grafana["Grafana"]
        Prometheus["Prometheus"]
        NodeExporter["Node Exporter"]
        CAdvisor["cAdvisor"]
        RedisExporter["Redis Exporter"]
    end

    Mobile -->|"HTTPS maps + anonymous session<br/>authenticated WebSocket"| Gateway
    Operator -->|"SSH tunnel to loopback-only UI"| Grafana
    Grafana -->|"PromQL"| Prometheus
    Prometheus -->|"private /metrics"| Gateway
    Prometheus -->|"private /metrics"| Worker
    Prometheus -->|"private /metrics"| Analytics
    Prometheus --> NodeExporter
    Prometheus --> CAdvisor
    Prometheus --> RedisExporter
    RedisExporter --> Redis
    Consumer -.->|"aggregate HTTPS queries<br/>not wired to Flutter today"| Analytics

    Gateway -->|"hot state, Pub/Sub,<br/>trajectory + lifecycle Streams"| Redis
    Redis -->|"Consumer Groups"| Worker
    Worker -->|"batch inserts"| ClickHouse
    Analytics -->|"SELECT-only aggregate queries"| ClickHouse
```

The solid mobile edge is deployed. The monitoring edge is implemented in the
production Compose model and becomes active when that revision is deployed.
The dashed analytics-client edge marks the intended caller boundary; exposing
it is a deployment decision, not part of the current Flutter integration.
Operators do not connect directly to exporter or Go-service metric endpoints.

## Deployable and network topology

```mermaid
flowchart TB
    Internet["Tailscale Funnel / ingress"]

    subgraph Host["Single-host CMP deployment"]
        GatewayLoopback["127.0.0.1:8080"]
        GrafanaLoopback["127.0.0.1:3000"]

        subgraph IngressNet["ingress network"]
            Gateway["presence-gateway :8080"]
            Grafana["grafana :3000"]
        end

        subgraph AppNet["internal application network"]
            Redis[("redis :6379")]
            Worker["trajectory-worker :9091"]
            ClickHouse[("clickhouse :9000")]
            Analytics["analytics-api :9092"]
            RedisExporter["redis-exporter :9121"]
            Prometheus["prometheus :9090"]
        end

        subgraph MonitoringNet["internal monitoring network"]
            NodeExporter["node-exporter :9100"]
            CAdvisor["cadvisor :8080"]
        end

        MapData[("read-only map-data volume")]
        CHData[("ClickHouse volume")]
        PromData[("Prometheus volume")]
        GrafanaData[("Grafana volume")]
    end

    Operator["Operator SSH client"] -->|"SSH port forwarding"| GrafanaLoopback --> Grafana
    Internet --> GatewayLoopback --> Gateway
    Gateway --> Redis
    Gateway --> MapData
    Worker --> Redis
    Worker --> ClickHouse
    Analytics --> ClickHouse
    ClickHouse --> CHData
    RedisExporter --> Redis
    Prometheus -->|"scrapes application metrics"| Gateway
    Prometheus --> Worker
    Prometheus --> Analytics
    Prometheus --> RedisExporter
    Prometheus --> NodeExporter
    Prometheus --> CAdvisor
    Grafana -->|"queries over monitoring network"| Prometheus
    Prometheus --> PromData
    Grafana --> GrafanaData
```

The Gateway bridges the application and ingress networks. Prometheus bridges
the application and monitoring networks, while Grafana bridges monitoring and
ingress. Only the Gateway and Grafana have host-published ports, and both bind
to loopback. Tailscale Funnel exposes only the Gateway; Grafana requires an SSH
tunnel. Redis, ClickHouse, the Worker, the Analytics API, Prometheus, and all
exporters have no host-published port.

ClickHouse, Prometheus, and Grafana use named volumes. The current single-host
Compose configuration deliberately runs Redis without AOF or snapshots on
`tmpfs`, so its hot state and unconsumed Stream entries do not survive a Redis
container or host restart; the deployment runbook records this durability
limit.

## Production observability

```mermaid
flowchart LR
    VM["GCE VM kernel and filesystem"] --> Node["Node Exporter"]
    Docker["Docker containers and cgroups"] --> CAdvisor["cAdvisor"]
    Redis[("Redis")] --> RedisExporter["Redis Exporter"]
    Go["Go services /metrics"] --> Prometheus["Prometheus"]
    Node --> Prometheus
    CAdvisor --> Prometheus
    RedisExporter --> Prometheus
    Prometheus --> Grafana["Grafana<br/>Infrastructure Overview"]
    Operator["Operator browser"] -->|"SSH tunnel<br/>127.0.0.1:3000"| Grafana
```

Node Exporter owns VM-level CPU, memory, load, uptime, and filesystem signals.
cAdvisor owns per-container CPU, working-set memory, filesystem, network, start
time, and liveness signals. Prometheus also scrapes the three Go services and
Redis Exporter across the private application network. The provisioned Grafana
dashboard derives restart observations from changes in container start time.

Prometheus scrapes every 15 seconds and is bounded by both time and storage-size
retention settings. Prometheus and Grafana state survive container replacement
in named volumes. Monitoring cannot affect the Flutter request path: exporters
are read-only observers, and an unavailable monitoring container is not a
dependency of the Gateway, Worker, Analytics API, Redis, or ClickHouse.

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
