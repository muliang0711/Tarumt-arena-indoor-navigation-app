package domain

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strings"
	"time"
)

const SchemaVersion = 1

var ErrInvalidTrajectoryEvent = errors.New("invalid trajectory event")

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

func Decode(version int, payload []byte) (TrajectoryEvent, error) {
	if version != SchemaVersion {
		return TrajectoryEvent{}, fmt.Errorf("%w: unsupported schema version %d", ErrInvalidTrajectoryEvent, version)
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	var event TrajectoryEvent
	if err := decoder.Decode(&event); err != nil {
		return TrajectoryEvent{}, fmt.Errorf("%w: decode: %v", ErrInvalidTrajectoryEvent, err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return TrajectoryEvent{}, fmt.Errorf("%w: payload must contain exactly one JSON object", ErrInvalidTrajectoryEvent)
	}
	event = event.Normalized()
	if err := event.Validate(); err != nil {
		return TrajectoryEvent{}, err
	}
	return event, nil
}

func (e TrajectoryEvent) Validate() error {
	if e.EventID == "" || e.JourneyID == "" || e.BuildingID == "" || e.FloorID == "" || e.FromNodeID == "" || e.ToNodeID == "" {
		return ErrInvalidTrajectoryEvent
	}
	if math.IsNaN(e.EdgeProgress) || math.IsInf(e.EdgeProgress, 0) || e.EdgeProgress < 0 || e.EdgeProgress > 1 {
		return ErrInvalidTrajectoryEvent
	}
	if math.IsNaN(e.Heading) || math.IsInf(e.Heading, 0) || e.Heading < 0 || e.Heading >= 360 {
		return ErrInvalidTrajectoryEvent
	}
	switch e.MovementState {
	case "idle", "walking":
	default:
		return ErrInvalidTrajectoryEvent
	}
	if e.ObservedAt.IsZero() || e.IngestedAt.IsZero() {
		return ErrInvalidTrajectoryEvent
	}
	return nil
}

func (e TrajectoryEvent) Normalized() TrajectoryEvent {
	e.EventID = strings.TrimSpace(e.EventID)
	e.JourneyID = strings.TrimSpace(e.JourneyID)
	e.BuildingID = strings.TrimSpace(e.BuildingID)
	e.FloorID = strings.TrimSpace(e.FloorID)
	e.FromNodeID = strings.TrimSpace(e.FromNodeID)
	e.ToNodeID = strings.TrimSpace(e.ToNodeID)
	e.MovementState = strings.TrimSpace(e.MovementState)
	e.ObservedAt = e.ObservedAt.UTC()
	e.IngestedAt = e.IngestedAt.UTC()
	return e
}
