package redisinfra

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
	redis "github.com/redis/go-redis/v9"
)

const journeyLifecycleSchemaVersion = 1

type JourneyLifecycleOptions struct {
	StreamKey string
	MaxLength int64
}

type JourneyLifecycleStore struct {
	client    *redis.Client
	keys      Keyspace
	streamKey string
	maxLength int64
}

type redisActiveJourney struct {
	domain.ActiveJourney
	PresenceKey        string `json:"presence_key"`
	StartedAtMillis    int64  `json:"started_at_ms"`
	LastPositionMillis int64  `json:"last_position_at_ms,omitempty"`
}

type journeyResultPayload struct {
	JourneyID         string `json:"journey_id"`
	LifecycleSequence uint64 `json:"lifecycle_sequence"`
	RouteRevision     uint64 `json:"route_revision"`
}

func NewJourneyLifecycleStore(
	client *redis.Client,
	keys Keyspace,
	options JourneyLifecycleOptions,
) *JourneyLifecycleStore {
	if options.StreamKey == "" {
		options.StreamKey = keys.JourneyLifecycleStream()
	}
	return &JourneyLifecycleStore{
		client: client, keys: keys, streamKey: options.StreamKey,
		maxLength: options.MaxLength,
	}
}

func (s *JourneyLifecycleStore) Start(
	ctx context.Context,
	request ports.StartJourneyMutation,
) (ports.JourneyCommandResult, error) {
	active := domain.ActiveJourney{
		JourneyID: request.JourneyID, DeviceRef: request.DeviceRef,
		SessionID:        request.SessionID,
		ClientJourneyKey: request.ClientJourneyKey,
		MapID:            request.MapID, MapRevision: request.MapRevision,
		Route: request.Route.Normalized(), RouteRevision: 1,
		LifecycleSequence: 1, StartedAt: request.IngestedAt.UTC(),
	}
	if err := active.Validate(); err != nil {
		return ports.JourneyCommandResult{}, err
	}
	activePayload, err := json.Marshal(redisActiveJourney{
		ActiveJourney:   active,
		PresenceKey:     s.keys.Presence(request.SessionID),
		StartedAtMillis: request.IngestedAt.UnixMilli(),
	})
	if err != nil {
		return ports.JourneyCommandResult{}, fmt.Errorf("encode active journey: %w", err)
	}
	route := active.Route
	started := domain.JourneyLifecycleEvent{
		EventType: domain.JourneyStartedEvent,
		EventID:   request.StartedEventID, ClientEventID: request.ClientEventID,
		JourneyID:        active.JourneyID,
		ClientJourneyKey: active.ClientJourneyKey,
		MapID:            active.MapID, MapRevision: active.MapRevision,
		LifecycleSequence: 1, RouteRevision: 1,
		OccurredAt: request.OccurredAt.UTC(),
		IngestedAt: request.IngestedAt.UTC(), PlannedRoute: &route,
	}
	if err := started.Validate(); err != nil {
		return ports.JourneyCommandResult{}, err
	}
	startedPayload, err := json.Marshal(started)
	if err != nil {
		return ports.JourneyCommandResult{}, fmt.Errorf("encode journey start: %w", err)
	}
	resultPayload, err := json.Marshal(journeyResultPayload{
		JourneyID: active.JourneyID, LifecycleSequence: 1, RouteRevision: 1,
	})
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	values, err := startJourneyScript.Run(ctx, s.client, []string{
		s.keys.ActiveJourney(request.DeviceRef),
		s.keys.JourneyIdempotency(request.DeviceRef, request.ClientEventID),
		s.keys.ActiveJourneys(), s.streamKey, s.keys.ActivePresences(),
	},
		request.DeviceRef, request.ClientEventID, string(activePayload),
		string(startedPayload), request.SupersededEventID,
		request.IngestedAt.UnixMilli(),
		request.IdempotencyExpiresAt.UnixMilli(),
		request.EndedTombstoneExpiresAt.UnixMilli(),
		s.keys.EndedJourneyPrefix(), s.keys.Prefix()+":presence:",
		s.keys.Prefix(), s.maxLength, journeyLifecycleSchemaVersion,
		string(resultPayload), request.StartedEventID,
		request.FirstPositionExpiresAt.UnixMilli(),
	).Slice()
	if err != nil {
		return ports.JourneyCommandResult{}, storeError("start journey", err)
	}
	return decodeJourneyResult(values)
}

