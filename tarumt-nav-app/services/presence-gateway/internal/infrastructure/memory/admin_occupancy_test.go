package memory

import (
	"context"
	"fmt"
	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
	"testing"
	"time"
)

func TestAdminSnapshotReturnsAll100WithoutChangingMobileLimit(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()
	presences := NewPresenceStore()
	occupancy := NewOccupancyStore(NewSessionStore(), presences)
	for i := 0; i < 102; i++ {
		id := fmt.Sprintf("user-%03d", i)
		floor := "floor-2"
		seen := now
		if i == 100 {
			floor = "other-floor"
		}
		if i == 101 {
			seen = now.Add(-time.Hour)
		}
		_, err := presences.Apply(ctx, ports.PresenceMutationRequest{
			Presence:   domain.Presence{SessionID: id, JourneyID: id, Position: domain.Position{BuildingID: "main-campus", FloorID: floor, FromNodeID: "a", ToNodeID: "b", EdgeProgress: .5, Heading: 90, MovementState: "walking"}, Sequence: 1, LastSeenAt: seen},
			Trajectory: domain.TrajectoryEvent{EventID: id, JourneyID: id, BuildingID: "main-campus", FloorID: floor, FromNodeID: "a", ToNodeID: "b", EdgeProgress: .5, Heading: 90, MovementState: "walking", ObservedAt: seen, IngestedAt: seen},
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	query := ports.OccupancyQuery{BuildingID: "main-campus", FloorID: "floor-2", ActiveSince: now.Add(-time.Minute), GeneratedAt: now, RepresentativeLimit: 10}
	mobile, err := occupancy.Snapshot(ctx, query)
	if err != nil {
		t.Fatal(err)
	}
	query.IncludeAll = true
	admin, err := occupancy.Snapshot(ctx, query)
	if err != nil {
		t.Fatal(err)
	}
	if len(mobile.Representatives) != 10 || len(admin.Representatives) != 100 {
		t.Fatalf("mobile=%d admin=%d; expected 10 and 100", len(mobile.Representatives), len(admin.Representatives))
	}
}
