package domain

import (
	"errors"
	"testing"
	"time"
)

func TestActiveJourneyExpiryUsesFirstPositionAndStaleDeadlines(t *testing.T) {
	startedAt := time.Date(2026, 7, 26, 2, 0, 0, 0, time.UTC)
	active := ActiveJourney{StartedAt: startedAt}
	if active.IsDueForExpiry(
		startedAt.Add(59*time.Second),
		time.Minute,
		45*time.Second,
	) {
		t.Fatal("journey expired before first-position deadline")
	}
	if !active.IsDueForExpiry(
		startedAt.Add(time.Minute),
		time.Minute,
		45*time.Second,
	) {
		t.Fatal("journey did not expire at first-position deadline")
	}

	positionAt := startedAt.Add(10 * time.Second)
	active.LastPositionAt = &positionAt
	if active.IsDueForExpiry(
		positionAt.Add(44*time.Second),
		time.Minute,
		45*time.Second,
	) {
		t.Fatal("journey expired before stale-position deadline")
	}
	if !active.IsDueForExpiry(
		positionAt.Add(45*time.Second),
		time.Minute,
		45*time.Second,
	) {
		t.Fatal("journey did not expire at stale-position deadline")
	}
}

func TestJourneyLifecycleEventValidationSeparatesClientAndServerEvents(t *testing.T) {
	now := time.Date(2026, 7, 26, 2, 0, 0, 0, time.UTC)
	route := PlannedRoute{
		OriginNodeID: "node-1", DestinationNodeID: "node-2",
		PlannedEdgeIDs: []string{"edge-1"},
	}
	started := JourneyLifecycleEvent{
		EventType: JourneyStartedEvent, EventID: "event-1",
		JourneyID: "journey-1", ClientJourneyKey: "local-1",
		MapID: "map", MapRevision: "revision",
		LifecycleSequence: 1, RouteRevision: 1,
		OccurredAt: now, IngestedAt: now, PlannedRoute: &route,
	}
	if !errors.Is(started.Validate(), ErrInvalidJourney) {
		t.Fatal("client-originated start accepted without client_event_id")
	}

	expired := JourneyLifecycleEvent{
		EventType: JourneyEndedEvent, EventID: "event-2",
		JourneyID: "journey-1", ClientJourneyKey: "local-1",
		MapID: "map", MapRevision: "revision",
		LifecycleSequence: 2, RouteRevision: 1,
		OccurredAt: now, IngestedAt: now, Outcome: JourneyExpired,
	}
	if err := expired.Validate(); err != nil {
		t.Fatalf("server-originated expiry was rejected: %v", err)
	}
}
