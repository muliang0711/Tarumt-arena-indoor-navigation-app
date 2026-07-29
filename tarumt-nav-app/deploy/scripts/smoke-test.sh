#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: %s [compose-file] [environment-file]\n' "$0" >&2
}

if [[ $# -gt 2 ]]; then
  usage
  exit 2
fi

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
default_compose=$(cd "$script_dir/.." && pwd)/compose.production.yaml
compose_file=${1:-$default_compose}
environment_file=${2:-}
project_name=${CAMPUS_COMPOSE_PROJECT_NAME:-campus-navigator}

if docker info >/dev/null 2>&1; then
  docker_command=(docker)
elif sudo -n docker info >/dev/null 2>&1; then
  docker_command=(sudo -n docker)
else
  printf '%s\n' "Docker is unavailable directly and through non-interactive sudo." >&2
  exit 1
fi

compose=("${docker_command[@]}" compose --project-name "$project_name")
if [[ -n "$environment_file" ]]; then
  compose+=(--env-file "$environment_file")
fi
compose+=(--file "$compose_file")

for service in redis clickhouse presence-gateway trajectory-worker analytics-api; do
  if [[ $("${compose[@]}" ps --status running --services "$service") != "$service" ]]; then
    printf 'Service is not running: %s\n' "$service" >&2
    exit 1
  fi
done

gateway_address=$("${compose[@]}" port presence-gateway 8080)
gateway_url="http://${gateway_address}"

curl --fail --silent --show-error "${gateway_url}/health/ready" | grep -q ready
curl --fail --silent --show-error "${gateway_url}/v1/maps/main-campus/current" |
  grep -q '"map_id"[[:space:]]*:[[:space:]]*"main-campus"'
curl --fail --silent --show-error \
  --header 'Content-Type: application/json' \
  --data '{"installation_id":"deployment-smoke-installation-v1"}' \
  "${gateway_url}/v1/anonymous-sessions" |
  grep -q '"access_token"'

"${compose[@]}" exec -T redis redis-cli ping | grep -q PONG
"${compose[@]}" exec -T clickhouse sh -ec \
  'clickhouse-client --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD" --query "SELECT 1"'
"${compose[@]}" exec -T trajectory-worker wget -qO- \
  http://127.0.0.1:9091/health/ready | grep -q ready
"${compose[@]}" exec -T analytics-api wget -qO- \
  http://127.0.0.1:9092/health/ready | grep -q ready

printf '%s\n' "Campus Navigator deployment smoke test passed."
