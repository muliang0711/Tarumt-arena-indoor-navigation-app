package memory

import (
	"context"
	"sync"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]domain.Session
	current  map[string]string
}

func (s *SessionStore) Touch(ctx context.Context, id string, at time.Time) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return ports.ErrNotFound
	}
	session.LastSeenAt = at
	s.sessions[id] = session
	return nil
}

func NewSessionStore() *SessionStore {
	return &SessionStore{sessions: make(map[string]domain.Session), current: make(map[string]string)}
}

func (s *SessionStore) Put(ctx context.Context, session domain.Session) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[session.ID] = session
	s.current[session.DeviceRef] = session.ID
	return nil
}

func (s *SessionStore) IsCurrent(ctx context.Context, session domain.Session) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.current[session.DeviceRef] == session.ID, nil
}

func (s *SessionStore) Get(ctx context.Context, id string) (domain.Session, error) {
	if err := ctx.Err(); err != nil {
		return domain.Session{}, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, ok := s.sessions[id]
	if !ok {
		return domain.Session{}, ports.ErrNotFound
	}
	return session, nil
}

func (s *SessionStore) Delete(ctx context.Context, id string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, id)
	return nil
}

func (s *SessionStore) list(ctx context.Context) ([]domain.Session, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]domain.Session, 0, len(s.sessions))
	for _, session := range s.sessions {
		result = append(result, session)
	}
	return result, nil
}

func (s *SessionStore) DeleteExpired(ctx context.Context, now time.Time, limit int) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	deleted := 0
	for id, session := range s.sessions {
		if session.IsExpired(now) {
			delete(s.sessions, id)
			deleted++
			if deleted >= limit {
				break
			}
		}
	}
	return nil
}
