package application

import (
	"context"
	"errors"
	"time"

	"github.com/campus-navigator/trajectory-worker/internal/application/ports"
)

const (
	batchFlushReasonSize    = "size"
	batchFlushReasonTimeout = "timeout"
)

type microBatchCollector struct {
	source  ports.EventSource
	maxSize int64
	maxWait time.Duration
}

func newMicroBatchCollector(source ports.EventSource, maxSize int64, maxWait time.Duration) microBatchCollector {
	return microBatchCollector{source: source, maxSize: maxSize, maxWait: maxWait}
}

// Collect grows an already-delivered batch until either its bounded size or
// latency limit is reached. Messages read while collecting remain recoverable
// in the Redis consumer group's pending list until Process acknowledges them.
func (c microBatchCollector) Collect(ctx context.Context, initial []ports.StreamMessage) ([]ports.StreamMessage, string, time.Duration, error) {
	startedAt := time.Now()
	messages := append(make([]ports.StreamMessage, 0, c.maxSize), initial...)
	if int64(len(messages)) >= c.maxSize {
		return messages[:c.maxSize], batchFlushReasonSize, time.Since(startedAt), nil
	}

	deadline := startedAt.Add(c.maxWait)
	for int64(len(messages)) < c.maxSize {
		remainingWait := time.Until(deadline)
		if remainingWait <= 0 {
			return messages, batchFlushReasonTimeout, time.Since(startedAt), nil
		}

		readCtx, cancel := context.WithTimeout(ctx, remainingWait)
		next, err := c.source.Read(readCtx, c.maxSize-int64(len(messages)), remainingWait)
		cancel()
		if err != nil {
			if errors.Is(err, context.DeadlineExceeded) && ctx.Err() == nil {
				return messages, batchFlushReasonTimeout, time.Since(startedAt), nil
			}
			return messages, "", time.Since(startedAt), err
		}
		messages = append(messages, next...)
	}
	return messages, batchFlushReasonSize, time.Since(startedAt), nil
}
