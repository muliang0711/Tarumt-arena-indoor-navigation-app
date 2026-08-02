package ports

import (
	"context"
	"errors"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/domain"
)

var (
	ErrNotFound    = errors.New("not found")
	ErrUnavailable = errors.New("dependency unavailable")
)

type SessionStore interface {
	Put(context.Context, domain.Session) error
	Get(context.Context, string) (domain.Session, error)
	Touch(context.Context, string, time.Time) error
	IsCurrent(context.Context, domain.Session) (bool, error)
	Delete(context.Context, string) error
	DeleteExpired(context.Context, time.Time, int) error
}
