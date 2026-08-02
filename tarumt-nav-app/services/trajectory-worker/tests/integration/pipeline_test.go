package integration_test

import (
	"context"
	"crypto/rand"
	"encoding/hex"
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
	redisinfra "github.com/campus-navigator/trajectory-worker/internal/infrastructure/redis"
	redis "github.com/redis/go-redis/v9"
)

func TestRedisToClickHousePipelineAndPendingRecovery(t *testing.T) {
	redisURL := os.Getenv("TRAJECTORY_INTEGRATION_REDIS_URL")
	clickhouseAddress := os.Getenv("TRAJECTORY_INTEGRATION_CLICKHOUSE_ADDRESS")
	if redisURL == "" || clickhouseAddress == "" {
		t.Skip("trajectory integration services are not configured; run make verify-integration")
	}
	ctx := context.Background()
	suffix := randomSuffix(t)
	stream := "test:trajectory:" + suffix
	deadLetter := stream + ":dead-letter"
	group := "workers-" + suffix
	rawRedis := newRawRedis(t, redisURL)
	t.Cleanup(func() { _ = rawRedis.Del(context.Background(), stream, deadLetter).Err() })

	sourceA := newSource(t, redisURL, stream, deadLetter, group, "worker-a")
	sourceB := newSource(t, redisURL, stream, deadLetter, group, "worker-b")
	if err := sourceA.EnsureGroup(ctx); err != nil {
		t.Fatal(err)
	}
	repository := newRepository(t, clickhouseAddress)
	serviceA := newService(sourceA, repository)
	serviceB := newService(sourceB, repository)
	eventOne := "event-" + suffix + "-1"
	eventTwo := "event-" + suffix + "-2"

	appendEvent(t, rawRedis, stream, eventOne, 1)
	messages, err := sourceA.Read(ctx, 10, time.Second)
	if err != nil || len(messages) != 1 {
		t.Fatalf("initial Redis read = %d messages, %v", len(messages), err)
	}
	if err := serviceA.Process(ctx, messages); err != nil {
		t.Fatal(err)
	}
	assertPending(t, sourceA, 0)
	assertClickHouseCount(t, clickhouseAddress, eventOne, 1)
	appendEvent(t, rawRedis, stream, eventOne, 1)
	duplicate, err := sourceA.Read(ctx, 10, time.Second)
	if err != nil || len(duplicate) != 1 {
		t.Fatalf("duplicate Redis read = %d messages, %v", len(duplicate), err)
	}
	if err := serviceA.Process(ctx, duplicate); err != nil {
		t.Fatal(err)
	}
	assertClickHouseCount(t, clickhouseAddress, eventOne, 1)

	appendEvent(t, rawRedis, stream, eventTwo, 1)
	claimedByA, err := sourceA.Read(ctx, 10, time.Second)
	if err != nil || len(claimedByA) != 1 {
		t.Fatalf("pending setup read = %d messages, %v", len(claimedByA), err)
	}
	time.Sleep(20 * time.Millisecond)
	reclaimed, err := sourceB.Reclaim(ctx, time.Millisecond, 10)
	if err != nil || len(reclaimed) != 1 || reclaimed[0].EventID != eventTwo {
		t.Fatalf("reclaimed messages = %+v, %v", reclaimed, err)
	}
	if err := serviceB.Process(ctx, reclaimed); err != nil {
		t.Fatal(err)
	}
	assertPending(t, sourceB, 0)
	assertClickHouseCount(t, clickhouseAddress, eventTwo, 1)

	appendEvent(t, rawRedis, stream, "poison-"+suffix, 99)
	poison, err := sourceB.Read(ctx, 10, time.Second)
	if err != nil || len(poison) != 1 {
		t.Fatalf("poison Redis read = %d messages, %v", len(poison), err)
	}
	if err := serviceB.Process(ctx, poison); err != nil {
		t.Fatal(err)
	}
	assertPending(t, sourceB, 0)
	if length, err := rawRedis.XLen(ctx, deadLetter).Result(); err != nil || length != 1 {
		t.Fatalf("dead-letter length = %d, %v", length, err)
	}
	deadLetters, err := rawRedis.XRangeN(ctx, deadLetter, "-", "+", 1).Result()
	if err != nil || len(deadLetters) != 1 {
		t.Fatalf("dead-letter entries = %+v, %v", deadLetters, err)
	}
	values := deadLetters[0].Values
	if _, leaked := values["payload"]; leaked {
		t.Fatalf("dead-letter retained rejected payload: %+v", values)
	}
	if _, leaked := values["event_id"]; leaked {
		t.Fatalf("dead-letter retained untrusted event ID: %+v", values)
	}
	if values["payload_sha256"] == nil || values["event_id_sha256"] == nil {
		t.Fatalf("dead-letter fingerprints are missing: %+v", values)
	}
}

