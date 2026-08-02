package ports

import (
	"context"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type PresenceStore interface {
	TrajectoryEventLog
	Get(context.Context, string) (domain.Presence, error)
	// Apply accepts the monotonic presence update and its trajectory event at
	// one storage consistency boundary.
	Apply(context.Context, PresenceMutationRequest) (PresenceMutation, error)
	Touch(context.Context, string, time.Time) error
	Remove(context.Context, string) (*domain.Presence, error)
	RemoveIfStale(context.Context, string, time.Time) (*domain.Presence, error)
	ListStaleSessionIDs(context.Context, time.Time, int) ([]string, error)
}

type PresenceMutationRequest struct {
	Presence         domain.Presence
	Trajectory       domain.TrajectoryEvent
	CanonicalJourney bool
	JourneyDeviceRef string
	ReceivedAt       time.Time
}

type PresenceMutation struct {
	Previous   *domain.Presence
	Accepted   domain.Presence
	Trajectory domain.TrajectoryEvent
}
