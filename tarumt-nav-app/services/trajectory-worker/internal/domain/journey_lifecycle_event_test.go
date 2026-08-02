package domain

import (
	"errors"
	"testing"
)

const validMapRevision = "sha256:9ce75cc7224ccc08e343761fb981c1625ca1b58231db1eb9c7270f1cf0a7865b"

func TestDecodeJourneyLifecycleAcceptsAllLifecycleShapes(t *testing.T) {
	t.Parallel()
	payloads := [][]byte{
		[]byte(`{"event_type":"journey_started","event_id":"event-1","client_event_id":"client-1","journey_id":"journey-1","client_journey_key":"key-1","map_id":"main-campus","map_revision":"` + validMapRevision + `","lifecycle_sequence":1,"route_revision":1,"occurred_at":"2026-07-26T02:00:00Z","ingested_at":"2026-07-26T02:00:00.050Z","planned_route":{"origin_node_id":"a","destination_node_id":"b","planned_edge_ids":["edge-a-b"]}}`),
		[]byte(`{"event_type":"route_recalculated","event_id":"event-2","client_event_id":"client-2","journey_id":"journey-1","client_journey_key":"key-1","map_id":"main-campus","map_revision":"` + validMapRevision + `","lifecycle_sequence":2,"route_revision":2,"occurred_at":"2026-07-26T02:01:00Z","ingested_at":"2026-07-26T02:01:00.050Z","reason":"wrong_way","planned_route":{"origin_node_id":"c","destination_node_id":"b","planned_edge_ids":["edge-c-b"]}}`),
		[]byte(`{"event_type":"journey_ended","event_id":"event-3","journey_id":"journey-1","client_journey_key":"key-1","map_id":"main-campus","map_revision":"` + validMapRevision + `","lifecycle_sequence":3,"route_revision":2,"occurred_at":"2026-07-26T02:05:00Z","ingested_at":"2026-07-26T02:05:00.050Z","outcome":"expired"}`),
	}
	for _, payload := range payloads {
		event, err := DecodeJourneyLifecycle(JourneyLifecycleSchemaVersion, payload)
		if err != nil {
			t.Fatal(err)
		}
		if event.JourneyID != "journey-1" {
			t.Fatalf("unexpected event: %+v", event)
		}
	}
}

func TestDecodeJourneyLifecycleRejectsIdentityAndInvalidVariant(t *testing.T) {
	t.Parallel()
	for _, payload := range [][]byte{
		[]byte(`{"event_type":"journey_ended","event_id":"event-3","journey_id":"journey-1","client_journey_key":"key-1","map_id":"main-campus","map_revision":"` + validMapRevision + `","lifecycle_sequence":3,"route_revision":2,"occurred_at":"2026-07-26T02:05:00Z","ingested_at":"2026-07-26T02:05:00.050Z","outcome":"expired","device_ref":"private"}`),
		[]byte(`{"event_type":"journey_started","event_id":"event-1","client_event_id":"client-1","journey_id":"journey-1","client_journey_key":"key-1","map_id":"main-campus","map_revision":"` + validMapRevision + `","lifecycle_sequence":1,"route_revision":1,"occurred_at":"2026-07-26T02:00:00Z","ingested_at":"2026-07-26T02:00:00.050Z","outcome":"arrived","planned_route":{"origin_node_id":"a","destination_node_id":"b","planned_edge_ids":["edge-a-b"]}}`),
	} {
		if _, err := DecodeJourneyLifecycle(JourneyLifecycleSchemaVersion, payload); !errors.Is(err, ErrInvalidJourneyLifecycleEvent) {
			t.Fatalf("expected invalid lifecycle event, got %v", err)
		}
	}
}
