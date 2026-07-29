# Backend schema flow

This document connects domain records, Redis hot state, versioned Stream
contracts, and ClickHouse raw tables. It describes implemented storage only.
See [backend data flows](data-flow.md) for runtime ordering.

## Logical domain relationships

```mermaid
erDiagram
    INSTALLATION ||--o{ ANONYMOUS_SESSION : derives
    INSTALLATION ||--o| ACTIVE_JOURNEY : owns
    MAP_REVISION ||--o{ ACTIVE_JOURNEY : validates
    ACTIVE_JOURNEY ||--o{ JOURNEY_LIFECYCLE_EVENT : emits
    ACTIVE_JOURNEY ||--o| PRESENCE : has_latest
    ACTIVE_JOURNEY ||--o{ TRAJECTORY_EVENT : emits
    ANONYMOUS_SESSION ||--o| PRESENCE : authenticates

    INSTALLATION {
        string installation_id "client only"
        string device_ref "HMAC, backend only"
    }
    ANONYMOUS_SESSION {
        string session_id PK
        string device_ref
        datetime issued_at
        datetime expires_at
        datetime last_seen_at
    }
    MAP_REVISION {
        string map_id
        string revision "sha256 content ID"
        string nodes
        string edges
    }
    ACTIVE_JOURNEY {
        string journey_id PK
        string device_ref
        string client_journey_key
        string map_id
        string map_revision
        uint lifecycle_sequence
        uint route_revision
        string origin_node_id
        string destination_node_id
        string planned_edge_ids
        datetime started_at
        datetime position_deadline
    }
    PRESENCE {
        string session_id PK
        string journey_id
        string building_id
        string floor_id
        string from_node_id
        string to_node_id
        float edge_progress
        float heading
        string movement_state
        uint sequence
        datetime last_seen_at
    }
    JOURNEY_LIFECYCLE_EVENT {
        string event_id PK
        string event_type
        string journey_id
        uint lifecycle_sequence
        uint route_revision
        datetime occurred_at
        string outcome_or_reason
    }
    TRAJECTORY_EVENT {
        string event_id PK
        string journey_id
        string building_id
        string floor_id
        string from_node_id
        string to_node_id
        float edge_progress
        float heading
        string movement_state
        datetime observed_at
    }
```

`INSTALLATION` is conceptual: the raw installation ID remains on the client,
and the Gateway derives `device_ref` with HMAC. Redis may hold `device_ref` and
`session_id` for short-lived operational correctness. Neither identifier is
allowed in the two warehouse event contracts.

## Redis hot-state and handoff schema

The default prefix is `campus:presence:v1`. Dynamic identifiers in key
segments are Base64URL-encoded.

```mermaid
flowchart TB
    subgraph Sessions["Session state"]
        Session["session:{session}<br/>String / JSON"]
        SessionActive["sessions:active<br/>Sorted Set"]
        SessionExpiry["sessions:expires<br/>Sorted Set"]
    end

    subgraph Journeys["Journey state"]
        ActiveJourney["journey:active:{device}<br/>String / JSON"]
        ActiveJourneyIndex["journeys:active<br/>Sorted Set by deadline"]
        Idempotency["journey:idempotency:{device}:{client-event}<br/>String / JSON, 24h default"]
        Tombstone["journey:ended:{journey}<br/>String, TTL"]
    end

    subgraph Presence["Presence and occupancy"]
        Latest["presence:{session}<br/>Hash"]
        PresenceActive["presences:active<br/>Sorted Set"]
        Building["building:{building}:active<br/>Sorted Set"]
        Floors["building:{building}:floors<br/>Set"]
        Floor["floor:{building}:{floor}:active<br/>Sorted Set"]
        Representatives["floor:{building}:{floor}:representatives<br/>Sorted Set"]
        Edges["floor:{building}:{floor}:edges<br/>Set"]
        EdgeActive["floor:{building}:{floor}:edge:{edge}:active<br/>Sorted Set"]
    end

    subgraph Realtime["Transient distribution"]
        FloorEvents["floor:{building}:{floor}:events<br/>Pub/Sub"]
    end

    subgraph Handoff["Append-only handoff"]
        Trajectory["trajectory:events<br/>Stream"]
        Lifecycle["journey:lifecycle:events<br/>Stream"]
        TrajectoryDLQ["trajectory:dead-letter<br/>Stream"]
        LifecycleDLQ["journey:lifecycle:dead-letter<br/>Stream"]
    end

    Session --> SessionActive
    Session --> SessionExpiry
    Session --> Latest
    ActiveJourney --> ActiveJourneyIndex
    ActiveJourney --> Idempotency
    ActiveJourney --> Tombstone
    ActiveJourney --> Latest
    Latest --> PresenceActive
    Latest --> Building --> Floors --> Floor
    Floor --> Representatives
    Floor --> Edges --> EdgeActive
    Latest --> FloorEvents
    Latest --> Trajectory
    ActiveJourney --> Lifecycle
    Trajectory -.-> TrajectoryDLQ
    Lifecycle -.-> LifecycleDLQ
```

The arrows show logical maintenance, not separate network calls. Lua scripts
atomically update related keys so a Journey transition, presence state, index
membership, and Stream append cannot partially succeed. Sorted-set scores
encode last-seen times or expiry deadlines and support bounded stale sweeps.

### Redis retention classes

| Class | Examples | Retention behavior |
| --- | --- | --- |
| Expiring operational state | session, presence, active Journey, idempotency result, tombstone | TTL and/or deadline index; repaired by sweepers |
| Rebuildable secondary index | active, building, floor, edge, representative sets | pruned by writes and reads; derived from current state |
| Transient signal | floor Pub/Sub | no replay; subscriber resyncs from a snapshot |
| Asynchronous handoff buffer | trajectory and lifecycle Streams | approximate configured max length; Consumer Group ACK after ClickHouse insert |
| Diagnostic isolation | dead-letter Streams | fingerprints and reasons only; no rejected raw payload |

