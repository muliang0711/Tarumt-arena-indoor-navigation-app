package observability

import (
	"fmt"
	"io"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

var durationBuckets = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5}

type httpKey struct {
	method string
	path   string
	status int
}

type messageKey struct {
	messageType string
	outcome     string
}

type snapshotKey struct {
	reason  string
	outcome string
}

type durationMetric struct {
	count   uint64
	sum     float64
	buckets []uint64
}

type Metrics struct {
	mu               sync.RWMutex
	httpRequests     map[httpKey]*durationMetric
	messages         map[messageKey]*durationMetric
	snapshotRefresh  map[snapshotKey]*durationMetric
	floorEvents      map[string]uint64
	floorMovements   map[string]uint64
	connectionsOpen  atomic.Uint64
	connectionsClose atomic.Uint64
	connectionsLive  atomic.Int64
	projectionsLive  atomic.Int64
	subscribersLive  atomic.Int64
	terminationMu    sync.RWMutex
	terminations     map[string]uint64
}

func NewMetrics() *Metrics {
	return &Metrics{
		httpRequests:    make(map[httpKey]*durationMetric),
		messages:        make(map[messageKey]*durationMetric),
		snapshotRefresh: make(map[snapshotKey]*durationMetric),
		floorEvents:     make(map[string]uint64),
		floorMovements:  make(map[string]uint64),
		terminations:    make(map[string]uint64),
	}
}

func (m *Metrics) ObserveHTTPRequest(method, path string, status int, duration time.Duration) {
	key := httpKey{method: normalizeMethod(method), path: normalizePath(path), status: status}
	m.mu.Lock()
	observe(m.httpRequests, key, duration)
	m.mu.Unlock()
}

func (m *Metrics) WebSocketOpened() {
	m.connectionsOpen.Add(1)
	m.connectionsLive.Add(1)
}

func (m *Metrics) WebSocketClosed() {
	m.connectionsClose.Add(1)
	m.connectionsLive.Add(-1)
}

func (m *Metrics) WebSocketTerminated(reason string) {
	m.terminationMu.Lock()
	m.terminations[normalizeTermination(reason)]++
	m.terminationMu.Unlock()
}

func (m *Metrics) WebSocketMessage(messageType, outcome string, duration time.Duration) {
	key := messageKey{messageType: normalizeMessageType(messageType), outcome: normalizeOutcome(outcome)}
	m.mu.Lock()
	observe(m.messages, key, duration)
	m.mu.Unlock()
}

func (m *Metrics) FloorProjectionOpened() {
	m.projectionsLive.Add(1)
}

func (m *Metrics) FloorProjectionClosed() {
	m.projectionsLive.Add(-1)
}

func (m *Metrics) FloorProjectionSubscriberAdded() {
	m.subscribersLive.Add(1)
}

func (m *Metrics) FloorProjectionSubscriberRemoved() {
	m.subscribersLive.Add(-1)
}

func (m *Metrics) FloorEventReceived(eventType string) {
	m.mu.Lock()
	m.floorEvents[normalizeFloorEvent(eventType)]++
	m.mu.Unlock()
}

func (m *Metrics) FloorSnapshotRefreshed(reason, outcome string, duration time.Duration) {
	key := snapshotKey{
		reason: normalizeSnapshotReason(reason), outcome: normalizeSnapshotOutcome(outcome),
	}
	m.mu.Lock()
	observe(m.snapshotRefresh, key, duration)
	m.mu.Unlock()
}

func (m *Metrics) FloorMovementHandled(outcome string) {
	m.mu.Lock()
	m.floorMovements[normalizeMovementOutcome(outcome)]++
	m.mu.Unlock()
}

