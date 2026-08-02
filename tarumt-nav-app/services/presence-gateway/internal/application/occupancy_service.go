package application

import (
	"context"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type OccupancyService struct {
	store      ports.OccupancyStore
	clock      ports.Clock
	staleAfter time.Duration
	limit      int
}

func NewOccupancyService(store ports.OccupancyStore, clock ports.Clock, staleAfter time.Duration, representativeLimit int) *OccupancyService {
	return &OccupancyService{store: store, clock: clock, staleAfter: staleAfter, limit: representativeLimit}
}

func (s *OccupancyService) Snapshot(ctx context.Context, buildingID, floorID string) (domain.FloorSnapshot, error) {
	now := s.clock.Now().UTC()
	return s.store.Snapshot(ctx, ports.OccupancyQuery{
		BuildingID: buildingID, FloorID: floorID,
		ActiveSince: now.Add(-s.staleAfter), GeneratedAt: now,
		RepresentativeLimit: s.limit,
	})
}
