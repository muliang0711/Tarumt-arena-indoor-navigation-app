package redisinfra

import (
	"bytes"
	"errors"
	"testing"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/domain"
)

func TestKeyspaceEncodesUntrustedIdentifiers(t *testing.T) {
	t.Parallel()
	keys := NewKeyspace("test")
	key := keys.FloorActive("main:building", "../floor 2")
	if key == "test:floor:main:building:../floor 2:active" {
		t.Fatal("untrusted identifiers were included directly in Redis key")
	}
	encoded := encodePart("../floor 2")
	decoded, err := decodePart(encoded)
	if err != nil || decoded != "../floor 2" {
		t.Fatalf("key part round trip = %q, %v", decoded, err)
	}
	if stream := keys.TrajectoryStream(); stream != "test:trajectory:events" {
		t.Fatalf("trajectory stream key = %q", stream)
	}
}

func TestEventCodecVersionBoundary(t *testing.T) {
	t.Parallel()
	event := domain.Event{Type: domain.EventPresenceUpdated, BuildingID: "main", FloorID: "2", OccurredAt: time.Now()}
	payload, err := encodeEvent(event, "event", "instance")
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := decodeEvent(payload)
	if err != nil || decoded.Type != event.Type || decoded.FloorID != event.FloorID {
		t.Fatalf("decoded event = %+v, %v", decoded, err)
	}
	payload = bytes.Replace(payload, []byte(`"version":1`), []byte(`"version":2`), 1)
	if _, err := decodeEvent(payload); !errors.Is(err, ErrUnsupportedEventVersion) {
		t.Fatalf("version error = %v, want ErrUnsupportedEventVersion", err)
	}
}
