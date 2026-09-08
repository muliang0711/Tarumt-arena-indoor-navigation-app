# Frontend public API addresses

For a frontend on the **same VM** as the backend, use the
[one-command DuckDNS deployment](../../deploy/FRONTEND-GCP.md). That script
uses private HTTP service URLs and exposes **both the website and APK API**
through one HTTPS/WSS domain. This is the recommended deployment.
The examples below use `api.example.com`; a registered `YOUR_NAME.duckdns.org`
name works the same way. These are placeholders, not deployed addresses.

## Planned public origin

Use **one HTTPS origin** for both Go APIs:

```text
https://api.YOUR_DOMAIN
```

This is a placeholder, not an assigned or deployed address. On Compute Engine,
reserve an external IP, point a domain A record at it, and configure HTTPS as
described in [the cloud guide](google-cloud-deployment.md). A VM IP by itself
does not configure a trusted certificate or route the application endpoints.

For example, if you own `example.com` and configure `api.example.com`:

| Consumer | Full public URL | Routed service |
| --- | --- | --- |
| Admin dashboard / live page | `https://api.example.com/` / `https://api.example.com/live` | Admin web |
| Browser API proxies | `/api/live` / `/api/dashboard?period=week` on that origin | Admin web → private Go APIs |
| Readiness | `https://api.example.com/health/ready` | Presence Gateway |
| Live admin map | `https://api.example.com/v1/live/floors/main-campus/floor-2` | Presence Gateway |
| Dashboard | `https://api.example.com/v1/analytics/dashboard?map_id=main-campus&period=week` | Analytics API |
| Current map bundle | `https://api.example.com/v1/maps/main-campus/current` | Presence Gateway |
| Anonymous session creation (POST) | `https://api.example.com/v1/anonymous-sessions` | Presence Gateway |
| Authenticated mobile WebSocket | `wss://api.example.com/v1/presence` | Presence Gateway |

Dashboard `period` supports `today` and `week`. Browser admin live updates are
HTTP polling, not the mobile WebSocket. The live endpoint returns all eligible
active sessions for that floor; the webpage's 10/20/30 selector only limits
rendered markers. It does not change the mobile representative feed.

## Current server-backed admin frontend

The current website contains runtime proxy routes; it is not a GitHub Pages
static export. The shared-VM Compose file configures its **server environment**:

```dotenv
PRESENCE_API_BASE_URL=http://presence-gateway:8080
ANALYTICS_API_BASE_URL=http://analytics-api:9092
```

These private base URLs have no `/v1` or endpoint suffixes. The existing frontend
continues to call its own `/api/live` and `/api/dashboard`; these routes append
the backend paths and the dashboard proxy converts node IDs to place names.

If hosting the server elsewhere later, set both values to the public HTTPS
origin instead and validate that platform's runtime compatibility. Never put
Docker hostnames such as `analytics-api` or `redis` in public browser configuration.

## Future GitHub Pages frontend

This is an alternative architecture, not part of the shared-VM deployment.

GitHub Pages hosts static HTML/CSS/JavaScript, not these runtime proxy handlers.
See [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Before publishing there:

1. Produce a static client build and remove server-route dependencies.
2. Replace browser calls to `/api/live` and `/api/dashboard` with the full
   public endpoint URLs in the table. Keep destination-ID-to-name mapping in
   the client, using the bundled campus catalog, or move it into the Go API.
3. Supply the API base URL through the chosen static build/runtime config.
   No such new client config variable has been implemented by this docs change;
   setting the current server environment variables alone will not convert it.
4. Configure CORS at the HTTPS proxy for the exact frontend origin:
   `https://YOUR_GITHUB_USER.github.io` (no repository path), or your custom domain.
5. Handle the repository base path, map asset URLs, and direct navigation to
   Dashboard and Live map in the static build.
6. Test from a second device. Its `localhost` is not your backend VM.

The HTTPS origin is intentionally public configuration. JWT signing secrets,
ClickHouse passwords, Google credentials, and Grafana passwords are not.
CORS controls browser access, **not** authorization; anyone able to request the
unprotected admin endpoints can obtain their data. Do not publish real-person
live tracking with the current unauthenticated demo configuration.

## Flutter configuration

After the public endpoint has been verified, from `flutter_app`:

```sh
flutter build apk --release \
  --dart-define=PRESENCE_MODE=realtime \
  --dart-define=PRESENCE_BASE_URL=https://api.example.com
```

The separately hosted Wi-Fi positioning service is not moved by this backend
deployment. Preserve its independent configuration. Use the established app
signing/version procedure, record the APK checksum, and verify on a target phone.
An APK built for an older hostname does not automatically discover a new one;
rebuild/reconfigure it, or preserve its old hostname during a reviewed migration.

## Not public endpoints

Do not expose Redis 6379, ClickHouse 8123/9000, worker 9091, Prometheus 9090,
exporters, raw Go metrics, or Grafana 3000 to the frontend. The shared Caddy
connects to Go services over the private Docker network, not public raw ports.