The Stream protocol provides recovery while Redis is running, but the current
single-host deployment configures Redis without disk persistence. Uninserted
events therefore do not survive a Redis or host restart. Persistent,
replicated Redis is an operational requirement for a production durability
claim.

## Contract-to-table transformation

```mermaid
flowchart LR
    subgraph Gateway["Presence Gateway"]
        AcceptedPosition["accepted Position"]
        JourneyTransition["validated Journey transition"]
        TEvent["TrajectoryEventV1 payload"]
        JEvent["JourneyLifecycleEventV1 payload"]
    end

    subgraph Redis["Redis Stream entry envelope"]
        TEnvelope["schema_version = 1<br/>event_id<br/>payload JSON"]
        JEnvelope["schema_version = 1<br/>event_id<br/>payload JSON"]
    end

    subgraph Worker["Trajectory Worker"]
        TValidate["strict trajectory decoder"]
        JValidate["strict lifecycle decoder"]
        TBatch["trajectory micro-batch"]
        JBatch["lifecycle micro-batch"]
    end

    subgraph Warehouse["ClickHouse"]
        TTable[("trajectory_events_v1")]
        JTable[("journey_lifecycle_events_v1")]
    end

    AcceptedPosition --> TEvent --> TEnvelope --> TValidate --> TBatch --> TTable
    JourneyTransition --> JEvent --> JEnvelope --> JValidate --> JBatch --> JTable
```

The worker rejects unknown schema versions, extra JSON fields, Stream/payload
event-ID mismatches, and forbidden identity fields. The Stream envelope is
transport metadata; its `schema_version` becomes a table column, while the JSON
payload supplies the remaining event columns.

## ClickHouse raw schemas

These are event tables, not current-state tables. Both have a 30-day TTL and
use `ReplacingMergeTree(ingested_at)`.

```mermaid
erDiagram
    JOURNEY_LIFECYCLE_EVENTS_V1 ||--o{ TRAJECTORY_EVENTS_V1 : "logical journey_id"

    JOURNEY_LIFECYCLE_EVENTS_V1 {
        uint16 schema_version
        string event_type
        string event_id
        string client_event_id "empty for server events"
        string journey_id
        string client_journey_key
        string map_id
        string map_revision
        uint64 lifecycle_sequence
        uint64 route_revision
        datetime occurred_at
        datetime ingested_at
        string origin_node_id "nullable"
        string destination_node_id "nullable"
        string planned_edge_ids "Array(String)"
        string reroute_reason
        string outcome
    }

    TRAJECTORY_EVENTS_V1 {
        uint16 schema_version
        string event_id
        string journey_id
        string building_id
        string floor_id
        string from_node_id
        string to_node_id
        float64 edge_progress
        float64 heading
        string movement_state
        datetime observed_at
        datetime ingested_at
    }
```

The relationship is analytical only: ClickHouse does not enforce a foreign
key, and lifecycle and trajectory ingestion can arrive independently.
Lifecycle start/recalculation rows carry planned route fields; end rows carry
an outcome. `reroute_reason`, `outcome`, and absent optional values are stored
as empty/default values according to the repository mapping.

### Physical behavior and query implications

```mermaid
flowchart LR
    Retry["at-least-once retry"]
    Physical["possible duplicate physical rows"]
    Replacing["ReplacingMergeTree<br/>background replacement"]
    Correct["correct query"]
    Analytics["Analytics API baseline"]

    Retry --> Physical --> Replacing
    Physical --> Correct
    Correct -->|"event-level reads"| Dedup["explicit event_id deduplication"]
    Correct -->|"current aggregate API"| Analytics
    Analytics --> Final["FINAL"]
    Analytics --> Exact["uniqExact(event_id)<br/>uniqExact(journey_id)"]
```

Background merges are not an exactly-once guarantee. Queries must preserve
explicit event-ID deduplication. The current Analytics API uses `FINAL` and
`uniqExact`; it reads the trajectory table only.

## Field lineage

| Source | Gateway transformation | Redis / contract | ClickHouse |
| --- | --- | --- | --- |
| local installation ID | HMAC with server secret | `device_ref` in operational state only | forbidden |
| authenticated connection | resolves current session | `session_id` in operational state only | forbidden |
| Gateway ID generator | canonical identity | `journey_id` in both event payloads | logical join key in both tables |
| map bundle and app route | graph revision, direction, edge existence, and continuity validation | lifecycle `map_id`, `map_revision`, `planned_route` | lifecycle route columns |
| route-relative marker | normalize position; assign Gateway acceptance time | trajectory position fields | trajectory event columns |
| client lifecycle command | stable idempotency key; server sequence/revisions | lifecycle event variant | one row per start, recalculate, or end event |
| Gateway clock | acceptance/ingestion timestamps | `observed_at` / `ingested_at` or `occurred_at` / `ingested_at` | UTC `DateTime64(3)` |

Client observation time is not currently serialized for trajectory events, so
`observed_at` is the Gateway acceptance time. This is an explicit current
limitation, not a future-state field hidden by the diagram.

## Lifecycle state transitions

```mermaid
stateDiagram-v2
    [*] --> Active: journey_started
    Active --> Active: route_recalculated<br/>route_revision + 1
    Active --> Ended: arrived
    Active --> Ended: cancelled
    Active --> Ended: superseded by a new Journey
    Active --> Ended: expired by Gateway
    Ended --> [*]
```

There is at most one Active Journey per `device_ref`. Starting another Journey
atomically records `superseded` for the old one before activating the new
Journey. Ended tombstones prevent an old Journey from being reopened.
