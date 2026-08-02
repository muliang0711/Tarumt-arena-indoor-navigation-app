package application

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

func TestLiveFloorManagerSharesProjectionAndInitialSnapshot(t *testing.T) {
	t.Parallel()
	broker := newProjectionTestBroker()
	snapshots := &projectionTestSnapshots{snapshot: projectionSnapshot("representative", 1)}
	manager := newProjectionTestManager(broker, snapshots)
	t.Cleanup(manager.Close)

	firstSnapshot, first, err := manager.Subscribe(context.Background(), "main", "2")
	if err != nil {
		t.Fatalf("subscribe first: %v", err)
	}
	t.Cleanup(first.Close)
	secondSnapshot, second, err := manager.Subscribe(context.Background(), "main", "2")
	if err != nil {
		t.Fatalf("subscribe second: %v", err)
	}
	t.Cleanup(second.Close)

	if firstSnapshot.TotalActiveUsers != 1 || secondSnapshot.TotalActiveUsers != 1 {
		t.Fatalf("unexpected snapshots: first=%+v second=%+v", firstSnapshot, secondSnapshot)
	}
	if calls := snapshots.Calls(); calls != 1 {
		t.Fatalf("snapshot calls = %d, want 1", calls)
	}
	if subscriptions := broker.SubscriptionCount(); subscriptions != 1 {
		t.Fatalf("raw subscriptions = %d, want 1", subscriptions)
	}
}

func TestLiveFloorProjectionIgnoresNonRepresentativeMovementWithoutSnapshot(t *testing.T) {
	t.Parallel()
	broker := newProjectionTestBroker()
	snapshots := &projectionTestSnapshots{snapshot: projectionSnapshot("representative", 1)}
	manager := newProjectionTestManager(broker, snapshots)
	t.Cleanup(manager.Close)
	_, subscription, err := manager.Subscribe(context.Background(), "main", "2")
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	t.Cleanup(subscription.Close)

	broker.Send(domain.Event{
		Type: domain.EventPresenceUpdated, BuildingID: "main", FloorID: "2",
		SessionID: "not-visible", Presence: projectionPresence("not-visible", 2),
	})
	assertNoLiveFloorUpdate(t, subscription.Updates(), 60*time.Millisecond)
	if calls := snapshots.Calls(); calls != 1 {
		t.Fatalf("snapshot calls = %d, want initial call only", calls)
	}
}

func TestLiveFloorProjectionCoalescesRepresentativeMovementLatestWins(t *testing.T) {
	t.Parallel()
	broker := newProjectionTestBroker()
	snapshots := &projectionTestSnapshots{snapshot: projectionSnapshot("representative", 1)}
	manager := newProjectionTestManager(broker, snapshots)
	t.Cleanup(manager.Close)
	_, subscription, err := manager.Subscribe(context.Background(), "main", "2")
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	t.Cleanup(subscription.Close)

	for sequence := uint64(2); sequence <= 4; sequence++ {
		broker.Send(domain.Event{
			Type: domain.EventPresenceUpdated, BuildingID: "main", FloorID: "2",
			SessionID: "representative", Presence: projectionPresence("representative", sequence),
		})
	}
	update := awaitLiveFloorUpdate(t, subscription.Updates())
	if update.Type != LiveFloorPresenceUpdate || update.Presence == nil {
		t.Fatalf("unexpected update: %+v", update)
	}
	if update.Presence.Sequence != 4 {
		t.Fatalf("sequence = %d, want latest sequence 4", update.Presence.Sequence)
	}
	assertNoLiveFloorUpdate(t, subscription.Updates(), 60*time.Millisecond)
	if calls := snapshots.Calls(); calls != 1 {
		t.Fatalf("movement caused snapshot calls = %d, want 1", calls)
	}
}

func TestLiveFloorProjectionDebouncesMembershipEventsIntoOneSnapshot(t *testing.T) {
	t.Parallel()
	broker := newProjectionTestBroker()
	snapshots := &projectionTestSnapshots{snapshot: projectionSnapshot("representative", 1)}
	manager := newProjectionTestManager(broker, snapshots)
	t.Cleanup(manager.Close)
	_, subscription, err := manager.Subscribe(context.Background(), "main", "2")
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	t.Cleanup(subscription.Close)

	snapshots.Set(projectionSnapshot("new-representative", 2))
	broker.Send(domain.Event{Type: domain.EventPresenceJoined, BuildingID: "main", FloorID: "2"})
	broker.Send(domain.Event{Type: domain.EventOccupancyUpdated, BuildingID: "main", FloorID: "2"})

	update := awaitLiveFloorUpdate(t, subscription.Updates())
	if update.Type != LiveFloorSnapshotUpdate || update.Snapshot == nil {
		t.Fatalf("unexpected update: %+v", update)
	}
	if update.Snapshot.TotalActiveUsers != 2 || update.Snapshot.Representatives[0].SessionID != "new-representative" {
		t.Fatalf("unexpected refreshed snapshot: %+v", *update.Snapshot)
	}
	if calls := snapshots.Calls(); calls != 2 {
		t.Fatalf("snapshot calls = %d, want initial + one debounced refresh", calls)
	}
}

