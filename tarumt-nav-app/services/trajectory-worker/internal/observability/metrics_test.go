package observability

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/campus-navigator/trajectory-worker/internal/application/ports"
)

func TestMetricsExposeScalingAndFailureSignals(t *testing.T) {
	t.Parallel()
	metrics := NewMetrics()
	metrics.BatchCollected(4, 100*time.Millisecond, "timeout")
	metrics.BatchRead(4)
	metrics.BatchInserted(3, 250*time.Millisecond)
	metrics.Acknowledged(3)
	metrics.Reclaimed(1)
	metrics.DeadLettered()
	metrics.Failed("insert")
	metrics.SetSourceStats(ports.SourceStats{Lag: 12, Pending: 2, StreamLength: 90, EntriesAdded: 100, Trimmed: 10})
	var output bytes.Buffer
	metrics.WritePrometheus(&output)
	encoded := output.String()
	for _, expected := range []string{
		"trajectory_worker_events_read_total 4",
		`trajectory_worker_batches_collected_by_reason_total{reason="timeout"} 1`,
		`trajectory_worker_batch_size_bucket{le="10"} 1`,
		"trajectory_worker_batch_size_sum 4",
		"trajectory_worker_batch_collection_duration_seconds_count 1",
		"trajectory_worker_events_inserted_total 3",
		"trajectory_worker_stream_lag 12",
		"trajectory_worker_stream_pending 2",
		"trajectory_worker_stream_length 90",
		"trajectory_worker_stream_trimmed_total 10",
		`trajectory_worker_failures_total{operation="insert"} 1`,
	} {
		if !strings.Contains(encoded, expected) {
			t.Fatalf("metrics missing %q:\n%s", expected, encoded)
		}
	}
}

func TestMetricsCanExposeJourneyPipelineIndependently(t *testing.T) {
	t.Parallel()
	metrics := NewMetricsWithPrefix("journey_lifecycle_worker")
	metrics.BatchRead(2)
	metrics.SetSourceStats(ports.SourceStats{Lag: 4})
	var output bytes.Buffer
	metrics.WritePrometheus(&output)
	encoded := output.String()
	for _, expected := range []string{
		"journey_lifecycle_worker_events_read_total 2",
		"journey_lifecycle_worker_stream_lag 4",
	} {
		if !strings.Contains(encoded, expected) {
			t.Fatalf("metrics missing %q:\n%s", expected, encoded)
		}
	}
	if strings.Contains(encoded, "trajectory_worker_events_read_total") {
		t.Fatalf("Journey metrics collided with trajectory metrics:\n%s", encoded)
	}
}
