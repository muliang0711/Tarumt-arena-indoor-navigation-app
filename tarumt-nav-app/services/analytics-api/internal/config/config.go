package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/campus-navigator/analytics-api/internal/domain"
)

type Config struct {
	Address                string
	ShutdownTimeout        time.Duration
	QueryTimeout           time.Duration
	MaxConcurrentQueries   int
	Policy                 domain.QueryPolicy
	ClickHouseAddress      string
	ClickHouseDatabase     string
	ClickHouseUsername     string
	ClickHousePassword     string
	ClickHouseTable        string
	ClickHouseDialTimeout  time.Duration
	ClickHouseMaxOpenConns int
	ClickHouseMaxIdleConns int
	ClickHouseConnMaxAge   time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Address:            env("ANALYTICS_API_ADDRESS", ":9092"),
		ClickHouseAddress:  env("ANALYTICS_CLICKHOUSE_ADDRESS", "localhost:9000"),
		ClickHouseDatabase: env("ANALYTICS_CLICKHOUSE_DATABASE", "campus_analytics"),
		ClickHouseUsername: env("ANALYTICS_CLICKHOUSE_USERNAME", "default"),
		ClickHousePassword: os.Getenv("ANALYTICS_CLICKHOUSE_PASSWORD"),
		ClickHouseTable:    env("ANALYTICS_CLICKHOUSE_TABLE", "campus_analytics.trajectory_events_v1"),
	}
	var err error
	if cfg.ShutdownTimeout, err = envDuration("ANALYTICS_API_SHUTDOWN_TIMEOUT", 10*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.QueryTimeout, err = envDuration("ANALYTICS_QUERY_TIMEOUT", 3*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.Policy.MaxRange, err = envDuration("ANALYTICS_MAX_QUERY_RANGE", 7*24*time.Hour); err != nil {
		return Config{}, err
	}
	if cfg.ClickHouseDialTimeout, err = envDuration("ANALYTICS_CLICKHOUSE_DIAL_TIMEOUT", 5*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.ClickHouseConnMaxAge, err = envDuration("ANALYTICS_CLICKHOUSE_CONN_MAX_AGE", time.Hour); err != nil {
		return Config{}, err
	}
	if cfg.MaxConcurrentQueries, err = envInt("ANALYTICS_MAX_CONCURRENT_QUERIES", 16); err != nil {
		return Config{}, err
	}
	if cfg.Policy.MaxResultRows, err = envInt("ANALYTICS_MAX_RESULT_ROWS", 500); err != nil {
		return Config{}, err
	}
	if cfg.ClickHouseMaxOpenConns, err = envInt("ANALYTICS_CLICKHOUSE_MAX_OPEN_CONNECTIONS", 10); err != nil {
		return Config{}, err
	}
	if cfg.ClickHouseMaxIdleConns, err = envInt("ANALYTICS_CLICKHOUSE_MAX_IDLE_CONNECTIONS", 3); err != nil {
		return Config{}, err
	}
	if cfg.Policy.PrivacyThreshold, err = envUint64("ANALYTICS_PRIVACY_THRESHOLD", 5); err != nil {
		return Config{}, err
	}
	if cfg.Policy.ModerateAt, err = envUint64("ANALYTICS_TRAFFIC_MODERATE_AT", 10); err != nil {
		return Config{}, err
	}
	if cfg.Policy.BusyAt, err = envUint64("ANALYTICS_TRAFFIC_BUSY_AT", 25); err != nil {
		return Config{}, err
	}
	if err := cfg.validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) validate() error {
	if c.Address == "" || c.ClickHouseAddress == "" || c.ClickHouseDatabase == "" || c.ClickHouseTable == "" {
		return fmt.Errorf("analytics address and ClickHouse configuration cannot be empty")
	}
	if c.ShutdownTimeout <= 0 || c.QueryTimeout <= 0 || c.Policy.MaxRange <= 0 || c.ClickHouseDialTimeout <= 0 || c.ClickHouseConnMaxAge <= 0 {
		return fmt.Errorf("analytics timeout and range values must be positive")
	}
	if c.MaxConcurrentQueries < 1 || c.Policy.MaxResultRows < 1 || c.Policy.MaxResultRows > 10_000 || c.ClickHouseMaxOpenConns < 1 || c.ClickHouseMaxIdleConns < 0 || c.ClickHouseMaxIdleConns > c.ClickHouseMaxOpenConns {
		return fmt.Errorf("analytics concurrency, result, or connection pool settings are invalid")
	}
	if c.Policy.PrivacyThreshold < 5 || c.Policy.ModerateAt < c.Policy.PrivacyThreshold || c.Policy.BusyAt <= c.Policy.ModerateAt {
		return fmt.Errorf("analytics privacy and traffic thresholds are invalid")
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

func envUint64(key string, fallback uint64) (uint64, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%s must be an unsigned integer: %w", key, err)
	}
	return parsed, nil
}
