package memory

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type JourneyLifecycleStore struct {
	mu             sync.RWMutex
	active         map[string]domain.ActiveJourney
	idempotency    map[string]idempotencyRecord
	ended          map[string]time.Time
	events         []domain.JourneyLifecycleEvent
	removePresence JourneyPresenceRemover
	nextExpiry     map[string]time.Time
}

type idempotencyRecord struct {
	result    ports.JourneyCommandResult
	expiresAt time.Time
}

type JourneyPresenceRemover func(
	context.Context,
	string,
) (*domain.Presence, error)

func NewJourneyLifecycleStore(
	removers ...JourneyPresenceRemover,
) *JourneyLifecycleStore {
	var remover JourneyPresenceRemover
	if len(removers) > 0 {
		remover = removers[0]
	}
	return &JourneyLifecycleStore{
		active:         make(map[string]domain.ActiveJourney),
		idempotency:    make(map[string]idempotencyRecord),
		ended:          make(map[string]time.Time),
		removePresence: remover,
		nextExpiry:     make(map[string]time.Time),
	}
}

func (s *JourneyLifecycleStore) Start(
	ctx context.Context,
	request ports.StartJourneyMutation,
) (ports.JourneyCommandResult, error) {
	if err := ctx.Err(); err != nil {
		return ports.JourneyCommandResult{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if result, ok := s.deduplicated(
		request.DeviceRef,
		request.ClientEventID,
		request.IngestedAt,
	); ok {
		return result, nil
	}

	var superseded *domain.JourneyLifecycleEvent
	var removedPresence *domain.Presence
	if previous, ok := s.active[request.DeviceRef]; ok {
		event := domain.JourneyLifecycleEvent{
			EventType:        domain.JourneyEndedEvent,
			EventID:          request.SupersededEventID,
			ClientEventID:    request.ClientEventID,
			JourneyID:        previous.JourneyID,
			ClientJourneyKey: previous.ClientJourneyKey,
			MapID:            previous.MapID, MapRevision: previous.MapRevision,
			LifecycleSequence: previous.LifecycleSequence + 1,
			RouteRevision:     previous.RouteRevision,
			OccurredAt:        request.OccurredAt, IngestedAt: request.IngestedAt,
			Outcome: domain.JourneySuperseded,
		}
		if err := event.Validate(); err != nil {
			return ports.JourneyCommandResult{}, err
		}
		superseded = &event
		if s.removePresence != nil {
			removed, removeErr := s.removePresence(ctx, previous.SessionID)
			if removeErr != nil {
				return ports.JourneyCommandResult{}, removeErr
			}
			removedPresence = removed
		}
	}

	active := domain.ActiveJourney{
		JourneyID: request.JourneyID, DeviceRef: request.DeviceRef,
		SessionID:        request.SessionID,
		ClientJourneyKey: request.ClientJourneyKey,
		MapID:            request.MapID, MapRevision: request.MapRevision,
		Route: request.Route.Normalized(), RouteRevision: 1,
		LifecycleSequence: 1, StartedAt: request.IngestedAt,
	}
	if err := active.Validate(); err != nil {
		return ports.JourneyCommandResult{}, err
	}
	route := active.Route
	started := domain.JourneyLifecycleEvent{
		EventType: domain.JourneyStartedEvent,
		EventID:   request.StartedEventID, ClientEventID: request.ClientEventID,
		JourneyID:        active.JourneyID,
		ClientJourneyKey: active.ClientJourneyKey,
		MapID:            active.MapID, MapRevision: active.MapRevision,
		LifecycleSequence: 1, RouteRevision: 1,
		OccurredAt: request.OccurredAt, IngestedAt: request.IngestedAt,
		PlannedRoute: &route,
	}
	if err := started.Validate(); err != nil {
		return ports.JourneyCommandResult{}, err
	}

	if superseded != nil {
		s.events = append(s.events, cloneLifecycleEvent(*superseded))
		s.ended[superseded.JourneyID] = request.EndedTombstoneExpiresAt
	}
	s.active[request.DeviceRef] = cloneActiveJourney(active)
	s.nextExpiry[request.DeviceRef] = request.FirstPositionExpiresAt
	s.events = append(s.events, cloneLifecycleEvent(started))
	result := ports.JourneyCommandResult{
		JourneyID: active.JourneyID, LifecycleSequence: 1, RouteRevision: 1,
		RemovedPresence: removedPresence,
	}
	s.remember(
		request.DeviceRef,
		request.ClientEventID,
		result,
		request.IdempotencyExpiresAt,
	)
	return result, nil
}

func (s *JourneyLifecycleStore) Recalculate(
	ctx context.Context,
	request ports.RecalculateRouteMutation,
) (ports.JourneyCommandResult, error) {
	if err := ctx.Err(); err != nil {
		return ports.JourneyCommandResult{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if result, ok := s.deduplicated(
		request.DeviceRef,
		request.ClientEventID,
		request.IngestedAt,
	); ok {
		return result, nil
	}
	active, err := s.ownedActive(
		request.DeviceRef,
		request.JourneyID,
		request.ClientJourneyKey,
		request.IngestedAt,
	)
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	if active.MapID != request.MapID ||
		active.MapRevision != request.MapRevision {
		return ports.JourneyCommandResult{}, domain.ErrInvalidJourney
	}
	if active.Route.DestinationNodeID != request.Route.DestinationNodeID {
		return ports.JourneyCommandResult{}, domain.ErrDestinationChanged
	}
	active.Route = request.Route.Normalized()
	active.RouteRevision++
	active.LifecycleSequence++
	route := active.Route
	event := domain.JourneyLifecycleEvent{
		EventType: domain.RouteRecalculatedEvent,
		EventID:   request.EventID, ClientEventID: request.ClientEventID,
		JourneyID:        active.JourneyID,
		ClientJourneyKey: active.ClientJourneyKey,
		MapID:            active.MapID, MapRevision: active.MapRevision,
		LifecycleSequence: active.LifecycleSequence,
		RouteRevision:     active.RouteRevision,
		OccurredAt:        request.OccurredAt, IngestedAt: request.IngestedAt,
		PlannedRoute: &route, RerouteReason: request.Reason,
	}
	if err := event.Validate(); err != nil {
		return ports.JourneyCommandResult{}, err
	}
	s.active[request.DeviceRef] = cloneActiveJourney(active)
	s.events = append(s.events, cloneLifecycleEvent(event))
	result := ports.JourneyCommandResult{
		JourneyID:         active.JourneyID,
		LifecycleSequence: active.LifecycleSequence,
		RouteRevision:     active.RouteRevision,
	}
	s.remember(
		request.DeviceRef,
		request.ClientEventID,
		result,
		request.IdempotencyExpiresAt,
	)
	return result, nil
}

func (s *JourneyLifecycleStore) End(
	ctx context.Context,
	request ports.EndJourneyMutation,
) (ports.JourneyCommandResult, error) {
	if err := ctx.Err(); err != nil {
		return ports.JourneyCommandResult{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if result, ok := s.deduplicated(
		request.DeviceRef,
		request.ClientEventID,
		request.IngestedAt,
	); ok {
		return result, nil
	}
	active, err := s.ownedActive(
		request.DeviceRef,
		request.JourneyID,
		request.ClientJourneyKey,
		request.IngestedAt,
	)
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	event := endedEvent(
		active,
		request.EventID,
		request.ClientEventID,
		request.Outcome,
		request.OccurredAt,
		request.IngestedAt,
	)
	if err := event.Validate(); err != nil {
		return ports.JourneyCommandResult{}, err
	}
	var removedPresence *domain.Presence
	if s.removePresence != nil {
		removedPresence, err = s.removePresence(ctx, active.SessionID)
		if err != nil {
			return ports.JourneyCommandResult{}, err
		}
	}
	delete(s.active, request.DeviceRef)
	delete(s.nextExpiry, request.DeviceRef)
	s.ended[active.JourneyID] = request.EndedTombstoneExpiresAt
	s.events = append(s.events, cloneLifecycleEvent(event))
	result := ports.JourneyCommandResult{
		JourneyID:         active.JourneyID,
		LifecycleSequence: event.LifecycleSequence,
		RouteRevision:     event.RouteRevision,
		RemovedPresence:   removedPresence,
	}
	s.remember(
		request.DeviceRef,
		request.ClientEventID,
		result,
		request.IdempotencyExpiresAt,
	)
	return result, nil
}

func (s *JourneyLifecycleStore) Active(
	ctx context.Context,
	deviceRef string,
) (domain.ActiveJourney, error) {
	if err := ctx.Err(); err != nil {
		return domain.ActiveJourney{}, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	active, ok := s.active[deviceRef]
	if !ok {
		return domain.ActiveJourney{}, ports.ErrNotFound
	}
	return cloneActiveJourney(active), nil
}

func (s *JourneyLifecycleStore) RecordPosition(
	ctx context.Context,
	deviceRef string,
	journeyID string,
	sessionID string,
	observedAt time.Time,
	expiresAt time.Time,
) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	active, ok := s.active[deviceRef]
	if !ok {
		if s.isEnded(journeyID, observedAt) {
			return domain.ErrJourneyAlreadyEnded
		}
		return domain.ErrJourneyNotActive
	}
	if active.JourneyID != journeyID {
		return domain.ErrJourneyOwnerMismatch
	}
	if active.LastPositionAt == nil || observedAt.After(*active.LastPositionAt) {
		value := observedAt.UTC()
		active.LastPositionAt = &value
	}
	active.SessionID = sessionID
	s.active[deviceRef] = active
	s.nextExpiry[deviceRef] = expiresAt
	return nil
}

func (s *JourneyLifecycleStore) ListExpiredDeviceRefs(
	ctx context.Context,
	now time.Time,
	limit int,
) ([]string, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]string, 0, min(limit, len(s.active)))
	for deviceRef, expiresAt := range s.nextExpiry {
		if !now.Before(expiresAt) {
			result = append(result, deviceRef)
		}
	}
	sort.Strings(result)
	if len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

func (s *JourneyLifecycleStore) ExpireIfDue(
	ctx context.Context,
	request ports.ExpireJourneyMutation,
) (ports.JourneyExpiryResult, error) {
	if err := ctx.Err(); err != nil {
		return ports.JourneyExpiryResult{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	active, ok := s.active[request.DeviceRef]
	if !ok || active.JourneyID != request.JourneyID {
		return ports.JourneyExpiryResult{}, domain.ErrJourneyNotActive
	}
	if !active.IsDueForExpiry(
		request.IngestedAt,
		request.FirstPositionTimeout,
		request.PositionStaleAfter,
	) {
		return ports.JourneyExpiryResult{}, nil
	}
	event := endedEvent(
		active,
		request.EventID,
		"",
		domain.JourneyExpired,
		request.IngestedAt,
		request.IngestedAt,
	)
	if err := event.Validate(); err != nil {
		return ports.JourneyExpiryResult{}, err
	}
	var removedPresence *domain.Presence
	if s.removePresence != nil {
		var err error
		removedPresence, err = s.removePresence(ctx, active.SessionID)
		if err != nil {
			return ports.JourneyExpiryResult{}, err
		}
	}
	delete(s.active, request.DeviceRef)
	delete(s.nextExpiry, request.DeviceRef)
	s.ended[active.JourneyID] = request.EndedTombstoneExpiresAt
	s.events = append(s.events, cloneLifecycleEvent(event))
	return ports.JourneyExpiryResult{
		Expired: true, RemovedPresence: removedPresence,
	}, nil
}

func (s *JourneyLifecycleStore) LifecycleEvents() []domain.JourneyLifecycleEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]domain.JourneyLifecycleEvent, len(s.events))
	for index, event := range s.events {
		result[index] = cloneLifecycleEvent(event)
	}
	return result
}

func (s *JourneyLifecycleStore) ownedActive(
	deviceRef string,
	journeyID string,
	clientJourneyKey string,
	now time.Time,
) (domain.ActiveJourney, error) {
	active, ok := s.active[deviceRef]
	if !ok {
		if s.isEnded(journeyID, now) {
			return domain.ActiveJourney{}, domain.ErrJourneyAlreadyEnded
		}
		return domain.ActiveJourney{}, domain.ErrJourneyNotActive
	}
	if active.JourneyID != journeyID ||
		active.ClientJourneyKey != clientJourneyKey {
		return domain.ActiveJourney{}, domain.ErrJourneyOwnerMismatch
	}
	return active, nil
}

func (s *JourneyLifecycleStore) deduplicated(
	deviceRef string,
	clientEventID string,
	now time.Time,
) (ports.JourneyCommandResult, bool) {
	key := idempotencyKey(deviceRef, clientEventID)
	record, ok := s.idempotency[key]
	if !ok {
		return ports.JourneyCommandResult{}, false
	}
	if !now.Before(record.expiresAt) {
		delete(s.idempotency, key)
		return ports.JourneyCommandResult{}, false
	}
	result := record.result
	result.Deduplicated = true
	result.RemovedPresence = nil
	return result, true
}

func (s *JourneyLifecycleStore) remember(
	deviceRef string,
	clientEventID string,
	result ports.JourneyCommandResult,
	expiresAt time.Time,
) {
	s.idempotency[idempotencyKey(deviceRef, clientEventID)] = idempotencyRecord{
		result: result, expiresAt: expiresAt,
	}
}

func (s *JourneyLifecycleStore) isEnded(journeyID string, now time.Time) bool {
	expiresAt, ok := s.ended[journeyID]
	if !ok {
		return false
	}
	if !now.Before(expiresAt) {
		delete(s.ended, journeyID)
		return false
	}
	return true
}

func endedEvent(
	active domain.ActiveJourney,
	eventID string,
	clientEventID string,
	outcome domain.JourneyOutcome,
	occurredAt time.Time,
	ingestedAt time.Time,
) domain.JourneyLifecycleEvent {
	return domain.JourneyLifecycleEvent{
		EventType: domain.JourneyEndedEvent,
		EventID:   eventID, ClientEventID: clientEventID,
		JourneyID:        active.JourneyID,
		ClientJourneyKey: active.ClientJourneyKey,
		MapID:            active.MapID, MapRevision: active.MapRevision,
		LifecycleSequence: active.LifecycleSequence + 1,
		RouteRevision:     active.RouteRevision,
		OccurredAt:        occurredAt, IngestedAt: ingestedAt,
		Outcome: outcome,
	}
}

func idempotencyKey(deviceRef, clientEventID string) string {
	return deviceRef + "\x00" + clientEventID
}

func cloneActiveJourney(value domain.ActiveJourney) domain.ActiveJourney {
	value.Route = value.Route.Normalized()
	if value.LastPositionAt != nil {
		copied := *value.LastPositionAt
		value.LastPositionAt = &copied
	}
	return value
}

func cloneLifecycleEvent(
	value domain.JourneyLifecycleEvent,
) domain.JourneyLifecycleEvent {
	if value.PlannedRoute != nil {
		copied := value.PlannedRoute.Normalized()
		value.PlannedRoute = &copied
	}
	return value
}
