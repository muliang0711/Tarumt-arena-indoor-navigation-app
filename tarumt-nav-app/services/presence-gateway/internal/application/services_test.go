package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/domain"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/auth"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/identity"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/memory"
)

type fakeClock struct{ now time.Time }

func (c *fakeClock) Now() time.Time { return c.now }

type fixedID string

func (id fixedID) NewID() (string, error) { return string(id), nil }

type sequenceID struct{ values []string }

func (id *sequenceID) NewID() (string, error) {
	value := id.values[0]
	id.values = id.values[1:]
	return value, nil
}

func TestRepeatedInstallationCountsOnceAndSupersedesOldSession(t *testing.T) {
	ctx := context.Background()
	clock := &fakeClock{now: time.Date(2026, 7, 22, 8, 0, 0, 0, time.UTC)}
	sessions := memory.NewSessionStore()
	presences := memory.NewPresenceStore()
	ids := &sequenceID{values: []string{"session-1", "session-2"}}
	sessionService := NewSessionService(
		sessions,
		auth.NewJWTTokenService("01234567890123456789012345678901", "test"),
		identity.NewAnonymousIdentity("abcdefghijklmnopqrstuvwxyz123456"),
		ids, clock, time.Hour, 30*time.Minute,
	)
	presenceService := NewPresenceService(presences, sessions, memory.NewRealtimeBroker(8), clock, identity.UUIDGenerator{})
	occupancyService := NewOccupancyService(memory.NewOccupancyStore(sessions, presences), clock, 45*time.Second, 10)
	installationID := "8f912e7e-918b-4455-9561-f4494c44ff75"
	first, err := sessionService.Create(ctx, installationID)
	if err != nil {
		t.Fatal(err)
	}
	second, err := sessionService.Create(ctx, installationID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := sessionService.Authenticate(ctx, first.AccessToken); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("old token error = %v, want unauthorized", err)
	}
	if _, err := sessionService.Authenticate(ctx, second.AccessToken); err != nil {
		t.Fatal(err)
	}
	position := domain.Position{BuildingID: "main", FloorID: "2", FromNodeID: "a", ToNodeID: "b", EdgeProgress: .2, Heading: 90, MovementState: "walking"}
	if _, err := presenceService.Update(ctx, first.Session.ID, 1, position); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("superseded update error = %v, want unauthorized", err)
	}
	snapshot, err := occupancyService.Snapshot(ctx, "main", "2")
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.TotalActiveUsers != 1 {
		t.Fatalf("total users = %d, want 1", snapshot.TotalActiveUsers)
	}
}

func TestSessionPresenceAndOccupancyLifecycle(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	clock := &fakeClock{now: time.Date(2026, 7, 22, 8, 0, 0, 0, time.UTC)}
	sessions := memory.NewSessionStore()
	presences := memory.NewPresenceStore()
	occupancyStore := memory.NewOccupancyStore(sessions, presences)
	broker := memory.NewRealtimeBroker(8)
	tokens := auth.NewJWTTokenService("01234567890123456789012345678901", "test")
	identities := identity.NewAnonymousIdentity("abcdefghijklmnopqrstuvwxyz123456")
	sessionService := NewSessionService(sessions, tokens, identities, fixedID("session-1"), clock, time.Hour, 30*time.Minute)
	presenceService := NewPresenceService(presences, sessions, broker, clock, identity.UUIDGenerator{})
	occupancyService := NewOccupancyService(occupancyStore, clock, 45*time.Second, 10)

	created, err := sessionService.Create(ctx, "8f912e7e-918b-4455-9561-f4494c44ff75")
	if err != nil {
		t.Fatal(err)
	}
	if created.Session.DeviceRef == "8f912e7e-918b-4455-9561-f4494c44ff75" {
		t.Fatal("raw installation ID was stored")
	}
	if _, err := sessionService.Authenticate(ctx, created.AccessToken); err != nil {
		t.Fatalf("issued token did not authenticate: %v", err)
	}

	position := domain.Position{
		BuildingID: "main", FloorID: "2", FromNodeID: "a", ToNodeID: "b",
		EdgeProgress: 0.25, Heading: 90, MovementState: "walking",
	}
	firstPresence, err := presenceService.Update(ctx, created.Session.ID, 1, position)
	if err != nil {
		t.Fatal(err)
	}
	if firstPresence.JourneyID == "" {
		t.Fatal("first accepted presence did not receive a journey ID")
	}
	if _, err := presenceService.Update(ctx, created.Session.ID, 1, position); !errors.Is(err, domain.ErrStaleSequence) {
		t.Fatalf("duplicate sequence error = %v, want ErrStaleSequence", err)
	}
	if events := presences.TrajectoryEvents(); len(events) != 1 || events[0].JourneyID != firstPresence.JourneyID {
		t.Fatalf("trajectory events after duplicate = %+v", events)
	}
	position.EdgeProgress = 0.5
	secondPresence, err := presenceService.Update(ctx, created.Session.ID, 2, position)
	if err != nil {
		t.Fatal(err)
	}
	if secondPresence.JourneyID != firstPresence.JourneyID {
		t.Fatalf("journey changed during navigation: first=%q second=%q", firstPresence.JourneyID, secondPresence.JourneyID)
	}
	if events := presences.TrajectoryEvents(); len(events) != 2 || events[1].JourneyID != firstPresence.JourneyID {
		t.Fatalf("trajectory events after accepted update = %+v", events)
	}
	snapshot, err := occupancyService.Snapshot(ctx, "main", "2")
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.TotalActiveUsers != 1 || snapshot.BuildingActiveUsers != 1 || len(snapshot.Representatives) != 1 {
		t.Fatalf("unexpected snapshot: %+v", snapshot)
	}

	clock.now = clock.now.Add(46 * time.Second)
	if err := presenceService.SweepExpired(ctx, 45*time.Second); err != nil {
		t.Fatal(err)
	}
	snapshot, err = occupancyService.Snapshot(ctx, "main", "2")
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.TotalActiveUsers != 0 || snapshot.BuildingActiveUsers != 0 || len(snapshot.Representatives) != 0 {
		t.Fatalf("stale user remained active: %+v", snapshot)
	}

	thirdPresence, err := presenceService.Update(ctx, created.Session.ID, 3, position)
	if err != nil {
		t.Fatal(err)
	}
	if thirdPresence.JourneyID == firstPresence.JourneyID {
		t.Fatalf("new navigation reused completed journey %q", thirdPresence.JourneyID)
	}
	if events := presences.TrajectoryEvents(); len(events) != 3 || events[2].JourneyID != thirdPresence.JourneyID {
		t.Fatalf("trajectory events after new navigation = %+v", events)
	}
}

