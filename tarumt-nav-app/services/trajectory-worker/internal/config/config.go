package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Address                string
	ShutdownTimeout        time.Duration
	RedisURL               string
	RedisStream            string
	RedisDeadLetter        string
	RedisGroup             string
	RedisConsumer          string
	RedisPoolSize          int
	RedisDialTimeout       time.Duration
	RedisReadTimeout       time.Duration
	RedisWriteTimeout      time.Duration
	RedisMaxRetries        int
	BatchSize              int64
	BatchMaxWait           time.Duration
	JourneyRedisStream     string
	JourneyRedisDeadLetter string
	JourneyRedisGroup      string
	JourneyRedisConsumer   string
	JourneyBatchSize       int64
	JourneyBatchMaxWait    time.Duration
	ReadBlock              time.Duration
	ReclaimInterval        time.Duration
	ReclaimMinIdle         time.Duration
	StatsInterval          time.Duration
	ErrorBackoff           time.Duration
	ClickHouseAddress      string
	ClickHouseDatabase     string
	ClickHouseUsername     string
	ClickHousePassword     string
	ClickHouseTable        string
	JourneyClickHouseTable string
	ClickHouseDial         time.Duration
	ClickHouseMaxOpen      int
	ClickHouseMaxIdle      int
	ClickHouseConnMaxAge   time.Duration
}

