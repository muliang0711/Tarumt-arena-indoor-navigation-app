package integration_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/campus-navigator/trajectory-worker/internal/application"
	"github.com/campus-navigator/trajectory-worker/internal/application/ports"
	clickhouseinfra "github.com/campus-navigator/trajectory-worker/internal/infrastructure/clickhouse"
	redis "github.com/redis/go-redis/v9"
)

func TestJourneyLifecycleRedisToClickHousePipeline(t *testing.T) {
	redisURL := os.Getenv("TRAJECTORY_INTEGRATION_REDIS_URL")
	clickhouseAddress := os.Getenv("TRAJECTORY_INTEGRATION_CLICKHOUSE_ADDRESS")
	if redisURL == "" || clickhouseAddress == "" {
		t.Skip("trajectory integration services are not configured; run make verify-integration")
	}
	ctx := context.Background()
	suffix := randomSuffix(t)
	stream := "test:journey:" + suffix
	deadLetter := stream + ":dead-letter"
	rawRedis := newRawRedis(t, redisURL)
	t.Cleanup(func() { _ = rawRedis.Del(context.Background(), stream, deadLetter).Err() })
	source := newSource(t, redisURL, stream, deadLetter, "journey-workers-"+suffix, "worker-a")
	if err := source.EnsureGroup(ctx); err != nil {
		t.Fatal(err)
	}
	repository := newJourneyRepository(t, clickhouseAddress)
	service := newJourneyService(source, repository)
	eventID := "journey-event-" + suffix

	appendJourneyEvent(t, rawRedis, stream, eventID, 1, false)
	messages, err := source.Read(ctx, 10, time.Second)
	if err != nil || len(messages) != 1 {
		t.Fatalf("Journey Redis read = %d messages, %v", len(messages), err)
	}
	if err := service.Process(ctx, messages); err != nil {
		t.Fatal(err)
	}
	assertPending(t, source, 0)
	assertJourneyClickHouseCount(t, clickhouseAddress, eventID, 1)

	appendJourneyEvent(t, rawRedis, stream, "private-"+suffix, 1, true)
	poison, err := source.Read(ctx, 10, time.Second)
	if err != nil || len(poison) != 1 {
		t.Fatalf("Journey poison read = %d messages, %v", len(poison), err)
	}
	if err := service.Process(ctx, poison); err != nil {
		t.Fatal(err)
	}
	if length := rawRedis.XLen(ctx, deadLetter).Val(); length != 1 {
		t.Fatalf("Journey dead-letter length = %d", length)
	}
	deadLetters, err := rawRedis.XRangeN(ctx, deadLetter, "-", "+", 1).Result()
	if err != nil || len(deadLetters) != 1 {
		t.Fatalf("Journey dead-letter entries = %+v, %v", deadLetters, err)
	}
	if _, leaked := deadLetters[0].Values["payload"]; leaked {
		t.Fatalf("Journey dead letter retained rejected payload: %+v", deadLetters[0].Values)
	}
}

func newJourneyRepository(
	t *testing.T,
	address string,
) *clickhouseinfra.JourneyLifecycleRepository {
	t.Helper()
	repository, err := clickhouseinfra.NewJourneyLifecycleRepository(clickhouseinfra.Options{
		Address: address, Database: "campus_analytics",
		Username:    integrationClickHouseUsername(),
		Password:    os.Getenv("TRAJECTORY_INTEGRATION_CLICKHOUSE_PASSWORD"),
		DialTimeout: 2 * time.Second, MaxOpenConns: 3, MaxIdleConns: 1,
		ConnMaxLifetime: time.Minute,
		Table:           "campus_analytics.journey_lifecycle_events_v1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := repository.Ping(context.Background()); err != nil {
		_ = repository.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repository.Close() })
	return repository
}

func newJourneyService(
	source ports.EventSource,
	repository ports.JourneyLifecycleRepository,
) *application.JourneyIngestionService {
	return application.NewJourneyIngestionService(
		source,
		repository,
		ports.NoopObserver{},
		slog.New(slog.NewTextHandler(io.Discard, nil)),
		application.IngestionOptions{},
	)
}

func appendJourneyEvent(
	t *testing.T,
	client *redis.Client,
	stream string,
	eventID string,
	schemaVersion int,
	withIdentity bool,
) {
	t.Helper()
	identity := ""
	if withIdentity {
		identity = `,"device_ref":"private-device"`
	}
	payload := fmt.Sprintf(
		`{"event_type":"journey_started","event_id":%q,"client_event_id":"client-1","journey_id":"journey-test","client_journey_key":"key-test","map_id":"main-campus","map_revision":"sha256:9ce75cc7224ccc08e343761fb981c1625ca1b58231db1eb9c7270f1cf0a7865b","lifecycle_sequence":1,"route_revision":1,"occurred_at":"2026-07-26T02:00:00Z","ingested_at":"2026-07-26T02:00:00.050Z","planned_route":{"origin_node_id":"node-1","destination_node_id":"node-21","planned_edge_ids":["edge-node-1-node-21"]}%s}`,
		eventID,
		identity,
	)
	if err := client.XAdd(context.Background(), &redis.XAddArgs{
		Stream: stream,
		Values: map[string]any{
			"schema_version": schemaVersion,
			"event_id":       eventID,
			"payload":        payload,
		},
	}).Err(); err != nil {
		t.Fatal(err)
	}
}

func assertJourneyClickHouseCount(
	t *testing.T,
	address string,
	eventID string,
	expected uint64,
) {
	t.Helper()
	connection, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{address},
		Auth: clickhouse.Auth{
			Database: "campus_analytics", Username: integrationClickHouseUsername(),
			Password: os.Getenv("TRAJECTORY_INTEGRATION_CLICKHOUSE_PASSWORD"),
		},
		DialTimeout: 2 * time.Second,
	})
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	var count uint64
	if err := connection.QueryRow(
		context.Background(),
		"SELECT count() FROM campus_analytics.journey_lifecycle_events_v1 FINAL WHERE event_id = ?",
		eventID,
	).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != expected {
		t.Fatalf("ClickHouse Journey event %q count = %d, want %d", eventID, count, expected)
	}
}
