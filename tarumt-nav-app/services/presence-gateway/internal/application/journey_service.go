package application

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

var ErrInvalidJourneyCommand = errors.New("invalid journey command")

type StartJourneyCommand struct {
	ClientEventID    string
	ClientJourneyKey string
	MapID            string
	MapRevision      string
	Route            domain.PlannedRoute
	OccurredAt       time.Time
}

type RecalculateRouteCommand struct {
	ClientEventID    string
	JourneyID        string
	ClientJourneyKey string
	MapID            string
	MapRevision      string
	Route            domain.PlannedRoute
	Reason           domain.RerouteReason
	OccurredAt       time.Time
}

type EndJourneyCommand struct {
	ClientEventID    string
	JourneyID        string
	ClientJourneyKey string
	Outcome          domain.JourneyOutcome
	OccurredAt       time.Time
}

type JourneyService struct {
	store                ports.JourneyLifecycleStore
	routes               ports.JourneyRouteValidator
	ids                  ports.IDGenerator
	clock                ports.Clock
	idempotencyTTL       time.Duration
	endedTombstoneTTL    time.Duration
	firstPositionTimeout time.Duration
	positionStaleAfter   time.Duration
}

func NewJourneyService(
	store ports.JourneyLifecycleStore,
	routes ports.JourneyRouteValidator,
	ids ports.IDGenerator,
	clock ports.Clock,
	idempotencyTTL time.Duration,
	endedTombstoneTTL time.Duration,
	firstPositionTimeout time.Duration,
	positionStaleAfter time.Duration,
) *JourneyService {
	return &JourneyService{
		store: store, routes: routes, ids: ids, clock: clock,
		idempotencyTTL: idempotencyTTL, endedTombstoneTTL: endedTombstoneTTL,
		firstPositionTimeout: firstPositionTimeout,
		positionStaleAfter:   positionStaleAfter,
	}
}

func (s *JourneyService) Start(
	ctx context.Context,
	session domain.Session,
	command StartJourneyCommand,
) (ports.JourneyCommandResult, error) {
	command.Route = command.Route.Normalized()
	if !validCommandIdentity(command.ClientEventID, command.ClientJourneyKey) ||
		strings.TrimSpace(command.MapID) == "" ||
		strings.TrimSpace(command.MapRevision) == "" ||
		command.OccurredAt.IsZero() ||
		command.Route.Validate() != nil {
		return ports.JourneyCommandResult{}, ErrInvalidJourneyCommand
	}
	if err := s.validateRoute(
		command.MapID,
		command.MapRevision,
		command.Route,
	); err != nil {
		return ports.JourneyCommandResult{}, err
	}
	journeyID, err := s.ids.NewID()
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	startedEventID, err := s.ids.NewID()
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	supersededEventID, err := s.ids.NewID()
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	now := s.clock.Now().UTC()
	return s.store.Start(ctx, ports.StartJourneyMutation{
		DeviceRef: session.DeviceRef, SessionID: session.ID,
		ClientEventID:    command.ClientEventID,
		ClientJourneyKey: command.ClientJourneyKey,
		JourneyID:        journeyID, StartedEventID: startedEventID,
		SupersededEventID: supersededEventID,
		MapID:             command.MapID, MapRevision: command.MapRevision,
		Route: command.Route, OccurredAt: command.OccurredAt.UTC(),
		IngestedAt: now, IdempotencyExpiresAt: now.Add(s.idempotencyTTL),
		EndedTombstoneExpiresAt: now.Add(s.endedTombstoneTTL),
		FirstPositionExpiresAt:  now.Add(s.firstPositionTimeout),
	})
}

func (s *JourneyService) Recalculate(
	ctx context.Context,
	session domain.Session,
	command RecalculateRouteCommand,
) (ports.JourneyCommandResult, error) {
	command.Route = command.Route.Normalized()
	if !validCommandIdentity(command.ClientEventID, command.ClientJourneyKey) ||
		strings.TrimSpace(command.JourneyID) == "" ||
		strings.TrimSpace(command.MapID) == "" ||
		strings.TrimSpace(command.MapRevision) == "" ||
		command.OccurredAt.IsZero() ||
		command.Route.Validate() != nil {
		return ports.JourneyCommandResult{}, ErrInvalidJourneyCommand
	}
	if !command.Reason.Valid() {
		return ports.JourneyCommandResult{}, domain.ErrInvalidRerouteReason
	}
	if err := s.validateRoute(
		command.MapID,
		command.MapRevision,
		command.Route,
	); err != nil {
		return ports.JourneyCommandResult{}, err
	}
	eventID, err := s.ids.NewID()
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	now := s.clock.Now().UTC()
	return s.store.Recalculate(ctx, ports.RecalculateRouteMutation{
		DeviceRef: session.DeviceRef, ClientEventID: command.ClientEventID,
		JourneyID:        command.JourneyID,
		ClientJourneyKey: command.ClientJourneyKey, EventID: eventID,
		MapID: command.MapID, MapRevision: command.MapRevision,
		Route: command.Route, Reason: command.Reason,
		OccurredAt: command.OccurredAt.UTC(), IngestedAt: now,
		IdempotencyExpiresAt: now.Add(s.idempotencyTTL),
	})
}

