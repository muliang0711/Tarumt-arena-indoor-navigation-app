package domain

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"
)

const JourneyLifecycleSchemaVersion = 1

var (
	ErrInvalidJourneyLifecycleEvent = errors.New("invalid journey lifecycle event")
	mapRevisionPattern              = regexp.MustCompile(`^sha256:[a-f0-9]{64}$`)
)

type PlannedRoute struct {
	OriginNodeID      string   `json:"origin_node_id"`
	DestinationNodeID string   `json:"destination_node_id"`
	PlannedEdgeIDs    []string `json:"planned_edge_ids"`
}

type JourneyLifecycleEvent struct {
	EventType         string        `json:"event_type"`
	EventID           string        `json:"event_id"`
	ClientEventID     string        `json:"client_event_id,omitempty"`
	JourneyID         string        `json:"journey_id"`
	ClientJourneyKey  string        `json:"client_journey_key"`
	MapID             string        `json:"map_id"`
	MapRevision       string        `json:"map_revision"`
	LifecycleSequence uint64        `json:"lifecycle_sequence"`
	RouteRevision     uint64        `json:"route_revision"`
	OccurredAt        time.Time     `json:"occurred_at"`
	IngestedAt        time.Time     `json:"ingested_at"`
	PlannedRoute      *PlannedRoute `json:"planned_route,omitempty"`
	Reason            string        `json:"reason,omitempty"`
	Outcome           string        `json:"outcome,omitempty"`
}

func DecodeJourneyLifecycle(version int, payload []byte) (JourneyLifecycleEvent, error) {
	if version != JourneyLifecycleSchemaVersion {
		return JourneyLifecycleEvent{}, fmt.Errorf(
			"%w: unsupported schema version %d",
			ErrInvalidJourneyLifecycleEvent,
			version,
		)
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	var event JourneyLifecycleEvent
	if err := decoder.Decode(&event); err != nil {
		return JourneyLifecycleEvent{}, fmt.Errorf("%w: decode: %v", ErrInvalidJourneyLifecycleEvent, err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return JourneyLifecycleEvent{}, fmt.Errorf(
			"%w: payload must contain exactly one JSON object",
			ErrInvalidJourneyLifecycleEvent,
		)
	}
	event = event.Normalized()
	if err := event.Validate(); err != nil {
		return JourneyLifecycleEvent{}, err
	}
	return event, nil
}

func (e JourneyLifecycleEvent) Validate() error {
	if e.EventID == "" || e.JourneyID == "" || e.ClientJourneyKey == "" ||
		e.MapID == "" || !mapRevisionPattern.MatchString(e.MapRevision) ||
		e.LifecycleSequence == 0 || e.RouteRevision == 0 ||
		e.OccurredAt.IsZero() || e.IngestedAt.IsZero() {
		return ErrInvalidJourneyLifecycleEvent
	}
	switch e.EventType {
	case "journey_started":
		if e.ClientEventID == "" || !e.validRoute() || e.Reason != "" || e.Outcome != "" {
			return ErrInvalidJourneyLifecycleEvent
		}
	case "route_recalculated":
		if e.ClientEventID == "" || !e.validRoute() || !validRerouteReason(e.Reason) || e.Outcome != "" {
			return ErrInvalidJourneyLifecycleEvent
		}
	case "journey_ended":
		if e.PlannedRoute != nil || e.Reason != "" || !validJourneyOutcome(e.Outcome) {
			return ErrInvalidJourneyLifecycleEvent
		}
	default:
		return ErrInvalidJourneyLifecycleEvent
	}
	return nil
}

func (e JourneyLifecycleEvent) Normalized() JourneyLifecycleEvent {
	e.EventType = strings.TrimSpace(e.EventType)
	e.EventID = strings.TrimSpace(e.EventID)
	e.ClientEventID = strings.TrimSpace(e.ClientEventID)
	e.JourneyID = strings.TrimSpace(e.JourneyID)
	e.ClientJourneyKey = strings.TrimSpace(e.ClientJourneyKey)
	e.MapID = strings.TrimSpace(e.MapID)
	e.MapRevision = strings.TrimSpace(e.MapRevision)
	e.Reason = strings.TrimSpace(e.Reason)
	e.Outcome = strings.TrimSpace(e.Outcome)
	e.OccurredAt = e.OccurredAt.UTC()
	e.IngestedAt = e.IngestedAt.UTC()
	if e.PlannedRoute != nil {
		e.PlannedRoute.OriginNodeID = strings.TrimSpace(e.PlannedRoute.OriginNodeID)
		e.PlannedRoute.DestinationNodeID = strings.TrimSpace(e.PlannedRoute.DestinationNodeID)
		for index := range e.PlannedRoute.PlannedEdgeIDs {
			e.PlannedRoute.PlannedEdgeIDs[index] = strings.TrimSpace(e.PlannedRoute.PlannedEdgeIDs[index])
		}
	}
	return e
}

func (e JourneyLifecycleEvent) validRoute() bool {
	if e.PlannedRoute == nil ||
		e.PlannedRoute.OriginNodeID == "" ||
		e.PlannedRoute.DestinationNodeID == "" ||
		len(e.PlannedRoute.PlannedEdgeIDs) == 0 {
		return false
	}
	for _, edgeID := range e.PlannedRoute.PlannedEdgeIDs {
		if edgeID == "" {
			return false
		}
	}
	return true
}

func validRerouteReason(value string) bool {
	switch value {
	case "wrong_way", "congestion", "blocked_edge", "localization_correction", "user_requested":
		return true
	default:
		return false
	}
}

func validJourneyOutcome(value string) bool {
	switch value {
	case "arrived", "cancelled", "superseded", "expired":
		return true
	default:
		return false
	}
}
