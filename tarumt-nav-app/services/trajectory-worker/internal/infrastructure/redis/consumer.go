package redisinfra

import (
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/campus-navigator/trajectory-worker/internal/application/ports"
	redis "github.com/redis/go-redis/v9"
)

//go:embed scripts/dead_letter.lua
var deadLetterSource string

var deadLetterScript = redis.NewScript(deadLetterSource)

type Options struct {
	URL          string
	Stream       string
	DeadLetter   string
	Group        string
	Consumer     string
	PoolSize     int
	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	MaxRetries   int
}

type Consumer struct {
	client     *redis.Client
	stream     string
	deadLetter string
	group      string
	consumer   string
}

func NewConsumer(options Options) (*Consumer, error) {
	parsed, err := redis.ParseURL(options.URL)
	if err != nil {
		return nil, fmt.Errorf("parse Redis URL: %w", err)
	}
	parsed.PoolSize = options.PoolSize
	parsed.DialTimeout = options.DialTimeout
	parsed.ReadTimeout = options.ReadTimeout
	parsed.WriteTimeout = options.WriteTimeout
	parsed.MaxRetries = options.MaxRetries
	return &Consumer{
		client: redis.NewClient(parsed), stream: options.Stream,
		deadLetter: options.DeadLetter, group: options.Group, consumer: options.Consumer,
	}, nil
}

func (c *Consumer) EnsureGroup(ctx context.Context) error {
	err := c.client.XGroupCreateMkStream(ctx, c.stream, c.group, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return fmt.Errorf("create Redis consumer group: %w", err)
	}
	return nil
}

func (c *Consumer) Read(ctx context.Context, count int64, block time.Duration) ([]ports.StreamMessage, error) {
	streams, err := c.client.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group: c.group, Consumer: c.consumer, Streams: []string{c.stream, ">"},
		Count: count, Block: block,
	}).Result()
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read Redis consumer group: %w", err)
	}
	return decodeStreams(streams), nil
}

func (c *Consumer) Reclaim(ctx context.Context, minIdle time.Duration, count int64) ([]ports.StreamMessage, error) {
	messages, _, err := c.client.XAutoClaim(ctx, &redis.XAutoClaimArgs{
		Stream: c.stream, Group: c.group, Consumer: c.consumer,
		MinIdle: minIdle, Start: "0-0", Count: count,
	}).Result()
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("reclaim Redis pending messages: %w", err)
	}
	return decodeMessages(messages), nil
}

func (c *Consumer) Acknowledge(ctx context.Context, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	if err := c.client.XAck(ctx, c.stream, c.group, ids...).Err(); err != nil {
		return fmt.Errorf("acknowledge Redis messages: %w", err)
	}
	return nil
}

func (c *Consumer) DeadLetter(ctx context.Context, message ports.StreamMessage, reason string) (bool, error) {
	if len(reason) > 1024 {
		reason = reason[:1024]
	}
	eventHash := sha256.Sum256([]byte(message.EventID))
	payloadHash := sha256.Sum256(message.Payload)
	acknowledged, err := deadLetterScript.Run(ctx, c.client, []string{c.stream, c.deadLetter},
		c.group, message.ID, message.SchemaVersion, hex.EncodeToString(eventHash[:]), hex.EncodeToString(payloadHash[:]), reason,
		time.Now().UTC().Format(time.RFC3339Nano),
	).Int64()
	if err != nil {
		return false, fmt.Errorf("move Redis message to dead letter: %w", err)
	}
	return acknowledged > 0, nil
}

func (c *Consumer) Stats(ctx context.Context) (ports.SourceStats, error) {
	stream, err := c.client.XInfoStream(ctx, c.stream).Result()
	if err != nil {
		return ports.SourceStats{}, fmt.Errorf("read Redis Stream stats: %w", err)
	}
	groups, err := c.client.XInfoGroups(ctx, c.stream).Result()
	if err != nil {
		return ports.SourceStats{}, fmt.Errorf("read Redis group stats: %w", err)
	}
	for _, group := range groups {
		if group.Name == c.group {
			trimmed := stream.EntriesAdded - stream.Length
			if trimmed < 0 {
				trimmed = 0
			}
			return ports.SourceStats{
				Lag: group.Lag, Pending: group.Pending, StreamLength: stream.Length,
				EntriesAdded: stream.EntriesAdded, Trimmed: trimmed,
			}, nil
		}
	}
	return ports.SourceStats{}, fmt.Errorf("Redis consumer group %q not found", c.group)
}

func (c *Consumer) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

func (c *Consumer) Close() error {
	return c.client.Close()
}

func decodeStreams(streams []redis.XStream) []ports.StreamMessage {
	var decoded []ports.StreamMessage
	for _, stream := range streams {
		decoded = append(decoded, decodeMessages(stream.Messages)...)
	}
	return decoded
}

func decodeMessages(messages []redis.XMessage) []ports.StreamMessage {
	decoded := make([]ports.StreamMessage, 0, len(messages))
	for _, message := range messages {
		version, _ := strconv.Atoi(valueString(message.Values["schema_version"]))
		decoded = append(decoded, ports.StreamMessage{
			ID: message.ID, SchemaVersion: version,
			EventID: valueString(message.Values["event_id"]),
			Payload: []byte(valueString(message.Values["payload"])),
		})
	}
	return decoded
}

func valueString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case []byte:
		return string(typed)
	case nil:
		return ""
	default:
		return fmt.Sprint(typed)
	}
}
