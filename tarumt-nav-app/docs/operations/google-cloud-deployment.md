# Google Cloud backend + admin website deployment

This is the primary first-deployment guide, updated 2026-09-08. It describes a
**new single-VM demonstration deployment**, not a completed cloud release.
Run cloud commands yourself after reviewing cost and data exposure.
The local Docker demonstration is separate and is not changed by these steps.

## 1. Target and prerequisites

Use Compute Engine because the current application already runs as a Compose
stack with Redis, ClickHouse, workers, and monitoring. This guide does not
convert it to Cloud Run or claim high availability.

Prepare:

- A billing-enabled Google Cloud project and permission to create a VM,
  network/firewall rules, and a reserved external IPv4 address.
- Operator IAP tunnel permission and VM SSH/sudo permissions. Ask the project
  administrator to grant the required roles rather than making all users owners.
- A registered free DuckDNS name, such as `YOUR_NAME.duckdns.org`. All domain examples here are
  placeholders, **not working project URLs**.
- Repository access and a reviewed commit containing the new live/dashboard
  handlers. Uncommitted local changes will not appear in a cloud clone.
- A synthetic dataset for an unauthenticated demo. Live admin responses expose
  names and positions. CORS does not stop non-browser clients from reading them.

As a starting estimate for this combined stack, consider an Ubuntu 24.04
`e2-standard-4` VM and 100 GB persistent boot disk. This is not a benchmark-backed
capacity guarantee; measure memory, disk, and CPU and adjust. Set billing alerts.

Topology:

```text
Browser / Flutter → https://YOUR_NAME.duckdns.org (one Caddy container, port 443)
                        ├─ / and /live → Admin web :3000
                        ├─ /api/* → Admin web → private Go APIs
                        ├─ maps, sessions, WebSocket, live → Gateway :8080
                        └─ /v1/analytics/... → Analytics API :9092
Gateway → Redis → Trajectory Worker → ClickHouse ← Analytics API
Operator → IAP SSH tunnel → private Grafana
```

## 2. Create the VM — Google Cloud Shell

The example creates a dedicated VPC to avoid inheriting broad SSH rules. Do not
rerun resource-creation commands blindly if the resources already exist.

```sh
export GCP_PROJECT_ID=YOUR_PROJECT_ID
export GCP_REGION=asia-southeast1
export GCP_ZONE=asia-southeast1-b
export GCP_INSTANCE=tarumt-backend
gcloud config set project "$GCP_PROJECT_ID"
gcloud services enable compute.googleapis.com iap.googleapis.com

gcloud compute networks create campus-backend --subnet-mode=custom
gcloud compute networks subnets create campus-backend-subnet \
  --network=campus-backend --region="$GCP_REGION" --range=10.20.0.0/24

gcloud compute addresses create campus-api-ip --region="$GCP_REGION"
gcloud compute addresses describe campus-api-ip --region="$GCP_REGION" --format='value(address)'
```

Copy the printed address into `YOUR_RESERVED_IP` below.

```sh
gcloud compute firewall-rules create campus-public-web \
  --network=campus-backend --direction=INGRESS --action=ALLOW \
  --rules=tcp:80,tcp:443 --source-ranges=0.0.0.0/0 --target-tags=campus-api
gcloud compute firewall-rules create campus-iap-ssh \
  --network=campus-backend --direction=INGRESS --action=ALLOW \
  --rules=tcp:22 --source-ranges=35.235.240.0/20 --target-tags=campus-api
gcloud compute instances create "$GCP_INSTANCE" \
  --zone="$GCP_ZONE" --machine-type=e2-standard-4 \
  --subnet=campus-backend-subnet --address=YOUR_RESERVED_IP --tags=campus-api \
  --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
  --boot-disk-size=100GB --boot-disk-type=pd-balanced --no-boot-disk-auto-delete \
  --no-service-account --no-scopes
gcloud compute ssh "$GCP_INSTANCE" --zone="$GCP_ZONE" --tunnel-through-iap
```

