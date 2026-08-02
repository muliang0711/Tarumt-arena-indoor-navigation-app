package domain

import "strings"

type FloorCount struct {
	FloorID string `json:"floor_id"`
	Count   int    `json:"count"`
}

// EdgeOccupancy identifies a physical corridor without assigning it a travel
// direction. FromNodeID is always lexicographically before ToNodeID.
type EdgeOccupancy struct {
	FromNodeID  string `json:"from_node_id"`
	ToNodeID    string `json:"to_node_id"`
	ActiveUsers int    `json:"active_users"`
}

func CanonicalEdge(fromNodeID, toNodeID string) (string, string) {
	fromNodeID = strings.TrimSpace(fromNodeID)
	toNodeID = strings.TrimSpace(toNodeID)
	if fromNodeID <= toNodeID {
		return fromNodeID, toNodeID
	}
	return toNodeID, fromNodeID
}

type FloorSnapshot struct {
	TotalActiveUsers    int             `json:"total_active_users"`
	BuildingActiveUsers int             `json:"building_active_users"`
	BuildingID          string          `json:"building_id"`
	FloorID             string          `json:"floor_id"`
	FloorCounts         []FloorCount    `json:"floor_counts"`
	Representatives     []Presence      `json:"representatives"`
	EdgeOccupancies     []EdgeOccupancy `json:"edge_occupancies"`
	GeneratedAt         string          `json:"generated_at"`
}
