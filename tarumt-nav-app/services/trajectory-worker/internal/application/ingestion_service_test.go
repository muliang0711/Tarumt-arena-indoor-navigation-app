package application

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"reflect"
	"testing"
	"time"

	"github.com/campus-navigator/trajectory-worker/internal/application/ports"
	"github.com/campus-navigator/trajectory-worker/internal/domain"
)

type fakeSource struct {
	steps        *[]string
	acknowledged []string
	deadLetters  []ports.StreamMessage
	deadReason   []string
}

func (s *fakeSource) EnsureGroup(context.Context) error { return nil }
func (s *fakeSource) Read(context.Context, int64, time.Duration) ([]ports.StreamMessage, error) {
	return nil, nil
}
func (s *fakeSource) Reclaim(context.Context, time.Duration, int64) ([]ports.StreamMessage, error) {
	return nil, nil
}
func (s *fakeSource) Acknowledge(_ context.Context, ids []string) error {
	*s.steps = append(*s.steps, "ack")
	s.acknowledged = append(s.acknowledged, ids...)
	return nil
}
func (s *fakeSource) DeadLetter(_ context.Context, message ports.StreamMessage, reason string) (bool, error) {
	*s.steps = append(*s.steps, "dead_letter")
	s.deadLetters = append(s.deadLetters, message)
	s.deadReason = append(s.deadReason, reason)
	return true, nil
}
func (s *fakeSource) Stats(context.Context) (ports.SourceStats, error) {
	return ports.SourceStats{}, nil
}
func (s *fakeSource) Ping(context.Context) error { return nil }
func (s *fakeSource) Close() error               { return nil }

type fakeRepository struct {
	steps    *[]string
	err      error
	failures int
	events   []domain.TrajectoryEvent
}

func (r *fakeRepository) InsertBatch(_ context.Context, events []domain.TrajectoryEvent) error {
	*r.steps = append(*r.steps, "insert")
	if r.failures > 0 {
		r.failures--
		return errors.New("temporary ClickHouse failure")
	}
	if r.err != nil {
		return r.err
	}
	r.events = append(r.events, events...)
	return nil
}

func TestProcessRetriesSameBatchBeforeAcknowledging(t *testing.T) {
	t.Parallel()
	steps := []string{}
	source := &fakeSource{steps: &steps}
	repo := &fakeRepository{steps: &steps, failures: 1}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	service := NewIngestionService(source, repo, ports.NoopObserver{}, logger, IngestionOptions{ErrorBackoff: time.Millisecond})

	if completed := service.processUntilSuccess(context.Background(), []ports.StreamMessage{validMessage("stream-1", "event-1")}, "test"); !completed {
		t.Fatal("retry loop stopped before the batch succeeded")
	}
	if !reflect.DeepEqual(steps, []string{"insert", "insert", "ack"}) {
		t.Fatalf("retry order = %v", steps)
	}
}
func (r *fakeRepository) Ping(context.Context) error { return nil }
func (r *fakeRepository) Close() error               { return nil }

func TestProcessInsertsBeforeAcknowledging(t *testing.T) {
	t.Parallel()
	steps := []string{}
	source := &fakeSource{steps: &steps}
	repo := &fakeRepository{steps: &steps}
	service := testService(source, repo)
	message := validMessage("stream-1", "event-1")

	if err := service.Process(context.Background(), []ports.StreamMessage{message}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(steps, []string{"insert", "ack"}) {
		t.Fatalf("processing order = %v", steps)
	}
	if len(repo.events) != 1 || !reflect.DeepEqual(source.acknowledged, []string{"stream-1"}) {
		t.Fatalf("events=%+v acknowledged=%v", repo.events, source.acknowledged)
	}
}

func TestProcessDoesNotAcknowledgeFailedInsert(t *testing.T) {
	t.Parallel()
	steps := []string{}
	source := &fakeSource{steps: &steps}
	repo := &fakeRepository{steps: &steps, err: errors.New("ClickHouse unavailable")}
	service := testService(source, repo)

	if err := service.Process(context.Background(), []ports.StreamMessage{validMessage("stream-1", "event-1")}); err == nil {
		t.Fatal("failed repository insert returned nil")
	}
	if !reflect.DeepEqual(steps, []string{"insert"}) || len(source.acknowledged) != 0 {
		t.Fatalf("steps=%v acknowledged=%v", steps, source.acknowledged)
	}
}

func TestProcessDeadLettersPoisonMessageAndContinuesBatch(t *testing.T) {
	t.Parallel()
	steps := []string{}
	source := &fakeSource{steps: &steps}
	repo := &fakeRepository{steps: &steps}
	service := testService(source, repo)
	invalid := validMessage("stream-bad", "event-bad")
	invalid.SchemaVersion = 99

	if err := service.Process(context.Background(), []ports.StreamMessage{invalid, validMessage("stream-good", "event-good")}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(steps, []string{"dead_letter", "insert", "ack"}) {
		t.Fatalf("processing order = %v", steps)
	}
	if len(source.deadLetters) != 1 || !reflect.DeepEqual(source.acknowledged, []string{"stream-good"}) {
		t.Fatalf("dead letters=%+v acknowledged=%v", source.deadLetters, source.acknowledged)
	}
}

func testService(source ports.EventSource, repo ports.TrajectoryRepository) *IngestionService {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return NewIngestionService(source, repo, ports.NoopObserver{}, logger, IngestionOptions{})
}

func validMessage(streamID, eventID string) ports.StreamMessage {
	payload := []byte(`{"event_id":"` + eventID + `","journey_id":"journey-1","building_id":"main","floor_id":"2","from_node_id":"a","to_node_id":"b","edge_progress":0.5,"heading":90,"movement_state":"walking","observed_at":"2026-07-22T12:00:00Z","ingested_at":"2026-07-22T12:00:00.001Z"}`)
	return ports.StreamMessage{ID: streamID, SchemaVersion: domain.SchemaVersion, EventID: eventID, Payload: payload}
}