func newRawRedis(t *testing.T, url string) *redis.Client {
	t.Helper()
	options, err := redis.ParseURL(url)
	if err != nil {
		t.Fatal(err)
	}
	client := redis.NewClient(options)
	if err := client.Ping(context.Background()).Err(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Close() })
	return client
}

func newSource(t *testing.T, url, stream, deadLetter, group, consumer string) *redisinfra.Consumer {
	t.Helper()
	source, err := redisinfra.NewConsumer(redisinfra.Options{
		URL: url, Stream: stream, DeadLetter: deadLetter, Group: group, Consumer: consumer,
		PoolSize: 4, DialTimeout: time.Second, ReadTimeout: 2 * time.Second,
		WriteTimeout: time.Second, MaxRetries: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = source.Close() })
	return source
}

func newRepository(t *testing.T, address string) *clickhouseinfra.TrajectoryRepository {
	t.Helper()
	repository, err := clickhouseinfra.NewTrajectoryRepository(clickhouseinfra.Options{
		Address: address, Database: "campus_analytics",
		Username: integrationClickHouseUsername(), Password: os.Getenv("TRAJECTORY_INTEGRATION_CLICKHOUSE_PASSWORD"),
		DialTimeout: 2 * time.Second, MaxOpenConns: 3, MaxIdleConns: 1,
		ConnMaxLifetime: time.Minute, Table: "campus_analytics.trajectory_events_v1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := repository.Ping(context.Background()); err != nil {
		repository.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repository.Close() })
	return repository
}

func newService(source ports.EventSource, repository ports.TrajectoryRepository) *application.IngestionService {
	return application.NewIngestionService(
		source, repository, ports.NoopObserver{}, slog.New(slog.NewTextHandler(io.Discard, nil)),
		application.IngestionOptions{},
	)
}

func appendEvent(t *testing.T, client *redis.Client, stream, eventID string, schemaVersion int) {
	t.Helper()
	payload := fmt.Sprintf(`{"event_id":%q,"journey_id":"journey-test","building_id":"main","floor_id":"2","from_node_id":"a","to_node_id":"b","edge_progress":0.5,"heading":90,"movement_state":"walking","observed_at":"2026-07-22T12:00:00Z","ingested_at":"2026-07-22T12:00:00.001Z"}`, eventID)
	if err := client.XAdd(context.Background(), &redis.XAddArgs{
		Stream: stream, Values: map[string]any{
			"schema_version": schemaVersion, "event_id": eventID, "payload": payload,
		},
	}).Err(); err != nil {
		t.Fatal(err)
	}
}

func assertPending(t *testing.T, source *redisinfra.Consumer, expected int64) {
	t.Helper()
	stats, err := source.Stats(context.Background())
	if err != nil || stats.Pending != expected {
		t.Fatalf("pending = %d, want %d, error=%v", stats.Pending, expected, err)
	}
}

func assertClickHouseCount(t *testing.T, address, eventID string, expected uint64) {
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
	if err := connection.QueryRow(context.Background(),
		"SELECT count() FROM campus_analytics.trajectory_events_v1 FINAL WHERE event_id = ?", eventID,
	).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != expected {
		t.Fatalf("ClickHouse event %q count = %d, want %d", eventID, count, expected)
	}
}

func integrationClickHouseUsername() string {
	if value := os.Getenv("TRAJECTORY_INTEGRATION_CLICKHOUSE_USERNAME"); value != "" {
		return value
	}
	return "default"
}

func randomSuffix(t *testing.T) string {
	t.Helper()
	value := make([]byte, 8)
	if _, err := rand.Read(value); err != nil {
		t.Fatal(err)
	}
	return hex.EncodeToString(value)
}
