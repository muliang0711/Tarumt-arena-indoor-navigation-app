#!/usr/bin/env bash
# Run on the backend VM. Never run with bash -x: the DNS token is sensitive.
set +x
set -euo pipefail
umask 077

die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
usage() {
  printf '%s\n' \
    'Usage: sudo bash deploy/gcp/deploy-frontend.sh --domain NAME.duckdns.org --ip RESERVED_IPV4 [options]' \
    '  --token-file FILE       Read DuckDNS token from a protected file; otherwise prompt silently' \
    '  --backend-network NAME Existing backend Docker network (default campus-navigator_application)' \
    '  --accept-public-demo    Confirm public access to unauthenticated names/positions' \
    '  --plan                  Print plan only; no Docker, DNS, credentials, or writes' \
    'Publishes the admin website AND APK API through one HTTPS/WSS ingress.' \
    'Register the name with DuckDNS first. Docker Compose and backend services must already be running.'
}
domain='' ip='' token_file='' backend_network=campus-navigator_application plan=false accepted=false
while (( $# )); do
  case "$1" in
    --domain|--ip|--token-file|--backend-network)
      (( $# >= 2 )) || die "Missing value for $1"
      case "$1" in
        --domain) domain=$2;; --ip) ip=$2;; --token-file) token_file=$2;; --backend-network) backend_network=$2;;
      esac
      shift 2;;
    --plan) plan=true; shift;;
    --accept-public-demo) accepted=true; shift;;
    --help|-h) usage; exit 0;;
    *) usage >&2; die "Unknown option: $1";;
  esac