func Load() (Config, error) {
	hostname, _ := os.Hostname()
	consumerFallback := fmt.Sprintf("%s-%d", hostname, os.Getpid())
	cfg := Config{
		Address:         env("TRAJECTORY_WORKER_ADDRESS", ":9091"),
		RedisURL:        env("TRAJECTORY_REDIS_URL", "redis://localhost:6379/0"),
		RedisStream:     env("TRAJECTORY_REDIS_STREAM", "campus:presence:v1:trajectory:events"),
		RedisDeadLetter: env("TRAJECTORY_REDIS_DEAD_LETTER_STREAM", "campus:presence:v1:trajectory:dead-letter"),
		RedisGroup:      env("TRAJECTORY_REDIS_CONSUMER_GROUP", "trajectory-workers-v1"),
		RedisConsumer:   env("TRAJECTORY_REDIS_CONSUMER_NAME", consumerFallback),
		JourneyRedisStream: env(
			"JOURNEY_LIFECYCLE_REDIS_STREAM",
			"campus:presence:v1:journey:lifecycle:events",
		),
		JourneyRedisDeadLetter: env(
			"JOURNEY_LIFECYCLE_REDIS_DEAD_LETTER_STREAM",
			"campus:presence:v1:journey:lifecycle:dead-letter",
		),
		JourneyRedisGroup: env(
			"JOURNEY_LIFECYCLE_REDIS_CONSUMER_GROUP",
			"journey-lifecycle-workers-v1",
		),
		JourneyRedisConsumer: env(
			"JOURNEY_LIFECYCLE_REDIS_CONSUMER_NAME",
			consumerFallback+"-journey",
		),
		ClickHouseAddress:  env("TRAJECTORY_CLICKHOUSE_ADDRESS", "localhost:9000"),
		ClickHouseDatabase: env("TRAJECTORY_CLICKHOUSE_DATABASE", "campus_analytics"),
		ClickHouseUsername: env("TRAJECTORY_CLICKHOUSE_USERNAME", "default"),
		ClickHousePassword: os.Getenv("TRAJECTORY_CLICKHOUSE_PASSWORD"),
		ClickHouseTable:    env("TRAJECTORY_CLICKHOUSE_TABLE", "campus_analytics.trajectory_events_v1"),
		JourneyClickHouseTable: env(
			"JOURNEY_LIFECYCLE_CLICKHOUSE_TABLE",
			"campus_analytics.journey_lifecycle_events_v1",
		),
	}
	var err error
	if cfg.ShutdownTimeout, err = envDuration("TRAJECTORY_WORKER_SHUTDOWN_TIMEOUT", 10*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.RedisDialTimeout, err = envDuration("TRAJECTORY_REDIS_DIAL_TIMEOUT", 3*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.RedisReadTimeout, err = envDuration("TRAJECTORY_REDIS_READ_TIMEOUT", 3*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.RedisWriteTimeout, err = envDuration("TRAJECTORY_REDIS_WRITE_TIMEOUT", 3*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.ReadBlock, err = envDuration("TRAJECTORY_READ_BLOCK", 2*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.BatchMaxWait, err = envDuration("TRAJECTORY_BATCH_MAX_WAIT", 100*time.Millisecond); err != nil {
		return Config{}, err
	}
	if cfg.JourneyBatchMaxWait, err = envDuration("JOURNEY_LIFECYCLE_BATCH_MAX_WAIT", 250*time.Millisecond); err != nil {
		return Config{}, err
	}
	if cfg.ReclaimInterval, err = envDuration("TRAJECTORY_RECLAIM_INTERVAL", 10*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.ReclaimMinIdle, err = envDuration("TRAJECTORY_RECLAIM_MIN_IDLE", 30*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.StatsInterval, err = envDuration("TRAJECTORY_STATS_INTERVAL", 5*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.ErrorBackoff, err = envDuration("TRAJECTORY_ERROR_BACKOFF", time.Second); err != nil {
		return Config{}, err
	}
	if cfg.ClickHouseDial, err = envDuration("TRAJECTORY_CLICKHOUSE_DIAL_TIMEOUT", 5*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.ClickHouseConnMaxAge, err = envDuration("TRAJECTORY_CLICKHOUSE_CONN_MAX_AGE", time.Hour); err != nil {
		return Config{}, err
	}
	if cfg.RedisPoolSize, err = envInt("TRAJECTORY_REDIS_POOL_SIZE", 10); err != nil {
		return Config{}, err
	}
	if cfg.RedisMaxRetries, err = envInt("TRAJECTORY_REDIS_MAX_RETRIES", 2); err != nil {
		return Config{}, err
	}
	if cfg.ClickHouseMaxOpen, err = envInt("TRAJECTORY_CLICKHOUSE_MAX_OPEN_CONNECTIONS", 5); err != nil {
		return Config{}, err
	}
	if cfg.ClickHouseMaxIdle, err = envInt("TRAJECTORY_CLICKHOUSE_MAX_IDLE_CONNECTIONS", 2); err != nil {
		return Config{}, err
	}
	if cfg.BatchSize, err = envInt64("TRAJECTORY_BATCH_SIZE", 500); err != nil {
		return Config{}, err
	}
	if cfg.JourneyBatchSize, err = envInt64("JOURNEY_LIFECYCLE_BATCH_SIZE", 100); err != nil {
		return Config{}, err
	}
	if err := cfg.validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) validate() error {
	if c.RedisURL == "" || c.RedisStream == "" || c.RedisDeadLetter == "" || c.RedisGroup == "" || c.RedisConsumer == "" {
		return fmt.Errorf("Redis trajectory configuration cannot be empty")
	}
	if c.JourneyRedisStream == "" || c.JourneyRedisDeadLetter == "" ||
		c.JourneyRedisGroup == "" || c.JourneyRedisConsumer == "" {
		return fmt.Errorf("Redis Journey lifecycle configuration cannot be empty")
	}
	if c.ClickHouseAddress == "" || c.ClickHouseDatabase == "" ||
		c.ClickHouseTable == "" || c.JourneyClickHouseTable == "" {
		return fmt.Errorf("ClickHouse trajectory configuration cannot be empty")
	}
	if c.BatchSize < 1 || c.JourneyBatchSize < 1 || c.RedisPoolSize < 1 ||
		c.RedisMaxRetries < 0 || c.ClickHouseMaxOpen < 1 ||
		c.ClickHouseMaxIdle < 0 || c.ClickHouseMaxIdle > c.ClickHouseMaxOpen {
		return fmt.Errorf("worker batch and connection pool settings are invalid")
	}
	for name, value := range map[string]time.Duration{
		"shutdown timeout": c.ShutdownTimeout, "read block": c.ReadBlock,
		"batch maximum wait":         c.BatchMaxWait,
		"Journey batch maximum wait": c.JourneyBatchMaxWait,
		"reclaim interval":           c.ReclaimInterval, "reclaim minimum idle": c.ReclaimMinIdle,
		"stats interval": c.StatsInterval, "error backoff": c.ErrorBackoff,
		"Redis dial timeout": c.RedisDialTimeout, "Redis read timeout": c.RedisReadTimeout,
		"Redis write timeout": c.RedisWriteTimeout, "ClickHouse dial timeout": c.ClickHouseDial,
		"ClickHouse connection maximum age": c.ClickHouseConnMaxAge,
	} {
		if value <= 0 {
			return fmt.Errorf("%s must be positive", name)
		}
	}
	return nil
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envDuration(key string, fallback time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be a duration: %w", key, err)
	}
	return parsed, nil
}

func envInt(key string, fallback int) (int, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}
	return parsed, nil
}

func envInt64(key string, fallback int64) (int64, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}
	return parsed, nil
}
