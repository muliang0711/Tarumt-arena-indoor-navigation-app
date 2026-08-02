package memory

import (
	"context"
	"sort"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type OccupancyStore struct {
	sessions  *SessionStore
	presences *PresenceStore
}

func NewOccupancyStore(sessions *SessionStore, presences *PresenceStore) *OccupancyStore {
	return &OccupancyStore{sessions: sessions, presences: presences}
}

func (s *OccupancyStore) Snapshot(ctx context.Context, query ports.OccupancyQuery) (domain.FloorSnapshot, error) {
	sessions, err := s.sessions.list(ctx)
	if err != nil {
		return domain.FloorSnapshot{}, err
	}
	activeDevices := make(map[string]struct{})
	for _, session := range sessions {
		if !session.IsExpired(query.GeneratedAt) && !session.LastSeenAt.Before(query.ActiveSince) {
			activeDevices[session.DeviceRef] = struct{}{}
		}
	}
	total := len(activeDevices)
	floorCounts := make(map[string]int)
	floorPresences := make([]domain.Presence, 0)
	edgeCounts := make(map[[2]string]int)
	buildingTotal := 0
	for _, presence := range s.presences.list() {
		if presence.LastSeenAt.Before(query.ActiveSince) || presence.Position.BuildingID != query.BuildingID {
			continue
		}
		buildingTotal++
		floorCounts[presence.Position.FloorID]++
		if presence.Position.FloorID == query.FloorID {
			floorPresences = append(floorPresences, presence)
			fromNodeID, toNodeID := domain.CanonicalEdge(
				presence.Position.FromNodeID,
				presence.Position.ToNodeID,
			)
			edgeCounts[[2]string{fromNodeID, toNodeID}]++
		}
	}
	counts := make([]domain.FloorCount, 0, len(floorCounts))
	for floorID, count := range floorCounts {
		counts = append(counts, domain.FloorCount{FloorID: floorID, Count: count})
	}
	sort.Slice(counts, func(i, j int) bool { return counts[i].FloorID < counts[j].FloorID })
	edgeOccupancies := make([]domain.EdgeOccupancy, 0, len(edgeCounts))
	for edge, count := range edgeCounts {
		edgeOccupancies = append(edgeOccupancies, domain.EdgeOccupancy{
			FromNodeID: edge[0], ToNodeID: edge[1], ActiveUsers: count,
		})
	}
	sort.Slice(edgeOccupancies, func(i, j int) bool {
		if edgeOccupancies[i].FromNodeID != edgeOccupancies[j].FromNodeID {
			return edgeOccupancies[i].FromNodeID < edgeOccupancies[j].FromNodeID
		}
		return edgeOccupancies[i].ToNodeID < edgeOccupancies[j].ToNodeID
	})
	return domain.FloorSnapshot{
		TotalActiveUsers: total, BuildingActiveUsers: buildingTotal,
		BuildingID: query.BuildingID, FloorID: query.FloorID, FloorCounts: counts,
		Representatives: domain.SelectRepresentatives(query.BuildingID, query.FloorID, floorPresences, query.RepresentativeLimit),
		EdgeOccupancies: edgeOccupancies,
		GeneratedAt:     query.GeneratedAt.Format(time.RFC3339Nano),
	}, nil
}