func (s *JourneyLifecycleStore) Recalculate(
	ctx context.Context,
	request ports.RecalculateRouteMutation,
) (ports.JourneyCommandResult, error) {
	routePayload, err := json.Marshal(request.Route.Normalized())
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	route := request.Route.Normalized()
	event := domain.JourneyLifecycleEvent{
		EventType: domain.RouteRecalculatedEvent,
		EventID:   request.EventID, ClientEventID: request.ClientEventID,
		JourneyID:        request.JourneyID,
		ClientJourneyKey: request.ClientJourneyKey,
		MapID:            request.MapID, MapRevision: request.MapRevision,
		LifecycleSequence: 1, RouteRevision: 1,
		OccurredAt:   request.OccurredAt.UTC(),
		IngestedAt:   request.IngestedAt.UTC(),
		PlannedRoute: &route, RerouteReason: request.Reason,
	}
	if err := event.Validate(); err != nil {
		return ports.JourneyCommandResult{}, err
	}
	eventPayload, err := json.Marshal(event)
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	values, err := recalculateJourneyScript.Run(ctx, s.client, []string{
		s.keys.ActiveJourney(request.DeviceRef),
		s.keys.JourneyIdempotency(request.DeviceRef, request.ClientEventID),
		s.keys.EndedJourney(request.JourneyID), s.streamKey,
	}, request.JourneyID, request.ClientJourneyKey, request.MapID,
		request.MapRevision, string(routePayload), string(eventPayload),
		request.EventID, request.IdempotencyExpiresAt.UnixMilli(),
		s.maxLength, journeyLifecycleSchemaVersion,
	).Slice()
	if err != nil {
		return ports.JourneyCommandResult{}, storeError("recalculate journey", err)
	}
	return decodeJourneyResult(values)
}

func (s *JourneyLifecycleStore) End(
	ctx context.Context,
	request ports.EndJourneyMutation,
) (ports.JourneyCommandResult, error) {
	event := domain.JourneyLifecycleEvent{
		EventType: domain.JourneyEndedEvent,
		EventID:   request.EventID, ClientEventID: request.ClientEventID,
		JourneyID:        request.JourneyID,
		ClientJourneyKey: request.ClientJourneyKey,
		MapID:            "resolved-by-store", MapRevision: "resolved-by-store",
		LifecycleSequence: 1, RouteRevision: 1,
		OccurredAt: request.OccurredAt.UTC(),
		IngestedAt: request.IngestedAt.UTC(), Outcome: request.Outcome,
	}
	if err := event.Validate(); err != nil {
		return ports.JourneyCommandResult{}, err
	}
	eventPayload, err := json.Marshal(event)
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	values, err := endJourneyScript.Run(ctx, s.client, []string{
		s.keys.ActiveJourney(request.DeviceRef),
		s.keys.JourneyIdempotency(request.DeviceRef, request.ClientEventID),
		s.keys.EndedJourney(request.JourneyID), s.keys.ActiveJourneys(),
		s.streamKey, s.keys.ActivePresences(),
	}, request.JourneyID, request.ClientJourneyKey, string(eventPayload),
		request.EventID, request.EndedTombstoneExpiresAt.UnixMilli(),
		request.IdempotencyExpiresAt.UnixMilli(), s.maxLength,
		journeyLifecycleSchemaVersion, request.DeviceRef, s.keys.Prefix(),
	).Slice()
	if err != nil {
		return ports.JourneyCommandResult{}, storeError("end journey", err)
	}
	return decodeJourneyResult(values)
}

func (s *JourneyLifecycleStore) Active(
	ctx context.Context,
	deviceRef string,
) (domain.ActiveJourney, error) {
	payload, err := s.client.Get(
		ctx,
		s.keys.ActiveJourney(deviceRef),
	).Bytes()
	if err != nil {
		if err == redis.Nil {
			return domain.ActiveJourney{}, ports.ErrNotFound
		}
		return domain.ActiveJourney{}, storeError("get active journey", err)
	}
	var active redisActiveJourney
	if err := json.Unmarshal(payload, &active); err != nil {
		return domain.ActiveJourney{}, fmt.Errorf("decode active journey: %w", err)
	}
	active.ActiveJourney.DeviceRef = deviceRef
	return active.ActiveJourney, nil
}

func (s *JourneyLifecycleStore) RecordPosition(
	ctx context.Context,
	deviceRef string,
	journeyID string,
	sessionID string,
	receivedAt time.Time,
	expiresAt time.Time,
) error {
	status, err := recordJourneyPositionScript.Run(ctx, s.client, []string{
		s.keys.ActiveJourney(deviceRef), s.keys.EndedJourney(journeyID),
		s.keys.ActiveJourneys(),
	}, journeyID, receivedAt.UnixMilli(),
		receivedAt.UTC().Format(time.RFC3339Nano), sessionID,
		s.keys.Presence(sessionID),
		deviceRef, expiresAt.UnixMilli(),
	).Text()
	if err != nil {
		return storeError("record journey position", err)
	}
	switch status {
	case "OK":
		return nil
	case "ENDED":
		return domain.ErrJourneyAlreadyEnded
	case "OWNER":
		return domain.ErrJourneyOwnerMismatch
	default:
		return domain.ErrJourneyNotActive
	}
}

