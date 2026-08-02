#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
compose_file="$root_dir/compose.load.yaml"
stream=${TRAJECTORY_STREAM:-campus:presence:v1:trajectory:events}
group=${TRAJECTORY_GROUP:-trajectory-workers-v1}
journey_stream=${JOURNEY_LIFECYCLE_STREAM:-campus:presence:v1:journey:lifecycle:events}
journey_group=${JOURNEY_LIFECYCLE_GROUP:-journey-lifecycle-workers-v1}
timeout_seconds=${LOAD_DRAIN_TIMEOUT_SECONDS:-120}
started_at=$(date +%s)

while :; do
	group_info=$(docker compose -f "$compose_file" exec -T redis redis-cli --raw XINFO GROUPS "$stream" 2>/dev/null || true)
	lag=$(printf '%s\n' "$group_info" | awk 'previous == "lag" { print; exit } { previous = $0 }')
	pending=$(docker compose -f "$compose_file" exec -T redis redis-cli --raw XPENDING "$stream" "$group" 2>/dev/null | sed -n '1p' || true)
	journey_group_info=$(docker compose -f "$compose_file" exec -T redis redis-cli --raw XINFO GROUPS "$journey_stream" 2>/dev/null || true)
	journey_lag=$(printf '%s\n' "$journey_group_info" | awk 'previous == "lag" { print; exit } { previous = $0 }')
	journey_pending=$(docker compose -f "$compose_file" exec -T redis redis-cli --raw XPENDING "$journey_stream" "$journey_group" 2>/dev/null | sed -n '1p' || true)
  lag=${lag:-1}
  pending=${pending:-1}
  journey_lag=${journey_lag:-1}
  journey_pending=${journey_pending:-1}
  if [ "$lag" = "0" ] && [ "$pending" = "0" ] &&
    [ "$journey_lag" = "0" ] && [ "$journey_pending" = "0" ]; then
	now=$(date +%s)
	printf 'both pipelines drained: lag=0 pending=0 elapsed=%ss\n' "$((now - started_at))"
    # Let the workers' two-second stats samplers publish the drained state
    # before the following evidence capture reads Prometheus metrics.
    sleep 3
    exit 0
  fi
  now=$(date +%s)
  if [ $((now - started_at)) -ge "$timeout_seconds" ]; then
    printf 'pipelines did not drain: trajectory=%s/%s journey=%s/%s\n' \
      "$lag" "$pending" "$journey_lag" "$journey_pending" >&2
    exit 1
  fi
  sleep 2
done
