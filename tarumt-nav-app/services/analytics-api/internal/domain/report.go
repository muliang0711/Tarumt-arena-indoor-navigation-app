package domain

import "time"

type AggregateRow struct {
	BucketStart  time.Time
	FromNodeID   string
	ToNodeID     string
	JourneyCount uint64
	EventCount   uint64
}

type QueryStats struct {
	RowsRead  uint64
	BytesRead uint64
}

type FloorTrafficPoint struct {
	BucketStart        time.Time `json:"bucket_start"`
	JourneyCount       uint64    `json:"journey_count"`
	MovementEventCount uint64    `json:"movement_event_count"`
	TrafficLevel       string    `json:"traffic_level"`
}

type RouteEdgeUsage struct {
	BucketStart         time.Time `json:"bucket_start"`
	FromNodeID          string    `json:"from_node_id"`
	ToNodeID            string    `json:"to_node_id"`
	JourneyCount        uint64    `json:"journey_count"`
	TraversalEventCount uint64    `json:"traversal_event_count"`
	UsageRank           int       `json:"usage_rank"`
}

type FloorTrafficReport struct {
	BuildingID  string              `json:"building_id"`
	FloorID     string              `json:"floor_id"`
	From        time.Time           `json:"from"`
	To          time.Time           `json:"to"`
	Bucket      Bucket              `json:"bucket"`
	GeneratedAt time.Time           `json:"generated_at"`
	Points      []FloorTrafficPoint `json:"points"`
}

type RouteEdgeReport struct {
	BuildingID  string           `json:"building_id"`
	FloorID     string           `json:"floor_id"`
	From        time.Time        `json:"from"`
	To          time.Time        `json:"to"`
	Bucket      Bucket           `json:"bucket"`
	GeneratedAt time.Time        `json:"generated_at"`
	Edges       []RouteEdgeUsage `json:"edges"`
}

func TrafficLevel(journeys uint64, policy QueryPolicy) string {
	switch {
	case journeys >= policy.BusyAt:
		return "busy"
	case journeys >= policy.ModerateAt:
		return "moderate"
	default:
		return "quiet"
	}
}
