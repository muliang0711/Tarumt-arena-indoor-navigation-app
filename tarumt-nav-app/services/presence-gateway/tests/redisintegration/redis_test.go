package redisintegration_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application"
	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/auth"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/identity"
	redisinfra "github.com/campus-navigator/presence-gateway/internal/infrastructure/redis"
	timeinfra "github.com/campus-navigator/presence-gateway/internal/infrastructure/time"
	redis "github.com/redis/go-redis/v9"
)

func TestRedisStoresAreSharedAndAtomic(t *testing.T) {
	ctx := context.Background()
	clientA, keys := newRedisTestClient(t)
	clientB, err := redisinfra.NewClient(testClientOptions(t))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = clientB.Close() })
	sessionsA := redisinfra.NewSessionStore(clientA, keys)
	sessionsB := redisinfra.NewSessionStore(clientB, keys)
	presencesA := redisinfra.NewPresenceStore(clientA, keys, 3*time.Minute)
	presencesB := redisinfra.NewPresenceStore(clientB, keys, 3*time.Minute)
	occupancyB := redisinfra.NewOccupancyStore(clientB, keys)

	now := time.Now().UTC()
	session := domain.Session{
		ID: "shared-session", DeviceRef: "private-reference", DisplayName: "Mei Ling",
		CreatedAt: now, LastSeenAt: now, ExpiresAt: now.Add(time.Hour),
	}
	if err := sessionsA.Put(ctx, session); err != nil {
		t.Fatal(err)
	}
	if loaded, err := sessionsB.Get(ctx, session.ID); err != nil || loaded.DeviceRef != session.DeviceRef || loaded.DisplayName != session.DisplayName {
		t.Fatalf("shared session = %+v, %v", loaded, err)
	}

	position := domain.Position{
		BuildingID: "main", FloorID: "2", FromNodeID: "n1", ToNodeID: "n2",
		EdgeProgress: 0.2, Heading: 90, MovementState: "walking",
	}
	first := domain.Presence{SessionID: session.ID, DisplayName: session.DisplayName, Position: position, Sequence: 1, LastSeenAt: now}
	firstMutation := trajectoryMutation(first)
	if _, err := presencesA.Apply(ctx, firstMutation); err != nil {
		t.Fatal(err)
	}
	if _, err := presencesB.Apply(ctx, firstMutation); !errors.Is(err, domain.ErrStaleSequence) {
		t.Fatalf("duplicate sequence error = %v, want ErrStaleSequence", err)
	}
	if length := clientA.XLen(ctx, keys.TrajectoryStream()).Val(); length != 1 {
		t.Fatalf("trajectory stream length after duplicate = %d, want 1", length)
	}
	position.FloorID = "3"
	second := domain.Presence{SessionID: session.ID, Position: position, Sequence: 2, LastSeenAt: now.Add(time.Second)}
	mutation, err := presencesB.Apply(ctx, trajectoryMutation(second))
	if err != nil {
		t.Fatal(err)
	}
	if mutation.Previous == nil || mutation.Previous.Position.FloorID != "2" {
		t.Fatalf("atomic mutation previous = %+v", mutation.Previous)
	}
	if mutation.Accepted.JourneyID != firstMutation.Presence.JourneyID || mutation.Trajectory.JourneyID != firstMutation.Presence.JourneyID {
		t.Fatalf("journey changed during active presence: %+v", mutation)
	}
	if length := clientA.XLen(ctx, keys.TrajectoryStream()).Val(); length != 2 {
		t.Fatalf("trajectory stream length after second update = %d, want 2", length)
	}
	streamEntries, err := clientA.XRangeN(ctx, keys.TrajectoryStream(), "-", "+", 2).Result()
	if err != nil {
		t.Fatal(err)
	}
	if len(streamEntries) != 2 {
		t.Fatalf("trajectory stream entries = %d, want 2", len(streamEntries))
	}
	for _, entry := range streamEntries {
		if fmt.Sprint(entry.Values["schema_version"]) != "1" {
			t.Fatalf("trajectory schema version = %v", entry.Values["schema_version"])
		}
		payload, ok := entry.Values["payload"].(string)
		if !ok {
			t.Fatalf("trajectory payload type = %T", entry.Values["payload"])
		}
		var event domain.TrajectoryEvent
		if err := json.Unmarshal([]byte(payload), &event); err != nil {
			t.Fatal(err)
		}
		if event.JourneyID != firstMutation.Presence.JourneyID || event.EventID == "" {
			t.Fatalf("unexpected durable trajectory event: %+v", event)
		}
		var raw map[string]any
		if err := json.Unmarshal([]byte(payload), &raw); err != nil {
			t.Fatal(err)
		}
		if _, exists := raw["session_id"]; exists {
			t.Fatalf("durable trajectory leaked session identity: %s", payload)
		}
	}
	var group sync.WaitGroup
	for sequence := uint64(3); sequence <= 32; sequence++ {
		group.Add(1)
		go func(sequence uint64) {
			defer group.Done()
			candidate := second
			candidate.Sequence = sequence
			candidate.LastSeenAt = now.Add(time.Duration(sequence) * time.Millisecond)
			_, _ = presencesA.Apply(ctx, trajectoryMutation(candidate))
		}(sequence)
	}
	group.Wait()
	latest, err := presencesB.Get(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if latest.Sequence != 32 {
		t.Fatalf("atomic concurrent sequence = %d, want 32", latest.Sequence)
	}

	for index := 0; index < 15; index++ {
		id := fmt.Sprintf("representative-%02d", index)
		candidateSession := domain.Session{
			ID: id, DeviceRef: "private-" + id, CreatedAt: now,
			LastSeenAt: now, ExpiresAt: now.Add(time.Hour),
		}
		if err := sessionsA.Put(ctx, candidateSession); err != nil {
			t.Fatal(err)
		}
		candidate := second
		candidate.SessionID = id
		candidate.Sequence = 1
		candidate.LastSeenAt = now
		if _, err := presencesA.Apply(ctx, trajectoryMutation(candidate)); err != nil {
			t.Fatal(err)
		}
	}
	snapshot, err := occupancyB.Snapshot(ctx, applicationQuery("main", "3", now.Add(-time.Minute), now.Add(time.Second)))
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.TotalActiveUsers != 16 || snapshot.BuildingActiveUsers != 16 || len(snapshot.Representatives) != 10 {
		t.Fatalf("unexpected Redis snapshot: %+v", snapshot)
	}
	if len(snapshot.EdgeOccupancies) != 1 ||
		snapshot.EdgeOccupancies[0].FromNodeID != "n1" ||
		snapshot.EdgeOccupancies[0].ToNodeID != "n2" ||
		snapshot.EdgeOccupancies[0].ActiveUsers != 16 {
		t.Fatalf("unexpected Redis edge occupancy: %+v", snapshot.EdgeOccupancies)
	}
	for _, count := range snapshot.FloorCounts {
		if count.FloorID == "2" && count.Count != 0 {
			t.Fatalf("old floor retained user after atomic move: %+v", snapshot.FloorCounts)
		}
	}

	moved := second
	moved.SessionID = "representative-00"
	moved.Sequence = 2
	moved.Position.FromNodeID = "n2"
	moved.Position.ToNodeID = "n3"
	moved.LastSeenAt = now.Add(2 * time.Second)
	if _, err := presencesA.Apply(ctx, trajectoryMutation(moved)); err != nil {
		t.Fatal(err)
	}
	if _, err := presencesB.Remove(ctx, moved.SessionID); err != nil {
		t.Fatal(err)
	}
	snapshot, err = occupancyB.Snapshot(ctx, applicationQuery("main", "3", now.Add(-time.Minute), now.Add(3*time.Second)))
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.EdgeOccupancies) != 1 || snapshot.EdgeOccupancies[0].ActiveUsers != 15 {
		t.Fatalf("edge move/remove left a ghost count: %+v", snapshot.EdgeOccupancies)
	}
}

