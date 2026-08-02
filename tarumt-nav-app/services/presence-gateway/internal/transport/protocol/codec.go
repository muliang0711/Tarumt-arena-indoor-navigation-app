package protocol

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

func Decode(data []byte, maxBytes int64) (Envelope, error) {
	if int64(len(data)) > maxBytes {
		return Envelope{}, ErrMessageTooLarge
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var envelope Envelope
	if err := decoder.Decode(&envelope); err != nil {
		return Envelope{}, fmt.Errorf("%w: %v", ErrInvalidMessage, err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return Envelope{}, ErrInvalidMessage
	}
	if envelope.Version != Version {
		return Envelope{}, ErrUnsupportedVersion
	}
	switch envelope.Type {
	case TypeSubscribeFloor, TypeChangeFloor, TypeLocationUpdate, TypeHeartbeat,
		TypeLeave, TypeJourneyStart, TypeRouteRecalculate, TypeJourneyEnd:
		return envelope, nil
	default:
		return Envelope{}, ErrUnknownMessage
	}
}

func DecodePayload(raw json.RawMessage, destination any) error {
	if len(raw) == 0 {
		return ErrInvalidMessage
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidMessage, err)
	}
	return nil
}
