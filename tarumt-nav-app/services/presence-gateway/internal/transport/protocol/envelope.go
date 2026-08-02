package protocol

import (
	"encoding/json"
	"time"
)

const Version = 1

type Envelope struct {
	Version   int             `json:"version"`
	Type      string          `json:"type"`
	RequestID string          `json:"request_id,omitempty"`
	Sequence  uint64          `json:"sequence,omitempty"`
	Timestamp time.Time       `json:"timestamp"`
	Payload   json.RawMessage `json:"payload,omitempty"`
}

type outboundEnvelope struct {
	Version   int       `json:"version"`
	Type      string    `json:"type"`
	RequestID string    `json:"request_id,omitempty"`
	Sequence  uint64    `json:"sequence,omitempty"`
	Timestamp time.Time `json:"timestamp"`
	Payload   any       `json:"payload,omitempty"`
}

func Encode(messageType, requestID string, sequence uint64, timestamp time.Time, payload any) ([]byte, error) {
	return json.Marshal(outboundEnvelope{
		Version: Version, Type: messageType, RequestID: requestID,
		Sequence: sequence, Timestamp: timestamp.UTC(), Payload: payload,
	})
}