func TestRedisSessionUsesAbsoluteTTL(t *testing.T) {
	client, keys := newRedisTestClient(t)
	store := redisinfra.NewSessionStore(client, keys)
	now := time.Now().UTC()
	session := domain.Session{
		ID: "short-session", DeviceRef: "private", CreatedAt: now,
		LastSeenAt: now, ExpiresAt: now.Add(150 * time.Millisecond),
	}
	if err := store.Put(context.Background(), session); err != nil {
		t.Fatal(err)
	}
	time.Sleep(250 * time.Millisecond)
	if _, err := store.Get(context.Background(), session.ID); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expired Redis session error = %v, want ErrNotFound", err)
	}
}

func TestRedisJourneyLifecycleIsAtomicIdempotentAndPrivacySafe(t *testing.T) {
	ctx := context.Background()
	client, keys := newRedisTestClient(t)
	journeys := redisinfra.NewJourneyLifecycleStore(
		client,
		keys,
		redisinfra.JourneyLifecycleOptions{MaxLength: 1000},
	)
	presences := redisinfra.NewPresenceStore(client, keys, 3*time.Minute)
	now := time.Now().UTC().Truncate(time.Millisecond)
	first := journeyStartMutation(
		"device-private",
		"session-1",
		"client-event-1",
		"local-1",
		"journey-1",
		now,
	)
	started, err := journeys.Start(ctx, first)
	if err != nil {
		t.Fatal(err)
	}
	retried, err := journeys.Start(ctx, first)
	if err != nil {
		t.Fatal(err)
	}
	if !retried.Deduplicated ||
		retried.JourneyID != started.JourneyID ||
		client.XLen(ctx, keys.JourneyLifecycleStream()).Val() != 1 {
		t.Fatalf("start retry was not idempotent: %#v", retried)
	}

	firstPresence := domain.Presence{
		SessionID: "session-1", JourneyID: "journey-1",
		Position: domain.Position{
			BuildingID: "main-campus", FloorID: "floor-2",
			FromNodeID: "node-1", ToNodeID: "node-21",
			EdgeProgress: 0.2, Heading: 90, MovementState: "walking",
		},
		Sequence: 1, LastSeenAt: now.Add(time.Second),
	}
	firstPresenceMutation := trajectoryMutation(firstPresence)
	firstPresenceMutation.CanonicalJourney = true
	firstPresenceMutation.JourneyDeviceRef = "device-private"
	firstPresenceMutation.ReceivedAt = now.Add(time.Second)
	if _, err := presences.Apply(ctx, firstPresenceMutation); err != nil {
		t.Fatal(err)
	}
	if err := journeys.RecordPosition(
		ctx,
		"device-private",
		"journey-1",
		"session-1",
		now.Add(time.Second),
		now.Add(46*time.Second),
	); err != nil {
		t.Fatal(err)
	}

	second := journeyStartMutation(
		"device-private",
		"session-2",
		"client-event-2",
		"local-2",
		"journey-2",
		now.Add(2*time.Second),
	)
	superseding, err := journeys.Start(ctx, second)
	if err != nil {
		t.Fatal(err)
	}
	if superseding.RemovedPresence == nil ||
		superseding.RemovedPresence.SessionID != "session-1" {
		t.Fatalf("supersede did not atomically remove presence: %#v", superseding)
	}
	if _, err := presences.Get(ctx, "session-1"); !errors.Is(
		err,
		ports.ErrNotFound,
	) {
		t.Fatalf("superseded presence still exists: %v", err)
	}
	if client.XLen(ctx, keys.JourneyLifecycleStream()).Val() != 3 {
		t.Fatal("supersede did not append end and start in one operation")
	}

	secondPresence := firstPresence
	secondPresence.SessionID = "session-2"
	secondPresence.JourneyID = "journey-2"
	secondPresence.Sequence = 1
	secondPresence.LastSeenAt = now.Add(3 * time.Second)
	secondPresenceMutation := trajectoryMutation(secondPresence)
	secondPresenceMutation.CanonicalJourney = true
	secondPresenceMutation.JourneyDeviceRef = "device-private"
	secondPresenceMutation.ReceivedAt = now.Add(3 * time.Second)
	if _, err := presences.Apply(ctx, secondPresenceMutation); err != nil {
		t.Fatal(err)
	}
	if err := journeys.RecordPosition(
		ctx,
		"device-private",
		"journey-2",
		"session-2",
		now.Add(3*time.Second),
		now.Add(48*time.Second),
	); err != nil {
		t.Fatal(err)
	}
	ended, err := journeys.End(ctx, ports.EndJourneyMutation{
		DeviceRef: "device-private", ClientEventID: "client-event-3",
		JourneyID: "journey-2", ClientJourneyKey: "local-2",
		EventID: "ended-2", Outcome: domain.JourneyArrived,
		OccurredAt:              now.Add(4 * time.Second),
		IngestedAt:              now.Add(4 * time.Second),
		IdempotencyExpiresAt:    now.Add(24 * time.Hour),
		EndedTombstoneExpiresAt: now.Add(24 * time.Hour),
	})
	if err != nil {
		t.Fatal(err)
	}
	if ended.RemovedPresence == nil ||
		ended.LifecycleSequence != 2 ||
		ended.RouteRevision != 1 {
		t.Fatalf("unexpected atomic end: %#v", ended)
	}
	if _, err := journeys.Active(
		ctx,
		"device-private",
	); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("ended journey remained active: %v", err)
	}
	if err := journeys.RecordPosition(
		ctx,
		"device-private",
		"journey-2",
		"session-2",
		now.Add(5*time.Second),
		now.Add(50*time.Second),
	); !errors.Is(err, domain.ErrJourneyAlreadyEnded) {
		t.Fatalf("ended tombstone was not enforced: %v", err)
	}

	entries, err := client.XRange(
		ctx,
		keys.JourneyLifecycleStream(),
		"-",
		"+",
	).Result()
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 4 {
		t.Fatalf("lifecycle stream length = %d, want 4", len(entries))
	}
	for _, entry := range entries {
		payload := fmt.Sprint(entry.Values["payload"])
		var raw map[string]any
		if err := json.Unmarshal([]byte(payload), &raw); err != nil {
			t.Fatal(err)
		}
		if _, exists := raw["device_ref"]; exists {
			t.Fatalf("lifecycle event leaked device_ref: %s", payload)
		}
		if _, exists := raw["session_id"]; exists {
			t.Fatalf("lifecycle event leaked session_id: %s", payload)
		}
		var event domain.JourneyLifecycleEvent
		if err := json.Unmarshal([]byte(payload), &event); err != nil {
			t.Fatal(err)
		}
		if err := event.Validate(); err != nil {
			t.Fatalf("invalid lifecycle stream event: %v, %s", err, payload)
		}
	}
}