func TestLiveFloorProjectionResyncRefreshesAuthoritativeSnapshot(t *testing.T) {
	t.Parallel()
	broker := newProjectionTestBroker()
	snapshots := &projectionTestSnapshots{snapshot: projectionSnapshot("representative", 1)}
	manager := newProjectionTestManager(broker, snapshots)
	t.Cleanup(manager.Close)
	_, subscription, err := manager.Subscribe(context.Background(), "main", "2")
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	t.Cleanup(subscription.Close)

	snapshots.Set(projectionSnapshot("replacement", 3))
	broker.Send(domain.Event{Type: domain.EventResyncRequired, BuildingID: "main", FloorID: "2"})
	update := awaitLiveFloorUpdate(t, subscription.Updates())
	if update.Type != LiveFloorSnapshotUpdate || update.Snapshot == nil {
		t.Fatalf("unexpected resync update: %+v", update)
	}
	if update.Snapshot.TotalActiveUsers != 3 || update.Snapshot.Representatives[0].SessionID != "replacement" {
		t.Fatalf("unexpected resync snapshot: %+v", *update.Snapshot)
	}
	if calls := snapshots.Calls(); calls != 2 {
		t.Fatalf("snapshot calls = %d, want initial + resync", calls)
	}
}

func TestLiveFloorProjectionKeepsCachedRepresentativePositionCurrent(t *testing.T) {
	t.Parallel()
	broker := newProjectionTestBroker()
	snapshots := &projectionTestSnapshots{snapshot: projectionSnapshot("representative", 1)}
	manager := newProjectionTestManager(broker, snapshots)
	t.Cleanup(manager.Close)
	_, first, err := manager.Subscribe(context.Background(), "main", "2")
	if err != nil {
		t.Fatalf("subscribe first: %v", err)
	}
	t.Cleanup(first.Close)

	broker.Send(domain.Event{
		Type: domain.EventPresenceUpdated, BuildingID: "main", FloorID: "2",
		SessionID: "representative", Presence: projectionPresence("representative", 7),
	})
	_ = awaitLiveFloorUpdate(t, first.Updates())

	snapshot, second, err := manager.Subscribe(context.Background(), "main", "2")
	if err != nil {
		t.Fatalf("subscribe second: %v", err)
	}
	t.Cleanup(second.Close)
	if snapshot.Representatives[0].Sequence != 7 {
		t.Fatalf("cached representative sequence = %d, want 7", snapshot.Representatives[0].Sequence)
	}
	if calls := snapshots.Calls(); calls != 1 {
		t.Fatalf("new subscriber caused snapshot calls = %d, want 1", calls)
	}
}

func TestLiveFloorProjectionAppliesEdgeTransitionWithoutFetchingSnapshot(t *testing.T) {
	t.Parallel()
	broker := newProjectionTestBroker()
	initial := projectionSnapshot("representative", 2)
	initial.EdgeOccupancies = []domain.EdgeOccupancy{
		{FromNodeID: "a", ToNodeID: "b", ActiveUsers: 2},
	}
	snapshots := &projectionTestSnapshots{snapshot: initial}
	manager := newProjectionTestManager(broker, snapshots)
	t.Cleanup(manager.Close)
	_, subscription, err := manager.Subscribe(context.Background(), "main", "2")
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	t.Cleanup(subscription.Close)

	broker.Send(domain.Event{
		Type: domain.EventEdgeOccupancyChanged, BuildingID: "main", FloorID: "2",
		EdgeChanges: []domain.EdgeOccupancyChange{
			{FromNodeID: "a", ToNodeID: "b", Delta: -1},
			{FromNodeID: "b", ToNodeID: "c", Delta: 1},
		},
	})

	update := awaitLiveFloorUpdate(t, subscription.Updates())
	if update.Type != LiveFloorEdgeOccupancyUpdate || len(update.EdgeOccupancies) != 2 {
		t.Fatalf("unexpected edge update: %+v", update)
	}
	if update.EdgeOccupancies[0].ActiveUsers != 1 ||
		update.EdgeOccupancies[1].ActiveUsers != 1 {
		t.Fatalf("unexpected changed edge counts: %+v", update.EdgeOccupancies)
	}
	if calls := snapshots.Calls(); calls != 1 {
		t.Fatalf("edge transition caused snapshot calls = %d, want initial call only", calls)
	}
}

