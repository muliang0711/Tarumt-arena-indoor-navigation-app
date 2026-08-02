package redisintegration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application"
	"github.com/campus-navigator/presence-gateway/internal/domain"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/auth"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/identity"
	redisinfra "github.com/campus-navigator/presence-gateway/internal/infrastructure/redis"
	timeinfra "github.com/campus-navigator/presence-gateway/internal/infrastructure/time"
	"github.com/campus-navigator/presence-gateway/internal/mapgraph"
	httptransport "github.com/campus-navigator/presence-gateway/internal/transport/http"
	"github.com/campus-navigator/presence-gateway/internal/transport/protocol"
	websockettransport "github.com/campus-navigator/presence-gateway/internal/transport/websocket"
	"github.com/coder/websocket"
	redis "github.com/redis/go-redis/v9"
)

func TestTwoGatewayWebSocketsShareRedisPresence(t *testing.T) {
	clientA, keys := newRedisTestClient(t)
	clientB, err := redisinfra.NewClient(testClientOptions(t))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = clientB.Close() })
	serverA := newRedisGateway(t, clientA, keys, "gateway-a")
	serverB := newRedisGateway(t, clientB, keys, "gateway-b")

	tokenA := createRedisSession(t, serverA.URL, "8f912e7e-918b-4455-9561-f4494c44ff75")
	tokenB := createRedisSession(t, serverA.URL, "22d42143-c758-4b0d-9086-7ef840d241d3")
	websocketA := openRedisWebSocket(t, serverA.URL, tokenA)
	defer websocketA.CloseNow()
	websocketB := openRedisWebSocket(t, serverB.URL, tokenB)
	defer websocketB.CloseNow()
	expectRedisType(t, websocketA, protocol.TypeSessionReady)
	expectRedisType(t, websocketB, protocol.TypeSessionReady)
	sendRedisEnvelope(t, websocketA, protocol.TypeSubscribeFloor, "sub-a", 0, protocol.FloorSubscription{BuildingID: "main", FloorID: "2"})
	sendRedisEnvelope(t, websocketB, protocol.TypeSubscribeFloor, "sub-b", 0, protocol.FloorSubscription{BuildingID: "main", FloorID: "2"})
	expectRedisType(t, websocketA, protocol.TypeFloorSnapshot)
	expectRedisType(t, websocketB, protocol.TypeFloorSnapshot)

	position := domain.Position{
		BuildingID: "main", FloorID: "2", FromNodeID: "n1", ToNodeID: "n2",
		EdgeProgress: 0.35, Heading: 90, MovementState: "walking",
	}
	sendRedisEnvelope(t, websocketA, protocol.TypeLocationUpdate, "move-a", 1, protocol.LocationUpdate{Position: position})
	expectRedisEventually(t, websocketA, protocol.TypeAck)
	event := expectRedisEventually(t, websocketB, protocol.TypeOccupancyUpdated)
	var changed protocol.FloorSnapshot
	if err := json.Unmarshal(event.Payload, &changed); err != nil {
		t.Fatal(err)
	}
	if len(changed.Representatives) != 1 || changed.Representatives[0].Position.EdgeProgress != position.EdgeProgress {
		t.Fatalf("gateway B representatives = %+v, want progress %v", changed.Representatives, position.EdgeProgress)
	}

	response, err := http.Get(serverB.URL + "/health/ready")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("Redis gateway readiness = %d, want 200", response.StatusCode)
	}
}