func TestRedisJourneyEndCannotRaceARealtimePositionBackIntoPresence(t *testing.T) {
	ctx := context.Background()
	client, keys := newRedisTestClient(t)
	journeys := redisinfra.NewJourneyLifecycleStore(
		client,
		keys,
		redisinfra.JourneyLifecycleOptions{MaxLength: 1000},
	)
	presences := redisinfra.NewPresenceStore(client, keys, 3*time.Minute)
	now := time.Now().UTC().Truncate(time.Millisecond)

	for index := 0; index < 25; index++ {
		deviceRef := fmt.Sprintf("race-device-%d", index)
		sessionID := fmt.Sprintf("race-session-%d", index)
		journeyID := fmt.Sprintf("race-journey-%d", index)
		clientKey := fmt.Sprintf("race-local-%d", index)
		if _, err := journeys.Start(ctx, journeyStartMutation(
			deviceRef,
			sessionID,
			fmt.Sprintf("race-start-%d", index),
			clientKey,
			journeyID,
			now,
		)); err != nil {
			t.Fatal(err)
		}
		presence := domain.Presence{
			SessionID: sessionID, JourneyID: journeyID,
			Position: domain.Position{
				BuildingID: "main-campus", FloorID: "floor-2",
				FromNodeID: "node-1", ToNodeID: "node-21",
				EdgeProgress: 0.3, Heading: 90, MovementState: "walking",
			},
			Sequence: 1, LastSeenAt: now,
		}
		mutation := trajectoryMutation(presence)
		mutation.CanonicalJourney = true
		mutation.JourneyDeviceRef = deviceRef
		mutation.ReceivedAt = now

		start := make(chan struct{})
		var group sync.WaitGroup
		group.Add(2)
		go func() {
			defer group.Done()
			<-start
			_, _ = presences.Apply(ctx, mutation)
		}()
		go func() {
			defer group.Done()
			<-start
			_, _ = journeys.End(ctx, ports.EndJourneyMutation{
				DeviceRef:     deviceRef,
				ClientEventID: fmt.Sprintf("race-end-%d", index),
				JourneyID:     journeyID, ClientJourneyKey: clientKey,
				EventID:    fmt.Sprintf("race-ended-event-%d", index),
				Outcome:    domain.JourneyCancelled,
				OccurredAt: now, IngestedAt: now,
				IdempotencyExpiresAt:    now.Add(24 * time.Hour),
				EndedTombstoneExpiresAt: now.Add(24 * time.Hour),
			})
		}()
		close(start)
		group.Wait()

		if _, err := presences.Get(ctx, sessionID); !errors.Is(
			err,
			ports.ErrNotFound,
		) {
			t.Fatalf(
				"iteration %d raced an ended journey back into presence: %v",
				index,
				err,
			)
		}
	}
}

