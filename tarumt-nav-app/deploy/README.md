# Deploy Campus Navigator on Google Cloud

Start with [the Google Cloud deployment guide](../docs/operations/google-cloud-deployment.md).
It teaches a new deployment on **Compute Engine + Ubuntu + Docker Compose**,
with a reserved external IP, a free DuckDNS name, and one Caddy HTTPS/WSS ingress
for both the APK API and admin website.

This is a deployment plan and operator guide, not evidence that a new cloud
deployment has already succeeded. Replace all project, domain, and revision
placeholders before running commands. No cloud resources are created by reading it.

## Documentation

- [One-command website + APK ingress](FRONTEND-GCP.md): free DuckDNS hostname,
  shared public HTTPS/WSS, and private HTTP to the existing backend on the same VM.

- [Google Cloud first deployment](../docs/operations/google-cloud-deployment.md):
  VM, firewall, SSH, secrets, map bundle, database permissions, HTTPS, and verification.
- [Public API addresses for the frontend](../docs/operations/frontend-api-addresses.md):
  exact shared-origin URLs, APK build settings, and alternative hosting considerations.
- [Operations](OPERATIONS.md): restart, logs, updates, rollback, backup, and private Grafana.
- [Local admin demo](ADMIN-LOCAL.md): local Docker and simulated users; not a cloud deployment.

## Configuration boundaries

`compose.production.yaml` is the existing ten-container backend/monitoring stack.
It does not include public HTTPS ingress or the admin website. The cloud guide
uses `compose.frontend.yaml` as a separate `campus-admin` project containing the
admin server and shared Caddy. Caddy joins the existing backend network; no
Analytics host port or second host Caddy is required. Certificates persist in
the existing frontend named volumes. Runtime state stays outside the checkout.

Use the explicit commands in the new guide. The older
`gcp/bootstrap-vm.sh` and `scripts/deploy.sh` helpers have not been migrated to
this workflow and must not be used as shortcuts for it. The supported public
ingress entrypoint is now `gcp/deploy-frontend.sh` after backend preparation.

Redis, ClickHouse, the worker, Prometheus, exporters, and Grafana are not public
frontend APIs. Only the selected application routes go through HTTPS port 443.
The admin endpoints currently have no administrator authentication: publish
only synthetic demo data until an access-control decision is made.
