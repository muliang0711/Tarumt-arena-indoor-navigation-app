package domain

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestPositionValidationAndNormalization(t *testing.T) {
	t.Parallel()
	valid := Position{
		BuildingID: "main", FloorID: "2", FromNodeID: "n1", ToNodeID: "n2",
		EdgeProgress: 0.5, Heading: -30, MovementState: "walking",
	}
	if err := valid.Validate(); err != nil {
		t.Fatalf("valid position rejected: %v", err)
	}
	if got := valid.Normalized().Heading; got != 330 {
		t.Fatalf("normalized heading = %v, want 330", got)
	}

	invalid := valid
	invalid.EdgeProgress = 1.1
	if !errors.Is(invalid.Validate(), ErrInvalidPosition) {
		t.Fatal("edge progress above one should be invalid")
	}
	invalid = valid
	invalid.MovementState = "flying"
	if !errors.Is(invalid.Validate(), ErrInvalidPosition) {
		t.Fatal("unknown movement state should be invalid")
	}
}

func TestPresenceJSONOmitsInternalJourneyID(t *testing.T) {
	t.Parallel()
	payload, err := json.Marshal(Presence{SessionID: "session", JourneyID: "private-journey"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(payload), "journey") {
		t.Fatalf("public presence JSON exposed its internal journey ID: %s", payload)
	}
}