func TestRedisJourneyExpiryUsesFirstPositionAndStalePositionDeadlines(t *testing.T) {
	ctx := context.Background()
	client, keys := newRedisTestClient(t)
	journeys := redisinfra.NewJourneyLifecycleStore(
		client,
		keys,
		redisinfra.JourneyLifecycleOptions{MaxLength: 1000},
	)
	now := time.Now().UTC().Truncate(time.Millisecond)
	if _, err := journeys.Start(ctx, journeyStartMutation(
		"expiry-device",
		"expiry-session",
		"expiry-start",
		"expiry-local",
		"expiry-journey",
		now,
	)); err != nil {
		t.Fatal(err)
	}
	request := ports.ExpireJourneyMutation{
		DeviceRef: "expiry-device", JourneyID: "expiry-journey",
		EventID: "expiry-event", FirstPositionTimeout: time.Minute,
		PositionStaleAfter:      45 * time.Second,
		EndedTombstoneExpiresAt: now.Add(24 * time.Hour),
	}
	candidates, err := journeys.ListExpiredDeviceRefs(
		ctx,
		now.Add(59*time.Second),
		100,
	)
	if err != nil || len(candidates) != 0 {
		t.Fatalf("first-position candidate appeared early: %v, %v", candidates, err)
	}
	candidates, err = journeys.ListExpiredDeviceRefs(
		ctx,
		now.Add(time.Minute),
		100,
	)
	if err != nil || len(candidates) != 1 ||
		candidates[0] != "expiry-device" {
		t.Fatalf("first-position candidate missing: %v, %v", candidates, err)
	}
	request.IngestedAt = now.Add(59 * time.Second)
	result, err := journeys.ExpireIfDue(ctx, request)
	if err != nil || result.Expired {
		t.Fatalf("expired before first-position deadline: %#v, %v", result, err)
	}
	request.IngestedAt = now.Add(time.Minute)
	result, err = journeys.ExpireIfDue(ctx, request)
	if err != nil || !result.Expired {
		t.Fatalf("did not expire at first-position deadline: %#v, %v", result, err)
	}

	secondStart := now.Add(2 * time.Minute)
	if _, err := journeys.Start(ctx, journeyStartMutation(
		"stale-device",
		"stale-session",
		"stale-start",
		"stale-local",
		"stale-journey",
		secondStart,
	)); err != nil {
		t.Fatal(err)
	}
	positionAt := secondStart.Add(10 * time.Second)
	if err := journeys.RecordPosition(
		ctx,
		"stale-device",
		"stale-journey",
		"stale-session",
		positionAt,
		positionAt.Add(45*time.Second),
	); err != nil {
		t.Fatal(err)
	}
	candidates, err = journeys.ListExpiredDeviceRefs(
		ctx,
		positionAt.Add(44*time.Second),
		100,
	)
	if err != nil || len(candidates) != 0 {
		t.Fatalf("stale-position candidate appeared early: %v, %v", candidates, err)
	}
	candidates, err = journeys.ListExpiredDeviceRefs(
		ctx,
		positionAt.Add(45*time.Second),
		100,
	)
	if err != nil || len(candidates) != 1 ||
		candidates[0] != "stale-device" {
		t.Fatalf("stale-position candidate missing: %v, %v", candidates, err)
	}
	staleRequest := ports.ExpireJourneyMutation{
		DeviceRef: "stale-device", JourneyID: "stale-journey",
		EventID:                 "stale-expiry-event",
		FirstPositionTimeout:    time.Minute,
		PositionStaleAfter:      45 * time.Second,
		EndedTombstoneExpiresAt: now.Add(24 * time.Hour),
		IngestedAt:              positionAt.Add(44 * time.Second),
	}
	result, err = journeys.ExpireIfDue(ctx, staleRequest)
	if err != nil || result.Expired {
		t.Fatalf("expired before stale-position deadline: %#v, %v", result, err)
	}
	staleRequest.IngestedAt = positionAt.Add(45 * time.Second)
	result, err = journeys.ExpireIfDue(ctx, staleRequest)
	if err != nil || !result.Expired {
		t.Fatalf("did not expire at stale-position deadline: %#v, %v", result, err)
	}
}

