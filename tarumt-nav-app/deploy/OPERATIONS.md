# Campus Navigator operator guide

This is the start-here guide for operating the CMP deployment and releasing
new Android APKs. It is organized by situation rather than by implementation
detail.

The deployment root on the CMP is `/opt/campus-navigator`. The remote host is
normally reachable through Tailscale as `hy@100.87.31.93`, and the public
Flutter endpoint is:

```text
https://hy-cmp.tailefdbe9.ts.net
```

## Decide what needs releasing

| Change | Backend deployment | New APK |
| --- | --- | --- |
| Flutter UI or local navigation logic only | No | Yes |
| Compatible Go implementation change | Yes | No |
| Backward-compatible HTTP/WebSocket addition | Backend first | Only if Flutter uses it |
| Breaking contract change | Deploy a backward-compatible backend first | Yes |
| `map-data/` asset or graph change | Yes | No |
| Compose or server environment change | Yes | No |
| Flutter build-time endpoint change | No | Yes |

Do not rebuild or restart everything automatically. Release only the side that
changed.

## Situation: the CMP rebooted

A normal reboot does **not** require a new deployment:

- Docker is enabled at boot.
- All five containers use `restart: unless-stopped`.
- `tailscaled` is enabled at boot.
- Tailscale Funnel configuration is persistent.
- ClickHouse data is stored in a named Docker volume.

Use this recovery order.

### 1. Check whether the host is online

Run on the Mac:

```sh
tailscale status
tailscale ping --c 3 hy-cmp
ssh -o ConnectTimeout=10 hy@100.87.31.93 'uptime'
```

