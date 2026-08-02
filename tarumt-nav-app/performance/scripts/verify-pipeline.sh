#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
compose_file="$root_dir/compose.load.yaml"
metrics=$(curl -fsS http://127.0.0.1:29091/metrics)

metric_value() {
  printf '%s\n' "$metrics" | awk -v wanted="$1" '$1 == wanted { print $2 }'
}

lag=$(metric_value trajectory_worker_stream_lag)
pending=$(metric_value trajectory_worker_stream_pending)
dead_lettered=$(metric_value trajectory_worker_events_dead_lettered_total)
trimmed=$(metric_value trajectory_worker_stream_trimmed_total)
journey_lag=$(metric_value journey_lifecycle_worker_stream_lag)
journey_pending=$(metric_value journey_lifecycle_worker_stream_pending)
journey_dead_lettered=$(metric_value journey_lifecycle_worker_events_dead_lettered_total)
journey_trimmed=$(metric_value journey_lifecycle_worker_stream_trimmed_total)

[ "${lag:-missing}" = "0" ] || { printf 'stream lag is %s\n' "${lag:-missing}" >&2; exit 1; }
[ "${pending:-missing}" = "0" ] || { printf 'stream pending is %s\n' "${pending:-missing}" >&2; exit 1; }
[ "${dead_lettered:-missing}" = "0" ] || { printf 'dead-lettered events: %s\n' "${dead_lettered:-missing}" >&2; exit 1; }
[ "${trimmed:-missing}" = "0" ] || { printf 'trimmed events: %s\n' "${trimmed:-missing}" >&2; exit 1; }
[ "${journey_lag:-missing}" = "0" ] || { printf 'Journey stream lag is %s\n' "${journey_lag:-missing}" >&2; exit 1; }
[ "${journey_pending:-missing}" = "0" ] || { printf 'Journey stream pending is %s\n' "${journey_pending:-missing}" >&2; exit 1; }
[ "${journey_dead_lettered:-missing}" = "0" ] || { printf 'Journey dead-lettered events: %s\n' "${journey_dead_lettered:-missing}" >&2; exit 1; }
[ "${journey_trimmed:-missing}" = "0" ] || { printf 'Journey trimmed events: %s\n' "${journey_trimmed:-missing}" >&2; exit 1; }

duplicate_count=$(docker compose -f "$compose_file" exec -T clickhouse clickhouse-client \
  --user trajectory --password trajectory-test --format TSVRaw \
  --query 'SELECT count() - uniqExact(event_id) FROM campus_analytics.trajectory_events_v1 FINAL')
[ "$duplicate_count" = "0" ] || { printf 'ClickHouse FINAL still exposes %s duplicate events\n' "$duplicate_count" >&2; exit 1; }
journey_duplicate_count=$(docker compose -f "$compose_file" exec -T clickhouse clickhouse-client \
  --user trajectory --password trajectory-test --format TSVRaw \
  --query 'SELECT count() - uniqExact(event_id) FROM campus_analytics.journey_lifecycle_events_v1 FINAL')
[ "$journey_duplicate_count" = "0" ] || { printf 'ClickHouse Journey FINAL still exposes %s duplicate events\n' "$journey_duplicate_count" >&2; exit 1; }

for url in \
  http://127.0.0.1:28080/health/ready \
  http://127.0.0.1:29091/health/ready \
  http://127.0.0.1:29092/health/ready; do
  curl -fsS "$url" >/dev/null
done

printf 'both pipelines passed: ready, drained, no DLQ, no trim, no visible duplicates\n'