func journeyStartMutation(
	deviceRef,
	sessionID,
	clientEventID,
	clientJourneyKey,
	journeyID string,
	now time.Time,
) ports.StartJourneyMutation {
	return ports.StartJourneyMutation{
		DeviceRef: deviceRef, SessionID: sessionID,
		ClientEventID: clientEventID, ClientJourneyKey: clientJourneyKey,
		JourneyID:         journeyID,
		StartedEventID:    "started-" + journeyID,
		SupersededEventID: "superseded-" + journeyID,
		MapID:             "main-campus", MapRevision: "revision-1",
		Route: domain.PlannedRoute{
			OriginNodeID: "node-1", DestinationNodeID: "node-21",
			PlannedEdgeIDs: []string{"edge-node-1-node-21"},
		},
		OccurredAt: now, IngestedAt: now,
		IdempotencyExpiresAt:    now.Add(24 * time.Hour),
		EndedTombstoneExpiresAt: now.Add(24 * time.Hour),
		FirstPositionExpiresAt:  now.Add(time.Minute),
	}
}

func TestRedisBrokerCrossesGatewayInstancesAndIsolatesFloors(t *testing.T) {
	clientA, keys := newRedisTestClient(t)
	clientB, err := redisinfra.NewClient(testClientOptions(t))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = clientB.Close() })
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	brokerA := redisinfra.NewRealtimeBroker(clientA, keys, "gateway-a", 16, logger)
	brokerB := redisinfra.NewRealtimeBroker(clientB, keys, "gateway-b", 16, logger)
	t.Cleanup(func() { _ = brokerA.Close(); _ = brokerB.Close() })
	floorTwo := brokerB.Subscribe("main", "2")
	defer floorTwo.Close()
	floorTwoSecond := brokerB.Subscribe("main", "2")
	defer floorTwoSecond.Close()
	floorThree := brokerB.Subscribe("main", "3")
	defer floorThree.Close()
	numSub, err := clientA.PubSubNumSub(context.Background(), keys.FloorChannel("main", "2")).Result()
	if err != nil {
		t.Fatal(err)
	}
	if numSub[keys.FloorChannel("main", "2")] != 1 {
		t.Fatalf("Redis subscriptions for two local floor clients = %d, want 1", numSub[keys.FloorChannel("main", "2")])
	}
	event := domain.Event{
		Type: domain.EventPresenceUpdated, BuildingID: "main", FloorID: "2",
		SessionID: "actor", OccurredAt: time.Now().UTC(),
	}
	if err := brokerA.Publish(context.Background(), event); err != nil {
		t.Fatal(err)
	}
	select {
	case received := <-floorTwo.Events():
		if received.SessionID != event.SessionID {
			t.Fatalf("received event = %+v", received)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("cross-instance floor event was not received")
	}
	select {
	case event := <-floorThree.Events():
		t.Fatalf("floor 3 received floor 2 event: %+v", event)
	default:
	}
}

