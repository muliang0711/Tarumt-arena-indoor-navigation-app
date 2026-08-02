package redisinfra

import (
	"errors"
	"fmt"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	redis "github.com/redis/go-redis/v9"
)

func storeError(operation string, err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, redis.Nil) {
		return ports.ErrNotFound
	}
	return fmt.Errorf("%w: Redis %s: %v", ports.ErrUnavailable, operation, err)
}