func (s *JourneyLifecycleStore) ListExpiredDeviceRefs(
	ctx context.Context,
	now time.Time,
	limit int,
) ([]string, error) {
	if limit <= 0 {
		return nil, nil
	}
	values, err := s.client.ZRangeByScore(
		ctx,
		s.keys.ActiveJourneys(),
		&redis.ZRangeBy{
			Min: "-inf", Max: fmt.Sprintf("%d", now.UnixMilli()),
			Count: int64(limit),
		},
	).Result()
	if err != nil {
		return nil, storeError("list active journeys", err)
	}
	return values, nil
}

func (s *JourneyLifecycleStore) ExpireIfDue(
	ctx context.Context,
	request ports.ExpireJourneyMutation,
) (ports.JourneyExpiryResult, error) {
	event := domain.JourneyLifecycleEvent{
		EventType: domain.JourneyEndedEvent,
		EventID:   request.EventID, JourneyID: request.JourneyID,
		ClientJourneyKey: "resolved-by-store",
		MapID:            "resolved-by-store", MapRevision: "resolved-by-store",
		LifecycleSequence: 1, RouteRevision: 1,
		OccurredAt: request.IngestedAt.UTC(),
		IngestedAt: request.IngestedAt.UTC(), Outcome: domain.JourneyExpired,
	}
	if err := event.Validate(); err != nil {
		return ports.JourneyExpiryResult{}, err
	}
	eventPayload, err := json.Marshal(event)
	if err != nil {
		return ports.JourneyExpiryResult{}, err
	}
	values, err := expireJourneyScript.Run(ctx, s.client, []string{
		s.keys.ActiveJourney(request.DeviceRef), s.keys.ActiveJourneys(),
		s.keys.EndedJourney(request.JourneyID), s.streamKey,
		s.keys.ActivePresences(),
	}, request.JourneyID,
		request.IngestedAt.Add(-request.FirstPositionTimeout).UnixMilli(),
		request.IngestedAt.Add(-request.PositionStaleAfter).UnixMilli(),
		string(eventPayload), request.EndedTombstoneExpiresAt.UnixMilli(),
		s.maxLength, journeyLifecycleSchemaVersion, request.DeviceRef,
		s.keys.Prefix(),
	).Slice()
	if err != nil {
		return ports.JourneyExpiryResult{}, storeError("expire journey", err)
	}
	if len(values) != 2 {
		return ports.JourneyExpiryResult{}, fmt.Errorf("unexpected Redis expiry result")
	}
	status, err := resultString(values[0])
	if err != nil {
		return ports.JourneyExpiryResult{}, err
	}
	switch status {
	case "NOT_ACTIVE":
		return ports.JourneyExpiryResult{}, domain.ErrJourneyNotActive
	case "NOT_DUE":
		return ports.JourneyExpiryResult{}, nil
	case "OK":
		presence, err := decodeRemovedPresence(values[1])
		return ports.JourneyExpiryResult{
			Expired: true, RemovedPresence: presence,
		}, err
	default:
		return ports.JourneyExpiryResult{}, fmt.Errorf(
			"unexpected Redis expiry status %q",
			status,
		)
	}
}

func decodeJourneyResult(values []any) (ports.JourneyCommandResult, error) {
	if len(values) < 2 || len(values) > 3 {
		return ports.JourneyCommandResult{}, fmt.Errorf("unexpected Redis journey result")
	}
	status, err := resultString(values[0])
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	switch status {
	case "NOT_ACTIVE":
		return ports.JourneyCommandResult{}, domain.ErrJourneyNotActive
	case "ENDED":
		return ports.JourneyCommandResult{}, domain.ErrJourneyAlreadyEnded
	case "OWNER":
		return ports.JourneyCommandResult{}, domain.ErrJourneyOwnerMismatch
	case "DESTINATION":
		return ports.JourneyCommandResult{}, domain.ErrDestinationChanged
	case "MAP":
		return ports.JourneyCommandResult{}, domain.ErrInvalidJourney
	case "OK", "DEDUP":
	default:
		return ports.JourneyCommandResult{}, fmt.Errorf(
			"unexpected Redis journey status %q",
			status,
		)
	}
	payload, err := resultString(values[1])
	if err != nil {
		return ports.JourneyCommandResult{}, err
	}
	var decoded journeyResultPayload
	if err := json.Unmarshal([]byte(payload), &decoded); err != nil {
		return ports.JourneyCommandResult{}, fmt.Errorf("decode journey result: %w", err)
	}
	result := ports.JourneyCommandResult{
		JourneyID:         decoded.JourneyID,
		LifecycleSequence: decoded.LifecycleSequence,
		RouteRevision:     decoded.RouteRevision, Deduplicated: status == "DEDUP",
	}
	if status == "OK" && len(values) == 3 {
		result.RemovedPresence, err = decodeRemovedPresence(values[2])
		if err != nil {
			return ports.JourneyCommandResult{}, err
		}
	}
	return result, nil
}

func decodeRemovedPresence(value any) (*domain.Presence, error) {
	payload, err := resultString(value)
	if err != nil {
		return nil, err
	}
	if payload == "" {
		return nil, nil
	}
	presence, err := decodePresence([]byte(payload))
	if err != nil {
		return nil, err
	}
	return &presence, nil
}
