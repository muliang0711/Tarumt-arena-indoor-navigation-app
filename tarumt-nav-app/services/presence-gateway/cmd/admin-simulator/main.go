// admin-simulator sends real lifecycle and location requests to a local gateway.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/domain"
	"github.com/campus-navigator/presence-gateway/internal/mapgraph"
	"github.com/campus-navigator/presence-gateway/internal/transport/protocol"
	"github.com/coder/websocket"
)

type hop struct{ from, to, id string }
type walker struct {
	conn *websocket.Conn
	seq  uint64
}

func main() {
	base := flag.String("base-url", "http://127.0.0.1:18080", "local gateway URL")
	users := flag.Int("users", 100, "number of concurrent walkers (1–1000)")
	interval := flag.Duration("interval", time.Second, "location update interval")
	duration := flag.Duration("duration", 0, "stop after duration; 0 runs until stopped")
	file := flag.String("map-bundle", "internal/mapgraph/assets/main-campus.map-graph.v1.json", "canonical map graph")
	flag.Parse()
	if *users < 1 || *users > 1000 || *interval < 100*time.Millisecond || *duration < 0 {
		log.Fatal("invalid users, interval, or duration")
	}
	data, err := os.ReadFile(*file)
	if err != nil {
		log.Fatal(err)
	}
	var bundle mapgraph.Bundle
	if err := json.Unmarshal(data, &bundle); err != nil {
		log.Fatal(err)
	}
	if len(bundle.Floors) == 0 {
		log.Fatal("map has no floors")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if *duration > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, *duration)
		defer cancel()
	}
	runID := fmt.Sprintf("%d", time.Now().UnixNano())
	var group sync.WaitGroup
	for i := 0; i < *users; i++ {
		group.Add(1)
		go func(index int) {
			defer group.Done()
			for ctx.Err() == nil {
				if err := walk(ctx, *base, runID, index, *interval, bundle); err != nil && ctx.Err() == nil {
					log.Printf("Walker %03d reconnecting: %v", index+1, err)
				}
				select {
				case <-ctx.Done():
					return
				case <-time.After(2 * time.Second):
				}
			}
		}(i)
		time.Sleep(15 * time.Millisecond)
	}
	log.Printf("%d simulated users sending to %s every %s; Ctrl+C stops them", *users, *base, *interval)
	group.Wait()
}

