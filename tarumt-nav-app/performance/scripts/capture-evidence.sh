#!/bin/sh
set -eu

label=${1:-manual}
root_dir=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
result_dir="$root_dir/results/$label"
compose_file="$root_dir/compose.load.yaml"
mkdir -p "$result_dir"

curl -fsS http://127.0.0.1:28080/metrics > "$result_dir/presence-gateway.prom"
curl -fsS http://127.0.0.1:29091/metrics > "$result_dir/trajectory-worker.prom"
curl -fsS http://127.0.0.1:29092/metrics > "$result_dir/analytics-api.prom"
curl -fsS http://127.0.0.1:29090/api/v1/targets > "$result_dir/prometheus-targets.json"
docker compose -f "$compose_file" ps --format json > "$result_dir/compose-ps.jsonl"
docker stats --no-stream --format '{{json .}}' \
  campus-performance-gateway-1 \
  campus-performance-redis-1 \
  campus-performance-worker-1 \
  campus-performance-clickhouse-1 \
  campus-performance-analytics-api-1 > "$result_dir/docker-stats.jsonl"
docker compose -f "$compose_file" exec -T clickhouse clickhouse-client \
  --user trajectory --password trajectory-test \
  --query 'SELECT count() AS stored_rows, uniqExact(event_id) AS unique_events, uniqExact(journey_id) AS unique_journeys FROM campus_analytics.trajectory_events_v1 FINAL FORMAT JSONEachRow' \
  > "$result_dir/clickhouse-counts.jsonl"
docker compose -f "$compose_file" exec -T clickhouse clickhouse-client \
  --user trajectory --password trajectory-test \
  --query 'SELECT count() AS stored_rows, uniqExact(event_id) AS unique_events, uniqExact(journey_id) AS unique_journeys, countIf(event_type = '"'"'journey_started'"'"') AS started, countIf(event_type = '"'"'journey_ended'"'"') AS ended FROM campus_analytics.journey_lifecycle_events_v1 FINAL FORMAT JSONEachRow' \
  > "$result_dir/clickhouse-journey-counts.jsonl"
printf 'captured evidence in %s\n' "$result_dir"
