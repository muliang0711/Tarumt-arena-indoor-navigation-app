package observability

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/campus-navigator/analytics-api/internal/domain"
)

func TestMetricsExposeCapacityAndClickHouseCostSignals(t *testing.T) {
	t.Parallel()
	metrics := NewMetrics()
	metrics.HTTPRequest()
	metrics.ConcurrencyRejected()
	metrics.QueryCompleted("floor_traffic", 40*time.Millisecond, domain.QueryStats{RowsRead: 120, BytesRead: 2400}, 3, 1)
	metrics.QueryFailed("floor_traffic")
	var output bytes.Buffer
	metrics.WritePrometheus(&output)

	for _, expected := range []string{
		"analytics_api_http_requests_total 1",
		"analytics_api_concurrency_rejected_total 1",
		"analytics_api_queries_completed_total{query=\"floor_traffic\"} 1",
		"analytics_api_queries_failed_total{query=\"floor_traffic\"} 1",
		"analytics_api_clickhouse_rows_read_total{query=\"floor_traffic\"} 120",
		"analytics_api_clickhouse_bytes_read_total{query=\"floor_traffic\"} 2400",
		"analytics_api_privacy_filtered_rows_total{query=\"floor_traffic\"} 1",
	} {
		if !strings.Contains(output.String(), expected) {
			t.Fatalf("metrics missing %q:\n%s", expected, output.String())
		}
	}
}