If these work, continue to [Check the application](#2-check-the-application).

If Tailscale reports `hy-cmp` as offline or SSH times out, the problem is below
the application layer. Docker commands from the Mac cannot fix an unreachable
host.

Use a keyboard/monitor or another local access method on the CMP and run:

```sh
ip route
nmcli device status
nmcli connection show --active
systemctl --no-pager --full status NetworkManager tailscaled docker
```

Expected state:

- the Wi-Fi or Ethernet device is connected;
- a default route exists;
- `NetworkManager`, `tailscaled`, and `docker` are active.

If a saved network profile did not reconnect, list profiles and bring up the
correct saved profile:

```sh
nmcli connection show
sudo nmcli connection up "<saved-profile-name>"
```

Then recover only the inactive system process:

```sh
sudo systemctl enable --now tailscaled
sudo systemctl enable --now docker
```

If `tailscale status` says the machine is logged out, run:

```sh
sudo tailscale up
```

Open the authorization URL it prints. Do not run `tailscale up` when the
machine is already authenticated.

Useful boot logs:

```sh
sudo journalctl -b -u NetworkManager -n 100 --no-pager
sudo journalctl -b -u tailscaled -n 100 --no-pager
sudo journalctl -b -u docker -n 100 --no-pager
```

### 2. Check the application

Once SSH works, run from the Mac:

```sh
ssh hy@100.87.31.93 '
  sudo docker ps \
    --filter label=com.docker.compose.project=campus-navigator \
    --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
'
```

Expected containers:

1. `campus-navigator-presence-gateway-1`
2. `campus-navigator-trajectory-worker-1`
3. `campus-navigator-analytics-api-1`
4. `campus-navigator-redis-1`
5. `campus-navigator-clickhouse-1`

Every container should say `healthy`. Only Presence Gateway should publish a
host port, and it should be `127.0.0.1:8080`.

Run the complete smoke test:

```sh
ssh hy@100.87.31.93 '
  /opt/campus-navigator/current/deploy/scripts/smoke-test.sh \
    /opt/campus-navigator/current/deploy/compose.production.yaml \
    /opt/campus-navigator/shared/production.env
'
```

Check the public Interface:

```sh
curl --fail --show-error \
  https://hy-cmp.tailefdbe9.ts.net/health/ready
```

### 3. If Docker is active but the containers are stopped

Start the existing verified release. This is a restart, not a new deployment:

```sh
ssh hy@100.87.31.93 '
  release=/opt/campus-navigator/current
  environment_file=/opt/campus-navigator/shared/production.env

  sudo docker compose \
    --project-name campus-navigator \
    --env-file "$environment_file" \
    --file "$release/deploy/compose.production.yaml" \
    up --detach --remove-orphans --wait

  "$release/deploy/scripts/smoke-test.sh" \
    "$release/deploy/compose.production.yaml" \
    "$environment_file"
'
```

Do not add `--build` after a simple reboot unless an image is missing.

### 4. If the containers work but the public URL does not

Check Funnel:

```sh
ssh hy@100.87.31.93 'sudo tailscale funnel status'
```

Expected route:

```text
https://hy-cmp.tailefdbe9.ts.net
|-- / proxy http://127.0.0.1:8080
```

If the route is absent, restore only the ingress Adapter:

```sh
ssh -t hy@100.87.31.93 \
  'sudo tailscale funnel --bg http://127.0.0.1:8080'
```

New public DNS records can take several minutes to propagate.

## Situation: release a Flutter-only feature

Run all commands from the repository on the Mac.

### 1. Finish and commit the feature

The worktree must be intentional and reproducible:

```sh
cd /Users/puihockyang/coding_project/test
git status --short
git add <feature-files>
git commit -m "feat: describe the feature"
```

Do not use `git add .` when unrelated work is present.

### 2. Increase the Android version

Edit `flutter_app/pubspec.yaml`:

```yaml
version: 1.0.1+2
```

- `1.0.1` is the user-visible version.
- `2` is Android's version code.
- Increase the version code for every APK release.

Commit the version change.

### 3. Verify Flutter

```sh
cd /Users/puihockyang/coding_project/test/flutter_app
flutter pub get
flutter analyze
flutter test
```

Verify the real Map Bundle Interface:

```sh
MAP_BUNDLE_INTEGRATION_BASE_URL=https://hy-cmp.tailefdbe9.ts.net \
  flutter test \
  test/infrastructure/maps/remote_map_bundle_gateway_integration_test.dart
```

### 4. Build the friend-testing APK

```sh
flutter build apk --release \
  --dart-define=PRESENCE_MODE=realtime \
  --dart-define=PRESENCE_BASE_URL=https://hy-cmp.tailefdbe9.ts.net \
  --dart-define=WIFI_POSITIONING_SOURCE=auto \
  --dart-define=WIFI_POSITIONING_BASE_URL=https://uni-rssi-knn-api-server.onrender.com
```

The result is:

```text
flutter_app/build/app/outputs/flutter-apk/app-release.apk
```

Generate a checksum:

```sh
shasum -a 256 build/app/outputs/flutter-apk/app-release.apk
```

Rename the uploaded copy with its version:

```text
campus-navigator-v1.0.1-build2.apk
```

Upload it to Google Drive as a new versioned file and share a viewer link.
Send the checksum separately.

An existing installation updates in place only when:

- the application ID is unchanged;
- the new Android version code is higher;
- both APKs use the same signing certificate.

The current friend-testing APK uses the Mac's Android debug certificate. Keep
building from the same Mac. Configure a permanent release keystore before Play
Store or wider distribution.

## Situation: release a backend change

### 1. Verify the changed Go Module

Run the relevant tests:

```sh
cd /Users/puihockyang/coding_project/test/services/presence-gateway
go test ./...

cd /Users/puihockyang/coding_project/test/services/trajectory-worker
go test ./...

cd /Users/puihockyang/coding_project/test/services/analytics-api
go test ./...
```

Run only the Modules affected by the change, plus any cross-Module integration
test for a changed contract.

### 2. Commit and deploy one exact revision

The deployment script rejects a dirty worktree:

```sh
cd /Users/puihockyang/coding_project/test
git status --short
git log -1 --oneline
deploy/scripts/deploy.sh hy@100.87.31.93
```

The script:

1. archives the current Git commit;
2. creates `/opt/campus-navigator/releases/<commit>`;
3. builds and starts the five-container model;
4. waits for health checks;
5. runs the smoke test;
6. changes `current` only after validation succeeds.

After deployment:

```sh
curl --fail --show-error \
  https://hy-cmp.tailefdbe9.ts.net/health/ready

ssh hy@100.87.31.93 \
  'sudo readlink -f /opt/campus-navigator/current'
```

For a breaking client/server change, first release a backend that understands
both the old and new Flutter contracts. Release the new APK only after that
backend is healthy. Remove old-contract compatibility in a later release.

## Situation: publish a new map

The Gateway serves `map-data/` from the deployed Git release. A map-only change
therefore needs a backend deployment but normally does not need a new APK.

1. Publish and verify a new immutable Map Bundle revision.
2. Update `map-data/main-campus/current.json`.
3. Commit the complete `map-data/` change.
4. Run `deploy/scripts/deploy.sh hy@100.87.31.93`.
5. Verify the returned `bundle_revision`.

```sh
curl --fail --silent \
  https://hy-cmp.tailefdbe9.ts.net/v1/maps/main-campus/current
```

Flutter revalidates the current manifest and caches verified immutable assets.

## Situation: inspect a failure

### Status

```sh
ssh hy@100.87.31.93 '
  sudo docker compose \
    --project-name campus-navigator \
    --env-file /opt/campus-navigator/shared/production.env \
    --file /opt/campus-navigator/current/deploy/compose.production.yaml \
    ps
'
```

### Logs

All containers:

```sh
ssh hy@100.87.31.93 '
  sudo docker compose \
    --project-name campus-navigator \
    --env-file /opt/campus-navigator/shared/production.env \
    --file /opt/campus-navigator/current/deploy/compose.production.yaml \
    logs --tail 200
'
```

One Module:

```sh
ssh hy@100.87.31.93 '
  sudo docker compose \
    --project-name campus-navigator \
    --env-file /opt/campus-navigator/shared/production.env \
    --file /opt/campus-navigator/current/deploy/compose.production.yaml \
    logs --tail 200 presence-gateway
'
```

Valid names are `presence-gateway`, `trajectory-worker`, `analytics-api`,
`redis`, and `clickhouse`.

### Host resources

```sh
ssh hy@100.87.31.93 '
  free -h
  df -h /
  sudo docker system df
'
```

Do not prune images or volumes during diagnosis. Build cache is reusable and
the ClickHouse volume contains analytics data.

## Situation: roll back the backend

List releases:

```sh
ssh hy@100.87.31.93 \
  'ls -1 /opt/campus-navigator/releases'
```

Choose a known-good commit, then follow the rollback command in
`docs/operations/cmp-deployment.md`.

Rollback is safe only when the older code understands the current Redis and
ClickHouse schemas. Review database compatibility first.

## Situation: prepare a new CMP

First-time host preparation, secret generation, production Compose validation,
and the detailed rollback command are documented in:

```text
docs/operations/cmp-deployment.md
```

The server-owned secret file is:

```text
/opt/campus-navigator/shared/production.env
```

It must remain `root:root` with mode `0600`. Never copy it into Git, an APK,
chat, logs, or screenshots. The `.env.production.example` file contains names
only and is safe to commit.

## Safety rules

- Never expose Redis, ClickHouse, Worker, or Analytics API host ports.
- Flutter communicates only with Presence Gateway.
- Never run `docker compose down --volumes` on the CMP.
- Never delete `/opt/campus-navigator/shared/production.env`.
- Never deploy a dirty worktree.
- Never reuse a lower Android version code.
- Never send server secrets inside a Flutter `dart-define`.
- Keep at least one known-good release until the new release is verified.
- Treat Redis as volatile in the current friend-testing deployment.
- Treat ClickHouse as the only durable application data volume.