func newRedisGateway(t *testing.T, client *redis.Client, keys redisinfra.Keyspace, instanceID string) *httptest.Server {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	clock := timeinfra.SystemClock{}
	sessions := redisinfra.NewSessionStore(client, keys)
	presences := redisinfra.NewPresenceStore(client, keys, 3*time.Minute)
	broker := redisinfra.NewRealtimeBroker(client, keys, instanceID, 32, logger)
	occupancy := redisinfra.NewOccupancyStore(client, keys)
	tokens := auth.NewJWTTokenService("01234567890123456789012345678901", "redis-websocket-test")
	sessionService := application.NewSessionService(
		sessions, tokens, identity.NewAnonymousIdentity("abcdefghijklmnopqrstuvwxyz123456"),
		identity.UUIDGenerator{}, clock, time.Hour, 30*time.Minute,
	)
	presenceService := application.NewPresenceService(presences, sessions, broker, clock, identity.UUIDGenerator{})
	mapRegistry, err := mapgraph.NewDefaultRegistry()
	if err != nil {
		t.Fatal(err)
	}
	journeyService := application.NewJourneyService(
		redisinfra.NewJourneyLifecycleStore(
			client,
			keys,
			redisinfra.JourneyLifecycleOptions{MaxLength: 1000},
		),
		mapRegistry,
		identity.UUIDGenerator{},
		clock,
		24*time.Hour,
		24*time.Hour,
		time.Minute,
		45*time.Second,
	)
	occupancyService := application.NewOccupancyService(occupancy, clock, 45*time.Second, 10)
	liveFloors := application.NewLiveFloorProjectionManager(
		broker, occupancyService, nil, application.LiveFloorOptions{
			MovementCoalesceInterval: 10 * time.Millisecond,
			MembershipDebounce:       10 * time.Millisecond,
			SubscriberQueueSize:      32,
			SnapshotTimeout:          time.Second,
		},
	)
	registry := websockettransport.NewConnectionRegistry()
	runner := websockettransport.NewSessionRunner(
		sessionService, presenceService, journeyService, liveFloors,
		registry, logger, nil, 32, 16*1024, 15*time.Second,
	)
	health := redisinfra.NewHealthChecker(client, broker)
	router := httptransport.NewRouter(
		httptransport.NewSessionHandler(sessionService, 16*1024),
		websockettransport.NewHandler(sessionService, runner, nil),
		nil,
		health, nil, logger,
	)
	server := httptest.NewServer(router)
	t.Cleanup(func() {
		server.CloseClientConnections()
		server.Close()
		liveFloors.Close()
		_ = broker.Close()
	})
	return server
}

func createRedisSession(t *testing.T, baseURL, installationID string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"installation_id": installationID})
	response, err := http.Post(baseURL+"/v1/anonymous-sessions", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusCreated {
		data, _ := io.ReadAll(response.Body)
		t.Fatalf("create session status = %d: %s", response.StatusCode, data)
	}
	var payload struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	return payload.AccessToken
}

func openRedisWebSocket(t *testing.T, baseURL, token string) *websocket.Conn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(baseURL, "http") + "/v1/presence"
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	connection, response, err := websocket.Dial(ctx, url, &websocket.DialOptions{
		HTTPHeader: http.Header{"Authorization": []string{"Bearer " + token}},
	})
	if err != nil {
		if response != nil {
			t.Fatalf("websocket status = %d: %v", response.StatusCode, err)
		}
		t.Fatal(err)
	}
	return connection
}

func sendRedisEnvelope(t *testing.T, connection *websocket.Conn, messageType, requestID string, sequence uint64, payload any) {
	t.Helper()
	message, err := protocol.Encode(messageType, requestID, sequence, time.Now().UTC(), payload)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := connection.Write(ctx, websocket.MessageText, message); err != nil {
		t.Fatal(err)
	}
}

func expectRedisType(t *testing.T, connection *websocket.Conn, want string) protocol.Envelope {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_, data, err := connection.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var envelope protocol.Envelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Type != want {
		t.Fatalf("message type = %q, want %q", envelope.Type, want)
	}
	return envelope
}

func expectRedisEventually(t *testing.T, connection *websocket.Conn, want string) protocol.Envelope {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		ctx, cancel := context.WithDeadline(context.Background(), deadline)
		_, data, err := connection.Read(ctx)
		cancel()
		if err != nil {
			t.Fatal(err)
		}
		var envelope protocol.Envelope
		if err := json.Unmarshal(data, &envelope); err != nil {
			t.Fatal(err)
		}
		if envelope.Type == want {
			return envelope
		}
	}
	t.Fatalf("did not receive %q", want)
	return protocol.Envelope{}
}
