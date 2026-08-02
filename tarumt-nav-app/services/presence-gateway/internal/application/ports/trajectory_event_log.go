package ports

import (
	"context"

	"github.com/campus-navigator/presence-gateway/internal/domain"
)

// TrajectoryEventLog is the application boundary for appending accepted,
// privacy-safe movement events. Redis Streams is one infrastructure adapter; callers
// do not depend on stream keys, consumer groups, or warehouse technology.
type TrajectoryEventLog interface {
	Append(context.Context, domain.TrajectoryEvent) error
}
