# CMP deployment runbook

For situation-based daily operations—including reboot recovery, backend
releases, APK releases, map updates, and troubleshooting—start with
[`../../deploy/OPERATIONS.md`](../../deploy/OPERATIONS.md).

## Scope

This runbook deploys Campus Navigator to the `hy-cmp` Ubuntu host as a
single-host friend-testing environment. It is deliberately smaller than a
high-availability production platform.

The deployment contains exactly five application containers:

1. Presence Gateway
2. Trajectory Worker
3. Analytics API
4. Redis
5. ClickHouse

Tailscale Funnel is an ingress Adapter, not another Go process in the
application architecture.

## Deployment seam

Flutter reaches only the Presence Gateway:

```text
Flutter -- HTTPS/WSS --> Tailscale Funnel --> 127.0.0.1:8080 Gateway
                                                    |
                                                    +--> Redis
Redis --> Trajectory Worker --> ClickHouse <-- Analytics API
```

The Compose application network is marked internal. Redis, ClickHouse, the
worker, and the Analytics API connect only to it and do not publish host ports.
The Gateway also joins a separate ingress network and publishes only to host
loopback, so the origin cannot be reached directly from the LAN or Tailnet.

## Host assumptions

The audited host is:

| Setting | Value |
| --- | --- |
| SSH | `hy@100.87.31.93` |
| Hostname | `hy-cmp` |
| OS | Ubuntu 24.04 |
| Capacity | 8 CPU, 15 GiB RAM, 98 GB root disk |
| Container runtime | Docker 29.6.2, Compose 5.3.1 |
| Deployment root | `/opt/campus-navigator` |

Run Docker through `sudo`. Membership in the `docker` group is intentionally
not required.

## One-time server preparation

Create the shared configuration:

```sh
ssh hy@100.87.31.93 \
  'sudo install -d -m 0755 /opt/campus-navigator/shared'

scp deploy/.env.production.example \
  hy@100.87.31.93:/tmp/campus-navigator-production.env

ssh -t hy@100.87.31.93 \
  'sudo install -m 0600 /tmp/campus-navigator-production.env \
    /opt/campus-navigator/shared/production.env &&
   rm /tmp/campus-navigator-production.env &&
   sudoedit /opt/campus-navigator/shared/production.env'
```

Generate four independent values with at least 32 characters. Use only ASCII
letters, digits, `_`, and `-`. For example, run `openssl rand -hex 32` once per
secret. Never commit the populated file.

## Validate locally

Use the example contract to render the complete model:

```sh
docker compose \
  --env-file deploy/.env.production.example \
  --file deploy/compose.production.yaml \
  config --quiet
```

This validation does not start containers.

## Deploy one committed revision

The deploy script refuses a dirty worktree because a release must correspond
to one reproducible Git revision:

```sh
deploy/scripts/deploy.sh hy@100.87.31.93
```

It performs these operations:

1. Archives the current Git commit.
2. Uploads it to the CMP.
3. Extracts it under `/opt/campus-navigator/releases/<commit>`.
4. validates the Compose model against the server-owned environment.
5. Builds and starts the five containers.
6. Runs the smoke-test Interface.
7. Moves `/opt/campus-navigator/current` only after the checks pass.

## Verify

Inspect the deployment:

```sh
ssh hy@100.87.31.93 \
  'cd /opt/campus-navigator/current &&
   deploy/scripts/smoke-test.sh \
     deploy/compose.production.yaml \
     /opt/campus-navigator/shared/production.env'
```

The smoke test verifies:

- all five containers are running;
- Gateway readiness;
- the current `main-campus` Map Bundle;
- anonymous-session creation;
- Redis connectivity;
- ClickHouse connectivity;
- worker and Analytics API readiness.

For an isolated local test project, set `CAMPUS_COMPOSE_PROJECT_NAME`; normal
CMP operations deliberately use the default `campus-navigator` project name.
The script uses direct Docker access when available and otherwise falls back to
non-interactive `sudo`, matching the audited CMP permission model.

## Logs

```sh
ssh hy@100.87.31.93 \
  'sudo docker compose --project-name campus-navigator \
     --env-file /opt/campus-navigator/shared/production.env \
     --file /opt/campus-navigator/current/deploy/compose.production.yaml \
     logs --tail 200'
```

Add a service name to the command to narrow the output. Docker JSON logs rotate
at the limits declared in the Compose file.

## Roll back

List releases and choose the last known-good commit:

```sh
ssh hy@100.87.31.93 \
  'ls -1 /opt/campus-navigator/releases'
```

Then render and start that exact release:

```sh
ssh hy@100.87.31.93 '
  release=/opt/campus-navigator/releases/<known-good-commit>
  env=/opt/campus-navigator/shared/production.env
  sudo docker compose --project-name campus-navigator \
    --env-file "$env" \
    --file "$release/deploy/compose.production.yaml" \
    up --detach --build --remove-orphans --wait &&
  "$release/deploy/scripts/smoke-test.sh" \
    "$release/deploy/compose.production.yaml" "$env" &&
  sudo ln -sfn "$release" /opt/campus-navigator/current
'
```

Database schema changes require a compatibility review before rollback. The
current schema is additive and the raw tables have a 30-day TTL.

## Persistence and known limits

ClickHouse uses the named `clickhouse-data` volume. Redis deliberately retains
the current volatile test policy: snapshots and AOF are disabled, and `/data`
is tmpfs. A Redis or host restart therefore removes active presence and any
Stream entries not yet consumed by the worker.

That tradeoff is accepted for this friend-testing stage. Before calling this a
durable production deployment, measure Stream backlog and recovery objectives,
then decide whether to enable AOF, replication/failover, or replace the event
transport. Do not present current Redis delivery as durable.

The 98 GB host disk is sufficient for initial testing, not unlimited analytics
retention. ClickHouse tables currently delete raw records after 30 days.

## Public HTTPS/WSS

After the private stack passes, expose only the Gateway:

```sh
ssh -t hy@100.87.31.93 \
  'sudo tailscale funnel --bg http://127.0.0.1:8080'
```

The first run may return an authorization URL that the Tailnet owner must
approve. Verify the assigned HTTPS hostname with:

```sh
ssh hy@100.87.31.93 'sudo tailscale funnel status'
```

Build Flutter with that HTTPS origin as `PRESENCE_BASE_URL`. The WebSocket
Adapter derives `wss` from the same origin, so no second public endpoint is
required.

## Operations deliberately deferred

The following are not justified for the friend-testing stage:

- multiple Gateway replicas;
- Redis replication or Sentinel;
- ClickHouse replication;
- Kubernetes;
- a public Analytics API;
- a separate load balancer.

The scaling playbook records the measurements that should trigger those
changes.
