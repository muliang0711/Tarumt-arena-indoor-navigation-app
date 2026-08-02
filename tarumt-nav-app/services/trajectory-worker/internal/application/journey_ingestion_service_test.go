package application

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"reflect"
	"testing"

	"github.com/campus-navigator/trajectory-worker/internal/application/ports"
	"github.com/campus-navigator/trajectory-worker/internal/domain"
)

type fakeJourneyRepository struct {
	steps  *[]string
	err    error
	events []domain.JourneyLifecycleEvent
}

func (r *fakeJourneyRepository) InsertBatch(
	_ context.Context,
	events []domain.JourneyLifecycleEvent,
) error {
	*r.steps = append(*r.steps, "insert_journey")
	if r.err != nil {
		return r.err
	}
	r.events = append(r.events, events...)
	return nil
}

func (r *fakeJourneyRepository) Ping(context.Context) error { return nil }
func (r *fakeJourneyRepository) Close() error               { return nil }

func TestJourneyProcessPersistsBeforeAcknowledging(t *testing.T) {
	t.Parallel()
	steps := []string{}
	source := &fakeSource{steps: &steps}
	repo := &fakeJourneyRepository{steps: &steps}
	service := testJourneyService(source, repo)

	if err := service.Process(
		context.Background(),
		[]ports.StreamMessage{validJourneyMessage("stream-1", "event-1")},
	); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(steps, []string{"insert_journey", "ack"}) {
		t.Fatalf("processing order = %v", steps)
	}
	if len(repo.events) != 1 || !reflect.DeepEqual(source.acknowledged, []string{"stream-1"}) {
		t.Fatalf("events=%+v acknowledged=%v", repo.events, source.acknowledged)
	}
}

func TestJourneyProcessDoesNotAcknowledgeFailedInsert(t *testing.T) {
	t.Parallel()
	steps := []string{}
	source := &fakeSource{steps: &steps}
	repo := &fakeJourneyRepository{
		steps: &steps,
		err:   errors.New("ClickHouse unavailable"),
	}
	service := testJourneyService(source, repo)

	if err := service.Process(
		context.Background(),
		[]ports.StreamMessage{validJourneyMessage("stream-1", "event-1")},
	); err == nil {
		t.Fatal("failed repository insert returned nil")
	}
	if !reflect.DeepEqual(steps, []string{"insert_journey"}) ||
		len(source.acknowledged) != 0 {
		t.Fatalf("steps=%v acknowledged=%v", steps, source.acknowledged)
	}
}

func TestJourneyProcessDeadLettersIdentityBearingPayload(t *testing.T) {
	t.Parallel()
	steps := []string{}
	source := &fakeSource{steps: &steps}
	repo := &fakeJourneyRepository{steps: &steps}
	service := testJourneyService(source, repo)
	message := validJourneyMessage("stream-bad", "event-bad")
	message.Payload = append(message.Payload[:len(message.Payload)-1], []byte(`,"session_id":"private"}`)...)

	if err := service.Process(context.Background(), []ports.StreamMessage{message}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(steps, []string{"dead_letter"}) || len(source.deadLetters) != 1 {
		t.Fatalf("steps=%v dead letters=%d", steps, len(source.deadLetters))
	}
}

func testJourneyService(
	source ports.EventSource,
	repo ports.JourneyLifecycleRepository,
) *JourneyIngestionService {
	return NewJourneyIngestionService(
		source,
		repo,
		ports.NoopObserver{},
		slog.New(slog.NewTextHandler(io.Discard, nil)),
		IngestionOptions{},
	)
}

func validJourneyMessage(streamID, eventID string) ports.StreamMessage {
	payload := []byte(`{"event_type":"journey_started","event_id":"` + eventID + `","client_event_id":"client-1","journey_id":"journey-1","client_journey_key":"key-1","map_id":"main-campus","map_revision":"sha256:9ce75cc7224ccc08e343761fb981c1625ca1b58231db1eb9c7270f1cf0a7865b","lifecycle_sequence":1,"route_revision":1,"occurred_at":"2026-07-26T02:00:00Z","ingested_at":"2026-07-26T02:00:00.050Z","planned_route":{"origin_node_id":"a","destination_node_id":"b","planned_edge_ids":["edge-a-b"]}}`)
	return ports.StreamMessage{
		ID: streamID, SchemaVersion: domain.JourneyLifecycleSchemaVersion,
		EventID: eventID, Payload: payload,
	}
}
