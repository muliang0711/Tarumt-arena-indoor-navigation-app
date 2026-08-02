package redisinfra

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
	redis "github.com/redis/go-redis/v9"
)

type PresenceStore struct {
	client            *redis.Client
	keys              Keyspace
	recordTTL         time.Duration
	trajectoryEnabled bool
	trajectoryMaxLen  int64
	trajectoryStream  string
}

type TrajectoryOptions struct {
	Enabled   bool
	MaxLength int64
	StreamKey string
}

func NewPresenceStore(client *redis.Client, keys Keyspace, recordTTL time.Duration, options ...TrajectoryOptions) *PresenceStore {
	resolved := TrajectoryOptions{Enabled: true, MaxLength: 1_000_000, StreamKey: keys.TrajectoryStream()}
	if len(options) > 0 {
		resolved = options[0]
		if resolved.StreamKey == "" {
			resolved.StreamKey = keys.TrajectoryStream()
		}
	}
	return &PresenceStore{
		client: client, keys: keys, recordTTL: recordTTL,
		trajectoryEnabled: resolved.Enabled, trajectoryMaxLen: resolved.MaxLength,
		trajectoryStream: resolved.StreamKey,
	}
}

func (s *PresenceStore) Get(ctx context.Context, sessionID string) (domain.Presence, error) {
	values, err := s.client.HMGet(ctx, s.keys.Presence(sessionID), "payload", "journey_id").Result()
	if err != nil {
		return domain.Presence{}, storeError("get presence", err)
	}
	if len(values) != 2 || values[0] == nil {
		return domain.Presence{}, ports.ErrNotFound
	}
	payload, err := resultString(values[0])
	if err != nil {
		return domain.Presence{}, err
	}
	presence, err := decodePresence([]byte(payload))
	if err != nil {
		return domain.Presence{}, err
	}
	if values[1] != nil {
		presence.JourneyID, err = resultString(values[1])
		if err != nil {
			return domain.Presence{}, err
		}
	}
	return presence, nil
}

func (s *PresenceStore) Apply(ctx context.Context, request ports.PresenceMutationRequest) (ports.PresenceMutation, error) {
	presence := request.Presence
	trajectory := request.Trajectory.Normalized()
	if err := trajectory.Validate(); err != nil {
		return ports.PresenceMutation{}, err
	}
	payload, err := json.Marshal(presence)
	if err != nil {
		return ports.PresenceMutation{}, fmt.Errorf("encode presence: %w", err)
	}
	trajectoryPayload, err := json.Marshal(trajectory)
	if err != nil {
		return ports.PresenceMutation{}, fmt.Errorf("encode trajectory: %w", err)
	}
	buildingPart := encodePart(presence.Position.BuildingID)
	floorPart := encodePart(presence.Position.FloorID)
	edgePart := encodeEdgePart(presence.Position.FromNodeID, presence.Position.ToNodeID)
	result, err := applyPresenceScript.Run(ctx, s.client, []string{
		s.keys.Presence(presence.SessionID), s.keys.ActivePresences(),
		s.keys.BuildingActive(presence.Position.BuildingID), s.keys.BuildingFloors(presence.Position.BuildingID),
		s.keys.FloorActive(presence.Position.BuildingID, presence.Position.FloorID),
		s.keys.FloorRepresentatives(presence.Position.BuildingID, presence.Position.FloorID),
		s.trajectoryStream,
		s.keys.ActiveJourney(request.JourneyDeviceRef),
		s.keys.EndedJourney(presence.JourneyID),
	}, string(payload), presence.SessionID, presence.Sequence, buildingPart, floorPart,
		presence.LastSeenAt.UnixMilli(), s.recordTTL.Milliseconds(),
		domain.RepresentativeScore(presence.Position.BuildingID, presence.Position.FloorID, presence.SessionID),
		s.keys.Prefix(), string(trajectoryPayload), boolString(s.trajectoryEnabled), s.trajectoryMaxLen, trajectory.EventID,
		presence.JourneyID, domain.TrajectorySchemaVersion,
		boolString(request.CanonicalJourney),
		request.ReceivedAt.UTC().Format(time.RFC3339Nano),
		request.ReceivedAt.UnixMilli(),
		edgePart,
	).Slice()
	if err != nil {
		return ports.PresenceMutation{}, storeError("apply presence", err)
	}
	if len(result) < 1 {
		return ports.PresenceMutation{}, fmt.Errorf("unexpected Redis apply presence result")
	}
	acceptedFlag, err := resultInt64(result[0])
	if err != nil {
		return ports.PresenceMutation{}, err
	}
	if acceptedFlag == 0 {
		return ports.PresenceMutation{}, domain.ErrStaleSequence
	}
	if acceptedFlag == -2 {
		return ports.PresenceMutation{}, domain.ErrJourneyAlreadyEnded
	}
	if acceptedFlag == -3 {
		return ports.PresenceMutation{}, domain.ErrJourneyNotActive
	}
	if acceptedFlag == -4 {
		return ports.PresenceMutation{}, domain.ErrJourneyOwnerMismatch
	}
	if len(result) != 5 {
		return ports.PresenceMutation{}, fmt.Errorf("unexpected Redis apply presence result")
	}
	previousPayload, err := resultString(result[1])
	if err != nil {
		return ports.PresenceMutation{}, err
	}
	previousJourney, err := resultString(result[2])
	if err != nil {
		return ports.PresenceMutation{}, err
	}
	acceptedJourney, err := resultString(result[3])
	if err != nil {
		return ports.PresenceMutation{}, err
	}
	accepted := presence
	accepted.JourneyID = acceptedJourney
	acceptedTrajectoryPayload, err := resultString(result[4])
	if err != nil {
		return ports.PresenceMutation{}, err
	}
	var acceptedTrajectory domain.TrajectoryEvent
	if err := json.Unmarshal([]byte(acceptedTrajectoryPayload), &acceptedTrajectory); err != nil {
		return ports.PresenceMutation{}, fmt.Errorf("decode accepted trajectory: %w", err)
	}
	mutation := ports.PresenceMutation{Accepted: accepted, Trajectory: acceptedTrajectory}
	if previousPayload != "" {
		previous, err := decodePresence([]byte(previousPayload))
		if err != nil {
			return ports.PresenceMutation{}, err
		}
		previous.JourneyID = previousJourney
		mutation.Previous = &previous
	}
	return mutation, nil
}

