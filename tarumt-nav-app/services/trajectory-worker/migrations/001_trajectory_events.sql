CREATE DATABASE IF NOT EXISTS campus_analytics;

CREATE TABLE IF NOT EXISTS campus_analytics.trajectory_events_v1
(
    schema_version UInt16,
    event_id String,
    journey_id String,
    building_id LowCardinality(String),
    floor_id LowCardinality(String),
    from_node_id String,
    to_node_id String,
    edge_progress Float64,
    heading Float64,
    movement_state LowCardinality(String),
    observed_at DateTime64(3, 'UTC'),
    ingested_at DateTime64(3, 'UTC'),
    INDEX idx_journey journey_id TYPE bloom_filter(0.01) GRANULARITY 4
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(observed_at)
ORDER BY (building_id, floor_id, toStartOfHour(observed_at), event_id)
TTL toDateTime(observed_at) + INTERVAL 30 DAY DELETE
SETTINGS index_granularity = 8192;
