package integration_test

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/campus-navigator/analytics-api/internal/application"
	"github.com/campus-navigator/analytics-api/internal/application/ports"
	"github.com/campus-navigator/analytics-api/internal/domain"
	clickhouseinfra "github.com/campus-navigator/analytics-api/internal/infrastructure/clickhouse"
)

type fixedClock struct{ now time.Time }

func (c fixedClock) Now() time.Time { return c.now }

func TestClickHouseAggregatesDeduplicateAndSuppressSmallCohorts(t *testing.T) {
	address := os.Getenv("ANALYTICS_INTEGRATION_CLICKHOUSE_ADDRESS")
	if address == "" {
		t.Skip("ClickHouse integration is not configured; run make integration-test")
	}
	ctx := context.Background()
	username := env("ANALYTICS_INTEGRATION_CLICKHOUSE_USERNAME", "default")
	password := os.Getenv("ANALYTICS_INTEGRATION_CLICKHOUSE_PASSWORD")
	prefix := "analytics-" + randomSuffix(t)
	buildingID := "main-" + prefix
	bucketStart := time.Now().UTC().Truncate(15 * time.Minute).Add(-15 * time.Minute)
	raw := openClickHouse(t, address, username, password)
	t.Cleanup(func() {
		_ = raw.Exec(context.Background(),
			"ALTER TABLE campus_analytics.trajectory_events_v1 DELETE WHERE startsWith(event_id, ?) SETTINGS mutations_sync = 1", prefix,
		)
	})
	insertCohort(t, raw, buildingID, prefix+"-public", 5, "a", "b", bucketStart)
	insertCohort(t, raw, buildingID, prefix+"-private", 4, "x", "y", bucketStart)
	insertDuplicate(t, raw, buildingID, prefix+"-public-event-0", prefix+"-public-journey-0", "a", "b", bucketStart)

	repository, err := clickhouseinfra.NewAnalyticsRepository(clickhouseinfra.Options{
		Address: address, Database: "campus_analytics", Username: username, Password: password,
		Table: "campus_analytics.trajectory_events_v1", DialTimeout: 2 * time.Second,
		MaxOpenConns: 3, MaxIdleConns: 1, ConnMaxLifetime: time.Minute,
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repository.Close() })
	policy := domain.QueryPolicy{
		PrivacyThreshold: 5, MaxRange: 7 * 24 * time.Hour,
		MaxResultRows: 500, ModerateAt: 10, BusyAt: 25,
	}
	service := application.NewAnalyticsService(repository, fixedClock{now: bucketStart.Add(30 * time.Minute)}, ports.NoopObserver{}, policy)
	query := domain.TrafficQuery{
		BuildingID: buildingID, FloorID: "2", Bucket: domain.Bucket15Minutes,
		From: bucketStart, To: bucketStart.Add(15 * time.Minute),
	}
	floor, err := service.FloorTraffic(ctx, query)
	if err != nil {
		t.Fatal(err)
	}
	if len(floor.Points) != 1 || floor.Points[0].JourneyCount != 9 || floor.Points[0].MovementEventCount != 9 {
		t.Fatalf("floor traffic = %+v", floor)
	}
	edges, err := service.RouteEdgeUsage(ctx, query)
	if err != nil {
		t.Fatal(err)
	}
	if len(edges.Edges) != 1 || edges.Edges[0].FromNodeID != "a" || edges.Edges[0].JourneyCount != 5 {
		t.Fatalf("privacy-safe route edges = %+v", edges)
	}
	payload, err := json.Marshal(edges)
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"journey_id", "event_id", "session_id", "device_ref"} {
		if strings.Contains(string(payload), forbidden) {
			t.Fatalf("analytics response leaked %q: %s", forbidden, payload)
		}
	}
}

func openClickHouse(t *testing.T, address, username, password string) clickhouse.Conn {
	t.Helper()
	connection, err := clickhouse.Open(&clickhouse.Options{
		Addr:        []string{address},
		Auth:        clickhouse.Auth{Database: "campus_analytics", Username: username, Password: password},
		DialTimeout: 2 * time.Second,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := connection.Ping(context.Background()); err != nil {
		connection.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = connection.Close() })
	return connection
}

func insertCohort(t *testing.T, connection clickhouse.Conn, buildingID, prefix string, count int, fromNode, toNode string, observedAt time.Time) {
	t.Helper()
	for index := 0; index < count; index++ {
		insertEvent(t, connection, buildingID,
			prefix+"-event-"+strconv.Itoa(index), prefix+"-journey-"+strconv.Itoa(index),
			fromNode, toNode, observedAt,
		)
	}
}

func insertDuplicate(t *testing.T, connection clickhouse.Conn, buildingID, eventID, journeyID, fromNode, toNode string, observedAt time.Time) {
	t.Helper()
	insertEvent(t, connection, buildingID, eventID, journeyID, fromNode, toNode, observedAt)
}

func insertEvent(t *testing.T, connection clickhouse.Conn, buildingID, eventID, journeyID, fromNode, toNode string, observedAt time.Time) {
	t.Helper()
	err := connection.Exec(context.Background(), `
INSERT INTO campus_analytics.trajectory_events_v1
(schema_version, event_id, journey_id, building_id, floor_id, from_node_id, to_node_id,
 edge_progress, heading, movement_state, observed_at, ingested_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		uint16(1), eventID, journeyID, buildingID, "2", fromNode, toNode,
		0.5, 90.0, "walking", observedAt, observedAt.Add(time.Millisecond),
	)
	if err != nil {
		t.Fatal(err)
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func randomSuffix(t *testing.T) string {
	t.Helper()
	value := make([]byte, 8)
	if _, err := rand.Read(value); err != nil {
		t.Fatal(err)
	}
	return hex.EncodeToString(value)
}
