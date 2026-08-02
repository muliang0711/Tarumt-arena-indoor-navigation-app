package application_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application"
	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/memory"
)

type journeyClock struct {
	now time.Time
}

func (c *journeyClock) Now() time.Time {
	return c.now
}

type journeyIDs struct {
	next int
}

func (g *journeyIDs) NewID() (string, error) {
	g.next++
	return fmt.Sprintf("generated-%02d", g.next), nil
}

type acceptingRoutes struct{}

func (acceptingRoutes) ValidateRoute(
	string,
	string,
	string,
	string,
	[]string,
) error {
	return nil
}

func newJourneyHarness() (
	*application.JourneyService,
	*memory.JourneyLifecycleStore,
	*journeyClock,
) {
	store := memory.NewJourneyLifecycleStore()
	clock := &journeyClock{
		now: time.Date(2026, 7, 26, 2, 0, 0, 0, time.UTC),
	}
	service := application.NewJourneyService(
		store,
		acceptingRoutes{},
		&journeyIDs{},
		clock,
		24*time.Hour,
		24*time.Hour,
		time.Minute,
		45*time.Second,
	)
	return service, store, clock
}

func startCommand(eventID, journeyKey string) application.StartJourneyCommand {
	return application.StartJourneyCommand{
		ClientEventID: eventID, ClientJourneyKey: journeyKey,
		MapID: "main-campus", MapRevision: "revision-1",
		Route: domain.PlannedRoute{
			OriginNodeID: "node-1", DestinationNodeID: "node-2",
			PlannedEdgeIDs: []string{"edge-1"},
		},
		OccurredAt: time.Date(2026, 7, 26, 2, 0, 0, 0, time.UTC),
	}
}

func TestJourneyLifecycleSupersedesAndDeduplicatesByDevice(t *testing.T) {
	ctx := context.Background()
	service, store, _ := newJourneyHarness()
	firstSession := domain.Session{ID: "session-1", DeviceRef: "device-1"}

	first, err := service.Start(ctx, firstSession, startCommand("client-1", "local-1"))
	if err != nil {
		t.Fatal(err)
	}
	retry, err := service.Start(ctx, firstSession, startCommand("client-1", "local-1"))
	if err != nil {
		t.Fatal(err)
	}
	if retry.JourneyID != first.JourneyID || !retry.Deduplicated {
		t.Fatalf("unexpected idempotent result: %#v", retry)
	}
	if len(store.LifecycleEvents()) != 1 {
		t.Fatal("retry appended another lifecycle event")
	}

	secondSession := domain.Session{ID: "session-2", DeviceRef: "device-1"}
	second, err := service.Start(
		ctx,
		secondSession,
		startCommand("client-2", "local-2"),
	)
	if err != nil {
		t.Fatal(err)
	}
	if second.JourneyID == first.JourneyID {
		t.Fatal("new command reused the superseded journey ID")
	}
	events := store.LifecycleEvents()
	if len(events) != 3 ||
		events[1].Outcome != domain.JourneySuperseded ||
		events[1].JourneyID != first.JourneyID ||
		events[2].EventType != domain.JourneyStartedEvent {
		t.Fatalf("unexpected supersede transaction: %#v", events)
	}
	active, err := service.Active(ctx, "device-1")
	if err != nil {
		t.Fatal(err)
	}
	if active.JourneyID != second.JourneyID ||
		active.SessionID != secondSession.ID {
		t.Fatalf("unexpected active journey: %#v", active)
	}
}

