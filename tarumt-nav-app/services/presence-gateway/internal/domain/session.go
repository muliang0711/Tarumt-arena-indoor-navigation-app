package domain

import "time"

type Session struct {
	ID          string    `json:"id"`
	DeviceRef   string    `json:"device_ref"`
	DisplayName string    `json:"display_name,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	LastSeenAt  time.Time `json:"last_seen_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

func (s Session) IsExpired(now time.Time) bool {
	return !now.Before(s.ExpiresAt)
}

func (s Session) Touch(now time.Time) Session {
	s.LastSeenAt = now
	return s
}
