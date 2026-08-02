package config

import (
	"testing"
	"time"
)

func TestLoadTrajectoryConfiguration(t *testing.T) {
	setValidRequiredEnvironment(t)
	t.Setenv("PRESENCE_TRAJECTORY_ENABLED", "true")
	t.Setenv("PRESENCE_TRAJECTORY_STREAM_KEY", "analytics:trajectory")
	t.Setenv("PRESENCE_TRAJECTORY_STREAM_MAX_LENGTH", "2500")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.TrajectoryEnabled || cfg.TrajectoryStreamKey != "analytics:trajectory" || cfg.TrajectoryStreamMaxLen != 2500 {
		t.Fatalf("unexpected trajectory configuration: %+v", cfg)
	}
}

func TestLoadRejectsInvalidEnabledTrajectoryLength(t *testing.T) {
	setValidRequiredEnvironment(t)
	t.Setenv("PRESENCE_TRAJECTORY_ENABLED", "true")
	t.Setenv("PRESENCE_TRAJECTORY_STREAM_MAX_LENGTH", "0")

	if _, err := Load(); err == nil {
		t.Fatal("enabled trajectory ingestion accepted a non-positive Stream length")
	}
}

func TestLoadUsesLiveFloorProjectionDefaults(t *testing.T) {
	setValidRequiredEnvironment(t)
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ProjectionQueueSize != 64 {
		t.Fatalf("projection queue = %d, want 64", cfg.ProjectionQueueSize)
	}
	if cfg.MovementCoalesce != 200*time.Millisecond {
		t.Fatalf("movement coalesce = %s, want 200ms", cfg.MovementCoalesce)
	}
	if cfg.MembershipDebounce != 50*time.Millisecond {
		t.Fatalf("membership debounce = %s, want 50ms", cfg.MembershipDebounce)
	}
}

func TestLoadAcceptsLiveFloorProjectionOverrides(t *testing.T) {
	setValidRequiredEnvironment(t)
	t.Setenv("PRESENCE_PROJECTION_SUBSCRIBER_QUEUE_SIZE", "32")
	t.Setenv("PRESENCE_MOVEMENT_COALESCE_INTERVAL", "125ms")
	t.Setenv("PRESENCE_MEMBERSHIP_DEBOUNCE_INTERVAL", "75ms")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ProjectionQueueSize != 32 || cfg.MovementCoalesce != 125*time.Millisecond || cfg.MembershipDebounce != 75*time.Millisecond {
		t.Fatalf("unexpected projection config: %+v", cfg)
	}
}

func TestLoadAcceptsMapDataRootOverride(t *testing.T) {
	setValidRequiredEnvironment(t)
	t.Setenv("PRESENCE_MAP_DATA_ROOT", "/srv/campus-maps")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.MapDataRoot != "/srv/campus-maps" {
		t.Fatalf("map data root = %q", cfg.MapDataRoot)
	}
}

func setValidRequiredEnvironment(t *testing.T) {
	t.Helper()
	t.Setenv("PRESENCE_JWT_SECRET", "01234567890123456789012345678901")
	t.Setenv("PRESENCE_IDENTITY_HMAC_SECRET", "abcdefghijklmnopqrstuvwxyz123456")
	t.Setenv("PRESENCE_BACKEND", "memory")
	t.Setenv("PRESENCE_TOKEN_TTL", "")
	t.Setenv("PRESENCE_SESSION_TTL", "")
	t.Setenv("PRESENCE_STALE_AFTER", "")
	t.Setenv("PRESENCE_WEBSOCKET_QUEUE_SIZE", "")
	t.Setenv("PRESENCE_BROKER_QUEUE_SIZE", "")
	t.Setenv("PRESENCE_PROJECTION_SUBSCRIBER_QUEUE_SIZE", "")
	t.Setenv("PRESENCE_MOVEMENT_COALESCE_INTERVAL", "")
	t.Setenv("PRESENCE_MEMBERSHIP_DEBOUNCE_INTERVAL", "")
	t.Setenv("PRESENCE_REDIS_POOL_SIZE", "")
	t.Setenv("PRESENCE_REDIS_MIN_IDLE_CONNECTIONS", "")
	t.Setenv("PRESENCE_REDIS_PRESENCE_TTL", "")
}
