package domain

import (
	"errors"
	"strings"
	"time"
)

var (
	ErrInvalidJourney        = errors.New("invalid journey")
	ErrJourneyNotActive      = errors.New("journey is not active")
	ErrJourneyAlreadyEnded   = errors.New("journey already ended")
	ErrJourneyOwnerMismatch  = errors.New("journey owner mismatch")
	ErrDestinationChanged    = errors.New("destination changed")
	ErrInvalidJourneyOutcome = errors.New("invalid journey outcome")
	ErrInvalidRerouteReason  = errors.New("invalid reroute reason")
)

type JourneyEventType string

const (
	JourneyStartedEvent    JourneyEventType = "journey_started"
	RouteRecalculatedEvent JourneyEventType = "route_recalculated"
	JourneyEndedEvent      JourneyEventType = "journey_ended"
)

type JourneyOutcome string

const (
	JourneyArrived    JourneyOutcome = "arrived"
	JourneyCancelled  JourneyOutcome = "cancelled"
	JourneySuperseded JourneyOutcome = "superseded"
	JourneyExpired    JourneyOutcome = "expired"
)

func (o JourneyOutcome) Valid() bool {
	switch o {
	case JourneyArrived, JourneyCancelled, JourneySuperseded, JourneyExpired:
		return true
	default:
		return false
	}
}

func (o JourneyOutcome) ClientAllowed() bool {
	return o == JourneyArrived || o == JourneyCancelled
}

type RerouteReason string

const (
	RerouteWrongWay               RerouteReason = "wrong_way"
	RerouteCongestion             RerouteReason = "congestion"
	RerouteBlockedEdge            RerouteReason = "blocked_edge"
	RerouteLocalizationCorrection RerouteReason = "localization_correction"
	RerouteUserRequested          RerouteReason = "user_requested"
)

func (r RerouteReason) Valid() bool {
	switch r {
	case RerouteWrongWay, RerouteCongestion, RerouteBlockedEdge,
		RerouteLocalizationCorrection, RerouteUserRequested:
		return true
	default:
		return false
	}
}

type PlannedRoute struct {
	OriginNodeID      string   `json:"origin_node_id"`
	DestinationNodeID string   `json:"destination_node_id"`
	PlannedEdgeIDs    []string `json:"planned_edge_ids"`
}

func (r PlannedRoute) Validate() error {
	if strings.TrimSpace(r.OriginNodeID) == "" ||
		strings.TrimSpace(r.DestinationNodeID) == "" ||
		len(r.PlannedEdgeIDs) == 0 {
		return ErrInvalidJourney
	}
	for _, edgeID := range r.PlannedEdgeIDs {
		if strings.TrimSpace(edgeID) == "" {
			return ErrInvalidJourney
		}
	}
	return nil
}

func (r PlannedRoute) Normalized() PlannedRoute {
	r.OriginNodeID = strings.TrimSpace(r.OriginNodeID)
	r.DestinationNodeID = strings.TrimSpace(r.DestinationNodeID)
	edges := make([]string, len(r.PlannedEdgeIDs))
	for index, edgeID := range r.PlannedEdgeIDs {
		edges[index] = strings.TrimSpace(edgeID)
	}
	r.PlannedEdgeIDs = edges
	return r
}

type ActiveJourney struct {
	JourneyID         string       `json:"journey_id"`
	DeviceRef         string       `json:"-"`
	SessionID         string       `json:"session_id"`
	ClientJourneyKey  string       `json:"client_journey_key"`
	MapID             string       `json:"map_id"`
	MapRevision       string       `json:"map_revision"`
	Route             PlannedRoute `json:"planned_route"`
	RouteRevision     uint64       `json:"route_revision"`
	LifecycleSequence uint64       `json:"lifecycle_sequence"`
	StartedAt         time.Time    `json:"started_at"`
	LastPositionAt    *time.Time   `json:"last_position_at,omitempty"`
}

func (j ActiveJourney) Validate() error {
	if strings.TrimSpace(j.JourneyID) == "" ||
		strings.TrimSpace(j.DeviceRef) == "" ||
		strings.TrimSpace(j.SessionID) == "" ||
		strings.TrimSpace(j.ClientJourneyKey) == "" ||
		strings.TrimSpace(j.MapID) == "" ||
		strings.TrimSpace(j.MapRevision) == "" ||
		j.RouteRevision == 0 ||
		j.LifecycleSequence == 0 ||
		j.StartedAt.IsZero() {
		return ErrInvalidJourney
	}
	return j.Route.Validate()
}

func (j ActiveJourney) IsDueForExpiry(
	now time.Time,
	firstPositionTimeout time.Duration,
	positionStaleAfter time.Duration,
) bool {
	if j.LastPositionAt == nil {
		return !now.Before(j.StartedAt.Add(firstPositionTimeout))
	}
	return !now.Before(j.LastPositionAt.Add(positionStaleAfter))
}

type JourneyLifecycleEvent struct {
	EventType         JourneyEventType `json:"event_type"`
	EventID           string           `json:"event_id"`
	ClientEventID     string           `json:"client_event_id,omitempty"`
	JourneyID         string           `json:"journey_id"`
	ClientJourneyKey  string           `json:"client_journey_key"`
	MapID             string           `json:"map_id"`
	MapRevision       string           `json:"map_revision"`
	LifecycleSequence uint64           `json:"lifecycle_sequence"`
	RouteRevision     uint64           `json:"route_revision"`
	OccurredAt        time.Time        `json:"occurred_at"`
	IngestedAt        time.Time        `json:"ingested_at"`
	PlannedRoute      *PlannedRoute    `json:"planned_route,omitempty"`
	RerouteReason     RerouteReason    `json:"reason,omitempty"`
	Outcome           JourneyOutcome   `json:"outcome,omitempty"`
}

func (e JourneyLifecycleEvent) Validate() error {
	if strings.TrimSpace(e.EventID) == "" ||
		strings.TrimSpace(e.JourneyID) == "" ||
		strings.TrimSpace(e.ClientJourneyKey) == "" ||
		strings.TrimSpace(e.MapID) == "" ||
		strings.TrimSpace(e.MapRevision) == "" ||
		e.LifecycleSequence == 0 ||
		e.RouteRevision == 0 ||
		e.OccurredAt.IsZero() ||
		e.IngestedAt.IsZero() {
		return ErrInvalidJourney
	}
	switch e.EventType {
	case JourneyStartedEvent:
		if strings.TrimSpace(e.ClientEventID) == "" ||
			e.PlannedRoute == nil ||
			e.PlannedRoute.Validate() != nil ||
			e.RerouteReason != "" ||
			e.Outcome != "" {
			return ErrInvalidJourney
		}
	case RouteRecalculatedEvent:
		if strings.TrimSpace(e.ClientEventID) == "" ||
			e.PlannedRoute == nil ||
			e.PlannedRoute.Validate() != nil ||
			!e.RerouteReason.Valid() ||
			e.Outcome != "" {
			return ErrInvalidJourney
		}
	case JourneyEndedEvent:
		if !e.Outcome.Valid() ||
			e.PlannedRoute != nil ||
			e.RerouteReason != "" {
			return ErrInvalidJourney
		}
	default:
		return ErrInvalidJourney
	}
	return nil
}
