package protocol

import (
	"encoding/json"
	"testing"
	"time"
)

func TestJourneyEventTime(t *testing.T) {
	now := time.Date(2026, 9, 14, 3, 0, 0, 0, time.UTC)
	old := now.Add(-48 * time.Hour)
	future := now.Add(6 * time.Minute)
	zero := time.Time{}
	for _, tc := range []struct {
		name    string
		event   *time.Time
		want    time.Time
		invalid bool
	}{
		{"legacy", nil, now, false},
		{"offline replay", &old, old, false},
		{"future", &future, time.Time{}, true},
		{"zero", &zero, time.Time{}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := JourneyEventTime(tc.event, now)
			if (err != nil) != tc.invalid || !got.Equal(tc.want) {
				t.Fatalf("got %v, %v", got, err)
			}
		})
	}
}

func TestJourneyPayloadsAcceptSeparateEventTime(t *testing.T) {
	for _, payload := range []any{&JourneyStart{}, &RouteRecalculate{}, &JourneyEnd{}} {
		if err := DecodePayload(json.RawMessage(`{"occurred_at":"2026-09-13T05:08:48Z"}`), payload); err != nil {
			t.Fatalf("%T: %v", payload, err)
		}
	}
}
