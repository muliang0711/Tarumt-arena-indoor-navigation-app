package domain

import "time"

type EventType string

const (
	EventPresenceJoined       EventType = "presence_joined"
	EventPresenceUpdated      EventType = "presence_updated"
	EventPresenceLeft         EventType = "presence_left"
	EventOccupancyUpdated     EventType = "occupancy_updated"
	EventEdgeOccupancyChanged EventType = "edge_occupancy_changed"
	EventResyncRequired       EventType = "resync_required"
)

type EdgeOccupancyChange struct {
	FromNodeID string `json:"from_node_id"`
	ToNodeID   string `json:"to_node_id"`
	Delta      int    `json:"delta"`
}

type Event struct {
	Type        EventType
	BuildingID  string
	FloorID     string
	SessionID   string
	Presence    *Presence
	EdgeChanges []EdgeOccupancyChange
	OccurredAt  time.Time
}
