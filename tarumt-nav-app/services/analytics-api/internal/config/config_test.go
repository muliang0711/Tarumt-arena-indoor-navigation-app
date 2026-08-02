package config

import "testing"

func TestLoadPrivacyAndStrictConfiguration(t *testing.T) {
	t.Setenv("ANALYTICS_PRIVACY_THRESHOLD", "7")
	t.Setenv("ANALYTICS_MAX_CONCURRENT_QUERIES", "8")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Policy.PrivacyThreshold != 7 || cfg.MaxConcurrentQueries != 8 {
		t.Fatalf("unexpected configuration: %+v", cfg)
	}
	t.Setenv("ANALYTICS_PRIVACY_THRESHOLD", "4")
	if _, err := Load(); err == nil {
		t.Fatal("privacy threshold below five was accepted")
	}
}
