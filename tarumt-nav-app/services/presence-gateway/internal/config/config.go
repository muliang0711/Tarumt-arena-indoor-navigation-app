package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Address                      string
	Backend                      string
	JWTSecret                    string
	JWTIssuer                    string
	IdentityHMACSecret           string
	TokenTTL                     time.Duration
	SessionTTL                   time.Duration
	HeartbeatInterval            time.Duration
	PresenceStaleAfter           time.Duration
	ExpirySweepInterval          time.Duration
	ShutdownTimeout              time.Duration
	MaxRequestBytes              int64
	MaxWebSocketBytes            int64
	WebSocketQueueSize           int
	BrokerSubscriberQueue        int
	ProjectionQueueSize          int
	MovementCoalesce             time.Duration
	MembershipDebounce           time.Duration
	AllowedOrigins               []string
	MapDataRoot                  string
	RedisURL                     string
	RedisKeyPrefix               string
	RedisPoolSize                int
	RedisMinIdleConns            int
	RedisDialTimeout             time.Duration
	RedisReadTimeout             time.Duration
	RedisWriteTimeout            time.Duration
	RedisMaxRetries              int
	PresenceRecordTTL            time.Duration
	TrajectoryEnabled            bool
	TrajectoryStreamKey          string
	TrajectoryStreamMaxLen       int64
	JourneyLifecycleStreamKey    string
	JourneyLifecycleStreamMaxLen int64
	JourneyIdempotencyTTL        time.Duration
	JourneyEndedTombstoneTTL     time.Duration
	JourneyFirstPositionTimeout  time.Duration
	InstanceID                   string
}

