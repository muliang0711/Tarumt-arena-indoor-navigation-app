package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	redis "github.com/redis/go-redis/v9"
)

func TestPresenceGatewayToWorkerToClickHouse(t *testing.T) {
	gatewayBinary := os.Getenv("TRAJECTORY_INTEGRATION_GATEWAY_BINARY")
	redisURL := os.Getenv("TRAJECTORY_INTEGRATION_REDIS_URL")
	clickhouseAddress := os.Getenv("TRAJECTORY_INTEGRATION_CLICKHOUSE_ADDRESS")
	if gatewayBinary == "" || redisURL == "" || clickhouseAddress == "" {
		t.Skip("full gateway integration is not configured; run make integration-test")
	}
	suffix := randomSuffix(t)
	prefix := "test:gateway:" + suffix
	stream := prefix + ":trajectory:events"
	deadLetter := prefix + ":trajectory:dead-letter"
	journeyStream := prefix + ":journey:lifecycle:events"
	journeyDeadLetter := prefix + ":journey:lifecycle:dead-letter"
	group := "workers-" + suffix
	rawRedis := newRawRedis(t, redisURL)
	t.Cleanup(func() { cleanupRedisPrefix(rawRedis, prefix+":*") })
	source := newSource(t, redisURL, stream, deadLetter, group, "worker-e2e")
	if err := source.EnsureGroup(context.Background()); err != nil {
		t.Fatal(err)
	}
	repository := newRepository(t, clickhouseAddress)
	service := newService(source, repository)

	baseURL, stopGateway := startGateway(t, gatewayBinary, redisURL, prefix, stream)
	defer stopGateway()
	token := createGatewaySession(t, baseURL)
	sendGatewayLocation(t, baseURL, token)

	messages, err := source.Read(context.Background(), 10, 3*time.Second)
	if err != nil || len(messages) != 1 {
		t.Fatalf("gateway trajectory read = %d messages, %v", len(messages), err)
	}
	if messages[0].SchemaVersion != 1 || messages[0].EventID == "" {
		t.Fatalf("gateway emitted invalid Stream envelope: %+v", messages[0])
	}
	if err := service.Process(context.Background(), messages); err != nil {
		t.Fatal(err)
	}
	assertPending(t, source, 0)
	assertClickHouseCount(t, clickhouseAddress, messages[0].EventID, 1)

	journeySource := newSource(
		t,
		redisURL,
		journeyStream,
		journeyDeadLetter,
		"journey-"+group,
		"worker-journey-e2e",
	)
	if err := journeySource.EnsureGroup(context.Background()); err != nil {
		t.Fatal(err)
	}
	journeyRepository := newJourneyRepository(t, clickhouseAddress)
	journeyService := newJourneyService(journeySource, journeyRepository)
	sendGatewayJourneyStart(t, baseURL, token)
	journeyMessages, err := journeySource.Read(
		context.Background(),
		10,
		3*time.Second,
	)
	if err != nil || len(journeyMessages) != 1 {
		t.Fatalf(
			"gateway Journey lifecycle read = %d messages, %v",
			len(journeyMessages),
			err,
		)
	}
	if err := journeyService.Process(context.Background(), journeyMessages); err != nil {
		t.Fatal(err)
	}
	assertPending(t, journeySource, 0)
	assertJourneyClickHouseCount(
		t,
		clickhouseAddress,
		journeyMessages[0].EventID,
		1,
	)
}

