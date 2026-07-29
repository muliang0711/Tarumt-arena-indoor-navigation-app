# Backend data flows

These diagrams trace data across the current backend. Storage shapes and
retention are detailed in [schema flow](schema-flow.md); component ownership is
shown in [backend architecture](architecture.md).

## 1. Map and anonymous-session bootstrap

```mermaid
sequenceDiagram
    autonumber
    participant App as Flutter app
    participant Gateway as Presence Gateway
    participant Catalog as Map bundle catalog
    participant Redis as Redis session store

    App->>Gateway: GET /v1/maps/{map_id}/current
    Gateway->>Catalog: Resolve current content-hash revision
    Catalog-->>Gateway: Verified manifest
    Gateway-->>App: Manifest and immutable asset URLs
    loop Required bundle assets
        App->>Gateway: GET /v1/maps/{map_id}/revisions/{revision}/{asset}
        Gateway->>Catalog: Verify path, revision, digest, and size
        Catalog-->>Gateway: Asset
        Gateway-->>App: Immutable asset response
    end
    App->>Gateway: POST /v1/anonymous-sessions<br/>{installation_id}
    Gateway->>Gateway: HMAC installation_id into device_ref
    Gateway->>Redis: Atomically store session + active/expiry indexes
    Gateway-->>App: session_id, JWT, expiry
    App->>Gateway: GET /v1/presence with JWT<br/>(WebSocket upgrade)
    Gateway->>Redis: Authenticate current, unexpired session
    Gateway-->>App: session_ready
```

The raw installation ID is used only to derive the private `device_ref`. It is
not written to Redis or ClickHouse. The Gateway's canonical map graph is also
used later to validate every planned Journey route.

## 2. Journey lifecycle and position observations

Journey commands and position updates are separate logical flows carried by
the same authenticated WebSocket.

```mermaid
sequenceDiagram
    autonumber
    participant App as Flutter app
    participant WS as Gateway WebSocket runner
    participant Journey as JourneyService
    participant Presence as PresenceService
    participant Graph as Map graph registry
    participant Redis as Redis + Lua

    App->>WS: journey_start(client_event_id, map revision, planned route)
    WS->>Journey: Start command + authenticated session
    Journey->>Graph: Validate map revision and continuous edge route
    Graph-->>Journey: Valid
    Journey->>Redis: Atomic start mutation
    Note over Redis: Supersede prior active Journey if present,<br/>write active state, idempotency result,<br/>expiry index, and lifecycle Stream event
    Redis-->>Journey: canonical journey_id + revisions
    Journey-->>WS: command result
    WS-->>App: journey_ack

    loop Meaningful movement, at most every 500 ms
        App->>WS: location_update(sequence, edge, progress, heading)
        WS->>Journey: Read active Journey for device_ref
        Journey->>Redis: Get canonical active Journey
        Redis-->>Journey: journey_id
        WS->>Presence: UpdateForJourney(position, journey_id)
        Presence->>Redis: Atomic canonical presence mutation
        Note over Redis: Verify active Journey and sequence,<br/>update hot presence + occupancy indexes,<br/>append trajectory Stream event
        Redis-->>Presence: Accepted presence and prior state
        Presence-->>WS: Accepted
        WS->>Journey: RecordPosition(journey_id, session_id)
        Journey->>Redis: Refresh Journey position deadline
        WS-->>App: ack(sequence)
    end

    opt Route changes without destination change
        App->>WS: route_recalculate(stable client_event_id, new route)
        WS->>Journey: Recalculate command
        Journey->>Graph: Validate new route
        Journey->>Redis: Atomic revision increment + lifecycle event
        Redis-->>App: journey_ack via Journey and WS
    end

    alt Client declares terminal outcome
        App->>WS: journey_end(arrived or cancelled)
        WS->>Journey: End command
        Journey->>Redis: Atomic end + presence removal + lifecycle event
        Redis-->>App: journey_ack via Journey and WS
    else Journey becomes stale
        Journey->>Redis: ExpireIfDue
        Note over Redis: End as expired and remove live state atomically
    end
```

Stable `client_event_id` values make lifecycle command retries idempotent.
Location sequences reject replayed or out-of-order observations. Old clients
that never start a canonical Journey still use the compatibility path, where
the Gateway creates an implicit Journey ID for each accepted update.

## 3. Live-floor projection

