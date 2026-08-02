CREATE TABLE IF NOT EXISTS campus_analytics.journey_lifecycle_events_v1
(
    schema_version UInt16,
    event_type LowCardinality(String),
    event_id String,
    client_event_id String,
    journey_id String,
    client_journey_key String,
    map_id LowCardinality(String),
    map_revision String,
    lifecycle_sequence UInt64,
    route_revision UInt64,
    occurred_at DateTime64(3, 'UTC'),
    ingested_at DateTime64(3, 'UTC'),
    origin_node_id Nullable(String),
    destination_node_id Nullable(String),
    planned_edge_ids Array(String),
    reroute_reason LowCardinality(String),
    outcome LowCardinality(String),
    INDEX idx_journey journey_id TYPE bloom_filter(0.01) GRANULARITY 4,
    INDEX idx_route_edges planned_edge_ids TYPE bloom_filter(0.01) GRANULARITY 4
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (map_id, event_type, toStartOfHour(occurred_at), event_id)
TTL toDateTime(occurred_at) + INTERVAL 30 DAY DELETE
SETTINGS index_granularity = 8192;