func (s *JourneyService) End(
	ctx context.Context,
	session domain.Session,
	command EndJourneyCommand,
) (ports.JourneyCommandResult, error) {
	if !validCommandIdentity(command.ClientEventID, command.ClientJourneyKey) ||
		strings.TrimSpace(command.JourneyID) == "" ||
		command.OccurredAt.IsZero() {
		return ports.JourneyCommandResult{}, ErrInvalidJourneyCommand
	}
	if !command.Outcome.ClientAllowed() {
		return ports.JourneyCommandResult{}, domain.ErrInvalidJourneyOutcome
	}
	eventID, err := s.ids.NewID()
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	now := s.clock.Now().UTC()
	return s.store.End(ctx, ports.EndJourneyMutation{
		DeviceRef: session.DeviceRef, ClientEventID: command.ClientEventID,
		JourneyID:        command.JourneyID,
		ClientJourneyKey: command.ClientJourneyKey, EventID: eventID,
		Outcome: command.Outcome, OccurredAt: command.OccurredAt.UTC(),
		IngestedAt: now, IdempotencyExpiresAt: now.Add(s.idempotencyTTL),
		EndedTombstoneExpiresAt: now.Add(s.endedTombstoneTTL),
	})
}

func (s *JourneyService) Active(
	ctx context.Context,
	deviceRef string,
) (domain.ActiveJourney, error) {
	return s.store.Active(ctx, deviceRef)
}

func (s *JourneyService) RecordPosition(
	ctx context.Context,
	deviceRef string,
	journeyID string,
	sessionID string,
) error {
	if strings.TrimSpace(deviceRef) == "" ||
		strings.TrimSpace(journeyID) == "" ||
		strings.TrimSpace(sessionID) == "" {
		return ErrInvalidJourneyCommand
	}
	now := s.clock.Now().UTC()
	return s.store.RecordPosition(
		ctx,
		deviceRef,
		journeyID,
		sessionID,
		now,
		now.Add(s.positionStaleAfter),
	)
}

func (s *JourneyService) SweepExpired(
	ctx context.Context,
	limit int,
) ([]domain.Presence, error) {
	if limit <= 0 {
		return nil, nil
	}
	now := s.clock.Now().UTC()
	deviceRefs, err := s.store.ListExpiredDeviceRefs(ctx, now, limit)
	if err != nil {
		return nil, err
	}
	removed := make([]domain.Presence, 0)
	for _, deviceRef := range deviceRefs {
		active, err := s.store.Active(ctx, deviceRef)
		if errors.Is(err, ports.ErrNotFound) {
			continue
		}
		if err != nil {
			return nil, err
		}
		eventID, err := s.ids.NewID()
		if err != nil {
			return nil, err
		}
		result, err := s.store.ExpireIfDue(ctx, ports.ExpireJourneyMutation{
			DeviceRef: deviceRef, JourneyID: active.JourneyID,
			EventID: eventID, IngestedAt: now,
			FirstPositionTimeout:    s.firstPositionTimeout,
			PositionStaleAfter:      s.positionStaleAfter,
			EndedTombstoneExpiresAt: now.Add(s.endedTombstoneTTL),
		})
		if err != nil && !errors.Is(err, domain.ErrJourneyNotActive) {
			return nil, err
		}
		if result.RemovedPresence != nil {
			removed = append(removed, *result.RemovedPresence)
		}
	}
	return removed, nil
}

func (s *JourneyService) validateRoute(
	mapID string,
	revision string,
	route domain.PlannedRoute,
) error {
	return s.routes.ValidateRoute(
		strings.TrimSpace(mapID),
		strings.TrimSpace(revision),
		route.OriginNodeID,
		route.DestinationNodeID,
		route.PlannedEdgeIDs,
	)
}

func validCommandIdentity(clientEventID, clientJourneyKey string) bool {
	return strings.TrimSpace(clientEventID) != "" &&
		strings.TrimSpace(clientJourneyKey) != ""
}
