package composition

import (
	"fmt"
	"log/slog"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/config"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/identity"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/memory"
	redisinfra "github.com/campus-navigator/presence-gateway/internal/infrastructure/redis"
)

type Backend struct {
	Sessions  ports.SessionStore
	Presences ports.PresenceStore
	Occupancy ports.OccupancyStore
	Broker    ports.RealtimeBroker
	Health    ports.DependencyHealth
	Journeys  ports.JourneyLifecycleStore
	Close     func() error
}

func NewBackend(cfg config.Config, logger *slog.Logger) (Backend, error) {
	if cfg.Backend == "redis" {
		return newRedisBackend(cfg, logger)
	}
	sessions := memory.NewSessionStore()
	presences := memory.NewPresenceStore(memory.TrajectoryOptions{
		Enabled: cfg.TrajectoryEnabled, MaxLength: int(cfg.TrajectoryStreamMaxLen),
	})
	return Backend{
		Sessions: sessions, Presences: presences,
		Occupancy: memory.NewOccupancyStore(sessions, presences),
		Broker:    memory.NewRealtimeBroker(cfg.BrokerSubscriberQueue),
		Health:    memory.HealthChecker{}, Close: func() error { return nil },
		Journeys: memory.NewJourneyLifecycleStore(presences.Remove),
	}, nil
}

func newRedisBackend(cfg config.Config, logger *slog.Logger) (Backend, error) {
	client, err := redisinfra.NewClient(redisinfra.ClientOptions{
		URL: cfg.RedisURL, PoolSize: cfg.RedisPoolSize, MinIdleConnections: cfg.RedisMinIdleConns,
		DialTimeout: cfg.RedisDialTimeout, ReadTimeout: cfg.RedisReadTimeout,
		WriteTimeout: cfg.RedisWriteTimeout, MaxRetries: cfg.RedisMaxRetries,
	})
	if err != nil {
		return Backend{}, err
	}
	instanceID := cfg.InstanceID
	if instanceID == "" {
		instanceID, err = (identity.UUIDGenerator{}).NewID()
		if err != nil {
			_ = client.Close()
			return Backend{}, fmt.Errorf("generate instance ID: %w", err)
		}
	}
	keys := redisinfra.NewKeyspace(cfg.RedisKeyPrefix)
	broker := redisinfra.NewRealtimeBroker(client, keys, instanceID, cfg.BrokerSubscriberQueue, logger)
	sessions := redisinfra.NewSessionStore(client, keys)
	presences := redisinfra.NewPresenceStore(client, keys, cfg.PresenceRecordTTL, redisinfra.TrajectoryOptions{
		Enabled: cfg.TrajectoryEnabled, MaxLength: cfg.TrajectoryStreamMaxLen,
		StreamKey: cfg.TrajectoryStreamKey,
	})
	journeys := redisinfra.NewJourneyLifecycleStore(
		client,
		keys,
		redisinfra.JourneyLifecycleOptions{
			StreamKey: cfg.JourneyLifecycleStreamKey,
			MaxLength: cfg.JourneyLifecycleStreamMaxLen,
		},
	)
	return Backend{
		Sessions: sessions, Presences: presences,
		Occupancy: redisinfra.NewOccupancyStore(client, keys), Broker: broker,
		Health:   redisinfra.NewHealthChecker(client, broker),
		Journeys: journeys,
		Close: func() error {
			_ = broker.Close()
			return client.Close()
		},
	}, nil
}