func (s *PresenceStore) Append(ctx context.Context, event domain.TrajectoryEvent) error {
	event = event.Normalized()
	if err := event.Validate(); err != nil {
		return err
	}
	if !s.trajectoryEnabled {
		return nil
	}
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("encode trajectory: %w", err)
	}
	args := &redis.XAddArgs{
		Stream: s.trajectoryStream,
		Values: map[string]any{
			"schema_version": domain.TrajectorySchemaVersion,
			"event_id":       event.EventID,
			"payload":        string(payload),
		},
	}
	if s.trajectoryMaxLen > 0 {
		args.MaxLen = s.trajectoryMaxLen
		args.Approx = true
	}
	return storeError("append trajectory", s.client.XAdd(ctx, args).Err())
}

func boolString(value bool) string {
	if value {
		return "1"
	}
	return "0"
}

func (s *PresenceStore) Touch(ctx context.Context, sessionID string, at time.Time) error {
	presence, err := s.Get(ctx, sessionID)
	if err != nil {
		return err
	}
	presence.LastSeenAt = at.UTC()
	payload, err := json.Marshal(presence)
	if err != nil {
		return fmt.Errorf("encode presence: %w", err)
	}
	result, err := touchPresenceScript.Run(ctx, s.client,
		[]string{s.keys.Presence(sessionID), s.keys.ActivePresences()},
		string(payload), sessionID, at.UnixMilli(), s.recordTTL.Milliseconds(), s.keys.Prefix(),
	).Int()
	if err != nil {
		return storeError("touch presence", err)
	}
	if result == 0 {
		return ports.ErrNotFound
	}
	return nil
}

func (s *PresenceStore) Remove(ctx context.Context, sessionID string) (*domain.Presence, error) {
	return s.remove(ctx, sessionID, time.Time{})
}

func (s *PresenceStore) RemoveIfStale(ctx context.Context, sessionID string, cutoff time.Time) (*domain.Presence, error) {
	return s.remove(ctx, sessionID, cutoff)
}

func (s *PresenceStore) remove(ctx context.Context, sessionID string, cutoff time.Time) (*domain.Presence, error) {
	cutoffMillis := int64(0)
	if !cutoff.IsZero() {
		cutoffMillis = cutoff.UnixMilli()
	}
	payload, err := removePresenceScript.Run(ctx, s.client,
		[]string{s.keys.Presence(sessionID), s.keys.ActivePresences()},
		s.keys.Prefix(), sessionID, cutoffMillis,
	).Text()
	if err != nil {
		return nil, storeError("remove presence", err)
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

func (s *PresenceStore) ListStaleSessionIDs(ctx context.Context, cutoff time.Time, limit int) ([]string, error) {
	ids, err := s.client.ZRangeByScore(ctx, s.keys.ActivePresences(), &redis.ZRangeBy{
		Min: "-inf", Max: strconv.FormatInt(cutoff.UnixMilli(), 10), Count: int64(limit),
	}).Result()
	if err != nil {
		return nil, storeError("list stale presences", err)
	}
	return ids, nil
}

func decodePresence(payload []byte) (domain.Presence, error) {
	var presence domain.Presence
	if err := json.Unmarshal(payload, &presence); err != nil {
		return domain.Presence{}, fmt.Errorf("decode presence: %w", err)
	}
	return presence, nil
}

func resultInt64(value any) (int64, error) {
	switch typed := value.(type) {
	case int64:
		return typed, nil
	case string:
		return strconv.ParseInt(typed, 10, 64)
	default:
		return 0, fmt.Errorf("unexpected integer result type %T", value)
	}
}

func resultString(value any) (string, error) {
	switch typed := value.(type) {
	case string:
		return typed, nil
	case []byte:
		return string(typed), nil
	default:
		return "", fmt.Errorf("unexpected string result type %T", value)
	}
}
