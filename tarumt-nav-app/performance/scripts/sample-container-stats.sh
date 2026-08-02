#!/bin/sh
set -eu

label=${1:-stats}
root_dir=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
result_dir="$root_dir/results/$label"
mkdir -p "$result_dir"

while :; do
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  docker stats --no-stream --format '{{json .}}' \
    campus-performance-gateway-1 \
    campus-performance-redis-1 \
    campus-performance-worker-1 \
    campus-performance-clickhouse-1 \
    campus-performance-analytics-api-1 |
    while IFS= read -r row; do
      printf '{"captured_at":"%s","docker":%s}\n' "$timestamp" "$row"
    done >> "$result_dir/docker-stats-timeseries.jsonl"
  sleep 2
done
