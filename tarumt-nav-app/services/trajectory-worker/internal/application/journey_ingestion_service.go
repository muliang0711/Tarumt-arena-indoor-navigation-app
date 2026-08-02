package application

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/campus-navigator/trajectory-worker/internal/application/ports"
	"github.com/campus-navigator/trajectory-worker/internal/domain"
)

// JourneyIngestionService is deliberately separate from the high-volume
// trajectory pipeline. A lifecycle outage or backlog therefore cannot change
// trajectory acknowledgement ordering, batching, or consumer ownership.
type JourneyIngestionService struct {
	source    ports.EventSource
	repo      ports.JourneyLifecycleRepository
	observer  ports.Observer
	logger    *slog.Logger
	options   IngestionOptions
	collector microBatchCollector
}

func NewJourneyIngestionService(
	source ports.EventSource,
	repo ports.JourneyLifecycleRepository,
	observer ports.Observer,
	logger *slog.Logger,
	options IngestionOptions,
) *JourneyIngestionService {
	if observer == nil {
		observer = ports.NoopObserver{}
	}
	return &JourneyIngestionService{
		source: source, repo: repo, observer: observer, logger: logger, options: options,
		collector: newMicroBatchCollector(source, options.BatchSize, options.BatchMaxWait),
	}
}

func (s *JourneyIngestionService) Run(ctx context.Context) error {
	if err := s.source.EnsureGroup(ctx); err != nil {
		return fmt.Errorf("ensure Journey consumer group: %w", err)
	}
	go s.observeStats(ctx)
	reclaimTicker := time.NewTicker(s.options.ReclaimInterval)
	defer reclaimTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-reclaimTicker.C:
			messages, err := s.source.Reclaim(ctx, s.options.ReclaimMinIdle, s.options.BatchSize)
			if err != nil {
				s.recordFailure("reclaim", err)
			} else if len(messages) > 0 {
				s.observer.Reclaimed(len(messages))
				if !s.processUntilSuccess(ctx, messages, "process_reclaimed") {
					return nil
				}
			}
		default:
			messages, err := s.source.Read(ctx, s.options.BatchSize, s.options.ReadBlock)
			if errors.Is(err, context.Canceled) ||
				errors.Is(err, context.DeadlineExceeded) && ctx.Err() != nil {
				return nil
			}
			if err != nil {
				s.recordFailure("read", err)
				if !s.backoff(ctx) {
					return nil
				}
				continue
			}
			if len(messages) == 0 {
				continue
			}
			batch, reason, duration, err := s.collector.Collect(ctx, messages)
			if errors.Is(err, context.Canceled) ||
				errors.Is(err, context.DeadlineExceeded) && ctx.Err() != nil {
				return nil
			}
			if err != nil {
				s.recordFailure("collect", err)
				if !s.backoff(ctx) {
					return nil
				}
				continue
			}
			s.observer.BatchCollected(len(batch), duration, reason)
			if !s.processUntilSuccess(ctx, batch, "process") {
				return nil
			}
		}
	}
}

func (s *JourneyIngestionService) Process(
	ctx context.Context,
	messages []ports.StreamMessage,
) error {
	if len(messages) == 0 {
		return nil
	}
	s.observer.BatchRead(len(messages))
	events := make([]domain.JourneyLifecycleEvent, 0, len(messages))
	ackIDs := make([]string, 0, len(messages))
	for _, message := range messages {
		event, err := domain.DecodeJourneyLifecycle(message.SchemaVersion, message.Payload)
		if err == nil && message.EventID != event.EventID {
			err = fmt.Errorf(
				"%w: stream event_id does not match payload",
				domain.ErrInvalidJourneyLifecycleEvent,
			)
		}
		if err != nil {
			moved, deadLetterErr := s.source.DeadLetter(ctx, message, err.Error())
			if deadLetterErr != nil {
				return fmt.Errorf("dead-letter Journey message %s: %w", message.ID, deadLetterErr)
			}
			if moved {
				s.observer.DeadLettered()
			}
			continue
		}
		events = append(events, event)
		ackIDs = append(ackIDs, message.ID)
	}
	if len(events) == 0 {
		return nil
	}
	startedAt := time.Now()
	if err := s.repo.InsertBatch(ctx, events); err != nil {
		return fmt.Errorf("insert Journey lifecycle batch: %w", err)
	}
	s.observer.BatchInserted(len(events), time.Since(startedAt))
	if err := s.source.Acknowledge(ctx, ackIDs); err != nil {
		return fmt.Errorf("acknowledge Journey lifecycle batch: %w", err)
	}
	s.observer.Acknowledged(len(ackIDs))
	return nil
}

func (s *JourneyIngestionService) observeStats(ctx context.Context) {
	ticker := time.NewTicker(s.options.StatsInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			stats, err := s.source.Stats(ctx)
			if err != nil {
				s.recordFailure("source_stats", err)
			} else {
				s.observer.SetSourceStats(stats)
			}
		}
	}
}

func (s *JourneyIngestionService) processUntilSuccess(
	ctx context.Context,
	messages []ports.StreamMessage,
	operation string,
) bool {
	for {
		if err := s.Process(ctx, messages); err == nil {
			return true
		} else {
			s.recordFailure(operation, err)
		}
		if !s.backoff(ctx) {
			return false
		}
	}
}

func (s *JourneyIngestionService) recordFailure(operation string, err error) {
	s.observer.Failed(operation)
	s.logger.Error(
		"Journey lifecycle ingestion operation failed",
		"operation",
		operation,
		"error",
		err,
	)
}

func (s *JourneyIngestionService) backoff(ctx context.Context) bool {
	timer := time.NewTimer(s.options.ErrorBackoff)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
