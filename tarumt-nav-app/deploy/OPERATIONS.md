# Google Cloud operations

Complete the [first-deployment guide](../docs/operations/google-cloud-deployment.md)
before using this runbook. Examples assume its VM, checkout, environment file,
and shared `campus-admin` ingress project. Replace project and zone placeholders.
For an older host-Caddy installation, retain its reviewed override until a
planned migration; the commands below target the new shared-container setup.

## Start, stop, and connect — Cloud Shell

```sh
export GCP_PROJECT_ID=YOUR_PROJECT_ID
export GCP_ZONE=asia-southeast1-b
export GCP_INSTANCE=tarumt-backend
gcloud compute instances describe "$GCP_INSTANCE" --project="$GCP_PROJECT_ID" --zone="$GCP_ZONE"
gcloud compute instances start "$GCP_INSTANCE" --project="$GCP_PROJECT_ID" --zone="$GCP_ZONE"
gcloud compute ssh "$GCP_INSTANCE" --project="$GCP_PROJECT_ID" --zone="$GCP_ZONE" --tunnel-through-iap
```

Only stop when interrupting all users is acceptable:

```sh
gcloud compute instances stop "$GCP_INSTANCE" --project="$GCP_PROJECT_ID" --zone="$GCP_ZONE"
```

Stopping makes the backend unavailable. Disks and reserved addresses can still
incur charges; closing Cloud Shell does not stop the VM. Configure a billing
budget and alerts. A budget alert is not an automatic spending cap.

## Inspect and recover — inside the VM

```sh
cd /opt/campus-navigator/source/tarumt-nav-app
dc() {
  sudo docker compose --project-name campus-navigator \
    --env-file /opt/campus-navigator/shared/production.env \
    -f deploy/compose.production.yaml "$@"
}
sudo systemctl status docker --no-pager
dc ps
dc logs --tail=100 presence-gateway trajectory-worker analytics-api
curl -fsS http://127.0.0.1:8080/health/ready
dc exec -T analytics-api wget -qO- http://127.0.0.1:9092/health/ready
sudo docker ps --filter label=com.docker.compose.project=campus-admin
sudo docker logs --tail=100 campus-admin-frontend-https-1
sudo docker logs --tail=100 campus-admin-admin-web-1
```

After a normal reboot, the enabled Docker service and container restart
policies should restore service. If a service is stopped, investigate logs
first; use `dc up -d --wait` for backend recovery. For the admin/shared ingress,
rerun the documented deployment command with the same domain and reserved IP.
Do not regenerate secrets or remove volumes to repair a connectivity problem.

- Local health works but HTTPS fails: check DNS, reserved IP attachment, ports
  80/443, Caddy certificate logs, and the VM firewall.
- Website works but APK fails: check the APK base hostname, session response,
  token forwarding and `/v1/presence` WebSocket upgrade with the ingress verifier.
- HTML works but admin data fails: check the server's private API base URLs and
  Docker backend network. This same-origin setup does not require browser CORS.
- Dashboard fails while readiness passes: check both ClickHouse tables and
  SELECT grants from the first-deployment guide.
- User disappears: presence is filtered by recent activity and floor. Journey
  completion, disconnects, and expiry can change live counts.
- Redis restart: current configuration loses hot state and unconsumed Streams;
  reconnect clients. Do not claim those events can be recovered from ClickHouse.

## Private Grafana — operator laptop

```sh
gcloud compute ssh "$GCP_INSTANCE" --project="$GCP_PROJECT_ID" --zone="$GCP_ZONE" \
  --tunnel-through-iap -- -N -L 3300:127.0.0.1:3000
```

Open `http://127.0.0.1:3300` on that laptop. Sign in using the server-owned
Grafana account; do not put its password in the frontend. Keep port 3000 private.
For Cloud Shell, use its authenticated Web Preview instead of treating its
loopback address as your laptop's loopback address.

## Release and rollback

1. Commit and push the intended backend and generated map resources from the
   development workstation. Record the exact commit and current deployed commit.
2. On the VM, inspect `git status --short` in the source checkout. Preserve any
   local changes; stop if they overlap the release. Fetch and check out the
   reviewed commit only in a clean checkout.
3. From `tarumt-nav-app`, rerun the map publisher from the first-deployment guide,
   then `dc config --quiet` and `dc up -d --build --wait`.
4. Recheck service health, maps, sessions, the public live endpoint, dashboard,
   WebSocket token checks, and a real frontend connection. Record the commit only after success.
5. To roll back application code, check out the previously recorded clean
   revision, rebuild its map resources, and repeat the same Compose and checks.
   This is an in-place single-VM release, not atomic or zero-downtime deployment.

Database schema changes require their own compatibility review and backup.
Reverting code does not revert persisted data or migrations. Avoid changing
the Compose project name because it selects different named volumes.
The server-backed admin frontend is released separately; see
[frontend API configuration](../docs/operations/frontend-api-addresses.md).

## Data protection

Keep `production.env`, `/opt/campus-navigator/frontend`, any legacy cloud override, the exact
release commit, and map resources in a protected recovery inventory. Never
commit populated secrets. Back up ClickHouse with an application-consistent
procedure and test a restore before relying on it; a disk snapshot taken while
the database is writing is not by itself proof of a usable backup.

ClickHouse, Grafana, and Prometheus use named volumes. Redis currently uses
tmpfs with persistence disabled. Monitor disk usage, bound retention, and do not
run `docker compose down --volumes`, volume pruning, or VM/disk deletion as
routine troubleshooting.

Cloud verification remains pending until performed on your actual project.
