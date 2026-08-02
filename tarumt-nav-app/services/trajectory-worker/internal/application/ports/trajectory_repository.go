package ports

import (
	"context"

	"github.com/campus-navigator/trajectory-worker/internal/domain"
)

type TrajectoryRepository interface {
	InsertBatch(context.Context, []domain.TrajectoryEvent) error
	Ping(context.Context) error
	Close() error
}
