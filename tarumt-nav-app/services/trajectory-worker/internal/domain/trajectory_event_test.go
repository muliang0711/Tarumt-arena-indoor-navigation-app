package domain

import (
	"errors"
	"os"
	"strings"
	"testing"
)

func TestVersionedContractExampleDecodes(t *testing.T) {
	t.Parallel()
	payload, err := os.ReadFile("../../../../contracts/trajectory/v1/examples/valid.json")
	if err != nil {
		t.Fatal(err)
	}
	event, err := Decode(SchemaVersion, payload)
	if err != nil {
		t.Fatal(err)
	}
	if event.BuildingID != "main" || event.EventID == "" {
		t.Fatalf("unexpected contract event: %+v", event)
	}
}

func TestDecodeRejectsUnknownVersionIdentityAndFields(t *testing.T) {
	t.Parallel()
	payload, err := os.ReadFile("../../../../contracts/trajectory/v1/examples/valid.json")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Decode(2, payload); !errors.Is(err, ErrInvalidTrajectoryEvent) {
		t.Fatalf("unsupported version error = %v", err)
	}
	leaked := strings.Replace(string(payload), "\n}", ",\n  \"session_id\": \"private\"\n}", 1)
	if _, err := Decode(SchemaVersion, []byte(leaked)); !errors.Is(err, ErrInvalidTrajectoryEvent) {
		t.Fatalf("identity field error = %v", err)
	}
}
