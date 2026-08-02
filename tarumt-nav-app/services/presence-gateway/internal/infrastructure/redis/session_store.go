package redisinfra

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
	redis "github.com/redis/go-redis/v9"
)

type SessionStore struct {
	client *redis.Client
	keys   Keyspace
}

func NewSessionStore(client *redis.Client, keys Keyspace) *SessionStore {
	return &SessionStore{client: client, keys: keys}
}

func (s *SessionStore) Put(ctx context.Context, session domain.Session) error {
	payload, err := json.Marshal(session)
	if err != nil {
		return fmt.Errorf("encode session: %w", err)
	}
	ttl := session.ExpiresAt.Sub(session.CreatedAt)
	if ttl <= 0 {
		return errors.New("session expiry must be after creation")
	}
	_, err = createSessionScript.Run(ctx, s.client,
		[]string{s.keys.Session(session.ID), s.keys.ActiveSessions(), s.keys.SessionExpirations(), s.keys.CurrentDeviceSession(session.DeviceRef), s.keys.ActiveDevices()},
		string(payload), session.ID, session.LastSeenAt.UnixMilli(), ttl.Milliseconds(), session.ExpiresAt.UnixMilli(), session.DeviceRef,
	).Result()
	return storeError("create session", err)
}

func (s *SessionStore) Get(ctx context.Context, id string) (domain.Session, error) {
	payload, err := s.client.Get(ctx, s.keys.Session(id)).Bytes()
	if err != nil {
		return domain.Session{}, storeError("get session", err)
	}
	var session domain.Session
	if err := json.Unmarshal(payload, &session); err != nil {
		return domain.Session{}, fmt.Errorf("decode session: %w", err)
	}
	return session, nil
}

func (s *SessionStore) Touch(ctx context.Context, id string, at time.Time) error {
	result, err := touchSessionScript.Run(ctx, s.client,
		[]string{s.keys.Session(id), s.keys.ActiveSessions(), s.keys.ActiveDevices()},
		id, at.UTC().Format(time.RFC3339Nano), at.UnixMilli(),
	).Int()
	if err != nil {
		return storeError("touch session", err)
	}
	if result == 0 {
		return ports.ErrNotFound
	}
	return nil
}

func (s *SessionStore) IsCurrent(ctx context.Context, session domain.Session) (bool, error) {
	current, err := s.client.Get(ctx, s.keys.CurrentDeviceSession(session.DeviceRef)).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, storeError("get current device session", err)
	}
	return current == session.ID, nil
}

func (s *SessionStore) Delete(ctx context.Context, id string) error {
	_, err := s.client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		pipe.Del(ctx, s.keys.Session(id))
		pipe.ZRem(ctx, s.keys.ActiveSessions(), id)
		pipe.ZRem(ctx, s.keys.SessionExpirations(), id)
		return nil
	})
	return storeError("delete session", err)
}

func (s *SessionStore) DeleteExpired(ctx context.Context, now time.Time, limit int) error {
	ids, err := s.client.ZRangeByScore(ctx, s.keys.SessionExpirations(), &redis.ZRangeBy{
		Min: "-inf", Max: strconv.FormatInt(now.UnixMilli(), 10), Offset: 0, Count: int64(limit),
	}).Result()
	if err != nil {
		return storeError("list expired sessions", err)
	}
	if len(ids) == 0 {
		return nil
	}
	_, err = s.client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		for _, id := range ids {
			pipe.Del(ctx, s.keys.Session(id))
			pipe.ZRem(ctx, s.keys.ActiveSessions(), id)
			pipe.ZRem(ctx, s.keys.SessionExpirations(), id)
		}
		return nil
	})
	return storeError("delete expired sessions", err)
}
