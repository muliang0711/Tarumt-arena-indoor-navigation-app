package domain

import (
	"errors"
	"strings"
	"time"
)

var ErrInvalidTrajectoryEvent = errors.New("invalid trajectory event")

const TrajectorySchemaVersion = 1

// TrajectoryEvent is the privacy-safe durable record produced from an
// accepted presence mutation. Authentication and installation identifiers are
// deliberately absent from this contract.
type TrajectoryEvent struct {
	EventID       string    `json:"event_id"`
	JourneyID     string    `json:"journey_id"`
	BuildingID    string    `json:"building_id"`
	FloorID       string    `json:"floor_id"`
	FromNodeID    string    `json:"from_node_id"`
	ToNodeID      string    `json:"to_node_id"`
	EdgeProgress  float64   `json:"edge_progress"`
	Heading       float64   `json:"heading"`
	MovementState string    `json:"movement_state"`
	ObservedAt    time.Time `json:"observed_at"`
	IngestedAt    time.Time `json:"ingested_at"`
}

func (e TrajectoryEvent) Validate() error {
	if strings.TrimSpace(e.EventID) == "" || strings.TrimSpace(e.JourneyID) == "" {
		return ErrInvalidTrajectoryEvent
	}
	position := Position{
		BuildingID: e.BuildingID, FloorID: e.FloorID,
		FromNodeID: e.FromNodeID, ToNodeID: e.ToNodeID,
		EdgeProgress: e.EdgeProgress, Heading: e.Heading,
		MovementState: e.MovementState,
	}
	if position.Validate() != nil || e.ObservedAt.IsZero() || e.IngestedAt.IsZero() {
		return ErrInvalidTrajectoryEvent
	}
	return nil
}

func (e TrajectoryEvent) Normalized() TrajectoryEvent {
	position := Position{Heading: e.Heading}.Normalized()
	e.Heading = position.Heading
	e.EventID = strings.TrimSpace(e.EventID)
	e.JourneyID = strings.TrimSpace(e.JourneyID)
	e.BuildingID = strings.TrimSpace(e.BuildingID)
	e.FloorID = strings.TrimSpace(e.FloorID)
	e.FromNodeID = strings.TrimSpace(e.FromNodeID)
	e.ToNodeID = strings.TrimSpace(e.ToNodeID)
	e.ObservedAt = e.ObservedAt.UTC()
	e.IngestedAt = e.IngestedAt.UTC()
	return e
}
