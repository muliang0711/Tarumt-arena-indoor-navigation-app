#!/bin/sh
set -eu

label=${1:-stream}
root_dir=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
result_dir="$root_dir/results/$label"
compose_file="$root_dir/compose.load.yaml"
stream=${TRAJECTORY_STREAM:-campus:presence:v1:trajectory:events}
group=${TRAJECTORY_GROUP:-trajectory-workers-v1}
mkdir -p "$result_dir"

docker compose -f "$compose_file" exec -T redis redis-cli --raw XLEN "$stream" > "$result_dir/stream-length.txt"
docker compose -f "$compose_file" exec -T redis redis-cli --raw XINFO GROUPS "$stream" > "$result_dir/stream-groups.txt"
docker compose -f "$compose_file" exec -T redis redis-cli --raw XPENDING "$stream" "$group" > "$result_dir/stream-pending.txt"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$result_dir/captured-at.txt"
printf 'captured Redis Stream state in %s\n' "$result_dir"
