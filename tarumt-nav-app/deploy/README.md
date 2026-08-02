# CMP deployment

Start with [`OPERATIONS.md`](OPERATIONS.md) when:

- the CMP has rebooted or become unreachable;
- a container or the public URL is down;
- a new Flutter APK, backend revision, or map must be released;
- logs, rollback, environment setup, or recovery commands are needed.

This directory is the deployment Module for the single-host Campus Navigator
test environment. Its Interface is:

- `compose.production.yaml` defines the five runtime containers, their private
  application network, and the Gateway-only ingress network.
- `.env.production.example` defines the server-owned configuration contract.
- `scripts/deploy.sh` publishes one committed Git revision.
- `scripts/smoke-test.sh` verifies the deployed Interface through health, map,
  session, Redis, and ClickHouse checks.
- `gcp/manage-vm.sh` starts, stops, checks, or opens SSH to the shared Google
  Compute Engine test VM from Cloud Shell or another authenticated `gcloud`
  environment.
- `gcp/bootstrap-vm.sh` performs the first-time setup inside an Ubuntu Compute
  Engine VM: Docker, Tailscale, production secrets, all five containers,
  smoke tests, and the public HTTPS Funnel.

Implementation details such as ClickHouse user initialization live behind that
Interface. Flutter only crosses the public Presence Gateway seam. The
Gateway-only ingress network publishes loopback port 8080; Redis, ClickHouse,
the worker, and the Analytics API remain only on the internal application
network and have no host port.

See [`../docs/operations/cmp-deployment.md`](../docs/operations/cmp-deployment.md)
for the lower-level first-time infrastructure runbook.

## Google Compute Engine test VM

The shared test VM can be managed from Google Cloud Shell without keeping an
SSH session open:

```sh
cd ~/Tarumt-arena-indoor-navigation-app/tarumt-nav-app
bash deploy/gcp/manage-vm.sh status
bash deploy/gcp/manage-vm.sh start
bash deploy/gcp/manage-vm.sh ssh
bash deploy/gcp/manage-vm.sh stop
```

Stopping the VM stops compute charges and makes the backend unavailable, but
the attached persistent disk remains billable. Closing Cloud Shell or an SSH
window does not stop the VM. The stop command asks for confirmation so a
running test is not interrupted accidentally.

The defaults describe the current shared test VM:

```text
project:  formidable-gate-504309-r6
zone:     asia-southeast1-b
instance: tarumt-backend
```

For a different environment, override any default without editing the script:

```sh
GCP_PROJECT_ID=another-project \
GCP_ZONE=another-zone \
GCP_INSTANCE=another-instance \
bash deploy/gcp/manage-vm.sh status
```

## First-time VM bootstrap

Run the bootstrap script from inside the Compute Engine VM after cloning this
repository. It is safe to rerun: existing production secrets are preserved,
package installation is idempotent, and Docker reuses its build cache.

```sh
cd ~/Tarumt-arena-indoor-navigation-app/tarumt-nav-app
bash deploy/gcp/bootstrap-vm.sh
```

The script installs and enables Docker and Tailscale, creates the protected
`/opt/campus-navigator/shared/production.env` file when it is absent, builds
and starts the Compose application, runs the deployment smoke test, and maps
the loopback-only Gateway to a public Tailscale Funnel HTTPS URL.

Tailscale requires one-time interactive authorization. Open the login or
Funnel approval URL printed by the script. If Funnel approval interrupts the
first run, rerun the same bootstrap command; completed steps are retained.
Do not copy `production.env` into Git, an APK, chat, logs, or screenshots.

After this first-time bootstrap, normal VM starts do not require rerunning the
script. Docker, the five containers, `tailscaled`, and the saved Funnel
configuration resume automatically. Use `manage-vm.sh` from Cloud Shell to
start and stop the VM as needed.
