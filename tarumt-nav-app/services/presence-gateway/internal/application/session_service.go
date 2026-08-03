package application

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

var (
	ErrUnauthorized   = errors.New("unauthorized")
	ErrSessionExpired = errors.New("session expired")
)

type CreatedSession struct {
	Session        domain.Session
	AccessToken    string
	TokenExpiresAt time.Time
}

type SessionService struct {
	store      ports.SessionStore
	tokens     ports.TokenService
	identities ports.IdentityService
	ids        ports.IDGenerator
	clock      ports.Clock
	sessionTTL time.Duration
	tokenTTL   time.Duration
}

func NewSessionService(
	store ports.SessionStore,
	tokens ports.TokenService,
	identities ports.IdentityService,
	ids ports.IDGenerator,
	clock ports.Clock,
	sessionTTL time.Duration,
	tokenTTL time.Duration,
) *SessionService {
	return &SessionService{
		store: store, tokens: tokens, identities: identities, ids: ids,
		clock: clock, sessionTTL: sessionTTL, tokenTTL: tokenTTL,
	}
}

func (s *SessionService) Create(ctx context.Context, installationID string) (CreatedSession, error) {
	return s.CreateWithDisplayName(ctx, installationID, nil)
}

func (s *SessionService) CreateWithDisplayName(
	ctx context.Context,
	installationID string,
	displayName *string,
) (CreatedSession, error) {
	deviceRef, err := s.identities.DeriveDeviceReference(installationID)
	if err != nil {
		return CreatedSession{}, err
	}
	sessionID, err := s.ids.NewID()
	if err != nil {
		return CreatedSession{}, err
	}
	now := s.clock.Now().UTC()
	normalizedDisplayName := ""
	if displayName != nil {
		normalizedDisplayName, err = domain.NormalizeDisplayName(*displayName)
		if err != nil {
			return CreatedSession{}, err
		}
	}
	session := domain.Session{
		ID: sessionID, DeviceRef: deviceRef, CreatedAt: now,
		DisplayName: normalizedDisplayName, LastSeenAt: now, ExpiresAt: now.Add(s.sessionTTL),
	}
	if err := s.store.Put(ctx, session); err != nil {
		return CreatedSession{}, err
	}
	tokenExpiresAt := now.Add(s.tokenTTL)
	if tokenExpiresAt.After(session.ExpiresAt) {
		tokenExpiresAt = session.ExpiresAt
	}
	token, err := s.tokens.Issue(session.ID, now, tokenExpiresAt)
	if err != nil {
		_ = s.store.Delete(ctx, session.ID)
		return CreatedSession{}, err
	}
	return CreatedSession{Session: session, AccessToken: token, TokenExpiresAt: tokenExpiresAt}, nil
}

func (s *SessionService) Authenticate(ctx context.Context, rawToken string) (domain.Session, error) {
	if strings.TrimSpace(rawToken) == "" {
		return domain.Session{}, ErrUnauthorized
	}
	now := s.clock.Now().UTC()
	sessionID, err := s.tokens.Verify(rawToken, now)
	if err != nil {
		return domain.Session{}, ErrUnauthorized
	}
	session, err := s.store.Get(ctx, sessionID)
	if err != nil {
		if errors.Is(err, ports.ErrUnavailable) {
			return domain.Session{}, err
		}
		return domain.Session{}, ErrUnauthorized
	}
	if session.IsExpired(now) {
		return domain.Session{}, ErrSessionExpired
	}
	current, err := s.store.IsCurrent(ctx, session)
	if err != nil {
		return domain.Session{}, err
	}
	if !current {
		return domain.Session{}, ErrUnauthorized
	}
	return session, nil
}

func (s *SessionService) Touch(ctx context.Context, sessionID string) error {
	now := s.clock.Now().UTC()
	session, err := s.store.Get(ctx, sessionID)
	if err != nil {
		if errors.Is(err, ports.ErrUnavailable) {
			return err
		}
		return ErrUnauthorized
	}
	if session.IsExpired(now) {
		return ErrSessionExpired
	}
	return s.store.Touch(ctx, sessionID, now)
}
