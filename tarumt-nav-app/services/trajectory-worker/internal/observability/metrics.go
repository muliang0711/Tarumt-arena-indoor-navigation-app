package observability

import (
	"fmt"
	"io"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/campus-navigator/trajectory-worker/internal/application/ports"
)

type Metrics struct {
	prefix           string
	batchesCollected atomic.Uint64
	batchSizeSum     atomic.Uint64
	collectionNS     atomic.Uint64
	batchSizeBuckets [7]atomic.Uint64
	flushBySize      atomic.Uint64
	flushByTimeout   atomic.Uint64
	read             atomic.Uint64
	inserted         atomic.Uint64
	acknowledged     atomic.Uint64
	reclaimed        atomic.Uint64
	deadLettered     atomic.Uint64
	insertDurationNS atomic.Uint64
	insertBatches    atomic.Uint64
	lag              atomic.Int64
	pending          atomic.Int64
	streamLength     atomic.Int64
	entriesAdded     atomic.Int64
	trimmed          atomic.Int64
	failureMu        sync.RWMutex
	failures         map[string]uint64
}

func NewMetrics() *Metrics {
	return NewMetricsWithPrefix("trajectory_worker")
}

func NewMetricsWithPrefix(prefix string) *Metrics {
	return &Metrics{prefix: prefix, failures: make(map[string]uint64)}
}

func (m *Metrics) BatchCollected(count int, duration time.Duration, reason string) {
	m.batchesCollected.Add(1)
	m.batchSizeSum.Add(uint64(count))
	m.collectionNS.Add(uint64(duration.Nanoseconds()))
	for index, upperBound := range [...]int{1, 10, 50, 100, 250, 500} {
		if count <= upperBound {
			m.batchSizeBuckets[index].Add(1)
		}
	}
	m.batchSizeBuckets[6].Add(1)
	switch reason {
	case "size":
		m.flushBySize.Add(1)
	default:
		m.flushByTimeout.Add(1)
	}
}

func (m *Metrics) BatchRead(count int) { m.read.Add(uint64(count)) }

func (m *Metrics) BatchInserted(count int, duration time.Duration) {
	m.inserted.Add(uint64(count))
	m.insertDurationNS.Add(uint64(duration.Nanoseconds()))
	m.insertBatches.Add(1)
}

func (m *Metrics) Acknowledged(count int) { m.acknowledged.Add(uint64(count)) }
func (m *Metrics) Reclaimed(count int)    { m.reclaimed.Add(uint64(count)) }
func (m *Metrics) DeadLettered()          { m.deadLettered.Add(1) }

func (m *Metrics) Failed(operation string) {
	m.failureMu.Lock()
	m.failures[operation]++
	m.failureMu.Unlock()
}

func (m *Metrics) SetSourceStats(stats ports.SourceStats) {
	m.lag.Store(stats.Lag)
	m.pending.Store(stats.Pending)
	m.streamLength.Store(stats.StreamLength)
	m.entriesAdded.Store(stats.EntriesAdded)
	m.trimmed.Store(stats.Trimmed)
}

func (m *Metrics) WritePrometheus(output io.Writer) {
	writeCounter(output, m.name("batches_collected_total"), m.batchesCollected.Load())
	fmt.Fprintf(output, "%s{reason=%q} %d\n", m.name("batches_collected_by_reason_total"), "size", m.flushBySize.Load())
	fmt.Fprintf(output, "%s{reason=%q} %d\n", m.name("batches_collected_by_reason_total"), "timeout", m.flushByTimeout.Load())
	for index, upperBound := range [...]string{"1", "10", "50", "100", "250", "500", "+Inf"} {
		fmt.Fprintf(output, "%s{le=%q} %d\n", m.name("batch_size_bucket"), upperBound, m.batchSizeBuckets[index].Load())
	}
	fmt.Fprintf(output, "%s %d\n", m.name("batch_size_sum"), m.batchSizeSum.Load())
	fmt.Fprintf(output, "%s %d\n", m.name("batch_size_count"), m.batchesCollected.Load())
	fmt.Fprintf(output, "%s %g\n", m.name("batch_collection_duration_seconds_sum"), float64(m.collectionNS.Load())/float64(time.Second))
	fmt.Fprintf(output, "%s %d\n", m.name("batch_collection_duration_seconds_count"), m.batchesCollected.Load())
	writeCounter(output, m.name("events_read_total"), m.read.Load())
	writeCounter(output, m.name("events_inserted_total"), m.inserted.Load())
	writeCounter(output, m.name("events_acknowledged_total"), m.acknowledged.Load())
	writeCounter(output, m.name("events_reclaimed_total"), m.reclaimed.Load())
	writeCounter(output, m.name("events_dead_lettered_total"), m.deadLettered.Load())
	writeCounter(output, m.name("clickhouse_insert_batches_total"), m.insertBatches.Load())
	fmt.Fprintf(output, "%s %g\n", m.name("clickhouse_insert_duration_seconds_sum"), float64(m.insertDurationNS.Load())/float64(time.Second))
	fmt.Fprintf(output, "%s %d\n", m.name("stream_lag"), m.lag.Load())
	fmt.Fprintf(output, "%s %d\n", m.name("stream_pending"), m.pending.Load())
	fmt.Fprintf(output, "%s %d\n", m.name("stream_length"), m.streamLength.Load())
	fmt.Fprintf(output, "%s %d\n", m.name("stream_entries_added_total"), m.entriesAdded.Load())
	fmt.Fprintf(output, "%s %d\n", m.name("stream_trimmed_total"), m.trimmed.Load())

	m.failureMu.RLock()
	operations := make([]string, 0, len(m.failures))
	for operation := range m.failures {
		operations = append(operations, operation)
	}
	sort.Strings(operations)
	for _, operation := range operations {
		fmt.Fprintf(output, "%s{operation=%q} %d\n", m.name("failures_total"), operation, m.failures[operation])
	}
	m.failureMu.RUnlock()
}

func (m *Metrics) name(suffix string) string {
	return m.prefix + "_" + suffix
}

type MetricsCollection []*Metrics

func (collection MetricsCollection) WritePrometheus(output io.Writer) {
	for _, metrics := range collection {
		metrics.WritePrometheus(output)
	}
}

func writeCounter(output io.Writer, name string, value uint64) {
	fmt.Fprintf(output, "%s %d\n", name, value)
}
