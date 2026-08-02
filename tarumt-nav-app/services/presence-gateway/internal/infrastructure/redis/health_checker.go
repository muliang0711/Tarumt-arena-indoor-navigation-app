package redisinfra

import (
	"context"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	redis "github.com/redis/go-redis/v9"
)

type HealthChecker struct {
	client *redis.Client
	broker interface{ Healthy() bool }
}

func NewHealthChecker(client *redis.Client, broker interface{ Healthy() bool }) *HealthChecker {
	return &HealthChecker{client: client, broker: broker}
}

func (h *HealthChecker) Ready(ctx context.Context) error {
	if err := h.client.Ping(ctx).Err(); err != nil {
		return storeError("health ping", err)
	}
	if h.broker != nil && !h.broker.Healthy() {
		return ports.ErrUnavailable
	}
	return nil
}
