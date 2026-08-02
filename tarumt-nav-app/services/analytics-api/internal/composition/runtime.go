package composition

import (
	"context"
	"log/slog"

	"github.com/campus-navigator/analytics-api/internal/application"
	"github.com/campus-navigator/analytics-api/internal/application/ports"
	"github.com/campus-navigator/analytics-api/internal/config"
	clickhouseinfra "github.com/campus-navigator/analytics-api/internal/infrastructure/clickhouse"
	"github.com/campus-navigator/analytics-api/internal/observability"
	httptransport "github.com/campus-navigator/analytics-api/internal/transport/http"
)

type Runtime struct {
	repository *clickhouseinfra.AnalyticsRepository
	server     *httptransport.Server
}

func NewRuntime(cfg config.Config, logger *slog.Logger) (*Runtime, error) {
	repository, err := clickhouseinfra.NewAnalyticsRepository(clickhouseinfra.Options{
		Address: cfg.ClickHouseAddress, Database: cfg.ClickHouseDatabase,
		Username: cfg.ClickHouseUsername, Password: cfg.ClickHousePassword,
		Table: cfg.ClickHouseTable, DialTimeout: cfg.ClickHouseDialTimeout,
		MaxOpenConns: cfg.ClickHouseMaxOpenConns, MaxIdleConns: cfg.ClickHouseMaxIdleConns,
		ConnMaxLifetime: cfg.ClickHouseConnMaxAge,
	})
	if err != nil {
		return nil, err
	}
	metrics := observability.NewMetrics()
	service := application.NewAnalyticsService(repository, ports.SystemClock{}, metrics, cfg.Policy)
	server := httptransport.NewServer(service, repository, metrics, logger, httptransport.RouterOptions{
		Address: cfg.Address, ShutdownTimeout: cfg.ShutdownTimeout,
		QueryTimeout: cfg.QueryTimeout, MaxConcurrentQueries: cfg.MaxConcurrentQueries,
	})
	return &Runtime{repository: repository, server: server}, nil
}

func (r *Runtime) Run(ctx context.Context) error { return r.server.Run(ctx) }
func (r *Runtime) Close() error                  { return r.repository.Close() }
