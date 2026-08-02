package protocol

import (
	"errors"
	"testing"
	"time"
)

func TestDecodeRejectsUnknownVersionTypeAndTrailingJSON(t *testing.T) {
	t.Parallel()
	timestamp := time.Now().UTC().Format(time.RFC3339Nano)
	tests := []struct {
		name string
		data string
		want error
	}{
		{"version", `{"version":2,"type":"heartbeat","timestamp":"` + timestamp + `"}`, ErrUnsupportedVersion},
		{"type", `{"version":1,"type":"surprise","timestamp":"` + timestamp + `"}`, ErrUnknownMessage},
		{"trailing", `{"version":1,"type":"heartbeat","timestamp":"` + timestamp + `"} {}`, ErrInvalidMessage},
	}
	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			_, err := Decode([]byte(test.data), 16*1024)
			if !errors.Is(err, test.want) {
				t.Fatalf("Decode error = %v, want %v", err, test.want)
			}
		})
	}
}

func TestDecodeRejectsOversizedMessage(t *testing.T) {
	t.Parallel()
	if _, err := Decode([]byte("12345"), 4); !errors.Is(err, ErrMessageTooLarge) {
		t.Fatalf("Decode error = %v, want ErrMessageTooLarge", err)
	}
}
