# Shared website / APK ingress verification

## Non-mutating checks

From the repository root:

```sh
python3 -m unittest discover -s tarumt-nav-app/deploy/gcp/tests -p 'test_*.py' -v
node --check tarumt-nav-app/deploy/gcp/tests/verify_shared_ingress.mjs
```

## Isolated Docker integration

Requires Docker Compose v2 with `!reset` support and the project's Go toolchain.
Use a fresh, unique Compose project; do not reuse the production or local-demo
project name. The fixture publishes no host ports and uses an internal network.
The fixture's database passwords are synthetic test values, not production secrets.

From the repository root, in one shell:

```sh
export VERIFY_MAP_ROOT=$(mktemp -d /tmp/campus-ingress-verify.XXXXXX)
export VERIFY_PROJECT=campus-ingress-check-$(date +%s)
(
  cd tarumt-nav-app/services/presence-gateway
  go run ./cmd/map-bundle-publisher -workspace ../.. \
    -source contracts/maps/main-campus/map-bundle.source.json \
    -output "$VERIFY_MAP_ROOT/main-campus"
)
verify_dc() {
  docker compose -p "$VERIFY_PROJECT" \
    -f tarumt-nav-app/deploy/gcp/tests/compose.shared-ingress.yaml "$@"
}
verify_dc config --quiet
verify_dc up -d --build --wait --wait-timeout 120
verify_dc exec -T proxy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
verify_dc exec -T -e VERIFY_BASE_URL=http://proxy:8081 admin-web \
  node --input-type=module < tarumt-nav-app/deploy/gcp/tests/verify_shared_ingress.mjs
```

The exact production Caddy route file is mounted; only its site address changes
to internal HTTP so no real DNS or ACME certificate request occurs. The Go
Gateway, Redis, Analytics API, ClickHouse and admin server are real services.
No trajectory worker or moving-user simulator is needed for this routing test.

The verifier checks:

- Both HTML pages and both live-source frontend proxies.
- Current map manifest and every revision asset's byte size and SHA-256.
- Public live/dashboard APIs and Analytics query-error routing.
- Private/unknown routes return 404.
- Missing/invalid mobile tokens return 401.
- A newly created anonymous session opens an authenticated WebSocket and receives
  `session_ready` through Caddy. The token is neither logged nor passed as a CLI argument.

After checking that the selected project is the disposable test stack, remove
only its containers and synthetic data:

```sh
verify_dc ps -a
verify_dc down --volumes
```

This deletes only the selected test project's volume; its synthetic data can be
regenerated. Keep or manually remove the printed temporary map directory after
inspection. Never use this cleanup command against a production project.

## Public deployment check

The deployment script runs the same verifier using trusted HTTPS against the
selected public domain. To repeat from an external device with Node 22+:

```sh
VERIFY_BASE_URL=https://YOUR_NAME.duckdns.org \
  node tarumt-nav-app/deploy/gcp/tests/verify_shared_ingress.mjs
```

Run against synthetic-demo data only. It creates one `Deployment check` session,
opens then disconnects the WebSocket, and does not send a position or journey.
The session expires through the backend's normal lifecycle. Do not disable TLS
validation to make a failed public check pass. Real DNS, ACME, VM firewall and
on-phone APK acceptance remain separate from the local HTTP integration check.
