package ports

import (
	"context"

	"github.com/campus-navigator/trajectory-worker/internal/domain"
)

type JourneyLifecycleRepository interface {
	InsertBatch(context.Context, []domain.JourneyLifecycleEvent) error
	Ping(context.Context) error
	Close() error
}