func TestJourneyRouteRecalculationAndEndEnforceLifecycleRules(t *testing.T) {
	ctx := context.Background()
	service, store, clock := newJourneyHarness()
	session := domain.Session{ID: "session-1", DeviceRef: "device-1"}
	started, err := service.Start(
		ctx,
		session,
		startCommand("client-1", "local-1"),
	)
	if err != nil {
		t.Fatal(err)
	}
	clock.now = clock.now.Add(time.Second)
	recalculated, err := service.Recalculate(
		ctx,
		session,
		application.RecalculateRouteCommand{
			ClientEventID: "client-2", JourneyID: started.JourneyID,
			ClientJourneyKey: "local-1", MapID: "main-campus",
			MapRevision: "revision-1", Reason: domain.RerouteWrongWay,
			OccurredAt: clock.now,
			Route: domain.PlannedRoute{
				OriginNodeID: "node-3", DestinationNodeID: "node-2",
				PlannedEdgeIDs: []string{"edge-2"},
			},
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if recalculated.LifecycleSequence != 2 ||
		recalculated.RouteRevision != 2 {
		t.Fatalf("unexpected revisions: %#v", recalculated)
	}

	changedDestination := application.RecalculateRouteCommand{
		ClientEventID: "client-3", JourneyID: started.JourneyID,
		ClientJourneyKey: "local-1", MapID: "main-campus",
		MapRevision: "revision-1", Reason: domain.RerouteUserRequested,
		OccurredAt: clock.now,
		Route: domain.PlannedRoute{
			OriginNodeID: "node-3", DestinationNodeID: "node-4",
			PlannedEdgeIDs: []string{"edge-3"},
		},
	}
	if _, err := service.Recalculate(
		ctx,
		session,
		changedDestination,
	); !errors.Is(err, domain.ErrDestinationChanged) {
		t.Fatalf("expected destination change rejection, got %v", err)
	}

	ended, err := service.End(ctx, session, application.EndJourneyCommand{
		ClientEventID: "client-4", JourneyID: started.JourneyID,
		ClientJourneyKey: "local-1", Outcome: domain.JourneyArrived,
		OccurredAt: clock.now,
	})
	if err != nil {
		t.Fatal(err)
	}
	if ended.LifecycleSequence != 3 || ended.RouteRevision != 2 {
		t.Fatalf("unexpected end result: %#v", ended)
	}
	if _, err := service.Active(ctx, "device-1"); !errors.Is(
		err,
		ports.ErrNotFound,
	) {
		t.Fatalf("ended journey remained active: %v", err)
	}
	if err := service.RecordPosition(
		ctx,
		"device-1",
		started.JourneyID,
		"session-1",
	); !errors.Is(err, domain.ErrJourneyAlreadyEnded) {
		t.Fatalf("ended journey reopened through position: %v", err)
	}
	if len(store.LifecycleEvents()) != 3 {
		t.Fatalf("unexpected event count: %d", len(store.LifecycleEvents()))
	}
}

func TestJourneyExpiryUsesTheTwoApprovedDeadlines(t *testing.T) {
	ctx := context.Background()
	service, store, clock := newJourneyHarness()
	session := domain.Session{ID: "session-1", DeviceRef: "device-1"}
	first, err := service.Start(
		ctx,
		session,
		startCommand("client-1", "local-1"),
	)
	if err != nil {
		t.Fatal(err)
	}
	clock.now = clock.now.Add(59 * time.Second)
	if _, err := service.SweepExpired(ctx, 100); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Active(ctx, "device-1"); err != nil {
		t.Fatal("journey expired before first-position timeout")
	}
	clock.now = clock.now.Add(time.Second)
	if _, err := service.SweepExpired(ctx, 100); err != nil {
		t.Fatal(err)
	}
	if got := store.LifecycleEvents(); len(got) != 2 ||
		got[1].Outcome != domain.JourneyExpired {
		t.Fatalf("first-position expiry not recorded: %#v", got)
	}

	second, err := service.Start(
		ctx,
		session,
		startCommand("client-2", "local-2"),
	)
	if err != nil {
		t.Fatal(err)
	}
	if err := service.RecordPosition(
		ctx,
		"device-1",
		second.JourneyID,
		"session-1",
	); err != nil {
		t.Fatal(err)
	}
	clock.now = clock.now.Add(44 * time.Second)
	if _, err := service.SweepExpired(ctx, 100); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Active(ctx, "device-1"); err != nil {
		t.Fatal("journey expired before stale-position timeout")
	}
	clock.now = clock.now.Add(time.Second)
	if _, err := service.SweepExpired(ctx, 100); err != nil {
		t.Fatal(err)
	}
	events := store.LifecycleEvents()
	if len(events) != 4 ||
		events[3].JourneyID != second.JourneyID ||
		events[3].Outcome != domain.JourneyExpired {
		t.Fatalf("stale-position expiry not recorded: %#v", events)
	}
	if first.JourneyID == second.JourneyID {
		t.Fatal("expired journey ID was reopened")
	}
}
