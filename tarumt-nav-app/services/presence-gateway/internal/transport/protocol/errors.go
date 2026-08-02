package protocol

import "errors"

var (
	ErrUnsupportedVersion = errors.New("unsupported protocol version")
	ErrUnknownMessage     = errors.New("unknown message type")
	ErrInvalidMessage     = errors.New("invalid message")
	ErrMessageTooLarge    = errors.New("message too large")
)

const (
	ErrorInvalidMessage     = "invalid_message"
	ErrorUnsupportedVersion = "unsupported_version"
	ErrorUnknownMessage     = "unknown_message"
	ErrorInvalidPosition    = "invalid_position"
	ErrorStaleSequence      = "stale_sequence"
	ErrorNotSubscribed      = "not_subscribed"
	ErrorFloorMismatch      = "floor_mismatch"
	ErrorInternal           = "internal_error"
	ErrorSlowConsumer       = "slow_consumer"
	ErrorInvalidJourney     = "invalid_journey"
	ErrorJourneyNotActive   = "journey_not_active"
	ErrorJourneyEnded       = "journey_ended"
	ErrorDestinationChanged = "destination_changed"
	ErrorUnknownMapRevision = "unknown_map_revision"
)
