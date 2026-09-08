#!/usr/bin/env bash
set -euo pipefail
arena_root="$(cd "$(dirname "$0")/.." && pwd)"
compose=(docker compose -f "$arena_root/deploy/compose.admin-local.yaml")
case "${1:-up}" in
  up)
    node "$arena_root/admin-web/scripts/sync-campus.mjs"
    "${compose[@]}" --profile web --profile simulation up -d --build --wait
    echo "Dashboard: http://localhost:3100   Live map: http://localhost:3100/live"
    ;;
  simulate)
    export SIM_USERS="${2:-100}"
    [[ "$SIM_USERS" =~ ^[0-9]+$ ]] && (( SIM_USERS >= 1 && SIM_USERS <= 1000 )) || { echo "Users must be 1–1000" >&2; exit 1; }
    "${compose[@]}" --profile simulation up -d --build --force-recreate simulator
    ;;
  stop-simulation) "${compose[@]}" --profile simulation stop simulator ;;
  status) "${compose[@]}" --profile web --profile simulation ps ;;
  logs) "${compose[@]}" --profile simulation logs --tail 50 simulator ;;
  down) "${compose[@]}" --profile web --profile simulation down ;;
  *) echo "Usage: bash dev/admin-local.sh {up|simulate [100]|stop-simulation|status|logs|down}" >&2; exit 1 ;;
esac
