package composition

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/campus-navigator/trajectory-worker/internal/application"
	"github.com/campus-navigator/trajectory-worker/internal/config"
	clickhouseinfra "github.com/campus-navigator/trajectory-worker/internal/infrastructure/clickhouse"
	redisinfra "github.com/campus-navigator/trajectory-worker/internal/infrastructure/redis"
	"github.com/campus-navigator/trajectory-worker/internal/observability"
)

type Runtime struct {
	trajectorySource    *redisinfra.Consumer
	trajectoryRepo      *clickhouseinfra.TrajectoryRepository
	trajectoryIngestion *application.IngestionService
	journeySource       *redisinfra.Consumer
	journeyRepo         *clickhouseinfra.JourneyLifecycleRepository
	journeyIngestion    *application.JourneyIngestionService
	server              *observability.Server
}

func NewRuntime(cfg config.Config, logger *slog.Logger) (*Runtime, error) {
	trajectorySource, err := redisinfra.NewConsumer(redisinfra.Options{
		URL: cfg.RedisURL, Stream: cfg.RedisStream, DeadLetter: cfg.RedisDeadLetter,
		Group: cfg.RedisGroup, Consumer: cfg.RedisConsumer, PoolSize: cfg.RedisPoolSize,
		DialTimeout: cfg.RedisDialTimeout, ReadTimeout: cfg.RedisReadTimeout,
		WriteTimeout: cfg.RedisWriteTimeout, MaxRetries: cfg.RedisMaxRetries,
	})
	if err != nil {
		return nil, err
	}
	trajectoryRepo, err := clickhouseinfra.NewTrajectoryRepository(clickhouseinfra.Options{
		Address: cfg.ClickHouseAddress, Database: cfg.ClickHouseDatabase,
		Username: cfg.ClickHouseUsername, Password: cfg.ClickHousePassword,
		DialTimeout: cfg.ClickHouseDial, MaxOpenConns: cfg.ClickHouseMaxOpen,
		MaxIdleConns: cfg.ClickHouseMaxIdle, ConnMaxLifetime: cfg.ClickHouseConnMaxAge,
		Table: cfg.ClickHouseTable,
	})
	if err != nil {
		_ = trajectorySource.Close()
		return nil, err
	}
	journeySource, err := redisinfra.NewConsumer(redisinfra.Options{
		URL: cfg.RedisURL, Stream: cfg.JourneyRedisStream,
		DeadLetter: cfg.JourneyRedisDeadLetter, Group: cfg.JourneyRedisGroup,
		Consumer: cfg.JourneyRedisConsumer, PoolSize: cfg.RedisPoolSize,
		DialTimeout: cfg.RedisDialTimeout, ReadTimeout: cfg.RedisReadTimeout,
		WriteTimeout: cfg.RedisWriteTimeout, MaxRetries: cfg.RedisMaxRetries,
	})
	if err != nil {
		_ = trajectorySource.Close()
		_ = trajectoryRepo.Close()
		return nil, err
	}
	journeyRepo, err := clickhouseinfra.NewJourneyLifecycleRepository(
		clickhouseinfra.Options{
			Address: cfg.ClickHouseAddress, Database: cfg.ClickHouseDatabase,
			Username: cfg.ClickHouseUsername, Password: cfg.ClickHousePassword,
			DialTimeout: cfg.ClickHouseDial, MaxOpenConns: cfg.ClickHouseMaxOpen,
			MaxIdleConns: cfg.ClickHouseMaxIdle, ConnMaxLifetime: cfg.ClickHouseConnMaxAge,
			Table: cfg.JourneyClickHouseTable,
		},
	)
	if err != nil {
		_ = trajectorySource.Close()
		_ = trajectoryRepo.Close()
		_ = journeySource.Close()
		return nil, err
	}
	trajectoryMetrics := observability.NewMetrics()
	journeyMetrics := observability.NewMetricsWithPrefix("journey_lifecycle_worker")
	trajectoryIngestion := application.NewIngestionService(trajectorySource, trajectoryRepo, trajectoryMetrics, logger, application.IngestionOptions{
		BatchSize: cfg.BatchSize, BatchMaxWait: cfg.BatchMaxWait, ReadBlock: cfg.ReadBlock,
		ReclaimInterval: cfg.ReclaimInterval, ReclaimMinIdle: cfg.ReclaimMinIdle,
		StatsInterval: cfg.StatsInterval, ErrorBackoff: cfg.ErrorBackoff,
	})
	journeyIngestion := application.NewJourneyIngestionService(
		journeySource,
		journeyRepo,
		journeyMetrics,
		logger,
		application.IngestionOptions{
			BatchSize: cfg.JourneyBatchSize, BatchMaxWait: cfg.JourneyBatchMaxWait,
			ReadBlock: cfg.ReadBlock, ReclaimInterval: cfg.ReclaimInterval,
			ReclaimMinIdle: cfg.ReclaimMinIdle, StatsInterval: cfg.StatsInterval,
			ErrorBackoff: cfg.ErrorBackoff,
		},
	)
	server := observability.NewServer(cfg.Address, observability.MetricsCollection{
		trajectoryMetrics, journeyMetrics,
	}, func(ctx context.Context) error {
		if err := trajectorySource.Ping(ctx); err != nil {
			return fmt.Errorf("Redis: %w", err)
		}
		if err := trajectoryRepo.Ping(ctx); err != nil {
			return fmt.Errorf("ClickHouse trajectory table: %w", err)
		}
		if err := journeyRepo.Ping(ctx); err != nil {
			return fmt.Errorf("ClickHouse Journey lifecycle table: %w", err)
		}
		return nil
	}, cfg.ShutdownTimeout)
	return &Runtime{
		trajectorySource: trajectorySource, trajectoryRepo: trajectoryRepo,
		trajectoryIngestion: trajectoryIngestion, journeySource: journeySource,
		journeyRepo: journeyRepo, journeyIngestion: journeyIngestion, server: server,
	}, nil
}

func (r *Runtime) Run(ctx context.Context) error {
	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	results := make(chan error, 3)
	go func() { results <- r.trajectoryIngestion.Run(runCtx) }()
	go func() { results <- r.journeyIngestion.Run(runCtx) }()
	go func() { results <- r.server.Run(runCtx) }()
	first := <-results
	cancel()
	second := <-results
	third := <-results
	return errors.Join(first, second, third)
}

func (r *Runtime) Close() error {
	return errors.Join(
		r.trajectorySource.Close(),
		r.trajectoryRepo.Close(),
		r.journeySource.Close(),
		r.journeyRepo.Close(),
	)
}
