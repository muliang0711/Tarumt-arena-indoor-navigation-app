package application

import (
	"context"
	"errors"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/campus-navigator/trajectory-worker/internal/application/ports"
)

type collectorSource struct {
	mu      sync.Mutex
	batches [][]ports.StreamMessage
	err     error
	limits  []int64
}

func (s *collectorSource) Read(ctx context.Context, count int64, block time.Duration) ([]ports.StreamMessage, error) {
	s.mu.Lock()
	s.limits = append(s.limits, count)
	if len(s.batches) > 0 {
		batch := s.batches[0]
		s.batches = s.batches[1:]
		s.mu.Unlock()
		return batch, nil
	}
	err := s.err
	s.mu.Unlock()
	if err != nil {
		return nil, err
	}
	timer := time.NewTimer(block)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-timer.C:
		return nil, nil
	}
}

func (s *collectorSource) EnsureGroup(context.Context) error { return nil }
func (s *collectorSource) Reclaim(context.Context, time.Duration, int64) ([]ports.StreamMessage, error) {
	return nil, nil
}
func (s *collectorSource) Acknowledge(context.Context, []string) error { return nil }
func (s *collectorSource) DeadLetter(context.Context, ports.StreamMessage, string) (bool, error) {
	return false, nil
}
func (s *collectorSource) Stats(context.Context) (ports.SourceStats, error) {
	return ports.SourceStats{}, nil
}
func (s *collectorSource) Ping(context.Context) error { return nil }
func (s *collectorSource) Close() error               { return nil }

func TestMicroBatchCollectorFlushesAtMaximumSize(t *testing.T) {
	t.Parallel()
	source := &collectorSource{batches: [][]ports.StreamMessage{
		{{ID: "2"}, {ID: "3"}},
		{{ID: "4"}, {ID: "5"}},
	}}
	collector := newMicroBatchCollector(source, 5, time.Second)

	batch, reason, _, err := collector.Collect(context.Background(), []ports.StreamMessage{{ID: "1"}})
	if err != nil {
		t.Fatal(err)
	}
	if reason != batchFlushReasonSize || len(batch) != 5 {
		t.Fatalf("reason=%q batch=%v", reason, batch)
	}
	if !reflect.DeepEqual(source.limits, []int64{4, 2}) {
		t.Fatalf("read limits=%v", source.limits)
	}
}

func TestMicroBatchCollectorFlushesPartialBatchAtDeadline(t *testing.T) {
	t.Parallel()
	source := &collectorSource{}
	collector := newMicroBatchCollector(source, 5, 20*time.Millisecond)

	startedAt := time.Now()
	batch, reason, duration, err := collector.Collect(context.Background(), []ports.StreamMessage{{ID: "1"}})
	if err != nil {
		t.Fatal(err)
	}
	if reason != batchFlushReasonTimeout || len(batch) != 1 {
		t.Fatalf("reason=%q batch=%v", reason, batch)
	}
	if duration < 15*time.Millisecond || time.Since(startedAt) > 500*time.Millisecond {
		t.Fatalf("unexpected collection duration %s", duration)
	}
}

func TestMicroBatchCollectorReturnsSourceFailureWithDeliveredMessagesUnacknowledged(t *testing.T) {
	t.Parallel()
	expected := errors.New("Redis unavailable")
	source := &collectorSource{err: expected}
	collector := newMicroBatchCollector(source, 5, time.Second)

	batch, reason, _, err := collector.Collect(context.Background(), []ports.StreamMessage{{ID: "1"}})
	if !errors.Is(err, expected) || reason != "" || len(batch) != 1 {
		t.Fatalf("batch=%v reason=%q err=%v", batch, reason, err)
	}
}

func TestMicroBatchCollectorHonorsParentCancellation(t *testing.T) {
	t.Parallel()
	source := &collectorSource{}
	collector := newMicroBatchCollector(source, 5, time.Second)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	batch, _, _, err := collector.Collect(ctx, []ports.StreamMessage{{ID: "1"}})
	if !errors.Is(err, context.Canceled) || len(batch) != 1 {
		t.Fatalf("batch=%v err=%v", batch, err)
	}
}
