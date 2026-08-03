package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application"
	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/auth"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/identity"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/memory"
	timeinfra "github.com/campus-navigator/presence-gateway/internal/infrastructure/time"
	"github.com/campus-navigator/presence-gateway/internal/mapgraph"
	httptransport "github.com/campus-navigator/presence-gateway/internal/transport/http"
	"github.com/campus-navigator/presence-gateway/internal/transport/protocol"
	websockettransport "github.com/campus-navigator/presence-gateway/internal/transport/websocket"
	"github.com/coder/websocket"
)

type testSession struct {
	AccessToken string `json:"access_token"`
}

func TestAnonymousSessionsAndRealtimeFloorIsolation(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	clock := timeinfra.SystemClock{}
	sessions := memory.NewSessionStore()
	presences := memory.NewPresenceStore()
	occupancyStore := memory.NewOccupancyStore(sessions, presences)
	broker := memory.NewRealtimeBroker(32)
	sessionService := application.NewSessionService(
		sessions,
		auth.NewJWTTokenService("01234567890123456789012345678901", "integration-test"),
		identity.NewAnonymousIdentity("abcdefghijklmnopqrstuvwxyz123456"),
		identity.UUIDGenerator{}, clock, time.Hour, 30*time.Minute,
	)
	presenceService := application.NewPresenceService(presences, sessions, broker, clock, identity.UUIDGenerator{})
	mapRegistry, err := mapgraph.NewDefaultRegistry()
	if err != nil {
		t.Fatal(err)
	}
	journeyStore := memory.NewJourneyLifecycleStore(presences.Remove)
	journeyService := application.NewJourneyService(
		journeyStore,
		mapRegistry,
		identity.UUIDGenerator{},
		clock,
		24*time.Hour,
		24*time.Hour,
		time.Minute,
		45*time.Second,
	)
	occupancyService := application.NewOccupancyService(
		occupancyStore, clock, 45*time.Second, 10,
	)
	liveFloors := application.NewLiveFloorProjectionManager(
		broker, occupancyService, nil, application.LiveFloorOptions{
			MovementCoalesceInterval: 10 * time.Millisecond,
			MembershipDebounce:       10 * time.Millisecond,
			SubscriberQueueSize:      32,
			SnapshotTimeout:          time.Second,
		},
	)
	t.Cleanup(liveFloors.Close)
	registry := websockettransport.NewConnectionRegistry()
	runner := websockettransport.NewSessionRunner(
		sessionService, presenceService, journeyService, liveFloors, registry, logger,
		nil, 32, 16*1024, 15*time.Second,
	)
	router := httptransport.NewRouter(
		httptransport.NewSessionHandler(sessionService, 16*1024),
		websockettransport.NewHandler(sessionService, runner, nil),
		nil,
		memory.HealthChecker{},
		nil,
		logger,
	)
	server := httptest.NewServer(router)
	defer server.Close()
	assertUnauthorizedWebSocket(t, server.URL)
	assertUnknownSessionFieldRejected(t, server.URL)
	assertInvalidDisplayNameRejected(t, server.URL)

	clientA := openClient(t, server.URL, createSessionWithDisplayName(t, server.URL, "8f912e7e-918b-4455-9561-f4494c44ff75", "Ghost Bob").AccessToken)
	defer clientA.CloseNow()
	clientB := openClient(t, server.URL, createSession(t, server.URL, "22d42143-c758-4b0d-9086-7ef840d241d3").AccessToken)
	defer clientB.CloseNow()
	clientC := openClient(t, server.URL, createSession(t, server.URL, "3d69f82b-78de-44f4-a586-72d79982dd78").AccessToken)
	defer clientC.CloseNow()

	readyAEnvelope := expectType(t, clientA, protocol.TypeSessionReady)
	var readyA protocol.SessionReady
	if err := json.Unmarshal(readyAEnvelope.Payload, &readyA); err != nil {
		t.Fatal(err)
	}
	expectType(t, clientB, protocol.TypeSessionReady)
	expectType(t, clientC, protocol.TypeSessionReady)
	subscribe(t, clientB, "main", "2", "sub-b")
	subscribe(t, clientC, "main", "3", "sub-c")
	expectType(t, clientB, protocol.TypeFloorSnapshot)
	expectType(t, clientC, protocol.TypeFloorSnapshot)

	position := domain.Position{
		BuildingID: "main", FloorID: "2", FromNodeID: "n1", ToNodeID: "n2",
		EdgeProgress: 0.25, Heading: 90, MovementState: "walking",
	}
	sendLocation(t, clientA, 1, "loc-1", position)
	expectEventually(t, clientA, protocol.TypeAck)
	expectEventually(t, clientB, protocol.TypeOccupancyUpdated)

	// Publishing does not require an observation subscription. A can subscribe
	// to floor 3 afterwards while its actual presence remains on floor 2.
	subscribe(t, clientA, "main", "3", "sub-a")
	expectType(t, clientA, protocol.TypeFloorSnapshot)

	sendLocation(t, clientA, 1, "duplicate", position)
	errorEnvelope := expectEventually(t, clientA, protocol.TypeError)
	var protocolError protocol.ErrorMessage
	if err := json.Unmarshal(errorEnvelope.Payload, &protocolError); err != nil {
		t.Fatal(err)
	}
	if protocolError.Code != protocol.ErrorStaleSequence {
		t.Fatalf("error code = %q, want %q", protocolError.Code, protocol.ErrorStaleSequence)
	}

	position.EdgeProgress = 0.5
	sendLocation(t, clientA, 2, "loc-2", position)
	expectEventually(t, clientA, protocol.TypeAck)
	updatedEnvelope := expectEventually(t, clientB, protocol.TypePresenceUpdated)
	var changed protocol.PresenceChanged
	if err := json.Unmarshal(updatedEnvelope.Payload, &changed); err != nil {
		t.Fatal(err)
	}
	if changed.Actor.DisplayName != "Ghost Bob" {
		t.Fatalf("actor display name = %q, want %q", changed.Actor.DisplayName, "Ghost Bob")
	}
	sendEnvelope(t, clientC, protocol.TypeHeartbeat, "heartbeat-c", 0, nil)
	expectType(t, clientC, protocol.TypePong)

	// Leaving navigation removes only A's building/floor presence. Its app
	// session and WebSocket remain active, so total app usage is unchanged.
	sendEnvelope(t, clientA, protocol.TypeLeave, "leave-a", 0, nil)
	expectEventually(t, clientA, protocol.TypeAck)
	expectEventually(t, clientB, protocol.TypeOccupancyUpdated)
	subscribe(t, clientB, "main", "2", "sub-b-after-leave")
	afterLeaveEnvelope := expectEventually(t, clientB, protocol.TypeFloorSnapshot)
	var afterLeave protocol.FloorSnapshot
	if err := json.Unmarshal(afterLeaveEnvelope.Payload, &afterLeave); err != nil {
		t.Fatal(err)
	}
	if afterLeave.TotalActiveUsers != 3 {
		t.Fatalf("total active users = %d, want 3", afterLeave.TotalActiveUsers)
	}
	if afterLeave.BuildingActiveUsers != 0 {
		t.Fatalf("building active users = %d, want 0", afterLeave.BuildingActiveUsers)
	}
	if len(afterLeave.Representatives) != 0 {
		t.Fatalf("representatives = %d, want 0", len(afterLeave.Representatives))
	}

	startPayload := protocol.JourneyStart{
		ClientEventID: "journey-client-1", ClientJourneyKey: "local-1",
		MapID:       "main-campus",
		MapRevision: "sha256:9ce75cc7224ccc08e343761fb981c1625ca1b58231db1eb9c7270f1cf0a7865b",
		PlannedRoute: domain.PlannedRoute{
			OriginNodeID: "node-1", DestinationNodeID: "node-21",
			PlannedEdgeIDs: []string{"edge-node-1-node-21"},
		},
	}
	sendEnvelope(
		t,
		clientA,
		protocol.TypeJourneyStart,
		"journey-start",
		0,
		startPayload,
	)
	startAckEnvelope := expectEventually(t, clientA, protocol.TypeAck)
	var startAck protocol.Acknowledgement
	if err := json.Unmarshal(startAckEnvelope.Payload, &startAck); err != nil {
		t.Fatal(err)
	}
	if startAck.JourneyID == "" ||
		startAck.LifecycleSequence != 1 ||
		startAck.RouteRevision != 1 {
		t.Fatalf(
			"unexpected journey start ACK: envelope=%#v ack=%#v payload=%s",
			startAckEnvelope,
			startAck,
			startAckEnvelope.Payload,
		)
	}
	sendEnvelope(
		t,
		clientA,
		protocol.TypeJourneyStart,
		"journey-start-retry",
		0,
		startPayload,
	)
	retryEnvelope := expectEventually(t, clientA, protocol.TypeAck)
	var retryAck protocol.Acknowledgement
	if err := json.Unmarshal(retryEnvelope.Payload, &retryAck); err != nil {
		t.Fatal(err)
	}
	if !retryAck.Deduplicated || retryAck.JourneyID != startAck.JourneyID {
		t.Fatalf("unexpected journey retry ACK: %#v", retryAck)
	}

	canonicalPosition := domain.Position{
		BuildingID: "main-campus", FloorID: "floor-2",
		FromNodeID: "node-1", ToNodeID: "node-21",
		EdgeProgress: 0.5, Heading: 90, MovementState: "walking",
	}
	sendLocation(t, clientA, 3, "canonical-location", canonicalPosition)
	expectEventually(t, clientA, protocol.TypeAck)
	sendEnvelope(t, clientA, protocol.TypeJourneyEnd, "journey-end", 0, protocol.JourneyEnd{
		ClientEventID: "journey-client-2",
		JourneyID:     startAck.JourneyID, ClientJourneyKey: "local-1",
		Outcome: domain.JourneyArrived,
	})
	endEnvelope := expectEventually(t, clientA, protocol.TypeAck)
	var endAck protocol.Acknowledgement
	if err := json.Unmarshal(endEnvelope.Payload, &endAck); err != nil {
		t.Fatal(err)
	}
	if endAck.JourneyID != startAck.JourneyID ||
		endAck.LifecycleSequence != 2 {
		t.Fatalf("unexpected journey end ACK: %#v", endAck)
	}
	if _, err := presences.Get(
		context.Background(),
		readyA.SessionID,
	); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal("journey end left presence data behind")
	}
	events := journeyStore.LifecycleEvents()
	if len(events) != 2 ||
		events[0].EventType != domain.JourneyStartedEvent ||
		events[1].Outcome != domain.JourneyArrived {
		t.Fatalf("unexpected lifecycle events: %#v", events)
	}
	trajectoryEvents := presences.TrajectoryEvents()
	if trajectoryEvents[len(trajectoryEvents)-1].JourneyID != startAck.JourneyID {
		t.Fatal("trajectory did not reuse canonical journey ID")
	}

	if registry.Count() != 3 {
		t.Fatalf("connection registry count = %d, want 3", registry.Count())
	}
}

