package application

import (
	"context"
	"log/slog"
	"time"
)

type ExpiryService struct {
	presence      *PresenceService
	journeys      *JourneyService
	staleAfter    time.Duration
	sweepInterval time.Duration
	logger        *slog.Logger
}

func NewExpiryService(
	presence *PresenceService,
	journeys *JourneyService,
	staleAfter,
	sweepInterval time.Duration,
	logger *slog.Logger,
) *ExpiryService {
	return &ExpiryService{
		presence: presence, journeys: journeys, staleAfter: staleAfter,
		sweepInterval: sweepInterval, logger: logger,
	}
}

func (s *ExpiryService) Run(ctx context.Context) {
	ticker := time.NewTicker(s.sweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			removed, err := s.journeys.SweepExpired(ctx, 100)
			if err != nil && ctx.Err() == nil {
				s.logger.Error("journey expiry sweep failed", "error", err)
			}
			for _, presence := range removed {
				s.presence.PublishRemoved(ctx, presence)
			}
			if err := s.presence.SweepExpired(ctx, s.staleAfter); err != nil && ctx.Err() == nil {
				s.logger.Error("presence expiry sweep failed", "error", err)
			}
		}
	}
}
