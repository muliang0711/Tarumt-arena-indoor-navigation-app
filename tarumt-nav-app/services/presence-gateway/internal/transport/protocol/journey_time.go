package protocol

import "time"

// JourneyEventTime preserves historical event time independently of the
// envelope freshness check. Legacy clients omit occurred_at.
func JourneyEventTime(occurredAt *time.Time, sentAt time.Time) (time.Time, error) {
	if occurredAt == nil {
		return sentAt, nil
	}
	if occurredAt.IsZero() || occurredAt.After(sentAt.Add(5*time.Minute)) {
		return time.Time{}, ErrInvalidMessage
	}
	return occurredAt.UTC(), nil
}