```mermaid
flowchart LR
    Update["Accepted presence update"]
    Atomic["Redis atomic presence write"]
    Indexes[("floor and physical-edge<br/>occupancy indexes")]
    PubSub[("floor Pub/Sub channel")]
    Projection["one projection per<br/>Gateway + floor"]
    Snapshot["authoritative occupancy snapshot"]
    Coalesce["latest-wins representative<br/>movement coalescing"]
    Clients["subscribed WebSocket clients"]

    Update --> Atomic
    Atomic --> Indexes
    Atomic --> PubSub
    PubSub --> Projection
    Indexes --> Snapshot --> Projection
    Projection --> Coalesce --> Clients
    Projection -->|"membership change / resync"| Snapshot
```

The projection sends total, building, floor, and physical-edge occupancy plus
at most ten stable representative actors. Representative movement is
coalesced over 200 ms, while membership refreshes are debounced over 50 ms.
The representative sample is visual only; congestion counts come from the
occupancy indexes. Redis Pub/Sub is transient, so reconnection triggers an
authoritative snapshot rather than event replay.

## 4. Durable event ingestion

```mermaid
sequenceDiagram
    participant Redis as Redis Stream
    participant Consumer as Worker Redis consumer
    participant Collector as Micro-batch collector
    participant Validator as Contract/domain validator
    participant CH as ClickHouse repository
    participant DLQ as Privacy-safe dead-letter Stream

    Consumer->>Redis: XREADGROUP / XAUTOCLAIM
    Redis-->>Consumer: Stream messages
    Consumer->>Collector: Collect until size or max-wait boundary
    Collector->>Validator: Decode schema_version, event_id, payload
    alt Batch is valid
        Validator->>CH: Batch insert
        CH-->>Validator: Insert confirmed
        Validator->>Redis: XACK source message IDs
    else Message is permanently invalid
        Validator->>DLQ: Atomic fingerprint + reason + source ID
        Validator->>Redis: XACK source message
    else Redis or ClickHouse is temporarily unavailable
        Validator-->>Consumer: Return error without XACK
        Note over Redis,Consumer: Message stays pending and can be reclaimed
    end
```

This flow runs independently for `trajectory` and `journey lifecycle`.
Acknowledgement happens only after ClickHouse confirms the batch, producing
at-least-once delivery. Dead letters omit the raw payload and untrusted event
ID; they retain hashes and diagnostic metadata only. The current single-host
deployment keeps Redis on ephemeral `tmpfs`, so events not yet inserted into
ClickHouse can be lost across a Redis or host restart; production durability
requires persistent, replicated Redis as described by the operations docs.

## 5. Aggregate analytics query

```mermaid
sequenceDiagram
    autonumber
    participant Caller as Approved caller
    participant HTTP as Analytics HTTP router
    participant Service as AnalyticsService
    participant CH as ClickHouse

    Caller->>HTTP: GET floor-traffic or route-edges<br/>building, floor, aligned range, bucket
    HTTP->>HTTP: Reject identity filters,<br/>enforce concurrency and timeout
    HTTP->>Service: Validated TrafficQuery
    Service->>Service: Enforce max range and result policy
    Service->>CH: SELECT ... FROM trajectory_events_v1 FINAL<br/>uniqExact + server privacy HAVING
    CH-->>Service: Aggregate rows and scan progress
    Service->>Service: Repeat privacy threshold check,<br/>classify traffic or rank edges
    alt Result is within row bound
        Service-->>Caller: Privacy-safe aggregate report
    else Result exceeds row bound
        Service-->>Caller: 422 result_too_large
    end
```

The API never exposes an individual Journey or accepts `journey_id`,
`event_id`, `session_id`, or `device_ref` filters. Its current queries read
only `trajectory_events_v1`; lifecycle analytics and planned-demand reports
are not implemented.

## 6. End-to-end lineage

```mermaid
flowchart LR
    Route["App route + navigation state"]
    Marker["App route-relative marker"]
    JCommand["Journey commands"]
    LCommand["LocationUpdateV1"]
    Active[("Redis active Journey")]
    Hot[("Redis hot presence<br/>and occupancy")]
    JStream[("lifecycle Stream")]
    TStream[("trajectory Stream")]
    Worker["two worker pipelines"]
    JTable[("journey_lifecycle_events_v1")]
    TTable[("trajectory_events_v1")]
    API["Analytics API"]
    Report["privacy-safe aggregate"]

    Route --> JCommand --> Active
    JCommand --> JStream
    Marker --> LCommand
    Active -.->|"canonical journey_id"| LCommand
    LCommand --> Hot
    LCommand --> TStream
    JStream --> Worker --> JTable
    TStream --> Worker --> TTable
    TTable --> API --> Report
```

The canonical `journey_id` joins low-frequency intent/outcome with
high-frequency position observations. This is a logical relationship; the raw
ClickHouse tables do not declare a foreign-key constraint.
