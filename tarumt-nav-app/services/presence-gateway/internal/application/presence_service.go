package application

import (
	"context"
	"errors"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type PresenceService struct {
	presences ports.PresenceStore
	sessions  ports.SessionStore
	broker    ports.RealtimeBroker
	clock     ports.Clock
	ids       ports.IDGenerator
}

func NewPresenceService(presences ports.PresenceStore, sessions ports.SessionStore, broker ports.RealtimeBroker, clock ports.Clock, ids ports.IDGenerator) *PresenceService {
	return &PresenceService{presences: presences, sessions: sessions, broker: broker, clock: clock, ids: ids}
}

func (s *PresenceService) Update(ctx context.Context, sessionID string, sequence uint64, position domain.Position) (domain.Presence, error) {
	return s.update(ctx, sessionID, sequence, position, "")
}

func (s *PresenceService) UpdateForJourney(
	ctx context.Context,
	sessionID string,
	sequence uint64,
	position domain.Position,
	journeyID string,
) (domain.Presence, error) {
	return s.update(ctx, sessionID, sequence, position, journeyID)
}

func (s *PresenceService) update(
	ctx context.Context,
	sessionID string,
	sequence uint64,
	position domain.Position,
	canonicalJourneyID string,
) (domain.Presence, error) {
	if err := position.Validate(); err != nil {
		return domain.Presence{}, err
	}
	now := s.clock.Now().UTC()
	session, err := s.sessions.Get(ctx, sessionID)
	if errors.Is(err, ports.ErrUnavailable) {
		return domain.Presence{}, err
	}
	if err != nil || session.IsExpired(now) {
		return domain.Presence{}, ErrUnauthorized
	}
	current, err := s.sessions.IsCurrent(ctx, session)
	if err != nil {
		return domain.Presence{}, err
	}
	if !current {
		return domain.Presence{}, ErrUnauthorized
	}
	eventID, err := s.ids.NewID()
	if err != nil {
		return domain.Presence{}, err
	}
	journeyID := canonicalJourneyID
	if journeyID == "" {
		journeyID, err = s.ids.NewID()
		if err != nil {
			return domain.Presence{}, err
		}
	}
	normalizedPosition := position.Normalized()
	presence := domain.Presence{
		JourneyID: journeyID,
		SessionID: sessionID, Position: normalizedPosition,
		Sequence: sequence, LastSeenAt: now,
	}
	trajectory := domain.TrajectoryEvent{
		EventID: eventID, JourneyID: journeyID,
		BuildingID: normalizedPosition.BuildingID, FloorID: normalizedPosition.FloorID,
		FromNodeID: normalizedPosition.FromNodeID, ToNodeID: normalizedPosition.ToNodeID,
		EdgeProgress: normalizedPosition.EdgeProgress, Heading: normalizedPosition.Heading,
		MovementState: normalizedPosition.MovementState,
		ObservedAt:    now, IngestedAt: now,
	}
	mutation, err := s.presences.Apply(ctx, ports.PresenceMutationRequest{
		Presence: presence, Trajectory: trajectory,
		CanonicalJourney: canonicalJourneyID != "",
		JourneyDeviceRef: session.DeviceRef,
		ReceivedAt:       now,
	})
	if err != nil {
		return domain.Presence{}, err
	}
	presence = mutation.Accepted
	if err := s.sessions.Touch(ctx, sessionID, now); err != nil {
		return domain.Presence{}, err
	}
	isNew := mutation.Previous == nil
	if mutation.Previous != nil && (mutation.Previous.Position.BuildingID != presence.Position.BuildingID || mutation.Previous.Position.FloorID != presence.Position.FloorID) {
		s.publish(ctx, domain.EventPresenceLeft, mutation.Previous.Position, sessionID, nil, now)
		s.publish(ctx, domain.EventOccupancyUpdated, mutation.Previous.Position, "", nil, now)
		isNew = true
	}
	if mutation.Previous != nil && !isNew && !samePhysicalEdge(mutation.Previous.Position, presence.Position) {
		oldFromNodeID, oldToNodeID := domain.CanonicalEdge(
			mutation.Previous.Position.FromNodeID,
			mutation.Previous.Position.ToNodeID,
		)
		newFromNodeID, newToNodeID := domain.CanonicalEdge(
			presence.Position.FromNodeID,
			presence.Position.ToNodeID,
		)
		_ = s.broker.Publish(ctx, domain.Event{
			Type:       domain.EventEdgeOccupancyChanged,
			BuildingID: presence.Position.BuildingID,
			FloorID:    presence.Position.FloorID,
			EdgeChanges: []domain.EdgeOccupancyChange{
				{FromNodeID: oldFromNodeID, ToNodeID: oldToNodeID, Delta: -1},
				{FromNodeID: newFromNodeID, ToNodeID: newToNodeID, Delta: 1},
			},
			OccurredAt: now,
		})
	}
	eventType := domain.EventPresenceUpdated
	if isNew {
		eventType = domain.EventPresenceJoined
	}
	s.publish(ctx, eventType, presence.Position, sessionID, &presence, now)
	if isNew {
		s.publish(ctx, domain.EventOccupancyUpdated, presence.Position, "", nil, now)
	}
	return presence, nil
}

func (s *PresenceService) PublishRemoved(
	ctx context.Context,
	presence domain.Presence,
) {
	now := s.clock.Now().UTC()
	s.publish(
		ctx,
		domain.EventPresenceLeft,
		presence.Position,
		presence.SessionID,
		nil,
		now,
	)
	s.publish(
		ctx,
		domain.EventOccupancyUpdated,
		presence.Position,
		"",
		nil,
		now,
	)
}

func (s *PresenceService) Heartbeat(ctx context.Context, sessionID string) error {
	now := s.clock.Now().UTC()
	session, err := s.sessions.Get(ctx, sessionID)
	if errors.Is(err, ports.ErrUnavailable) {
		return err
	}
	if err != nil || session.IsExpired(now) {
		return ErrUnauthorized
	}
	current, err := s.sessions.IsCurrent(ctx, session)
	if err != nil {
		return err
	}
	if !current {
		return ErrUnauthorized
	}
	if err := s.sessions.Touch(ctx, sessionID, now); err != nil {
		return err
	}
	_, err = s.presences.Get(ctx, sessionID)
	if errors.Is(err, ports.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	return s.presences.Touch(ctx, sessionID, now)
}

func (s *PresenceService) Leave(ctx context.Context, sessionID string) error {
	presence, err := s.presences.Remove(ctx, sessionID)
	if err != nil {
		return err
	}
	if presence == nil {
		return nil
	}
	now := s.clock.Now().UTC()
	s.publish(ctx, domain.EventPresenceLeft, presence.Position, sessionID, nil, now)
	s.publish(ctx, domain.EventOccupancyUpdated, presence.Position, "", nil, now)
	return nil
}

func (s *PresenceService) SweepExpired(ctx context.Context, staleAfter time.Duration) error {
	now := s.clock.Now().UTC()
	staleIDs, err := s.presences.ListStaleSessionIDs(ctx, now.Add(-staleAfter), 100)
	if err != nil {
		return err
	}
	for _, sessionID := range staleIDs {
		presence, err := s.presences.RemoveIfStale(ctx, sessionID, now.Add(-staleAfter))
		if err != nil {
			return err
		}
		if presence != nil {
			s.publish(ctx, domain.EventPresenceLeft, presence.Position, presence.SessionID, nil, now)
			s.publish(ctx, domain.EventOccupancyUpdated, presence.Position, "", nil, now)
		}
	}
	return s.sessions.DeleteExpired(ctx, now, 100)
}

func (s *PresenceService) Subscribe(buildingID, floorID string) ports.Subscription {
	return s.broker.Subscribe(buildingID, floorID)
}

func (s *PresenceService) publish(ctx context.Context, eventType domain.EventType, position domain.Position, sessionID string, presence *domain.Presence, occurredAt time.Time) {
	_ = s.broker.Publish(ctx, domain.Event{
		Type: eventType, BuildingID: position.BuildingID, FloorID: position.FloorID,
		SessionID: sessionID, Presence: presence, OccurredAt: occurredAt,
	})
}

func samePhysicalEdge(first, second domain.Position) bool {
	firstFromNodeID, firstToNodeID := domain.CanonicalEdge(first.FromNodeID, first.ToNodeID)
	secondFromNodeID, secondToNodeID := domain.CanonicalEdge(second.FromNodeID, second.ToNodeID)
	return firstFromNodeID == secondFromNodeID && firstToNodeID == secondToNodeID
}
