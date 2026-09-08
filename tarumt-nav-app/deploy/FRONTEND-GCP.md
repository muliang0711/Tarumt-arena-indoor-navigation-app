# One-command website + APK ingress on the backend VM

Use this when the backend is already running on a Google Compute Engine Ubuntu
VM and you want one free DuckDNS name for **both the admin website and APK API**.
The existing `deploy-frontend.sh` filename is retained for compatibility. It now
deploys the server-backed frontend and a shared Caddy ingress, not a static export.

```text
Browser -- HTTPS --> Caddy --> admin-web --> Gateway / Analytics (private HTTP)
APK ---- HTTPS/WSS --> Caddy --> Gateway (private HTTP / WebSocket)
Public /v1/analytics/* --> Caddy --> Analytics (allowlisted routes only)
```

Both browser and APK traffic use public TLS here. Backend HTTP stays on the
VM's private Docker network. The browser requests same-origin `/api/live` and
`/api/dashboard`; it never connects to Docker service names or plain-HTTP
public endpoints. No browser CORS change is necessary.

## Prepare once

1. Deploy the backend first, including the current live-map and Dashboard
   endpoints. For a new VM follow [Google Cloud setup](../docs/operations/google-cloud-deployment.md)
   through backend startup and database grants, then run this script for the
   shared public ingress. Do not install a second host Caddy service.