func Load() (Config, error) {
	cfg := Config{
		Address:                envString("PRESENCE_ADDRESS", ":8080"),
		Backend:                strings.ToLower(envString("PRESENCE_BACKEND", "memory")),
		JWTSecret:              os.Getenv("PRESENCE_JWT_SECRET"),
		JWTIssuer:              envString("PRESENCE_JWT_ISSUER", "campus-navigator-presence"),
		IdentityHMACSecret:     os.Getenv("PRESENCE_IDENTITY_HMAC_SECRET"),
		TokenTTL:               envDuration("PRESENCE_TOKEN_TTL", 30*time.Minute),
		SessionTTL:             envDuration("PRESENCE_SESSION_TTL", 8*time.Hour),
		HeartbeatInterval:      envDuration("PRESENCE_HEARTBEAT_INTERVAL", 15*time.Second),
		PresenceStaleAfter:     envDuration("PRESENCE_STALE_AFTER", 45*time.Second),
		ExpirySweepInterval:    envDuration("PRESENCE_EXPIRY_SWEEP_INTERVAL", 5*time.Second),
		ShutdownTimeout:        envDuration("PRESENCE_SHUTDOWN_TIMEOUT", 10*time.Second),
		MaxRequestBytes:        envInt64("PRESENCE_MAX_REQUEST_BYTES", 16*1024),
		MaxWebSocketBytes:      envInt64("PRESENCE_MAX_WEBSOCKET_BYTES", 16*1024),
		WebSocketQueueSize:     envInt("PRESENCE_WEBSOCKET_QUEUE_SIZE", 64),
		BrokerSubscriberQueue:  envInt("PRESENCE_BROKER_QUEUE_SIZE", 64),
		ProjectionQueueSize:    envInt("PRESENCE_PROJECTION_SUBSCRIBER_QUEUE_SIZE", 64),
		MovementCoalesce:       envDuration("PRESENCE_MOVEMENT_COALESCE_INTERVAL", 200*time.Millisecond),
		MembershipDebounce:     envDuration("PRESENCE_MEMBERSHIP_DEBOUNCE_INTERVAL", 50*time.Millisecond),
		AllowedOrigins:         envCSV("PRESENCE_ALLOWED_ORIGINS"),
		MapDataRoot:            envString("PRESENCE_MAP_DATA_ROOT", "../../map-data"),
		RedisURL:               envString("PRESENCE_REDIS_URL", "redis://localhost:6379/0"),
		RedisKeyPrefix:         envString("PRESENCE_REDIS_KEY_PREFIX", "campus:presence:v1"),
		RedisPoolSize:          envInt("PRESENCE_REDIS_POOL_SIZE", 20),
		RedisMinIdleConns:      envInt("PRESENCE_REDIS_MIN_IDLE_CONNECTIONS", 2),
		RedisDialTimeout:       envDuration("PRESENCE_REDIS_DIAL_TIMEOUT", 3*time.Second),
		RedisReadTimeout:       envDuration("PRESENCE_REDIS_READ_TIMEOUT", 2*time.Second),
		RedisWriteTimeout:      envDuration("PRESENCE_REDIS_WRITE_TIMEOUT", 2*time.Second),
		RedisMaxRetries:        envInt("PRESENCE_REDIS_MAX_RETRIES", 2),
		PresenceRecordTTL:      envDuration("PRESENCE_REDIS_PRESENCE_TTL", 3*time.Minute),
		TrajectoryEnabled:      envBool("PRESENCE_TRAJECTORY_ENABLED", true),
		TrajectoryStreamKey:    strings.TrimSpace(os.Getenv("PRESENCE_TRAJECTORY_STREAM_KEY")),
		TrajectoryStreamMaxLen: envInt64("PRESENCE_TRAJECTORY_STREAM_MAX_LENGTH", 1_000_000),
		JourneyLifecycleStreamKey: strings.TrimSpace(
			os.Getenv("PRESENCE_JOURNEY_LIFECYCLE_STREAM_KEY"),
		),
		JourneyLifecycleStreamMaxLen: envInt64(
			"PRESENCE_JOURNEY_LIFECYCLE_STREAM_MAX_LENGTH",
			1_000_000,
		),
		JourneyIdempotencyTTL: envDuration(
			"PRESENCE_JOURNEY_IDEMPOTENCY_TTL",
			24*time.Hour,
		),
		JourneyEndedTombstoneTTL: envDuration(
			"PRESENCE_JOURNEY_ENDED_TOMBSTONE_TTL",
			24*time.Hour,
		),
		JourneyFirstPositionTimeout: envDuration(
			"PRESENCE_JOURNEY_FIRST_POSITION_TIMEOUT",
			time.Minute,
		),
		InstanceID: strings.TrimSpace(os.Getenv("PRESENCE_INSTANCE_ID")),
	}

	if cfg.JWTSecret == "" {
		return Config{}, errors.New("PRESENCE_JWT_SECRET is required")
	}
	if len(cfg.JWTSecret) < 32 {
		return Config{}, errors.New("PRESENCE_JWT_SECRET must contain at least 32 characters")
	}
	if cfg.IdentityHMACSecret == "" {
		return Config{}, errors.New("PRESENCE_IDENTITY_HMAC_SECRET is required")
	}
	if len(cfg.IdentityHMACSecret) < 32 {
		return Config{}, errors.New("PRESENCE_IDENTITY_HMAC_SECRET must contain at least 32 characters")
	}
	if cfg.TokenTTL <= 0 || cfg.SessionTTL <= 0 || cfg.PresenceStaleAfter <= 0 {
		return Config{}, errors.New("TTL values must be positive")
	}
	if cfg.WebSocketQueueSize < 1 || cfg.BrokerSubscriberQueue < 1 || cfg.ProjectionQueueSize < 1 {
		return Config{}, errors.New("queue sizes must be positive")
	}
	if cfg.MovementCoalesce <= 0 || cfg.MembershipDebounce <= 0 {
		return Config{}, errors.New("live floor projection intervals must be positive")
	}
	if cfg.Backend != "memory" && cfg.Backend != "redis" {
		return Config{}, errors.New("PRESENCE_BACKEND must be memory or redis")
	}
	if cfg.Backend == "redis" && cfg.RedisURL == "" {
		return Config{}, errors.New("PRESENCE_REDIS_URL is required for the redis backend")
	}
	if cfg.RedisPoolSize < 1 || cfg.RedisMinIdleConns < 0 || cfg.RedisMinIdleConns > cfg.RedisPoolSize {
		return Config{}, errors.New("Redis pool settings are invalid")
	}
	if cfg.PresenceRecordTTL <= cfg.PresenceStaleAfter {
		return Config{}, errors.New("PRESENCE_REDIS_PRESENCE_TTL must be greater than PRESENCE_STALE_AFTER")
	}
	if cfg.TrajectoryEnabled && cfg.TrajectoryStreamMaxLen < 1 {
		return Config{}, errors.New("PRESENCE_TRAJECTORY_STREAM_MAX_LENGTH must be positive when trajectory ingestion is enabled")
	}
	if cfg.JourneyLifecycleStreamMaxLen < 1 ||
		cfg.JourneyIdempotencyTTL <= 0 ||
		cfg.JourneyEndedTombstoneTTL <= 0 ||
		cfg.JourneyFirstPositionTimeout <= 0 {
		return Config{}, errors.New("journey lifecycle settings must be positive")
	}
	return cfg, nil
}

func envBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envString(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envInt64(key string, fallback int64) int64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func envCSV(key string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func (c Config) String() string {
	return fmt.Sprintf("address=%s backend=%s token_ttl=%s session_ttl=%s stale_after=%s", c.Address, c.Backend, c.TokenTTL, c.SessionTTL, c.PresenceStaleAfter)
}