func newProjectionTestManager(broker ports.RealtimeBroker, snapshots floorSnapshotProvider) *LiveFloorProjectionManager {
	return NewLiveFloorProjectionManager(broker, snapshots, nil, LiveFloorOptions{
		MovementCoalesceInterval: 20 * time.Millisecond,
		MembershipDebounce:       20 * time.Millisecond,
		SubscriberQueueSize:      8,
		SnapshotTimeout:          time.Second,
	})
}

type projectionTestBroker struct {
	mu            sync.Mutex
	subscriptions []*projectionTestRawSubscription
}

func newProjectionTestBroker() *projectionTestBroker {
	return &projectionTestBroker{}
}

func (b *projectionTestBroker) Publish(context.Context, domain.Event) error {
	return nil
}

func (b *projectionTestBroker) Subscribe(string, string) ports.Subscription {
	b.mu.Lock()
	defer b.mu.Unlock()
	subscription := &projectionTestRawSubscription{events: make(chan domain.Event, 32)}
	b.subscriptions = append(b.subscriptions, subscription)
	return subscription
}

func (b *projectionTestBroker) Send(event domain.Event) {
	b.mu.Lock()
	subscriptions := append([]*projectionTestRawSubscription(nil), b.subscriptions...)
	b.mu.Unlock()
	for _, subscription := range subscriptions {
		subscription.events <- event
	}
}

func (b *projectionTestBroker) SubscriptionCount() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.subscriptions)
}

type projectionTestRawSubscription struct {
	events chan domain.Event
	once   sync.Once
}

func (s *projectionTestRawSubscription) Events() <-chan domain.Event {
	return s.events
}

func (s *projectionTestRawSubscription) Close() {
	s.once.Do(func() {
		close(s.events)
	})
}

type projectionTestSnapshots struct {
	mu       sync.Mutex
	snapshot domain.FloorSnapshot
	calls    int
}

func (s *projectionTestSnapshots) Snapshot(context.Context, string, string) (domain.FloorSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls++
	return cloneSnapshot(s.snapshot), nil
}

func (s *projectionTestSnapshots) Set(snapshot domain.FloorSnapshot) {
	s.mu.Lock()
	s.snapshot = snapshot
	s.mu.Unlock()
}

func (s *projectionTestSnapshots) Calls() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.calls
}

func projectionSnapshot(representative string, total int) domain.FloorSnapshot {
	return domain.FloorSnapshot{
		TotalActiveUsers: total, BuildingActiveUsers: total,
		BuildingID: "main", FloorID: "2",
		FloorCounts:     []domain.FloorCount{{FloorID: "2", Count: total}},
		Representatives: []domain.Presence{*projectionPresence(representative, 1)},
		GeneratedAt:     "2026-07-23T00:00:00Z",
	}
}

func projectionPresence(sessionID string, sequence uint64) *domain.Presence {
	return &domain.Presence{
		SessionID: sessionID, Sequence: sequence, LastSeenAt: time.Now().UTC(),
		Position: domain.Position{
			BuildingID: "main", FloorID: "2", FromNodeID: "a", ToNodeID: "b",
			EdgeProgress: float64(sequence) / 10, Heading: 90, MovementState: "walking",
		},
	}
}

func awaitLiveFloorUpdate(t *testing.T, updates <-chan LiveFloorUpdate) LiveFloorUpdate {
	t.Helper()
	select {
	case update, ok := <-updates:
		if !ok {
			t.Fatal("subscription closed before update")
		}
		return update
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for live floor update")
		return LiveFloorUpdate{}
	}
}

func assertNoLiveFloorUpdate(t *testing.T, updates <-chan LiveFloorUpdate, duration time.Duration) {
	t.Helper()
	select {
	case update, ok := <-updates:
		if ok {
			t.Fatalf("unexpected update: %+v", update)
		}
		t.Fatal("subscription unexpectedly closed")
	case <-time.After(duration):
	}
}