func assertUnauthorizedWebSocket(t *testing.T, baseURL string) {
	t.Helper()
	websocketURL := "ws" + strings.TrimPrefix(baseURL, "http") + "/v1/presence"
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	connection, response, err := websocket.Dial(ctx, websocketURL, nil)
	if connection != nil {
		connection.CloseNow()
	}
	if err == nil || response == nil || response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauthorized websocket result: status=%v err=%v", responseStatus(response), err)
	}
}

func responseStatus(response *http.Response) any {
	if response == nil {
		return nil
	}
	return response.StatusCode
}

func createSession(t *testing.T, baseURL, installationID string) testSession {
	t.Helper()
	return createSessionWithPayload(t, baseURL, map[string]string{"installation_id": installationID})
}

func createSessionWithDisplayName(t *testing.T, baseURL, installationID, displayName string) testSession {
	t.Helper()
	return createSessionWithPayload(t, baseURL, map[string]string{
		"installation_id": installationID,
		"display_name":    displayName,
	})
}

func createSessionWithPayload(t *testing.T, baseURL string, payload map[string]string) testSession {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	response, err := http.Post(baseURL+"/v1/anonymous-sessions", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusCreated {
		data, _ := io.ReadAll(response.Body)
		t.Fatalf("create session status = %d: %s", response.StatusCode, data)
	}
	var session testSession
	if err := json.NewDecoder(response.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	return session
}

func assertUnknownSessionFieldRejected(t *testing.T, baseURL string) {
	t.Helper()
	body, err := json.Marshal(map[string]string{
		"installation_id": "unknown-field-installation-v1",
		"unexpected":      "value",
	})
	if err != nil {
		t.Fatal(err)
	}
	response, err := http.Post(baseURL+"/v1/anonymous-sessions", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusBadRequest {
		data, _ := io.ReadAll(response.Body)
		t.Fatalf("unknown session field status = %d, want %d: %s", response.StatusCode, http.StatusBadRequest, data)
	}
}

func assertInvalidDisplayNameRejected(t *testing.T, baseURL string) {
	t.Helper()
	body, err := json.Marshal(map[string]string{
		"installation_id": "invalid-name-installation-v1",
		"display_name":    "1234567890123456789012345",
	})
	if err != nil {
		t.Fatal(err)
	}
	response, err := http.Post(baseURL+"/v1/anonymous-sessions", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusBadRequest {
		data, _ := io.ReadAll(response.Body)
		t.Fatalf("invalid display name status = %d, want %d: %s", response.StatusCode, http.StatusBadRequest, data)
	}
}

func openClient(t *testing.T, baseURL, token string) *websocket.Conn {
	t.Helper()
	websocketURL := "ws" + strings.TrimPrefix(baseURL, "http") + "/v1/presence"
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	connection, response, err := websocket.Dial(ctx, websocketURL, &websocket.DialOptions{
		HTTPHeader: http.Header{"Authorization": []string{"Bearer " + token}},
	})
	if err != nil {
		if response != nil {
			t.Fatalf("websocket dial failed with status %d: %v", response.StatusCode, err)
		}
		t.Fatal(err)
	}
	return connection
}

func subscribe(t *testing.T, connection *websocket.Conn, buildingID, floorID, requestID string) {
	t.Helper()
	sendEnvelope(t, connection, protocol.TypeSubscribeFloor, requestID, 0, protocol.FloorSubscription{
		BuildingID: buildingID, FloorID: floorID,
	})
}

func sendLocation(t *testing.T, connection *websocket.Conn, sequence uint64, requestID string, position domain.Position) {
	t.Helper()
	sendEnvelope(t, connection, protocol.TypeLocationUpdate, requestID, sequence, protocol.LocationUpdate{Position: position})
}

func sendEnvelope(t *testing.T, connection *websocket.Conn, messageType, requestID string, sequence uint64, payload any) {
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

func expectType(t *testing.T, connection *websocket.Conn, want string) protocol.Envelope {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	messageType, data, err := connection.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if messageType != websocket.MessageText {
		t.Fatalf("message type = %v, want text", messageType)
	}
	var envelope protocol.Envelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Type != want {
		t.Fatalf("envelope type = %q, want %q", envelope.Type, want)
	}
	return envelope
}

func expectEventually(t *testing.T, connection *websocket.Conn, want string) protocol.Envelope {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		ctx, cancel := context.WithDeadline(context.Background(), deadline)
		messageType, data, err := connection.Read(ctx)
		cancel()
		if err != nil {
			t.Fatal(err)
		}
		if messageType != websocket.MessageText {
			continue
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
