package ports

import (
	"context"
	"time"
)

type StreamMessage struct {
	ID            string
	SchemaVersion int
	EventID       string
	Payload       []byte
}

type SourceStats struct {
	Lag          int64
	Pending      int64
	StreamLength int64
	EntriesAdded int64
	Trimmed      int64
}

type EventSource interface {
	EnsureGroup(context.Context) error
	Read(context.Context, int64, time.Duration) ([]StreamMessage, error)
	Reclaim(context.Context, time.Duration, int64) ([]StreamMessage, error)
	Acknowledge(context.Context, []string) error
	DeadLetter(context.Context, StreamMessage, string) (bool, error)
	Stats(context.Context) (SourceStats, error)
	Ping(context.Context) error
	Close() error
}
