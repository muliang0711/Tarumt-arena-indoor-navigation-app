package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/domain"
	"github.com/campus-navigator/presence-gateway/internal/transport/protocol"
	"github.com/coder/websocket"
)

const defaultGatewayURL = "http://127.0.0.1:8080"

type sessionResponse struct {
	AccessToken string `json:"access_token"`
}

type simulator struct {
	name       string
	connection *websocket.Conn
	route      []edge
	sequence   uint64
	step       int
	progress   int
}

type edge struct {
	from string
	to   string
}

func main() {
	baseURL := flag.String("base-url", defaultGatewayURL, "Presence Gateway HTTP base URL")
	buildingID := flag.String("building-id", "main-campus", "building to simulate")
	floorID := flag.String("floor-id", "floor-2", "floor to simulate")
	interval := flag.Duration("interval", 600*time.Millisecond, "interval between location updates")
	flag.Parse()
	if *interval <= 0 {
		log.Fatal("interval must be greater than zero")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	client := &http.Client{Timeout: 8 * time.Second}
	users := make([]*simulator, 0, 2)
	for _, definition := range []struct {
		name  string
		route []edge
	}{
		{name: "Demo Walker A", route: outerRoute()},
		{name: "Demo Walker B", route: innerRoute()},
	} {
		user, err := connectSimulator(ctx, client, *baseURL, *buildingID, *floorID, definition.name, definition.route)
		if err != nil {
			for _, connected := range users {
				connected.close()
			}
			log.Fatal(err)
		}
		users = append(users, user)
	}
	defer func() {
		for _, user := range users {
			user.close()
		}
	}()

	for _, user := range users {
		if err := user.publish(ctx, *buildingID, *floorID); err != nil {
			log.Fatal(err)
		}
	}
	log.Printf("simulating %d users on %s/%s; press Ctrl+C to stop", len(users), *buildingID, *floorID)

	ticker := time.NewTicker(*interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			for _, user := range users {
				if err := user.publish(ctx, *buildingID, *floorID); err != nil {
					log.Printf("%s update failed: %v", user.name, err)
				}
			}
		}
	}
}

func connectSimulator(ctx context.Context, client *http.Client, baseURL, buildingID, floorID, name string, route []edge) (*simulator, error) {
	token, err := createSession(ctx, client, baseURL, name)
	if err != nil {
		return nil, fmt.Errorf("create %s session: %w", name, err)
	}
	connection, err := dial(ctx, baseURL, token)
	if err != nil {
		return nil, fmt.Errorf("connect %s websocket: %w", name, err)
	}
	user := &simulator{name: name, connection: connection, route: route}
	if err := waitForSessionReady(ctx, connection); err != nil {
		user.close()
		return nil, fmt.Errorf("wait for %s session readiness: %w", name, err)
	}
	if err := user.send(ctx, protocol.TypeSubscribeFloor, 0, protocol.FloorSubscription{BuildingID: buildingID, FloorID: floorID}); err != nil {
		user.close()
		return nil, fmt.Errorf("subscribe %s: %w", name, err)
	}
	go drain(connection)
	return user, nil
}

