package redisinfra

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/domain"
)

const redisEventVersion = 1

var ErrUnsupportedEventVersion = errors.New("unsupported Redis event version")

type eventEnvelope struct {
	Version     int                          `json:"version"`
	EventID     string                       `json:"event_id"`
	OriginID    string                       `json:"origin_instance_id"`
	Type        domain.EventType             `json:"type"`
	BuildingID  string                       `json:"building_id"`
	FloorID     string                       `json:"floor_id"`
	SessionID   string                       `json:"session_id,omitempty"`
	Presence    *domain.Presence             `json:"presence,omitempty"`
	EdgeChanges []domain.EdgeOccupancyChange `json:"edge_changes,omitempty"`
	OccurredAt  time.Time                    `json:"occurred_at"`
}

func encodeEvent(event domain.Event, eventID, originID string) ([]byte, error) {
	return json.Marshal(eventEnvelope{
		Version: redisEventVersion, EventID: eventID, OriginID: originID,
		Type: event.Type, BuildingID: event.BuildingID, FloorID: event.FloorID,
		SessionID: event.SessionID, Presence: event.Presence,
		EdgeChanges: event.EdgeChanges, OccurredAt: event.OccurredAt,
	})
}

func decodeEvent(payload []byte) (domain.Event, error) {
	var envelope eventEnvelope
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return domain.Event{}, err
	}
	if envelope.Version != redisEventVersion {
		return domain.Event{}, ErrUnsupportedEventVersion
	}
	return domain.Event{
		Type: envelope.Type, BuildingID: envelope.BuildingID, FloorID: envelope.FloorID,
		SessionID: envelope.SessionID, Presence: envelope.Presence,
		EdgeChanges: envelope.EdgeChanges, OccurredAt: envelope.OccurredAt,
	}, nil
}