The VM itself does not need Google API credentials for this Compose deployment.
Do not add public firewall rules for 8080, 9092, 6379, 8123, 9000, 9090, or 3000.
If using an existing VPC, audit its existing rules as well.

Register your DuckDNS name; the ingress script updates its **A record** to the reserved IP.
Do not create an AAAA record unless IPv6 is actually configured.
A VM does not automatically give this application a working HTTPS URL.

## 3. Install and prepare the source — inside the VM

Run as an SSH user with sudo. Do not install a host Caddy service: step 6 starts
the single shared Caddy container. Existing proxies require a reviewed handover.

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates curl git openssl docker.io docker-compose-v2 iproute2 util-linux
sudo systemctl enable --now docker
sudo install -d -o "$USER" -g "$(id -gn)" /opt/campus-navigator/source
sudo install -d -m 0700 /opt/campus-navigator/shared
git clone YOUR_REPOSITORY_URL /opt/campus-navigator/source
cd /opt/campus-navigator/source
git checkout YOUR_REVIEWED_COMMIT
cd tarumt-nav-app
```

Use SSH or an approved credential helper for a private repository; never embed
a repository access token into the clone URL or commit it.

Use this guide's explicit setup commands. The existing bootstrap and remote
release helpers are not part of this revised workflow.

## 4. Secrets and backend Compose

Copy the template only for a **new** installation:

```sh
sudo test ! -e /opt/campus-navigator/shared/production.env &&
sudo install -m 0600 deploy/.env.production.example /opt/campus-navigator/shared/production.env
sudoedit /opt/campus-navigator/shared/production.env
```

Replace every placeholder secret with a different random value. For each secret,
`openssl rand -hex 32` generates a suitable value; keep the output private.
Set `PRESENCE_INSTANCE_ID=gce-gateway-1`. Keep Gateway port 8080 and Grafana
port 3000 loopback-only. Never regenerate these secrets on a routine restart.
`PRESENCE_ALLOWED_ORIGINS` controls WebSocket origin matching, not HTTP CORS;
it can remain empty for the current native app and HTTP-polling admin website.

No Analytics host-port override is needed. The shared Caddy and admin server
connect to `campus-navigator_application` directly. Existing installations with
an override should retain their reviewed configuration during migration; do not
silently remove it or replace an already-serving host proxy.

Define this shell helper in each new VM shell:

```sh
dc() {
  sudo docker compose --project-name campus-navigator \
    --env-file /opt/campus-navigator/shared/production.env \
    -f deploy/compose.production.yaml "$@"
}
```

## 5. Publish maps and start the backend

From `/opt/campus-navigator/source/tarumt-nav-app`:

```sh
sudo docker run --rm --user "$(id -u):$(id -g)" \
  --env GOCACHE=/tmp/go-build --env GOMODCACHE=/tmp/go-mod \
  --volume "$PWD:/workspace" --workdir /workspace/services/presence-gateway \
  golang:1.24-alpine go run ./cmd/map-bundle-publisher \
  -workspace /workspace -source contracts/maps/main-campus/map-bundle.source.json \
  -output map-data/main-campus