func TestRedisBrokerReconnectEmitsResync(t *testing.T) {
	client, keys := newRedisTestClient(t)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	broker := redisinfra.NewRealtimeBroker(client, keys, "gateway-reconnect", 16, logger)
	t.Cleanup(func() { _ = broker.Close() })
	subscription := broker.Subscribe("main", "2")
	defer subscription.Close()
	killed, err := client.ClientKillByFilter(context.Background(), "TYPE", "pubsub").Result()
	if err != nil {
		t.Fatal(err)
	}
	if killed < 1 {
		t.Fatal("Redis did not report a killed Pub/Sub connection")
	}
	select {
	case event := <-subscription.Events():
		if event.Type != domain.EventResyncRequired {
			t.Fatalf("event after Redis reconnect = %s, want resync_required", event.Type)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("Redis Pub/Sub reconnect did not trigger resynchronization")
	}
}

func TestApplicationServicesWorkAcrossRedisBackends(t *testing.T) {
	clientA, keys := newRedisTestClient(t)
	clientB, err := redisinfra.NewClient(testClientOptions(t))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = clientB.Close() })
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	clock := timeinfra.SystemClock{}
	brokerA := redisinfra.NewRealtimeBroker(clientA, keys, "gateway-a", 16, logger)
	brokerB := redisinfra.NewRealtimeBroker(clientB, keys, "gateway-b", 16, logger)
	t.Cleanup(func() { _ = brokerA.Close(); _ = brokerB.Close() })
	sessionsA := redisinfra.NewSessionStore(clientA, keys)
	sessionsB := redisinfra.NewSessionStore(clientB, keys)
	presencesA := redisinfra.NewPresenceStore(clientA, keys, 3*time.Minute)
	presencesB := redisinfra.NewPresenceStore(clientB, keys, 3*time.Minute)
	tokenService := auth.NewJWTTokenService("01234567890123456789012345678901", "redis-test")
	identityService := identity.NewAnonymousIdentity("abcdefghijklmnopqrstuvwxyz123456")
	sessionA := application.NewSessionService(sessionsA, tokenService, identityService, identity.UUIDGenerator{}, clock, time.Hour, 30*time.Minute)
	sessionB := application.NewSessionService(sessionsB, tokenService, identityService, identity.UUIDGenerator{}, clock, time.Hour, 30*time.Minute)
	created, err := sessionA.Create(context.Background(), "8f912e7e-918b-4455-9561-f4494c44ff75")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := sessionB.Authenticate(context.Background(), created.AccessToken); err != nil {
		t.Fatalf("gateway B could not authenticate gateway A session: %v", err)
	}
	sharedSession, err := sessionsB.Get(context.Background(), created.Session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if sharedSession.DeviceRef == "8f912e7e-918b-4455-9561-f4494c44ff75" {
		t.Fatal("raw installation ID was stored in Redis")
	}
	presenceA := application.NewPresenceService(presencesA, sessionsA, brokerA, clock, identity.UUIDGenerator{})
	presenceB := application.NewPresenceService(presencesB, sessionsB, brokerB, clock, identity.UUIDGenerator{})
	subscription := presenceB.Subscribe("main", "2")
	defer subscription.Close()
	position := domain.Position{
		BuildingID: "main", FloorID: "2", FromNodeID: "n1", ToNodeID: "n2",
		EdgeProgress: 0.4, Heading: 45, MovementState: "walking",
	}
	if _, err := presenceA.Update(context.Background(), created.Session.ID, 1, position); err != nil {
		t.Fatal(err)
	}
	select {
	case event := <-subscription.Events():
		if event.Type != domain.EventPresenceJoined {
			t.Fatalf("cross-gateway event type = %s", event.Type)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("gateway B did not receive gateway A application event")
	}
}

func applicationQuery(buildingID, floorID string, activeSince, generatedAt time.Time) ports.OccupancyQuery {
	return ports.OccupancyQuery{
		BuildingID: buildingID, FloorID: floorID, ActiveSince: activeSince,
		GeneratedAt: generatedAt, RepresentativeLimit: 10,
	}
}

func trajectoryMutation(presence domain.Presence) ports.PresenceMutationRequest {
	journeyID := presence.JourneyID
	if journeyID == "" {
		journeyID = "journey-" + presence.SessionID
		presence.JourneyID = journeyID
	}
	position := presence.Position.Normalized()
	return ports.PresenceMutationRequest{
		Presence: presence,
		Trajectory: domain.TrajectoryEvent{
			EventID:       fmt.Sprintf("event-%s-%d", presence.SessionID, presence.Sequence),
			JourneyID:     journeyID,
			BuildingID:    position.BuildingID,
			FloorID:       position.FloorID,
			FromNodeID:    position.FromNodeID,
			ToNodeID:      position.ToNodeID,
			EdgeProgress:  position.EdgeProgress,
			Heading:       position.Heading,
			MovementState: position.MovementState,
			ObservedAt:    presence.LastSeenAt,
			IngestedAt:    presence.LastSeenAt,
		},
	}
}

func newRedisTestClient(t *testing.T) (*redis.Client, redisinfra.Keyspace) {
	t.Helper()
	client, err := redisinfra.NewClient(testClientOptions(t))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		t.Fatalf("Redis test server is unavailable: %v", err)
	}
	id, err := (identity.UUIDGenerator{}).NewID()
	if err != nil {
		t.Fatal(err)
	}
	keys := redisinfra.NewKeyspace("test:presence:" + id)
	t.Cleanup(func() {
		cleanupPrefix(context.Background(), client, keys.Prefix()+":*")
		_ = client.Close()
	})
	return client, keys
}

func testClientOptions(t *testing.T) redisinfra.ClientOptions {
	t.Helper()
	url := os.Getenv("PRESENCE_REDIS_TEST_URL")
	if url == "" {
		t.Skip("PRESENCE_REDIS_TEST_URL is not set; run make redis-test")
	}
	return redisinfra.ClientOptions{
		URL: url, PoolSize: 10, MinIdleConnections: 1,
		DialTimeout: 2 * time.Second, ReadTimeout: 2 * time.Second,
		WriteTimeout: 2 * time.Second, MaxRetries: 1,
	}
}

func cleanupPrefix(ctx context.Context, client *redis.Client, pattern string) {
	var cursor uint64
	for {
		keys, next, err := client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return
		}
		if len(keys) > 0 {
			_ = client.Del(ctx, keys...).Err()
		}
		cursor = next
		if cursor == 0 {
			return
		}
	}
}
