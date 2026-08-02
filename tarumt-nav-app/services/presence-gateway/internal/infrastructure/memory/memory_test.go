package memory

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

func TestRealtimeBrokerIsolatesFloors(t *testing.T) {
	t.Parallel()
	broker := NewRealtimeBroker(2)
	floorTwo := broker.Subscribe("main", "2")
	defer floorTwo.Close()
	floorThree := broker.Subscribe("main", "3")
	defer floorThree.Close()
	event := domain.Event{Type: domain.EventPresenceUpdated, BuildingID: "main", FloorID: "2"}
	if err := broker.Publish(context.Background(), event); err != nil {
		t.Fatal(err)
	}
	select {
	case <-floorTwo.Events():
	case <-time.After(time.Second):
		t.Fatal("floor 2 subscriber did not receive its event")
	}
	select {
	case <-floorThree.Events():
		t.Fatal("floor 3 subscriber received a floor 2 event")
	default:
	}
}

func TestRealtimeBrokerClosesSlowSubscriber(t *testing.T) {
	t.Parallel()
	broker := NewRealtimeBroker(1)
	subscriber := broker.Subscribe("main", "2")
	event := domain.Event{Type: domain.EventPresenceUpdated, BuildingID: "main", FloorID: "2"}
	if err := broker.Publish(context.Background(), event); err != nil {
		t.Fatal(err)
	}
	if err := broker.Publish(context.Background(), event); err != nil {
		t.Fatal(err)
	}
	<-subscriber.Events()
	if _, open := <-subscriber.Events(); open {
		t.Fatal("slow subscriber remained open after overflowing its bounded queue")
	}
}

func TestPresenceStoreConcurrentUpdatesKeepNewestSequence(t *testing.T) {
	t.Parallel()
	store := NewPresenceStore()
	ctx := context.Background()
	position := domain.Position{
		BuildingID: "main", FloorID: "2", FromNodeID: "a", ToNodeID: "b",
		EdgeProgress: 0.5, Heading: 90, MovementState: "walking",
	}
	var group sync.WaitGroup
	for sequence := uint64(1); sequence <= 100; sequence++ {
		group.Add(1)
		go func(sequence uint64) {
			defer group.Done()
			now := time.Now()
			_, _ = store.Apply(ctx, ports.PresenceMutationRequest{
				Presence: domain.Presence{
					JourneyID: "candidate", SessionID: "session", Position: position,
					Sequence: sequence, LastSeenAt: now,
				},
				Trajectory: domain.TrajectoryEvent{
					EventID: fmt.Sprintf("event-%d", sequence), JourneyID: "candidate",
					BuildingID: "main", FloorID: "2", FromNodeID: "a", ToNodeID: "b",
					EdgeProgress: .5, Heading: 90, MovementState: "walking",
					ObservedAt: now, IngestedAt: now,
				},
			})
		}(sequence)
	}
	group.Wait()
	presence, err := store.Get(ctx, "session")
	if err != nil {
		t.Fatal(err)
	}
	if presence.Sequence != 100 {
		t.Fatalf("stored sequence = %d, want 100", presence.Sequence)
	}
}

func TestPresenceStoreBoundsTrajectoryLog(t *testing.T) {
	t.Parallel()
	store := NewPresenceStore(TrajectoryOptions{Enabled: true, MaxLength: 2})
	now := time.Now().UTC()
	for sequence := 1; sequence <= 3; sequence++ {
		event := domain.TrajectoryEvent{
			EventID: fmt.Sprintf("event-%d", sequence), JourneyID: "journey",
			BuildingID: "main", FloorID: "2", FromNodeID: "a", ToNodeID: "b",
			EdgeProgress: .5, Heading: 90, MovementState: "walking",
			ObservedAt: now, IngestedAt: now,
		}
		if err := store.Append(context.Background(), event); err != nil {
			t.Fatal(err)
		}
	}
	events := store.TrajectoryEvents()
	if len(events) != 2 || events[0].EventID != "event-2" || events[1].EventID != "event-3" {
		t.Fatalf("bounded trajectory events = %+v", events)
	}
}

func TestOccupancySnapshotCombinesDirectionsAndDoesNotCountProgressUpdatesTwice(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	now := time.Now().UTC()
	presences := NewPresenceStore()
	occupancy := NewOccupancyStore(NewSessionStore(), presences)

	applyPresence := func(sessionID, fromNodeID, toNodeID string, sequence uint64, progress float64) {
		t.Helper()
		_, err := presences.Apply(ctx, ports.PresenceMutationRequest{
			Presence: domain.Presence{
				SessionID: sessionID,
				JourneyID: "journey-" + sessionID,
				Position: domain.Position{
					BuildingID: "main", FloorID: "2",
					FromNodeID: fromNodeID, ToNodeID: toNodeID,
					EdgeProgress: progress, Heading: 90, MovementState: "walking",
				},
				Sequence: sequence, LastSeenAt: now,
			},
			Trajectory: domain.TrajectoryEvent{
				EventID:    fmt.Sprintf("%s-%d", sessionID, sequence),
				JourneyID:  "journey-" + sessionID,
				BuildingID: "main", FloorID: "2",
				FromNodeID: fromNodeID, ToNodeID: toNodeID,
				EdgeProgress: progress, Heading: 90, MovementState: "walking",
				ObservedAt: now, IngestedAt: now,
			},
		})
		if err != nil {
			t.Fatal(err)
		}
	}

	applyPresence("one", "a", "b", 1, .2)
	applyPresence("two", "b", "a", 1, .4)
	applyPresence("one", "a", "b", 2, .8)

	snapshot, err := occupancy.Snapshot(ctx, ports.OccupancyQuery{
		BuildingID: "main", FloorID: "2",
		ActiveSince: now.Add(-time.Minute), GeneratedAt: now,
		RepresentativeLimit: 10,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.EdgeOccupancies) != 1 {
		t.Fatalf("edge occupancies = %+v, want one canonical edge", snapshot.EdgeOccupancies)
	}
	edge := snapshot.EdgeOccupancies[0]
	if edge.FromNodeID != "a" || edge.ToNodeID != "b" || edge.ActiveUsers != 2 {
		t.Fatalf("edge occupancy = %+v, want a-b with 2 active users", edge)
	}
}
