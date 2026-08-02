package protocol

import "github.com/campus-navigator/presence-gateway/internal/domain"

const (
	TypeSubscribeFloor   = "subscribe_floor"
	TypeChangeFloor      = "change_floor"
	TypeLocationUpdate   = "location_update"
	TypeHeartbeat        = "heartbeat"
	TypeLeave            = "leave"
	TypeJourneyStart     = "journey_start"
	TypeRouteRecalculate = "route_recalculate"
	TypeJourneyEnd       = "journey_end"
)

type FloorSubscription struct {
	BuildingID string `json:"building_id"`
	FloorID    string `json:"floor_id"`
}

type LocationUpdate struct {
	Position domain.Position `json:"position"`
}

type JourneyStart struct {
	ClientEventID    string              `json:"client_event_id"`
	ClientJourneyKey string              `json:"client_journey_key"`
	MapID            string              `json:"map_id"`
	MapRevision      string              `json:"map_revision"`
	PlannedRoute     domain.PlannedRoute `json:"planned_route"`
}

type RouteRecalculate struct {
	ClientEventID    string               `json:"client_event_id"`
	JourneyID        string               `json:"journey_id"`
	ClientJourneyKey string               `json:"client_journey_key"`
	MapID            string               `json:"map_id"`
	MapRevision      string               `json:"map_revision"`
	Reason           domain.RerouteReason `json:"reason"`
	PlannedRoute     domain.PlannedRoute  `json:"planned_route"`
}

type JourneyEnd struct {
	ClientEventID    string                `json:"client_event_id"`
	JourneyID        string                `json:"journey_id"`
	ClientJourneyKey string                `json:"client_journey_key"`
	Outcome          domain.JourneyOutcome `json:"outcome"`
}
