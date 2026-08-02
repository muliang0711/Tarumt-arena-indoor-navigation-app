package ports

import (
	"time"

	"github.com/campus-navigator/analytics-api/internal/domain"
)

type Observer interface {
	QueryCompleted(string, time.Duration, domain.QueryStats, int, int)
	QueryFailed(string)
}

type NoopObserver struct{}

func (NoopObserver) QueryCompleted(string, time.Duration, domain.QueryStats, int, int) {}
func (NoopObserver) QueryFailed(string)                                                {}
