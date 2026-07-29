# Stage 5.5 local performance baseline

Recorded on 2026-07-23. This is a repeatable engineering baseline, not a
production capacity claim or service-level agreement.

## Test environment

- Apple MacBook Air with Apple M4 (10 CPU cores) and 24 GB RAM
- macOS 26.5.2
- Docker Engine 29.5.3 with approximately 7.75 GiB visible to Docker
- One container each for Presence Gateway, trajectory worker, Analytics API,
  Redis 8.4, ClickHouse 25.3, Prometheus, Grafana, and Redis exporter
- All ports loopback-bound; Redis and ClickHouse data use temporary storage

The Compose stack deliberately represents the current architecture. It does
not model a load balancer, multiple gateways, Redis failover, multi-AZ network
latency, TLS termination, or production persistence.

## Results

| Scenario | Offered workload | Result | Interpretation |
| --- | --- | --- | --- |
| Smoke | 5 VUs looping for 15 seconds; 3 updates per journey | 50/50 journeys, 150/150 updates acknowledged, ACK p95 4 ms, session-create HTTP p95 3.11 ms, 0% failure | Protocol, metrics, and pipeline wiring are valid. |
| Steady presence | Ramp to 100 concurrent VUs; 20 updates per 22-second journey | 272/272 journeys completed, 5,440/5,440 updates acknowledged, ACK p95 10 ms, session-create HTTP p95 2.96 ms, 0% failure | Current single-node stack sustains this bounded concurrency test. It is not the maximum capacity. |
| Session churn | 20 new journeys/s for 30 seconds | 600/600 journeys, ACK p95 3 ms, session-create HTTP p95 1.00 ms, 0% failure | Anonymous-session creation and connect/disconnect cleanup remain stable at this rate. |
| Trajectory burst | 20 new journeys/s, 20 updates each, for 30 seconds | 601 journeys, 12,020/12,020 updates acknowledged (about 390/s), ACK p95 3 ms, no dropped iterations; worker peak lag 5 and pending 3, both drained to 0 | Worker and ClickHouse keep up with this short burst. No second worker is justified by this result. |
| Analytics reads | 20 aggregate queries/s for 30 seconds | 601/601 requests, HTTP p95 15.05 ms, max 47.72 ms, 0 failures and 0 concurrency rejections | Current local read latency passes the initial budget. |
| Worker recovery | Stop worker, accept 2,020 trajectory updates, restart worker | Redis Stream lag grew to 2,020 with pending 0; after restart both reached 0 in approximately 1 second | Consumer Group recovery works for this bounded outage. This does not prove durable recovery from Redis loss. |
| Increasing stress | Ramp 10 to 100 new journeys/s over 60 seconds; 20 updates per journey | 2,600 sessions started; 37,033 of 52,000 expected update ACKs arrived (71.2%); 1,954 socket errors; ACK p95 for the successful subset was 4 ms | This workload crossed the useful capacity boundary. Low ACK latency alone would hide the incomplete journeys. |

Every successful pipeline scenario also checked readiness, Stream lag and
pending, dead-letter count, Stream trimming, and visible ClickHouse duplicate
event IDs. The final burst drained with no dead letters, no trimming, and no
visible duplicates.

## Bottlenecks discovered

### The realtime fan-out path is the first observed limit

All stress clients subscribed to the same floor. The 2,600 sessions received
about 451,000 WebSocket messages while location acknowledgements remained only
71.2% complete. The client recorded 1,954 socket errors and Gateway metrics
recorded 11 writer failures. Each presence event currently causes work for
every floor subscriber, and representative checks can require an occupancy
snapshot. The traffic therefore grows much faster than the incoming update
rate. These signals locate the boundary in the Gateway/client broadcast path;
the next controlled experiment should separate server queue pressure, Redis
snapshot work, network output, and load-generator limits before attributing it
to one resource.

The correct next experiment is to reduce and coalesce floor broadcasts, avoid
recomputing the same snapshot per subscriber, and then rerun the identical
scenario. Adding Kafka or another trajectory worker would not fix this
Gateway-to-client fan-out path.

### Analytics queries scan more data than they return

The Analytics API completed its test quickly, but its own metrics show the
cost hidden behind the response latency:

- 301 floor-traffic queries read 8,613,416 rows and 930,360,599 bytes.
- 300 route-edge queries read 8,584,800 rows and 1,184,813,700 bytes.

This is acceptable for the current data size and rate. As history grows, use
rows/bytes scanned per query—not only HTTP latency—to decide when to add
ClickHouse projections or materialized rollups. A cache should follow evidence
of repeated identical windows, not be added automatically.

### Redis Stream and worker are not the first limit in this baseline

At roughly 390 accepted updates/s, worker lag peaked at 5 and pending at 3,
then immediately drained. The recovery test also drained a 2,020-event outage
backlog. This supports keeping one worker and Redis Streams for now. It does not
remove the production need for Redis persistence, replication, and failover.

## Corrections made while testing

Two false signals were found and removed from the harness:

1. The original recovery wait read a freshly restarted worker's in-memory
   gauges, which begin at zero and could falsely report a drained Stream. It
   now reads Redis `XINFO GROUPS` and `XPENDING` directly.
2. The original WebSocket load client closed after a fixed delay, which could
   manufacture missing acknowledgements. It now waits for every expected ACK
   and records ACK timeout, socket error, and protocol error independently.

These corrections are part of the result: performance evidence is only useful
when the measurement path is tested as carefully as the application path.

## Decision

Keep the current Redis Streams, one worker, and ClickHouse architecture.
Prioritize realtime fan-out optimization only when implementing the next
capacity improvement. Defer Kafka, extra workers, analytics caching, and
ClickHouse rollups until the triggers in the scaling playbook are observed.

The approved realtime projection improvement and same-workload comparison are
recorded in
[`stage-5.6-gateway-projection-improvement.md`](stage-5.6-gateway-projection-improvement.md).
