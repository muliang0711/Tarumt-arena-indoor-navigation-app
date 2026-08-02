package domain

import (
	"errors"
	"testing"
	"time"
)

func TestTrafficQueryRequiresAlignedBoundedPrivacySafeWindow(t *testing.T) {
	t.Parallel()
	policy := QueryPolicy{PrivacyThreshold: 5, MaxRange: 7 * 24 * time.Hour, MaxResultRows: 500, ModerateAt: 10, BusyAt: 25}
	now := time.Date(2026, 7, 22, 12, 7, 0, 0, time.UTC)
	valid := TrafficQuery{
		BuildingID: "main", FloorID: "2", Bucket: Bucket15Minutes,
		From: time.Date(2026, 7, 22, 10, 0, 0, 0, time.UTC),
		To:   time.Date(2026, 7, 22, 12, 0, 0, 0, time.UTC),
	}
	if err := valid.Validate(policy, now); err != nil {
		t.Fatalf("valid query rejected: %v", err)
	}
	misaligned := valid
	misaligned.From = misaligned.From.Add(time.Minute)
	if !errors.Is(misaligned.Validate(policy, now), ErrInvalidQuery) {
		t.Fatal("misaligned query was accepted")
	}
	tooWide := valid
	tooWide.From = tooWide.To.Add(-8 * 24 * time.Hour)
	if !errors.Is(tooWide.Validate(policy, now), ErrInvalidQuery) {
		t.Fatal("query wider than the policy was accepted")
	}
	weakPrivacy := policy
	weakPrivacy.PrivacyThreshold = 4
	if !errors.Is(valid.Validate(weakPrivacy, now), ErrInvalidQuery) {
		t.Fatal("privacy threshold below five was accepted")
	}
}

func TestTrafficLevelUsesServerPolicy(t *testing.T) {
	t.Parallel()
	policy := QueryPolicy{PrivacyThreshold: 5, ModerateAt: 10, BusyAt: 25}
	if TrafficLevel(5, policy) != "quiet" || TrafficLevel(10, policy) != "moderate" || TrafficLevel(25, policy) != "busy" {
		t.Fatal("traffic levels do not follow the configured thresholds")
	}
}