func walk(ctx context.Context, base, runID string, index int, interval time.Duration, bundle mapgraph.Bundle) error {
	name := fmt.Sprintf("Walker %03d", index+1)
	body, _ := json.Marshal(map[string]string{"installation_id": fmt.Sprintf("admin-sim-%s-%03d", runID, index), "display_name": name})
	req, _ := http.NewRequestWithContext(ctx, "POST", strings.TrimRight(base, "/")+"/v1/anonymous-sessions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	response, err := (&http.Client{Timeout: 8 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	var session struct {
		Token string `json:"access_token"`
	}
	err = json.NewDecoder(response.Body).Decode(&session)
	response.Body.Close()
	if err != nil {
		return err
	}
	if response.StatusCode != 201 || session.Token == "" {
		return fmt.Errorf("session HTTP %d", response.StatusCode)
	}
	endpoint, err := url.Parse(base)
	if err != nil {
		return err
	}
	if endpoint.Scheme == "https" {
		endpoint.Scheme = "wss"
	} else {
		endpoint.Scheme = "ws"
	}
	endpoint.Path = strings.TrimRight(endpoint.Path, "/") + "/v1/presence"
	conn, _, err := websocket.Dial(ctx, endpoint.String(), &websocket.DialOptions{HTTPHeader: http.Header{"Authorization": {"Bearer " + session.Token}}})
	if err != nil {
		return err
	}
	defer conn.CloseNow()
	readyCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	_, _, err = conn.Read(readyCtx)
	cancel()
	if err != nil {
		return err
	}
	w := walker{conn: conn}
	floor := bundle.Floors[0]
	nodes := map[string]mapgraph.Node{}
	for _, node := range floor.Nodes {
		nodes[node.NodeID] = node
	}
	// Weighted destinations create a realistic, reproducible popularity ranking.
	targets := []string{"node-14", "node-14", "node-14", "node-15", "node-15", "node-11", "node-4", "node-5", "node-17", "node-20"}
	origins := []string{"node-4", "node-5", "node-6", "node-7", "node-11", "node-13", "node-14", "node-15", "node-17", "node-18", "node-19", "node-20"}
	current := origins[index%len(origins)]
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for trip := 0; ctx.Err() == nil; trip++ {
		target := targets[(index+trip)%len(targets)]
		if target == current {
			target = origins[(index+trip+5)%len(origins)]
		}
		if target == current {
			target = "node-6"
		}
		route := findRoute(floor.Edges, current, target)
		if len(route) == 0 {
			return fmt.Errorf("no route from %s to %s", current, target)
		}
		key := fmt.Sprintf("%s-%d-%d-%d", runID, index, trip, time.Now().UnixNano())
		edgeIDs := make([]string, len(route))
		for i, edge := range route {
			edgeIDs[i] = edge.id
		}
		ack, err := w.request(ctx, protocol.TypeJourneyStart, protocol.JourneyStart{ClientEventID: key + "-start", ClientJourneyKey: key, MapID: bundle.MapID, MapRevision: bundle.MapRevision, PlannedRoute: domain.PlannedRoute{OriginNodeID: current, DestinationNodeID: target, PlannedEdgeIDs: edgeIDs}})
		if err != nil {
			return err
		}
		for edgeIndex, edge := range route {
			from, to := nodes[edge.from], nodes[edge.to]
			distance := math.Hypot(to.X-from.X, to.Y-from.Y)
			step := (18 + float64(index%17)) * interval.Seconds() / math.Max(distance, 1)
			progress := 0.0
			if trip == 0 && edgeIndex == 0 {
				progress = float64(index%19) / 20
			}
			for {
				_, err := w.request(ctx, protocol.TypeLocationUpdate, protocol.LocationUpdate{Position: domain.Position{BuildingID: bundle.MapID, FloorID: floor.FloorID, FromNodeID: edge.from, ToNodeID: edge.to, EdgeProgress: progress, Heading: math.Mod(math.Atan2(to.X-from.X, from.Y-to.Y)*180/math.Pi+360, 360), MovementState: "walking"}})
				if err != nil {
					return err
				}
				if progress >= 1 {
					break
				}
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-ticker.C:
				}
				progress = math.Min(1, progress+step)
			}
		}
		outcome := domain.JourneyArrived
		if (index+trip)%8 == 0 {
			outcome = domain.JourneyCancelled
		}
		if _, err := w.request(ctx, protocol.TypeJourneyEnd, protocol.JourneyEnd{ClientEventID: key + "-end", ClientJourneyKey: key, JourneyID: ack.JourneyID, Outcome: outcome}); err != nil {
			return err
		}
		current = target
	}
	return ctx.Err()
}

func (w *walker) request(ctx context.Context, kind string, payload any) (protocol.Acknowledgement, error) {
	w.seq++
	id := fmt.Sprintf("request-%d", w.seq)
	data, err := protocol.Encode(kind, id, w.seq, time.Now(), payload)
	if err != nil {
		return protocol.Acknowledgement{}, err
	}
	requestCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	if err := w.conn.Write(requestCtx, websocket.MessageText, data); err != nil {
		return protocol.Acknowledgement{}, err
	}
	for {
		_, data, err := w.conn.Read(requestCtx)
		if err != nil {
			return protocol.Acknowledgement{}, err
		}
		var envelope protocol.Envelope
		if err := json.Unmarshal(data, &envelope); err != nil {
			return protocol.Acknowledgement{}, err
		}
		if envelope.RequestID != id {
			continue
		}
		if envelope.Type == protocol.TypeError {
			return protocol.Acknowledgement{}, fmt.Errorf("%s: %s", kind, envelope.Payload)
		}
		if envelope.Type == protocol.TypeAck {
			var ack protocol.Acknowledgement
			err := json.Unmarshal(envelope.Payload, &ack)
			return ack, err
		}
	}
}

func findRoute(edges []mapgraph.Edge, origin, destination string) []hop {
	queue := []string{origin}
	seen := map[string]bool{origin: true}
	parent := map[string]hop{}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		if current == destination {
			break
		}
		for _, edge := range edges {
			to := ""
			if edge.FromNodeID == current {
				to = edge.ToNodeID
			} else if edge.Bidirectional && edge.ToNodeID == current {
				to = edge.FromNodeID
			}
			if to == "" || seen[to] {
				continue
			}
			seen[to] = true
			parent[to] = hop{current, to, edge.EdgeID}
			queue = append(queue, to)
		}
	}
	if !seen[destination] {
		return nil
	}
	route := []hop{}
	for node := destination; node != origin; {
		edge := parent[node]
		route = append([]hop{edge}, route...)
		node = edge.from
	}
	return route
}