chmod -R a+rX map-data
dc config --quiet
dc up -d --build --wait
dc ps
```

Do not print resolved Compose configuration: it contains secrets.

The existing ClickHouse initialization grants the reader access to trajectory
events only. After the lifecycle table exists, grant its Dashboard read access:

```sh
dc exec -T clickhouse sh -ec 'clickhouse-client --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD" --query "GRANT SELECT ON campus_analytics.journey_lifecycle_events_v1 TO analytics_reader"'
curl -fsS http://127.0.0.1:8080/health/ready
dc exec -T analytics-api wget -qO- 'http://127.0.0.1:9092/v1/analytics/dashboard?map_id=main-campus&period=week'
sudo bash deploy/scripts/smoke-test.sh deploy/compose.production.yaml /opt/campus-navigator/shared/production.env
```

Fresh volumes initialize the tables through entrypoint scripts. Existing
ClickHouse volumes do not automatically rerun initialization when files change:
inspect the schema and apply reviewed missing migrations before granting access.
Readiness alone does not prove that the Dashboard query has permission.

Redis is currently non-durable tmpfs. A restart loses live state and unconsumed
Stream entries. ClickHouse/Grafana/Prometheus named volumes persist; do not use
`down --volumes` or prune volumes during troubleshooting.

## 6. One shared HTTPS/WSS ingress

Follow [the website + APK deployment guide](../../deploy/FRONTEND-GCP.md).
From `tarumt-nav-app`, preview without making changes, then deploy:

```sh
bash deploy/gcp/deploy-frontend.sh \
  --domain YOUR_NAME.duckdns.org --ip YOUR_RESERVED_IP --plan
sudo bash deploy/gcp/deploy-frontend.sh \
  --domain YOUR_NAME.duckdns.org --ip YOUR_RESERVED_IP
```

The script prompts privately for the DuckDNS token and asks you to acknowledge
the unauthenticated synthetic demo. It builds the admin client and starts one
Caddy container on 80/443, serving the website and allowlisted Go API routes.
It does not restart backend containers or regenerate their secrets. No separate
host Caddy, public raw Go port, or browser CORS configuration is needed.

`deploy/frontend.Caddyfile` preserves request paths and the Authorization header,
and handles WebSocket upgrades for `/v1/presence`. APK JWT checks remain in Go.
`/metrics`, non-public health/debug routes and unknown `/v1/*` routes return 404.
Redis, ClickHouse and monitoring remain private. Keep 80/443 reachable for public
certificate provisioning and renewal. API reachability does not make live-user
data safe to publish without access control; use synthetic users only.

## 7. Verify from outside the VM

Replace `YOUR_NAME.duckdns.org` with your actual domain:

```sh
curl -fsS https://YOUR_NAME.duckdns.org/health/ready
curl -fsS https://YOUR_NAME.duckdns.org/v1/maps/main-campus/current
curl -fsS https://YOUR_NAME.duckdns.org/api/live
curl -fsS 'https://YOUR_NAME.duckdns.org/api/dashboard?period=week'
VERIFY_BASE_URL=https://YOUR_NAME.duckdns.org node deploy/gcp/tests/verify_shared_ingress.mjs
```

The verifier needs Node 22+ on the testing device. It checks both HTML pages,
API JSON, map manifest, session creation, token rejection, WebSocket session
opening, and private-route 404s. It creates a synthetic session without sending
a position or journey. Empty live/dashboard data is normal before activity.

Then test anonymous session creation and an authenticated mobile WebSocket,
generate named synthetic journeys, and check that live positions and dashboard
counts change. Do not treat an HTTP health check as complete end-to-end proof.
Record date, commit, DNS name, and redacted results. These cloud checks have
**not** been run as part of this documentation change.

## 8. Connect clients

Follow [frontend API addresses](frontend-api-addresses.md). The proposed public
base URL is `https://YOUR_NAME.duckdns.org`; its real value is only known after you
choose a domain and configure DNS/HTTPS. No cloud deployment was performed here.

For maintenance, use [the operations runbook](../../deploy/OPERATIONS.md).

## Official references

- [Create a Linux VM](https://docs.cloud.google.com/compute/docs/create-linux-vm-instance)
- [Reserve and assign an external IP](https://docs.cloud.google.com/compute/docs/ip-addresses/configure-static-external-ip-address)
- [IAP SSH prerequisites and permissions](https://docs.cloud.google.com/iap/docs/using-tcp-forwarding)
- [Caddy HTTPS prerequisites](https://caddyserver.com/docs/automatic-https)
- [Caddy reverse proxy and WebSocket support](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
