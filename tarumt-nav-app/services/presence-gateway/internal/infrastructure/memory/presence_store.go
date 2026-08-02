package memory

import (
	"context"
	"sync"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type PresenceStore struct {
	mu                sync.RWMutex
	presences         map[string]domain.Presence
	trajectoryEnabled bool
	trajectoryEvents  []domain.TrajectoryEvent
	trajectoryMaxLen  int
}

type TrajectoryOptions struct {
	Enabled   bool
	MaxLength int
}

func NewPresenceStore(options ...TrajectoryOptions) *PresenceStore {
	resolved := TrajectoryOptions{Enabled: true, MaxLength: 1_000_000}
	if len(options) > 0 {
		resolved = options[0]
	}
	return &PresenceStore{
		presences:         make(map[string]domain.Presence),
		trajectoryEnabled: resolved.Enabled,
		trajectoryMaxLen:  resolved.MaxLength,
	}
}

func (s *PresenceStore) Get(ctx context.Context, sessionID string) (domain.Presence, error) {
	if err := ctx.Err(); err != nil {
		return domain.Presence{}, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	presence, ok := s.presences[sessionID]
	if !ok {
		return domain.Presence{}, ports.ErrNotFound
	}
	return presence, nil
}

func (s *PresenceStore) Apply(ctx context.Context, request ports.PresenceMutationRequest) (ports.PresenceMutation, error) {
	if err := ctx.Err(); err != nil {
		return ports.PresenceMutation{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	presence := request.Presence
	trajectory := request.Trajectory
	previous, exists := s.presences[presence.SessionID]
	if exists && presence.Sequence <= previous.Sequence {
		return ports.PresenceMutation{}, domain.ErrStaleSequence
	}
	if exists && !request.CanonicalJourney {
		presence.JourneyID = previous.JourneyID
		trajectory.JourneyID = previous.JourneyID
	}
	trajectory = trajectory.Normalized()
	if err := trajectory.Validate(); err != nil {
		return ports.PresenceMutation{}, err
	}
	s.presences[presence.SessionID] = presence
	if s.trajectoryEnabled {
		s.appendTrajectory(trajectory)
	}
	mutation := ports.PresenceMutation{Accepted: presence, Trajectory: trajectory}
	if exists {
		mutation.Previous = &previous
	}
	return mutation, nil
}

func (s *PresenceStore) Append(ctx context.Context, event domain.TrajectoryEvent) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	event = event.Normalized()
	if err := event.Validate(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.trajectoryEnabled {
		s.appendTrajectory(event)
	}
	return nil
}

func (s *PresenceStore) TrajectoryEvents() []domain.TrajectoryEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]domain.TrajectoryEvent(nil), s.trajectoryEvents...)
}

func (s *PresenceStore) appendTrajectory(event domain.TrajectoryEvent) {
	s.trajectoryEvents = append(s.trajectoryEvents, event)
	if s.trajectoryMaxLen > 0 && len(s.trajectoryEvents) > s.trajectoryMaxLen {
		overflow := len(s.trajectoryEvents) - s.trajectoryMaxLen
		copy(s.trajectoryEvents, s.trajectoryEvents[overflow:])
		s.trajectoryEvents = s.trajectoryEvents[:s.trajectoryMaxLen]
	}
}

func (s *PresenceStore) Touch(ctx context.Context, sessionID string, at time.Time) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	presence, ok := s.presences[sessionID]
	if !ok {
		return ports.ErrNotFound
	}
	presence.LastSeenAt = at
	s.presences[sessionID] = presence
	return nil
}

func (s *PresenceStore) Remove(ctx context.Context, sessionID string) (*domain.Presence, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	presence, ok := s.presences[sessionID]
	if !ok {
		return nil, nil
	}
	delete(s.presences, sessionID)
	return &presence, nil
}

func (s *PresenceStore) RemoveIfStale(ctx context.Context, sessionID string, cutoff time.Time) (*domain.Presence, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	presence, ok := s.presences[sessionID]
	if !ok || presence.LastSeenAt.After(cutoff) {
		return nil, nil
	}
	delete(s.presences, sessionID)
	return &presence, nil
}

func (s *PresenceStore) ListStaleSessionIDs(ctx context.Context, cutoff time.Time, limit int) ([]string, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]string, 0, min(limit, len(s.presences)))
	for sessionID, presence := range s.presences {
		if !presence.LastSeenAt.After(cutoff) {
			result = append(result, sessionID)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (s *PresenceStore) list() []domain.Presence {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]domain.Presence, 0, len(s.presences))
	for _, presence := range s.presences {
		result = append(result, presence)
	}
	return result
}
