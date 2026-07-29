# Scaling playbook

This playbook turns measured symptoms into the smallest justified change. Do
not scale a component merely because it exists in the architecture.

## Presence Gateway

Watch client journey completion, socket/ACK timeouts, active WebSockets,
message outcome latency, termination reasons, CPU, memory, and Redis command
latency.

When failures grow while accepted-message latency stays low, inspect floor
fan-out first. Coalesce rapid presence events, compute one floor snapshot per
change rather than per subscriber, send only representative deltas, and apply
explicit backpressure. Rerun the same stress profile before adding replicas.

The shared projection implements this policy. Alert on movement-triggered
snapshot queries (the expected value is zero), snapshot refresh failures,
subscriber drops, writer failures, and ACK completion below the workload
budget.

Add Gateway replicas behind a WebSocket-aware load balancer when a single
process is CPU-, memory-, connection-, or file-descriptor-bound after fan-out
work is bounded. Replicas share Redis but own their WebSocket connections. More
replicas will not by themselves remove a shared Redis or all-subscriber fan-out
bottleneck.

## Trajectory worker

Watch Stream lag, pending entries, insert batch duration, events inserted and
acknowledged, reclaimed messages, failures, dead letters, and Stream trimming.
Do this separately for the `trajectory_worker_` and
`journey_lifecycle_worker_` metric namespaces. The two internal pipelines have
independent Streams and consumer groups even though they share one process.

First tune batch size, block interval, ClickHouse insert timeout, and consumer
parallelism. Add another worker in the same Consumer Group only when lag grows
for a sustained period under a representative workload and one worker cannot
drain it within the recovery objective. Confirm ClickHouse accepts the added
insert concurrency.

A configured maximum batch size is not proof that effective batches are large.
Measure `events_inserted / insert_batches`. If the average approaches one under
continuous traffic, add a bounded accumulation window before scaling workers;
more workers would otherwise create tiny ClickHouse parts even faster.

The worker now closes a micro-batch when it reaches 500 messages or 100ms after
the first message, whichever happens first. Watch batch-size histograms and
size/timeout flush reasons. Increase the window only when ClickHouse still sees
small inserts and the extra analytical ingestion latency fits the objective.
Increase the size only when memory, ClickHouse insert limits, and retry cost
remain acceptable.

Consider Kafka only when Redis Streams' durability, retention, replay,
partition throughput, or independent-consumer requirements become the proven
constraint. Kafka is not a remedy for WebSocket fan-out or slow analytics
queries.

If only one pipeline accumulates lag, tune or split that pipeline based on its
own evidence. Do not add a second worker replica merely because the other
pipeline has higher event volume.

## Redis

Watch operation latency, CPU, memory, evictions, connection saturation, Stream
length/trim, and persistence health. Production availability requires
persistence plus replication/failover even if throughput is still low.

Reduce hot-key or fan-out work before sharding. Add connection capacity only
after proving pool waits. Move to clustering or a different event backbone only
when a measured single-node resource or operational requirement demands it.

## Analytics API and ClickHouse

Watch API p95/p99, failures, concurrency rejections, query duration, rows and
bytes read per query, ClickHouse CPU/memory, parts, merge pressure, disk usage,
and insert latency.

Use this order:

1. Correct filters, partition pruning, ordering keys, and query bounds.
2. Add a projection or materialized aggregate for a repeatedly expensive query
   shape.
3. Cache only when the same windows are requested repeatedly and acceptable
   staleness is defined.
4. Add read replicas when concurrent reads saturate a correctly shaped query
   workload.

PostgreSQL remains suitable for future transactional metadata, users, or
configuration. It should not replace ClickHouse merely to store high-volume
trajectory analytics.

## Evidence required for a scaling decision

Record the commit, scenario, load parameters, duration, machine or deployment
limits, client-visible completion and latency, service metrics, dependency
metrics, and correctness checks. Compare one controlled change at a time.
Archive the reviewed summary; raw local results may remain uncommitted.
