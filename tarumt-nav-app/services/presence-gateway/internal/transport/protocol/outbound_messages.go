package protocol

import (
	"time"

	"github.com/campus-navigator/presence-gateway/internal/domain"
)

const (
	TypeSessionReady         = "session_ready"
	TypeFloorSnapshot        = "floor_snapshot"
	TypePresenceJoined       = "presence_joined"
	TypePresenceUpdated      = "presence_updated"
	TypePresenceLeft         = "presence_left"
	TypeOccupancyUpdated     = "occupancy_updated"
	TypeEdgeOccupancyUpdated = "edge_occupancy_updated"
	TypeAck                  = "ack"
	TypePong                 = "pong"
	TypeError                = "error"
)

type SessionReady struct {
	SessionID        string `json:"session_id"`
	HeartbeatSeconds int64  `json:"heartbeat_seconds"`
}

type ActorPresence struct {
	ActorID   string          `json:"actor_id"`
	Position  domain.Position `json:"position"`
	Sequence  uint64          `json:"sequence"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type FloorSnapshot struct {
	TotalActiveUsers    int                    `json:"total_active_users"`
	BuildingActiveUsers int                    `json:"building_active_users"`
	BuildingID          string                 `json:"building_id"`
	FloorID             string                 `json:"floor_id"`
	FloorCounts         []domain.FloorCount    `json:"floor_counts"`
	Representatives     []ActorPresence        `json:"representatives"`
	EdgeOccupancies     []domain.EdgeOccupancy `json:"edge_occupancies"`
	GeneratedAt         string                 `json:"generated_at"`
}

type EdgeOccupancyUpdated struct {
	BuildingID      string                 `json:"building_id"`
	FloorID         string                 `json:"floor_id"`
	EdgeOccupancies []domain.EdgeOccupancy `json:"edge_occupancies"`
	GeneratedAt     string                 `json:"generated_at"`
}

type PresenceChanged struct {
	Actor ActorPresence `json:"actor"`
}

type PresenceLeft struct {
	ActorID string `json:"actor_id"`
}

type Acknowledgement struct {
	AcceptedSequence  uint64 `json:"accepted_sequence,omitempty"`
	JourneyID         string `json:"journey_id,omitempty"`
	LifecycleSequence uint64 `json:"lifecycle_sequence,omitempty"`
	RouteRevision     uint64 `json:"route_revision,omitempty"`
	Deduplicated      bool   `json:"deduplicated,omitempty"`
}

type ErrorMessage struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}
