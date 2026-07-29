# Stage 5.7 worker micro-batching improvement

## Status

Implemented and validated with deterministic tests, real Redis/ClickHouse
integration tests, the identical 60-second stress workload, and the stopped
worker recovery scenario on 2026-07-23.

## Bottleneck discovered in the Stage 5.6 report

The Stage 5.6 Gateway projection removed the first saturation boundary and
allowed all 51,980 accepted location updates to reach Redis Stream. That
exposed the next bottleneck:

1. `XREADGROUP COUNT 500` was treated as if it waited for 500 messages, but
   Redis uses `COUNT` as a maximum and returns as soon as messages are
   available.
2. The worker immediately inserted each returned one- or two-message result,
   producing 20,045 ClickHouse insert batches at about 1.8 inserted rows per
   batch.
3. Those tiny inserts amplified ClickHouse part and storage overhead until the
   local 3.9 GiB tmpfs filled. The worker stopped draining with lag 16,186 and
   pending 60 even though the Gateway completed the client workload.

The configured maximum batch size was therefore not evidence of effective
batching.

## Applied solutions

### Solution 1: bounded application-level accumulation

Redis Stream keeps one durable handoff event per accepted location update. The
worker application now accumulates already-delivered messages until either 500
messages are collected or 100ms has elapsed since the first message. No Redis
adapter or event contract was changed.

### Solution 2: retain at-least-once recovery

Collected messages remain in the Redis Consumer Group pending list. The worker
inserts the valid batch into ClickHouse and only then sends `XACK`. A transient
ClickHouse failure retries the same bounded batch without reading unbounded
additional work. A crash before acknowledgement leaves messages reclaimable by
the existing `XAUTOCLAIM` path.

### Solution 3: measure effective batching

The worker now exposes collected batch-size buckets, collection duration, and
bounded `size`/`timeout` flush-reason counters. The dashboard shows both
collected batch size and effective rows per successful ClickHouse insert.

## Latency and resource trade-off

The collector holds at most 500 messages and adds at most 100ms to analytical
ingestion after the first message. Hot traffic fills the size boundary sooner.
This delay is outside the Flutter acknowledgement and live-map path.

## Controlled before/after

The post-change run must use the same `trajectory_stress` parameters and local
Docker resource boundary as Stage 5.6. Targets are engineering acceptance
criteria, not results written in advance.

| Signal | Before | Acceptance target | After |
| --- | ---: | ---: | ---: |
| Gateway ACK completion | 100% | remain 100% | **100%** |
| Gateway socket errors | 0 | remain 0 | **0** |
| Accepted/Stream events | 51,980 | preserve every accepted event | **51,980** |
| ClickHouse insert batches | 20,045 | reduce by at least 90% | **571 (-97.2%)** |
| Effective rows per insert | about 1.8 | at least 50 under stress | **91.0** |
| Redis lag / pending after drain | 16,186 / 60 | 0 / 0 | **0 / 0** |
| ClickHouse final valid rows | 35,884 | equal valid Stream events | **51,980** |
| ClickHouse space errors | present | none | **none** |
| Dead letters / trimmed entries | 0 / 0 | 0 / 0 | **0 / 0** |

The worker formed 571 timeout-closed batches. Their average size was 91.0,
their p95 bucket was at most 250, and none reached the 500-message size limit
under this offered traffic shape. This is expected bounded behavior: the
100ms latency boundary closed batches while arrivals were below 500 events per
window.

Successful ClickHouse insert time totalled 1.693 seconds across 571 inserts.
After all 51,980 rows were present, the ClickHouse tmpfs used approximately
376.6 MiB of 3.9 GiB (9%), compared with the previous run exhausting the same
filesystem. The services remained healthy and logs contained no ClickHouse
space or worker processing errors.

The client-visible path also remained stable:

- 2,599 journeys completed with 51,980/51,980 location ACKs.
- ACK p95 remained 2ms and the failure rate remained zero.
- HTTP p95 was 0.782ms.
- Clients received 98,306 WebSocket messages and about 129 MB, preserving the
  Stage 5.6 projection improvement.

## Recovery validation

The worker was stopped while a bounded workload added 2,020 accepted events.
Redis reported lag 2,020 and pending zero because no worker had delivered those
new entries yet. After restart, the same Consumer Group drained to lag zero and
pending zero. Pipeline verification then confirmed readiness, no DLQ entries,
no Stream trim, and no visible ClickHouse duplicates.

The real integration suite also passed Gateway-to-Stream-to-Worker-to-
ClickHouse persistence, ACK ordering, pending recovery by another consumer,
deduplication, schema rejection, and privacy-safe dead-letter behavior.

## Measured outcome

The change reduced ClickHouse insert calls by 19,474 per identical workload,
or 97.2%, while increasing effective rows per insert from about 1.8 to 91.0
(about 50.6 times larger). The pipeline stored 16,096 more valid rows than the
previous saturated run and fully drained instead of ending with backlog.

The next scaling step is not automatically another worker or Kafka. The new
batch metrics should first be observed under longer and production-like
traffic. More workers are justified only if sustained lag returns while
ClickHouse still has safe insert and merge capacity.

## Architecture boundary

This change adds no service. Flutter still communicates only with the Presence
Gateway. Redis remains the shared realtime state and Stream handoff. The
Trajectory Worker alone owns batching and ClickHouse writes, and the Analytics
API remains read-only.
