package domain

import (
	"errors"
	"math"
	"strings"
	"time"
)

var (
	ErrInvalidPosition = errors.New("invalid presence position")
	ErrStaleSequence   = errors.New("presence sequence is not newer")
)

type Position struct {
	BuildingID    string  `json:"building_id"`
	FloorID       string  `json:"floor_id"`
	FromNodeID    string  `json:"from_node_id"`
	ToNodeID      string  `json:"to_node_id"`
	EdgeProgress  float64 `json:"edge_progress"`
	Heading       float64 `json:"heading"`
	MovementState string  `json:"movement_state"`
}

func (p Position) Validate() error {
	if strings.TrimSpace(p.BuildingID) == "" || strings.TrimSpace(p.FloorID) == "" {
		return ErrInvalidPosition
	}
	if strings.TrimSpace(p.FromNodeID) == "" || strings.TrimSpace(p.ToNodeID) == "" {
		return ErrInvalidPosition
	}
	if math.IsNaN(p.EdgeProgress) || math.IsInf(p.EdgeProgress, 0) || p.EdgeProgress < 0 || p.EdgeProgress > 1 {
		return ErrInvalidPosition
	}
	if math.IsNaN(p.Heading) || math.IsInf(p.Heading, 0) {
		return ErrInvalidPosition
	}
	if p.MovementState != "idle" && p.MovementState != "walking" {
		return ErrInvalidPosition
	}
	return nil
}

func (p Position) Normalized() Position {
	p.Heading = math.Mod(p.Heading, 360)
	if p.Heading < 0 {
		p.Heading += 360
	}
	return p
}

type Presence struct {
	SessionID  string    `json:"session_id"`
	JourneyID  string    `json:"-"`
	Position   Position  `json:"position"`
	Sequence   uint64    `json:"sequence"`
	LastSeenAt time.Time `json:"last_seen_at"`
}

func (p Presence) IsStale(now time.Time, staleAfter time.Duration) bool {
	return now.Sub(p.LastSeenAt) >= staleAfter
}
