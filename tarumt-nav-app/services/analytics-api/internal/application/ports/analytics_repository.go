package ports

import (
	"context"

	"github.com/campus-navigator/analytics-api/internal/domain"
)

type AnalyticsRepository interface {
	FloorTraffic(context.Context, domain.TrafficQuery, domain.QueryPolicy) ([]domain.AggregateRow, domain.QueryStats, error)
	RouteEdgeUsage(context.Context, domain.TrafficQuery, domain.QueryPolicy) ([]domain.AggregateRow, domain.QueryStats, error)
	Ping(context.Context) error
	Close() error
}