2. Register an available name at [DuckDNS](https://www.duckdns.org/), such as
   `YOUR_NAME.duckdns.org`, and have its account token ready. The script updates
   a registered name; it cannot create a DuckDNS account or reserve a name.
3. Reserve and attach the VM's external IPv4 address. Open public TCP 80/443 in
   the VM's Google Cloud firewall; retain private operator SSH access. VM/IP
   charges are separate from the free DNS name and certificate.
4. Ensure Docker Compose v2, curl, iproute2 (`ss`), util-linux (`flock`), and
   normal Ubuntu DNS tools (`getent`) are installed. Use a sudo-capable operator.
5. Have the repository, including `admin-web`, its lockfile, generated
   `app/data/campus.json`, and `public/floor-2.png`, on the VM. Deploy a reviewed
   source revision. This script builds the current checkout; it does not fetch,
   commit, archive, or transfer code from your laptop.
6. Use synthetic data only: the admin endpoints currently have no administrator
   login. The script asks you to acknowledge public names/positions exposure.

## Deploy — inside the VM

From the repository's `tarumt-nav-app` directory:

```sh
sudo bash deploy/gcp/deploy-frontend.sh \
  --domain YOUR_NAME.duckdns.org \
  --ip YOUR_RESERVED_PUBLIC_IPV4
```

Use a lowercase registered name. The script prompts for the DuckDNS token
without echoing it. Do not paste the token into chat, Git, or command-line
arguments. Do not invoke the script with shell tracing.

To see the plan without any changes or credentials:

```sh
bash deploy/gcp/deploy-frontend.sh \
  --domain YOUR_NAME.duckdns.org \
  --ip YOUR_RESERVED_PUBLIC_IPV4 --plan
```

For unattended use, prepare a root-owned mode-0600 token file outside the
repository and use `--token-file /path/to/protected-token` with
`--accept-public-demo`. Do not use that flag for real-person tracking without
first adding appropriate access control.

The default backend network is `campus-navigator_application`. If your existing
Compose deployment uses a different project name, inspect `docker network ls`
and pass its actual shared backend network with `--backend-network NAME`.
That network must resolve `presence-gateway` and `analytics-api`.

## What the script does

- Validates the inputs, Docker backend network, and host ports before deployment.
- Uses independent Compose project `campus-admin`; does not recreate backend
  containers, run backend migrations, or remove backend resources.
- Builds the admin Docker image and checks live data, published maps and the
  Dashboard from the backend network. Fails early if routes or grants are missing.
- Sends a bounded HTTPS update to DuckDNS and checks for `OK`, then checks DNS
  resolution. The token is passed to curl via stdin, not process arguments,
  saved files, the web container, or the Caddy container.
- Starts private `admin-web` and public `frontend-https` containers. No web,
  database, or Go-service raw port is published by this frontend stack.
- Uses Caddy for automatic HTTPS certificates and renewal, with persistent
  certificate volumes, and redirects HTTP visitors to HTTPS.
- Tests both pages, both frontend proxies, public API JSON, the map manifest,
  anonymous session creation, missing/invalid token rejection, and an authenticated
  WebSocket `session_ready` through the public origin. Creates one synthetic
  `Deployment check` session without a position or journey; it expires normally.
  Checks that metrics and unknown backend routes return 404. Prints success only
  after these checks pass. An on-phone test remains required.
  Public checks run in a disposable Node container on the egress network,
  because the admin server itself intentionally only has private networks.

The script updates the IPv4 DNS record at deployment time. It is **not** a
background DDNS updater. Prefer a reserved IP; if the IP changes, rerun with the
new IP. Remove an obsolete DuckDNS IPv6 record manually if IPv6 is not configured.

## Existing reverse proxy

If host Caddy, nginx, or another container already owns port 80 or 443, the
script stops without replacing it. One host port cannot be owned by two proxies.
Either keep the previous cloud guide's host proxy and integrate the frontend
there deliberately, or use this separate container proxy on a fresh setup.
The script never stops an unrelated service to take its ports.

This script exposes **both the website and mobile APIs** through the same proxy.
An existing installation made by this script is updated in place, retaining
the Compose project name and certificate volumes. Recreating the shared proxy
interrupts existing WebSocket connections briefly; APK clients must reconnect.
An unrelated host proxy is never automatically stopped or overwritten. For a
VM already using host Caddy, schedule a reviewed handover before running this
script. Keep a previous APK hostname reachable until installed apps migrate.

## Client addresses

Replace `YOUR_NAME` with the registered name; these examples are not live URLs.

| Consumer | Address |
| --- | --- |
| Dashboard | `https://YOUR_NAME.duckdns.org/` |
| Live map | `https://YOUR_NAME.duckdns.org/live` |
| APK base URL | `https://YOUR_NAME.duckdns.org` (no `/v1` suffix) |
| APK sessions | `POST https://YOUR_NAME.duckdns.org/v1/anonymous-sessions` |
| APK WebSocket | `wss://YOUR_NAME.duckdns.org/v1/presence` (Bearer token required) |
| APK maps | `/v1/maps/main-campus/current` and revision assets |

The shared ingress also exposes `/v1/live/floors/*` and the Analytics dashboard,
floor-traffic and route-edges endpoints. It does not remove their existing
validation or the mobile WebSocket token check. Public reachability is not
administrator authorization; continue using synthetic demo identities only.

From `flutter_app`, build for the verified origin:

```sh
flutter build apk --release \
  --dart-define=PRESENCE_MODE=realtime \
  --dart-define=PRESENCE_BASE_URL=https://YOUR_NAME.duckdns.org
```

The deployment script does not rebuild or install an APK. If its configured
hostname changes, rebuild/reconfigure it. Preserve the separate Wi-Fi positioning
service configuration. No browser CORS rule is needed for this same-origin setup.

## Files, updates, and recovery

Non-secret frontend state lives in `/opt/campus-navigator/frontend`.
The token is not retained by the script. Rerun the same command after updating
the reviewed source checkout to deploy a new frontend. Same-domain reruns reuse
certificate volumes. A different domain is rejected to avoid accidental migration.

Inspect:

```sh
sudo docker ps --filter label=com.docker.compose.project=campus-admin
sudo docker logs --tail=100 campus-admin-admin-web-1
sudo docker logs --tail=100 campus-admin-frontend-https-1
```

Do not prune certificate volumes. A failed DNS update leaves running web
containers unchanged; a failure later in the process can leave the newly
started containers running. The script reports the failure, but does not claim
atomic rollback. To revert application code, restore the last reviewed compatible
checkout and rerun. DNS changes are external state and are not automatically undone.

If HTTPS fails, check A/AAAA records, firewall 80/443, VM IP attachment, Caddy
logs, and certificate-authority rate limits. DNS propagation and first certificate
issuance can take longer than the script's bounded verification window.
If the Dashboard check fails, verify SELECT on both ClickHouse tables as described
in the backend guide. Never publish raw database ports as a workaround.

## Validation scope

The argument tests and isolated shared-ingress integration can be run using
[the deployment test guide](gcp/tests/README.md). Actual DuckDNS
updates and public certificates require your registered hostname, token, and
running VM; they are not claimed as tested by a local simulation.

Official references:
[DuckDNS update API](https://www.duckdns.org/spec.jsp),
[Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).
