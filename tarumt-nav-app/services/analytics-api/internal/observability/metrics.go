package observability

import (
	"fmt"
	"io"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/campus-navigator/analytics-api/internal/domain"
)

var durationBuckets = []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5}

type queryMetrics struct {
	completed       uint64
	failed          uint64
	durationSum     float64
	durationBucket  []uint64
	rowsRead        uint64
	bytesRead       uint64
	resultRows      uint64
	privacyFiltered uint64
}

type Metrics struct {
	mu                  sync.RWMutex
	queries             map[string]*queryMetrics
	concurrencyRejected atomic.Uint64
	httpRequests        atomic.Uint64
}

func NewMetrics() *Metrics {
	return &Metrics{queries: make(map[string]*queryMetrics)}
}

func (m *Metrics) QueryCompleted(name string, duration time.Duration, stats domain.QueryStats, resultRows, privacyFiltered int) {
	m.mu.Lock()
	metric := m.query(name)
	metric.completed++
	seconds := duration.Seconds()
	metric.durationSum += seconds
	for index, upper := range durationBuckets {
		if seconds <= upper {
			metric.durationBucket[index]++
		}
	}
	metric.rowsRead += stats.RowsRead
	metric.bytesRead += stats.BytesRead
	metric.resultRows += uint64(resultRows)
	metric.privacyFiltered += uint64(privacyFiltered)
	m.mu.Unlock()
}

func (m *Metrics) QueryFailed(name string) {
	m.mu.Lock()
	m.query(name).failed++
	m.mu.Unlock()
}

func (m *Metrics) ConcurrencyRejected() { m.concurrencyRejected.Add(1) }
func (m *Metrics) HTTPRequest()         { m.httpRequests.Add(1) }

func (m *Metrics) WritePrometheus(output io.Writer) {
	fmt.Fprintf(output, "analytics_api_http_requests_total %d\n", m.httpRequests.Load())
	fmt.Fprintf(output, "analytics_api_concurrency_rejected_total %d\n", m.concurrencyRejected.Load())
	m.mu.RLock()
	names := make([]string, 0, len(m.queries))
	for name := range m.queries {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		metric := m.queries[name]
		label := strconv.Quote(name)
		fmt.Fprintf(output, "analytics_api_queries_completed_total{query=%s} %d\n", label, metric.completed)
		fmt.Fprintf(output, "analytics_api_queries_failed_total{query=%s} %d\n", label, metric.failed)
		fmt.Fprintf(output, "analytics_api_query_duration_seconds_sum{query=%s} %g\n", label, metric.durationSum)
		fmt.Fprintf(output, "analytics_api_query_duration_seconds_count{query=%s} %d\n", label, metric.completed)
		for index, upper := range durationBuckets {
			fmt.Fprintf(output, "analytics_api_query_duration_seconds_bucket{query=%s,le=%q} %d\n", label, strconv.FormatFloat(upper, 'g', -1, 64), metric.durationBucket[index])
		}
		fmt.Fprintf(output, "analytics_api_query_duration_seconds_bucket{query=%s,le=\"+Inf\"} %d\n", label, metric.completed)
		fmt.Fprintf(output, "analytics_api_clickhouse_rows_read_total{query=%s} %d\n", label, metric.rowsRead)
		fmt.Fprintf(output, "analytics_api_clickhouse_bytes_read_total{query=%s} %d\n", label, metric.bytesRead)
		fmt.Fprintf(output, "analytics_api_result_rows_total{query=%s} %d\n", label, metric.resultRows)
		fmt.Fprintf(output, "analytics_api_privacy_filtered_rows_total{query=%s} %d\n", label, metric.privacyFiltered)
	}
	m.mu.RUnlock()
}

func (m *Metrics) query(name string) *queryMetrics {
	metric := m.queries[name]
	if metric == nil {
		metric = &queryMetrics{durationBucket: make([]uint64, len(durationBuckets))}
		m.queries[name] = metric
	}
	return metric
}
