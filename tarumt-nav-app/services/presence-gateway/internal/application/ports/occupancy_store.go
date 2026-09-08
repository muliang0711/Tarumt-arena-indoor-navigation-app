package ports

import (
	"context"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type OccupancyQuery struct {
	BuildingID          string
	FloorID             string
	ActiveSince         time.Time
	GeneratedAt         time.Time
	RepresentativeLimit int
	IncludeAll          bool
}

type OccupancyStore interface {
	Snapshot(context.Context, OccupancyQuery) (domain.FloorSnapshot, error)
}
