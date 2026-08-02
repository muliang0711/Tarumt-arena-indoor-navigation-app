package redisinfra

import (
	"crypto/tls"
	"fmt"
	"strings"
	"time"

	redis "github.com/redis/go-redis/v9"
)

type ClientOptions struct {
	URL                string
	PoolSize           int
	MinIdleConnections int
	DialTimeout        time.Duration
	ReadTimeout        time.Duration
	WriteTimeout       time.Duration
	MaxRetries         int
}

func NewClient(options ClientOptions) (*redis.Client, error) {
	parsed, err := redis.ParseURL(options.URL)
	if err != nil {
		return nil, fmt.Errorf("parse Redis URL: %w", err)
	}
	parsed.PoolSize = options.PoolSize
	parsed.MinIdleConns = options.MinIdleConnections
	parsed.DialTimeout = options.DialTimeout
	parsed.ReadTimeout = options.ReadTimeout
	parsed.WriteTimeout = options.WriteTimeout
	parsed.MaxRetries = options.MaxRetries
	if strings.HasPrefix(options.URL, "rediss://") && parsed.TLSConfig == nil {
		parsed.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}
	return redis.NewClient(parsed), nil
}
