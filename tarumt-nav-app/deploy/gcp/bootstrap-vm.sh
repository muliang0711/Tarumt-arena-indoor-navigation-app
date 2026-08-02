#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repository_root=$(cd "$script_dir/../.." && pwd)
compose_file="$repository_root/deploy/compose.production.yaml"
environment_file=/opt/campus-navigator/shared/production.env
project_name=campus-navigator
tailscale_hostname=${TAILSCALE_HOSTNAME:-tarumt-backend}

if [[ $(uname -s) != "Linux" ]]; then
  printf '%s\n' "This bootstrap script must run inside the Linux Compute Engine VM." >&2
  exit 1
fi

if [[ ! -f "$compose_file" ]]; then
  printf 'Missing Compose file: %s\n' "$compose_file" >&2
  exit 1
fi

for service in presence-gateway trajectory-worker analytics-api; do
  if [[ ! -f "$repository_root/services/$service/Dockerfile" ]]; then
    printf 'Missing backend Dockerfile: services/%s/Dockerfile\n' "$service" >&2
    exit 1
  fi
done

printf '%s\n' "Installing VM packages..."
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates \
  curl \
  docker.io \
  docker-compose-v2 \
  git \
  openssl

sudo systemctl enable --now docker

if ! command -v tailscale >/dev/null 2>&1; then
  printf '%s\n' "Installing Tailscale..."
  tailscale_installer=$(mktemp)
  trap 'rm -f "$tailscale_installer"' EXIT
  curl --fail --silent --show-error --location \
    https://tailscale.com/install.sh \
    --output "$tailscale_installer"
  sh "$tailscale_installer"
  rm -f "$tailscale_installer"
  trap - EXIT
fi

sudo systemctl enable --now tailscaled

if [[ ! -f "$environment_file" ]]; then
  printf '%s\n' "Creating server-only production secrets..."
  environment_tmp=$(mktemp)
  trap 'rm -f "$environment_tmp"' EXIT
  chmod 0600 "$environment_tmp"
  {
    printf '%s\n' 'PRESENCE_HOST_PORT=8080'
    printf '%s\n' 'PRESENCE_INSTANCE_ID=gce-gateway-1'
    printf '%s\n' 'PRESENCE_ALLOWED_ORIGINS='
    printf 'PRESENCE_JWT_SECRET=%s\n' "$(openssl rand -hex 32)"
    printf 'PRESENCE_IDENTITY_HMAC_SECRET=%s\n' "$(openssl rand -hex 32)"
    printf 'CLICKHOUSE_TRAJECTORY_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf 'CLICKHOUSE_ANALYTICS_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  } > "$environment_tmp"
  sudo install -d -m 0755 /opt/campus-navigator/shared
  sudo install -o root -g root -m 0600 \
    "$environment_tmp" \
    "$environment_file"
  rm -f "$environment_tmp"
  trap - EXIT
else
  printf 'Preserving existing secrets in %s.\n' "$environment_file"
fi

map_pointer="$repository_root/map-data/main-campus/current.json"
map_manifest_relative=$(sed -n 's/.*"manifest_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$map_pointer")
if [[ -z "$map_manifest_relative" || ! -f "$repository_root/map-data/main-campus/$map_manifest_relative" ]]; then
  printf '%s\n' "Publishing the missing Main Campus Map Bundle..."
  sudo docker run --rm \
    --user "$(id -u):$(id -g)" \
    --env HOME=/tmp \
    --env GOCACHE=/tmp/go-build \
    --env GOMODCACHE=/tmp/go-mod \
    --volume "$repository_root:/workspace" \
    --workdir /workspace/services/presence-gateway \
    golang:1.24-alpine \
    go run ./cmd/map-bundle-publisher \
      -workspace /workspace \
      -source contracts/maps/main-campus/map-bundle.source.json \
      -output map-data/main-campus
fi

printf '%s\n' "Building and starting the Campus Navigator containers..."
sudo docker compose \
  --project-name "$project_name" \
  --env-file "$environment_file" \
  --file "$compose_file" \
  config --quiet

sudo docker compose \
  --project-name "$project_name" \
  --env-file "$environment_file" \
  --file "$compose_file" \
  up --detach --build --remove-orphans --wait

printf '%s\n' "Running the complete backend smoke test..."
sudo bash "$repository_root/deploy/scripts/smoke-test.sh" \
  "$compose_file" \
  "$environment_file"

if ! sudo tailscale ip -4 >/dev/null 2>&1; then
  printf '%s\n' "Tailscale needs one-time authentication."
  printf '%s\n' "Open the URL printed below, approve this VM, and return to this terminal."
  sudo tailscale up --hostname="$tailscale_hostname"
fi

printf '%s\n' "Enabling the public HTTPS Funnel..."
if ! sudo tailscale funnel --bg http://127.0.0.1:8080; then
  printf '%s\n' "Funnel needs one-time approval in the Tailscale admin page." >&2
  printf '%s\n' "Open the approval URL shown above, then run this bootstrap script again." >&2
  exit 1
fi

printf '\n%s\n' "Deployment is ready. Public Funnel status:"
sudo tailscale funnel status
printf '\n%s\n' "Use the displayed https://...ts.net URL as the APK PRESENCE_BASE_URL."