done
[[ "$domain" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.duckdns\.org$ ]] || die 'Use one registered lowercase NAME.duckdns.org hostname'
[[ "$backend_network" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || die 'Invalid backend network name'
[[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || die 'Supply the reserved public IPv4 address with --ip'
IFS=. read -r a b c d <<< "$ip"
for part in "$a" "$b" "$c" "$d"; do
  (( 10#$part <= 255 )) || die 'Invalid IPv4 address'
  [[ "$part" == 0 || "$part" != 0* ]] || die 'IPv4 octets must not have leading zeros'
done
(( a > 0 && a < 224 && a != 10 && a != 127 )) || die 'A public IPv4 address is required'
[[ "$a.$b" != 192.168 && "$a.$b" != 169.254 ]] || die 'A public IPv4 address is required'
(( a != 172 || b < 16 || b > 31 )) || die 'A public IPv4 address is required'

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source_root=$(cd "$script_dir/../.." && pwd)
deploy_dir=/opt/campus-navigator/frontend
printf '%s\n' "Frontend: https://$domain" "DuckDNS A record: $ip" \
  "Backend HTTP network: $backend_network" \
  'Browser -> HTTPS -> frontend server -> private HTTP -> Gateway / Analytics' \
  "APK -> https://$domain/v1/... and wss://$domain/v1/presence -> Gateway" \
  'One Caddy owns 80/443. Redis, ClickHouse and metrics remain private.' \
  'Verification creates one synthetic session and checks authenticated WebSocket access.' \
  'No backend restart, schema change, Google resource creation, or automatic APK rebuild.'
$plan && exit 0
[[ $(uname -s) == Linux && $EUID == 0 ]] || die 'Run inside the Linux VM with sudo'
for cmd in docker curl ss flock getent; do command -v "$cmd" >/dev/null || die "Missing prerequisite: $cmd"; done
docker info >/dev/null 2>&1 || die 'Docker is not available'
docker compose version >/dev/null || die 'Docker Compose v2 is required'
docker network inspect "$backend_network" >/dev/null 2>&1 || die 'Backend network does not exist; deploy backend first'
[[ -f "$source_root/admin-web/Dockerfile" ]] || die 'admin-web source is missing from this checkout'
[[ -f "$script_dir/tests/verify_shared_ingress.mjs" ]] || die 'Shared ingress verifier is missing'

install -d -m 0700 "$deploy_dir"
exec 9>"$deploy_dir/deploy.lock"
flock -n 9 || die 'Another frontend deployment is running'
if [[ -f "$deploy_dir/domain" && $(<"$deploy_dir/domain") != "$domain" ]]; then
  die 'This installation already serves a different domain; review migration manually'
fi

# Avoid replacing an unrelated host proxy or a container that already owns 80/443.
owned_proxy=$(docker ps -q --filter label=com.docker.compose.project=campus-admin --filter label=com.docker.compose.service=frontend-https)
for port in 80 443; do
  if [[ -n $(ss -H -ltn "sport = :$port") || -n $(docker ps -q --filter "publish=$port") ]]; then
    [[ -n "$owned_proxy" ]] || die "Port $port is in use. Existing Caddy/nginx must be integrated manually; nothing was stopped."
    docker port "$owned_proxy" "$port/tcp" >/dev/null 2>&1 || die "Port $port is not owned by this frontend proxy"
  fi
done
if ! $accepted; then
  [[ -t 0 ]] || die 'Use --accept-public-demo only after reviewing public names/positions exposure'
  read -r -p 'Publish website + APK APIs, with an unauthenticated admin map and synthetic verification session? Synthetic demo data only. [y/N] ' answer
  [[ "$answer" == y || "$answer" == Y ]] || die 'Cancelled'
fi

export FRONTEND_SOURCE="$source_root/admin-web" FRONTEND_DEPLOY_DIR="$deploy_dir" FRONTEND_DOMAIN="$domain" BACKEND_NETWORK="$backend_network"
compose=(docker compose --project-name campus-admin -f "$source_root/deploy/compose.frontend.yaml")
"${compose[@]}" config --quiet
"${compose[@]}" build admin-web

# Check both real Go endpoints before changing DNS or replacing the running web.
# Dashboard readiness alone does not detect missing ClickHouse SELECT grants.
"${compose[@]}" run --rm --no-deps -T admin-web node -e '
Promise.all([
  fetch(process.env.PRESENCE_API_BASE_URL+"/v1/live/floors/main-campus/floor-2", {signal:AbortSignal.timeout(8000)}),
  fetch(process.env.PRESENCE_API_BASE_URL+"/v1/maps/main-campus/current", {signal:AbortSignal.timeout(8000)}),
  fetch(process.env.ANALYTICS_API_BASE_URL+"/v1/analytics/dashboard?map_id=main-campus&period=week", {signal:AbortSignal.timeout(8000)})
]).then(async rs=>{for(const r of rs){if(!r.ok)throw Error("Backend status "+r.status);await r.json();}})
.catch(()=>{console.error("Backend check failed: inspect services, map endpoints and Analytics SELECT grants.");process.exit(1);});'

if [[ -n "$token_file" ]]; then
  [[ -f "$token_file" && ! -L "$token_file" ]] || die 'Token file must be a regular non-symlink file'
  mode=$(stat -c %a "$token_file")
  (( (8#$mode & 077) == 0 )) || die 'Token file must not be group/world-readable (chmod 600)'
  token=$(<"$token_file")
else
  [[ -t 0 ]] || die 'Supply --token-file for non-interactive deployment'
  read -r -s -p 'DuckDNS token (hidden): ' token
  printf '\n'
fi
[[ "$token" =~ ^[a-zA-Z0-9-]{16,128}$ ]] || die 'Invalid DuckDNS token format'
label=${domain%.duckdns.org}
# curl reads the secret-bearing URL through stdin, never its process arguments.
# Do not redirect-follow or print the config/URL on errors.
if ! result=$(printf 'url = "https://www.duckdns.org/update?domains=%s&token=%s&ip=%s"\n' "$label" "$token" "$ip" |
  curl --config - --proto '=https' --silent --fail --connect-timeout 10 --max-time 30 2>/dev/null); then
  unset token
  die 'DuckDNS update request failed; check connectivity and token'
fi
unset token
[[ "$result" == OK ]] || die 'DuckDNS rejected the update; verify the registered name and token'
printf '%s\n' 'DuckDNS accepted the IP update. Waiting briefly for DNS propagation...'
dns_ready=false
for _ in {1..12}; do
  if getent ahostsv4 "$domain" | awk '{print $1}' | grep -Fxq "$ip"; then dns_ready=true; break; fi
  sleep 5
done
$dns_ready || die 'DNS not yet resolved to this IP. DNS was updated; wait and rerun. Previous frontend was not replaced.'

if [[ -f "$deploy_dir/Caddyfile" ]]; then cp -p "$deploy_dir/Caddyfile" "$deploy_dir/Caddyfile.previous"; fi
install -m 0644 "$source_root/deploy/frontend.Caddyfile" "$deploy_dir/Caddyfile"
printf '%s\n' "$domain" > "$deploy_dir/domain"
"${compose[@]}" run --rm --no-deps -T frontend-https caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
"${compose[@]}" up -d --wait --wait-timeout 120 --force-recreate
# Re-read an updated bind-mounted Caddyfile on an existing proxy container.
"${compose[@]}" exec -T frontend-https caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

"${compose[@]}" exec -T admin-web node -e '
Promise.all(["/", "/live", "/api/live", "/api/dashboard?period=week"].map(async path=>{
 const r=await fetch("http://127.0.0.1:3000"+path,{signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error("Frontend proxy check failed: "+path);
})).catch(e=>{console.error(e.message);process.exit(1);});'
printf '%s\n' 'Checking public DNS, trusted HTTPS, and the frontend (certificate issuance may take a minute)...'
if ! curl --proto '=https' --fail --silent --show-error --connect-timeout 5 --max-time 10 \
  --retry 12 --retry-delay 5 --retry-all-errors --retry-max-time 100 "https://$domain/api/live" >/dev/null; then
  die 'Containers are running, but public HTTPS verification failed. Check DNS/AAAA records, firewall 80/443 and Caddy logs. No successful deployment is claimed.'
fi
# Exercise the same public origin an APK uses, including Authorization forwarding
# and WebSocket upgrade. Tokens stay in the Node process and are never printed.
if ! "${compose[@]}" run --rm --no-deps -T ingress-check \
  < "$script_dir/tests/verify_shared_ingress.mjs"; then
  die 'Ingress is running but website/APK verification failed. Review proxy routes and backend maps. No successful deployment is claimed.'
fi
printf 'Website + APK ingress verified: https://%s\nLive map: https://%s/live\nAPK PRESENCE_BASE_URL=https://%s\nWebSocket: wss://%s/v1/presence\n' "$domain" "$domain" "$domain" "$domain"
printf '%s\n' 'Rebuild/reconfigure the APK if its previous hostname differs. Backend credentials were not changed.'