func TestPresencePublishesTrafficOnlyWhenPhysicalEdgeChanges(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	clock := &fakeClock{now: time.Date(2026, 7, 22, 8, 0, 0, 0, time.UTC)}
	sessions := memory.NewSessionStore()
	presences := memory.NewPresenceStore()
	broker := memory.NewRealtimeBroker(8)
	sessionService := NewSessionService(
		sessions,
		auth.NewJWTTokenService("01234567890123456789012345678901", "test"),
		identity.NewAnonymousIdentity("abcdefghijklmnopqrstuvwxyz123456"),
		fixedID("session-1"), clock, time.Hour, 30*time.Minute,
	)
	ids := &sequenceID{values: []string{
		"event-1", "journey-1",
		"event-2", "journey-2",
		"event-3", "journey-3",
	}}
	presenceService := NewPresenceService(
		presences, sessions, broker, clock, ids,
	)
	created, err := sessionService.Create(
		ctx,
		"8f912e7e-918b-4455-9561-f4494c44ff75",
	)
	if err != nil {
		t.Fatal(err)
	}
	subscription := broker.Subscribe("main", "2")
	defer subscription.Close()
	position := domain.Position{
		BuildingID: "main", FloorID: "2",
		FromNodeID: "a", ToNodeID: "b",
		EdgeProgress: .2, Heading: 90, MovementState: "walking",
	}
	if _, err := presenceService.Update(ctx, created.Session.ID, 1, position); err != nil {
		t.Fatal(err)
	}
	awaitPresenceEvent(t, subscription.Events())
	awaitPresenceEvent(t, subscription.Events())

	position.EdgeProgress = .8
	if _, err := presenceService.Update(ctx, created.Session.ID, 2, position); err != nil {
		t.Fatal(err)
	}
	if event := awaitPresenceEvent(t, subscription.Events()); event.Type != domain.EventPresenceUpdated {
		t.Fatalf("same-edge event = %s, want presence_updated only", event.Type)
	}
	select {
	case event := <-subscription.Events():
		t.Fatalf("same-edge progress emitted extra event: %+v", event)
	case <-time.After(20 * time.Millisecond):
	}

	position.FromNodeID = "b"
	position.ToNodeID = "c"
	position.EdgeProgress = .1
	if _, err := presenceService.Update(ctx, created.Session.ID, 3, position); err != nil {
		t.Fatal(err)
	}
	edgeEvent := awaitPresenceEvent(t, subscription.Events())
	if edgeEvent.Type != domain.EventEdgeOccupancyChanged ||
		len(edgeEvent.EdgeChanges) != 2 {
		t.Fatalf("edge transition event = %+v", edgeEvent)
	}
	if event := awaitPresenceEvent(t, subscription.Events()); event.Type != domain.EventPresenceUpdated {
		t.Fatalf("event after edge transition = %s, want presence_updated", event.Type)
	}
}

func awaitPresenceEvent(t *testing.T, events <-chan domain.Event) domain.Event {
	t.Helper()
	select {
	case event := <-events:
		return event
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for presence event")
		return domain.Event{}
	}
}
