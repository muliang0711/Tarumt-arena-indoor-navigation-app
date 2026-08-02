package config

import (
	"testing"
	"time"
)

func TestLoadDefaultsAndStrictInvalidValues(t *testing.T) {
	t.Setenv("TRAJECTORY_BATCH_SIZE", "250")
	t.Setenv("TRAJECTORY_BATCH_MAX_WAIT", "75ms")
	t.Setenv("JOURNEY_LIFECYCLE_BATCH_SIZE", "80")
	t.Setenv("JOURNEY_LIFECYCLE_BATCH_MAX_WAIT", "150ms")
	t.Setenv("TRAJECTORY_READ_BLOCK", "1500ms")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.BatchSize != 250 || cfg.BatchMaxWait != 75*time.Millisecond ||
		cfg.JourneyBatchSize != 80 ||
		cfg.JourneyBatchMaxWait != 150*time.Millisecond ||
		cfg.ReadBlock.String() != "1.5s" || cfg.RedisGroup == "" ||
		cfg.JourneyRedisGroup == "" ||
		cfg.JourneyClickHouseTable != "campus_analytics.journey_lifecycle_events_v1" {
		t.Fatalf("unexpected configuration: %+v", cfg)
	}
	t.Setenv("TRAJECTORY_BATCH_SIZE", "not-a-number")
	if _, err := Load(); err == nil {
		t.Fatal("invalid batch size was silently accepted")
	}
}

func TestLoadRejectsInvalidBatchMaximumWait(t *testing.T) {
	t.Setenv("TRAJECTORY_BATCH_MAX_WAIT", "0s")
	if _, err := Load(); err == nil {
		t.Fatal("non-positive batch maximum wait was silently accepted")
	}
}