func (m *Metrics) WritePrometheus(output io.Writer) {
	fmt.Fprintln(output, "# TYPE presence_gateway_websocket_connections_active gauge")
	fmt.Fprintf(output, "presence_gateway_websocket_connections_active %d\n", m.connectionsLive.Load())
	fmt.Fprintln(output, "# TYPE presence_gateway_websocket_connections_opened_total counter")
	fmt.Fprintf(output, "presence_gateway_websocket_connections_opened_total %d\n", m.connectionsOpen.Load())
	fmt.Fprintln(output, "# TYPE presence_gateway_websocket_connections_closed_total counter")
	fmt.Fprintf(output, "presence_gateway_websocket_connections_closed_total %d\n", m.connectionsClose.Load())
	fmt.Fprintln(output, "# TYPE presence_gateway_websocket_terminations_total counter")
	m.terminationMu.RLock()
	reasons := make([]string, 0, len(m.terminations))
	for reason := range m.terminations {
		reasons = append(reasons, reason)
	}
	sort.Strings(reasons)
	for _, reason := range reasons {
		fmt.Fprintf(output, "presence_gateway_websocket_terminations_total{reason=%s} %d\n", strconv.Quote(reason), m.terminations[reason])
	}
	m.terminationMu.RUnlock()

	m.mu.RLock()
	fmt.Fprintln(output, "# TYPE presence_gateway_floor_projections_active gauge")
	fmt.Fprintf(output, "presence_gateway_floor_projections_active %d\n", m.projectionsLive.Load())
	fmt.Fprintln(output, "# TYPE presence_gateway_floor_projection_subscribers_active gauge")
	fmt.Fprintf(output, "presence_gateway_floor_projection_subscribers_active %d\n", m.subscribersLive.Load())
	fmt.Fprintln(output, "# TYPE presence_gateway_floor_events_total counter")
	for _, eventType := range sortedCounterKeys(m.floorEvents) {
		fmt.Fprintf(output, "presence_gateway_floor_events_total{type=%s} %d\n", strconv.Quote(eventType), m.floorEvents[eventType])
	}
	fmt.Fprintln(output, "# TYPE presence_gateway_floor_movement_events_total counter")
	for _, outcome := range sortedCounterKeys(m.floorMovements) {
		fmt.Fprintf(output, "presence_gateway_floor_movement_events_total{outcome=%s} %d\n", strconv.Quote(outcome), m.floorMovements[outcome])
	}
	snapshotKeys := make([]snapshotKey, 0, len(m.snapshotRefresh))
	for key := range m.snapshotRefresh {
		snapshotKeys = append(snapshotKeys, key)
	}
	sort.Slice(snapshotKeys, func(i, j int) bool {
		if snapshotKeys[i].reason != snapshotKeys[j].reason {
			return snapshotKeys[i].reason < snapshotKeys[j].reason
		}
		return snapshotKeys[i].outcome < snapshotKeys[j].outcome
	})
	for _, key := range snapshotKeys {
		labels := fmt.Sprintf("reason=%s,outcome=%s", strconv.Quote(key.reason), strconv.Quote(key.outcome))
		writeDurationMetric(output, "presence_gateway_floor_snapshot_refresh_duration_seconds", labels, m.snapshotRefresh[key])
	}

	httpKeys := make([]httpKey, 0, len(m.httpRequests))
	for key := range m.httpRequests {
		httpKeys = append(httpKeys, key)
	}
	sort.Slice(httpKeys, func(i, j int) bool {
		if httpKeys[i].path != httpKeys[j].path {
			return httpKeys[i].path < httpKeys[j].path
		}
		if httpKeys[i].method != httpKeys[j].method {
			return httpKeys[i].method < httpKeys[j].method
		}
		return httpKeys[i].status < httpKeys[j].status
	})
	for _, key := range httpKeys {
		labels := fmt.Sprintf("method=%s,path=%s,status=%s", strconv.Quote(key.method), strconv.Quote(key.path), strconv.Quote(strconv.Itoa(key.status)))
		writeDurationMetric(output, "presence_gateway_http_request_duration_seconds", labels, m.httpRequests[key])
	}

	messageKeys := make([]messageKey, 0, len(m.messages))
	for key := range m.messages {
		messageKeys = append(messageKeys, key)
	}
	sort.Slice(messageKeys, func(i, j int) bool {
		if messageKeys[i].messageType != messageKeys[j].messageType {
			return messageKeys[i].messageType < messageKeys[j].messageType
		}
		return messageKeys[i].outcome < messageKeys[j].outcome
	})
	for _, key := range messageKeys {
		labels := fmt.Sprintf("type=%s,outcome=%s", strconv.Quote(key.messageType), strconv.Quote(key.outcome))
		writeDurationMetric(output, "presence_gateway_websocket_message_duration_seconds", labels, m.messages[key])
	}
	m.mu.RUnlock()
}

func sortedCounterKeys(values map[string]uint64) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func observe[K comparable](metrics map[K]*durationMetric, key K, duration time.Duration) {
	metric := metrics[key]
	if metric == nil {
		metric = &durationMetric{buckets: make([]uint64, len(durationBuckets))}
		metrics[key] = metric
	}
	metric.count++
	seconds := duration.Seconds()
	metric.sum += seconds
	for index, upper := range durationBuckets {
		if seconds <= upper {
			metric.buckets[index]++
		}
	}
}

func writeDurationMetric(output io.Writer, name, labels string, metric *durationMetric) {
	fmt.Fprintf(output, "%s_count{%s} %d\n", name, labels, metric.count)
	fmt.Fprintf(output, "%s_sum{%s} %g\n", name, labels, metric.sum)
	for index, upper := range durationBuckets {
		fmt.Fprintf(output, "%s_bucket{%s,le=%q} %d\n", name, labels, strconv.FormatFloat(upper, 'g', -1, 64), metric.buckets[index])
	}
	fmt.Fprintf(output, "%s_bucket{%s,le=\"+Inf\"} %d\n", name, labels, metric.count)
}

func normalizeMethod(method string) string {
	switch method {
	case "GET", "POST":
		return method
	default:
		return "other"
	}
}

func normalizePath(path string) string {
	switch path {
	case "/v1/anonymous-sessions", "/v1/presence", "/health/live", "/health/ready", "/metrics":
		return path
	default:
		return "other"
	}
}

func normalizeMessageType(messageType string) string {
	switch messageType {
	case "subscribe_floor", "change_floor", "location_update", "heartbeat",
		"leave", "journey_start", "route_recalculate", "journey_end", "decode":
		return messageType
	default:
		return "unknown"
	}
}

func normalizeOutcome(outcome string) string {
	switch outcome {
	case "accepted", "rejected", "failed":
		return outcome
	default:
		return "failed"
	}
}

func normalizeTermination(reason string) string {
	switch reason {
	case "slow_consumer", "event_forward_failed", "write_failed":
		return reason
	default:
		return "other"
	}
}

func normalizeFloorEvent(eventType string) string {
	switch eventType {
	case "presence_joined", "presence_updated", "presence_left", "occupancy_updated", "resync_required":
		return eventType
	default:
		return "unknown"
	}
}

func normalizeSnapshotReason(reason string) string {
	switch reason {
	case "initial", "membership", "resync":
		return reason
	default:
		return "unknown"
	}
}

func normalizeSnapshotOutcome(outcome string) string {
	switch outcome {
	case "success", "failed":
		return outcome
	default:
		return "failed"
	}
}

func normalizeMovementOutcome(outcome string) string {
	switch outcome {
	case "broadcast", "coalesced", "ignored_non_representative", "ignored_membership_dirty", "dropped_slow_subscriber":
		return outcome
	default:
		return "unknown"
	}
}
