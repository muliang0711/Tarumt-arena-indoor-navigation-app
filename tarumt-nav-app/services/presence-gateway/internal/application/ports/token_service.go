package ports

import "time"

type TokenService interface {
	Issue(sessionID string, now, expiresAt time.Time) (string, error)
	Verify(token string, now time.Time) (string, error)
}
