package application

import "github.com/campus-navigator/presence-gateway/internal/domain"

type LiveFloorUpdateType string

const (
	LiveFloorSnapshotUpdate      LiveFloorUpdateType = "snapshot"
	LiveFloorPresenceUpdate      LiveFloorUpdateType = "presence_updated"
	LiveFloorEdgeOccupancyUpdate LiveFloorUpdateType = "edge_occupancy_updated"
)

type LiveFloorUpdate struct {
	Type            LiveFloorUpdateType
	Snapshot        *domain.FloorSnapshot
	Presence        *domain.Presence
	BuildingID      string
	FloorID         string
	EdgeOccupancies []domain.EdgeOccupancy
}

type LiveFloorSubscription interface {
	Updates() <-chan LiveFloorUpdate
	Close()
}