func createSession(ctx context.Context, client *http.Client, baseURL, name string) (string, error) {
	payload, err := json.Marshal(map[string]string{
		"installation_id": "presence-simulator-" + strings.ToLower(strings.ReplaceAll(name, " ", "-")),
		"display_name":    name,
	})
	if err != nil {
		return "", err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(baseURL, "/")+"/v1/anonymous-sessions", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(response.Body)
		return "", fmt.Errorf("unexpected HTTP status %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	var session sessionResponse
	if err := json.NewDecoder(response.Body).Decode(&session); err != nil {
		return "", err
	}
	if session.AccessToken == "" {
		return "", fmt.Errorf("session response has no access token")
	}
	return session.AccessToken, nil
}

func dial(ctx context.Context, baseURL, token string) (*websocket.Conn, error) {
	endpoint, err := url.Parse(baseURL)
	if err != nil {
		return nil, err
	}
	switch endpoint.Scheme {
	case "http":
		endpoint.Scheme = "ws"
	case "https":
		endpoint.Scheme = "wss"
	default:
		return nil, fmt.Errorf("base URL must use http or https")
	}
	endpoint.Path = strings.TrimRight(endpoint.Path, "/") + "/v1/presence"
	connection, response, err := websocket.Dial(ctx, endpoint.String(), &websocket.DialOptions{
		HTTPHeader: http.Header{"Authorization": []string{"Bearer " + token}},
	})
	if err != nil {
		if response != nil {
			return nil, fmt.Errorf("HTTP status %d: %w", response.StatusCode, err)
		}
		return nil, err
	}
	return connection, nil
}

func waitForSessionReady(ctx context.Context, connection *websocket.Conn) error {
	readyCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	for {
		messageType, data, err := connection.Read(readyCtx)
		if err != nil {
			return err
		}
		if messageType != websocket.MessageText {
			continue
		}
		var envelope struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(data, &envelope); err != nil {
			return err
		}
		if envelope.Type == protocol.TypeSessionReady {
			return nil
		}
	}
}

func (s *simulator) publish(ctx context.Context, buildingID, floorID string) error {
	edge := s.route[s.step]
	position := domain.Position{
		BuildingID: buildingID, FloorID: floorID,
		FromNodeID: edge.from, ToNodeID: edge.to,
		EdgeProgress: float64(s.progress) / 10,
		Heading: 90, MovementState: "walking",
	}
	s.sequence++
	if err := s.send(ctx, protocol.TypeLocationUpdate, s.sequence, protocol.LocationUpdate{Position: position}); err != nil {
		return err
	}
	s.progress++
	if s.progress > 10 {
		s.progress = 0
		s.step = (s.step + 1) % len(s.route)
	}
	return nil
}

func (s *simulator) send(ctx context.Context, messageType string, sequence uint64, payload any) error {
	message, err := protocol.Encode(messageType, "simulator-"+s.name, sequence, time.Now().UTC(), payload)
	if err != nil {
		return err
	}
	writeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return s.connection.Write(writeCtx, websocket.MessageText, message)
}

func (s *simulator) close() {
	_ = s.connection.Close(websocket.StatusNormalClosure, "simulator stopped")
}

func drain(connection *websocket.Conn) {
	for {
		if _, _, err := connection.Read(context.Background()); err != nil {
			return
		}
	}
}

func outerRoute() []edge {
	return []edge{
		{from: "node-1", to: "node-2"}, {from: "node-2", to: "node-3"},
		{from: "node-3", to: "node-4"}, {from: "node-4", to: "node-5"},
		{from: "node-5", to: "node-6"}, {from: "node-6", to: "node-7"},
		{from: "node-7", to: "node-8"}, {from: "node-8", to: "node-9"},
		{from: "node-9", to: "node-10"}, {from: "node-10", to: "node-11"},
		{from: "node-11", to: "node-12"}, {from: "node-12", to: "node-16"},
		{from: "node-16", to: "node-17"}, {from: "node-17", to: "node-18"},
		{from: "node-18", to: "node-19"}, {from: "node-19", to: "node-20"},
		{from: "node-20", to: "node-21"}, {from: "node-21", to: "node-1"},
	}
}

func innerRoute() []edge {
	return []edge{
		{from: "node-15", to: "node-14"}, {from: "node-14", to: "node-13"},
		{from: "node-13", to: "node-12"}, {from: "node-12", to: "node-11"},
		{from: "node-11", to: "node-10"}, {from: "node-10", to: "node-9"},
		{from: "node-9", to: "node-8"}, {from: "node-8", to: "node-7"},
		{from: "node-7", to: "node-6"}, {from: "node-6", to: "node-5"},
		{from: "node-5", to: "node-4"}, {from: "node-4", to: "node-3"},
		{from: "node-3", to: "node-2"}, {from: "node-2", to: "node-15"},
	}
}