func startGateway(t *testing.T, binary, redisURL, prefix, stream string) (string, func()) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := listener.Addr().String()
	_ = listener.Close()
	command := exec.Command(binary)
	command.Env = append(os.Environ(),
		"PRESENCE_ADDRESS="+address,
		"PRESENCE_BACKEND=redis",
		"PRESENCE_REDIS_URL="+redisURL,
		"PRESENCE_REDIS_KEY_PREFIX="+prefix,
		"PRESENCE_TRAJECTORY_STREAM_KEY="+stream,
		"PRESENCE_JWT_SECRET=01234567890123456789012345678901",
		"PRESENCE_IDENTITY_HMAC_SECRET=abcdefghijklmnopqrstuvwxyz123456",
		"PRESENCE_INSTANCE_ID=gateway-"+prefix,
	)
	var logs bytes.Buffer
	command.Stdout = &logs
	command.Stderr = &logs
	if err := command.Start(); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- command.Wait() }()
	stop := func() {
		if command.Process != nil {
			_ = command.Process.Signal(os.Interrupt)
		}
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			if command.Process != nil {
				_ = command.Process.Kill()
			}
			<-done
		}
	}
	baseURL := "http://" + address
	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case err := <-done:
			t.Fatalf("presence gateway exited before readiness: %v\n%s", err, logs.String())
		default:
		}
		response, err := http.Get(baseURL + "/health/ready")
		if err == nil {
			_ = response.Body.Close()
			if response.StatusCode == http.StatusOK {
				return baseURL, stop
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	stop()
	t.Fatalf("presence gateway did not become ready:\n%s", logs.String())
	return "", func() {}
}

func createGatewaySession(t *testing.T, baseURL string) string {
	t.Helper()
	body := strings.NewReader(`{"installation_id":"8f912e7e-918b-4455-9561-f4494c44ff75"}`)
	response, err := http.Post(baseURL+"/v1/anonymous-sessions", "application/json", body)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusCreated {
		payload, _ := io.ReadAll(response.Body)
		t.Fatalf("create gateway session status = %d: %s", response.StatusCode, payload)
	}
	var session struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(response.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	return session.AccessToken
}

func sendGatewayLocation(t *testing.T, baseURL, token string) {
	t.Helper()
	websocketURL := "ws" + strings.TrimPrefix(baseURL, "http") + "/v1/presence"
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	connection, _, err := websocket.Dial(ctx, websocketURL, &websocket.DialOptions{
		HTTPHeader: http.Header{"Authorization": []string{"Bearer " + token}},
	})
	if err != nil {
		t.Fatal(err)
	}
	defer connection.CloseNow()
	if _, _, err := connection.Read(ctx); err != nil {
		t.Fatal(err)
	}
	payload := map[string]any{
		"version": 1, "type": "location_update", "request_id": "e2e-location", "sequence": 1,
		"timestamp": time.Now().UTC(),
		"payload": map[string]any{"position": map[string]any{
			"building_id": "main", "floor_id": "2", "from_node_id": "a", "to_node_id": "b",
			"edge_progress": 0.5, "heading": 90, "movement_state": "walking",
		}},
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	if err := connection.Write(ctx, websocket.MessageText, encoded); err != nil {
		t.Fatal(err)
	}
	for {
		_, message, err := connection.Read(ctx)
		if err != nil {
			t.Fatal(err)
		}
		var envelope struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(message, &envelope); err != nil {
			t.Fatal(err)
		}
		if envelope.Type == "ack" {
			return
		}
		if envelope.Type == "error" {
			t.Fatalf("gateway rejected location update: %s", message)
		}
	}
}

func sendGatewayJourneyStart(t *testing.T, baseURL, token string) {
	t.Helper()
	websocketURL := "ws" + strings.TrimPrefix(baseURL, "http") + "/v1/presence"
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	connection, _, err := websocket.Dial(ctx, websocketURL, &websocket.DialOptions{
		HTTPHeader: http.Header{"Authorization": []string{"Bearer " + token}},
	})
	if err != nil {
		t.Fatal(err)
	}
	defer connection.CloseNow()
	if _, _, err := connection.Read(ctx); err != nil {
		t.Fatal(err)
	}
	payload := map[string]any{
		"version": 1, "type": "journey_start", "request_id": "e2e-journey-start",
		"timestamp": time.Now().UTC(),
		"payload": map[string]any{
			"client_event_id":    "e2e-client-event",
			"client_journey_key": "e2e-client-journey",
			"map_id":             "main-campus",
			"map_revision":       "sha256:9ce75cc7224ccc08e343761fb981c1625ca1b58231db1eb9c7270f1cf0a7865b",
			"planned_route": map[string]any{
				"origin_node_id": "node-1", "destination_node_id": "node-21",
				"planned_edge_ids": []string{"edge-node-1-node-21"},
			},
		},
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	if err := connection.Write(ctx, websocket.MessageText, encoded); err != nil {
		t.Fatal(err)
	}
	for {
		_, message, err := connection.Read(ctx)
		if err != nil {
			t.Fatal(err)
		}
		var envelope struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(message, &envelope); err != nil {
			t.Fatal(err)
		}
		if envelope.Type == "ack" {
			return
		}
		if envelope.Type == "error" {
			t.Fatalf("gateway rejected Journey start: %s", message)
		}
	}
}

func cleanupRedisPrefix(client *redis.Client, pattern string) {
	var cursor uint64
	for {
		keys, next, err := client.Scan(context.Background(), cursor, pattern, 100).Result()
		if err != nil {
			return
		}
		if len(keys) > 0 {
			_ = client.Del(context.Background(), keys...).Err()
		}
		cursor = next
		if cursor == 0 {
			return
		}
	}
}
