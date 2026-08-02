package domain

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestTrajectoryEventValidationNormalizationAndPrivacy(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 7, 22, 12, 0, 0, 0, time.FixedZone("MYT", 8*60*60))
	event := TrajectoryEvent{
		EventID: " event-1 ", JourneyID: " journey-1 ",
		BuildingID: " main ", FloorID: " 2 ", FromNodeID: " n1 ", ToNodeID: " n2 ",
		EdgeProgress: 0.4, Heading: -30, MovementState: "walking",
		ObservedAt: now, IngestedAt: now.Add(time.Second),
	}
	if err := event.Validate(); err != nil {
		t.Fatalf("valid event rejected: %v", err)
	}
	normalized := event.Normalized()
	if normalized.Heading != 330 || normalized.BuildingID != "main" {
		t.Fatalf("unexpected normalized event: %+v", normalized)
	}
	if normalized.ObservedAt.Location() != time.UTC || normalized.IngestedAt.Location() != time.UTC {
		t.Fatal("trajectory timestamps must normalize to UTC")
	}
	payload, err := json.Marshal(normalized)
	if err != nil {
		t.Fatal(err)
	}
	encoded := string(payload)
	for _, forbidden := range []string{"installation_id", "device_ref", "session_id", "access_token", "ip_address"} {
		if strings.Contains(encoded, forbidden) {
			t.Fatalf("trajectory payload exposed %q: %s", forbidden, encoded)
		}
	}

	invalid := normalized
	invalid.JourneyID = ""
	if !errors.Is(invalid.Validate(), ErrInvalidTrajectoryEvent) {
		t.Fatal("empty journey ID should be rejected")
	}
	invalid = normalized
	invalid.EdgeProgress = 2
	if !errors.Is(invalid.Validate(), ErrInvalidTrajectoryEvent) {
		t.Fatal("invalid route progress should be rejected")
	}
}
