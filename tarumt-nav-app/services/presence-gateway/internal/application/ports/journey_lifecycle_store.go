package ports

import (
	"context"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type JourneyCommandResult struct {
	JourneyID         string
	LifecycleSequence uint64
	RouteRevision     uint64
	Deduplicated      bool
	RemovedPresence   *domain.Presence
}

type JourneyExpiryResult struct {
	Expired         bool
	RemovedPresence *domain.Presence
}

type StartJourneyMutation struct {
	DeviceRef               string
	SessionID               string
	ClientEventID           string
	ClientJourneyKey        string
	JourneyID               string
	StartedEventID          string
	SupersededEventID       string
	MapID                   string
	MapRevision             string
	Route                   domain.PlannedRoute
	OccurredAt              time.Time
	IngestedAt              time.Time
	IdempotencyExpiresAt    time.Time
	EndedTombstoneExpiresAt time.Time
	FirstPositionExpiresAt  time.Time
}

type RecalculateRouteMutation struct {
	DeviceRef            string
	ClientEventID        string
	JourneyID            string
	ClientJourneyKey     string
	EventID              string
	MapID                string
	MapRevision          string
	Route                domain.PlannedRoute
	Reason               domain.RerouteReason
	OccurredAt           time.Time
	IngestedAt           time.Time
	IdempotencyExpiresAt time.Time
}

type EndJourneyMutation struct {
	DeviceRef               string
	ClientEventID           string
	JourneyID               string
	ClientJourneyKey        string
	EventID                 string
	Outcome                 domain.JourneyOutcome
	OccurredAt              time.Time
	IngestedAt              time.Time
	IdempotencyExpiresAt    time.Time
	EndedTombstoneExpiresAt time.Time
}

type ExpireJourneyMutation struct {
	DeviceRef               string
	JourneyID               string
	EventID                 string
	IngestedAt              time.Time
	FirstPositionTimeout    time.Duration
	PositionStaleAfter      time.Duration
	EndedTombstoneExpiresAt time.Time
}

type JourneyLifecycleStore interface {
	Start(context.Context, StartJourneyMutation) (JourneyCommandResult, error)
	Recalculate(context.Context, RecalculateRouteMutation) (JourneyCommandResult, error)
	End(context.Context, EndJourneyMutation) (JourneyCommandResult, error)
	Active(context.Context, string) (domain.ActiveJourney, error)
	RecordPosition(context.Context, string, string, string, time.Time, time.Time) error
	ListExpiredDeviceRefs(context.Context, time.Time, int) ([]string, error)
	ExpireIfDue(context.Context, ExpireJourneyMutation) (JourneyExpiryResult, error)
}

type JourneyRouteValidator interface {
	ValidateRoute(
		mapID string,
		revision string,
		originNodeID string,
		destinationNodeID string,
		plannedEdgeIDs []string,
	) error
}
