package application

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

var ErrLiveFloorManagerClosed = errors.New("live floor projection manager is closed")

type LiveFloorOptions struct {
	MovementCoalesceInterval time.Duration
	MembershipDebounce       time.Duration
	SubscriberQueueSize      int
	SnapshotTimeout          time.Duration
}

type LiveFloorObserver interface {
	FloorProjectionOpened()
	FloorProjectionClosed()
	FloorProjectionSubscriberAdded()
	FloorProjectionSubscriberRemoved()
	FloorEventReceived(eventType string)
	FloorSnapshotRefreshed(reason, outcome string, duration time.Duration)
	FloorMovementHandled(outcome string)
}

type noopLiveFloorObserver struct{}

func (noopLiveFloorObserver) FloorProjectionOpened()                               {}
func (noopLiveFloorObserver) FloorProjectionClosed()                               {}
func (noopLiveFloorObserver) FloorProjectionSubscriberAdded()                      {}
func (noopLiveFloorObserver) FloorProjectionSubscriberRemoved()                    {}
func (noopLiveFloorObserver) FloorEventReceived(string)                            {}
func (noopLiveFloorObserver) FloorSnapshotRefreshed(string, string, time.Duration) {}
func (noopLiveFloorObserver) FloorMovementHandled(string)                          {}

type floorSnapshotProvider interface {
	Snapshot(context.Context, string, string) (domain.FloorSnapshot, error)
}

type floorProjectionEntry struct {
	ready      chan struct{}
	projection *liveFloorProjection
	err        error
	refs       int
}

type LiveFloorProjectionManager struct {
	broker    ports.RealtimeBroker
	snapshots floorSnapshotProvider
	observer  LiveFloorObserver
	options   LiveFloorOptions
	ctx       context.Context
	cancel    context.CancelFunc

	mu          sync.Mutex
	projections map[string]*floorProjectionEntry
	closed      bool
}

func NewLiveFloorProjectionManager(
	broker ports.RealtimeBroker,
	snapshots floorSnapshotProvider,
	observer LiveFloorObserver,
	options LiveFloorOptions,
) *LiveFloorProjectionManager {
	if observer == nil {
		observer = noopLiveFloorObserver{}
	}
	if options.MovementCoalesceInterval <= 0 {
		options.MovementCoalesceInterval = 200 * time.Millisecond
	}
	if options.MembershipDebounce <= 0 {
		options.MembershipDebounce = 50 * time.Millisecond
	}
	if options.SubscriberQueueSize <= 0 {
		options.SubscriberQueueSize = 64
	}
	if options.SnapshotTimeout <= 0 {
		options.SnapshotTimeout = 2 * time.Second
	}
	ctx, cancel := context.WithCancel(context.Background())
	return &LiveFloorProjectionManager{
		broker: broker, snapshots: snapshots, observer: observer, options: options,
		ctx: ctx, cancel: cancel, projections: make(map[string]*floorProjectionEntry),
	}
}

func (m *LiveFloorProjectionManager) Subscribe(
	ctx context.Context,
	buildingID string,
	floorID string,
) (domain.FloorSnapshot, LiveFloorSubscription, error) {
	key := buildingID + "\x00" + floorID
	entry, creator, err := m.loadOrCreateEntry(key)
	if err != nil {
		return domain.FloorSnapshot{}, nil, err
	}
	if creator {
		m.initializeEntry(key, buildingID, floorID, entry)
	}
	select {
	case <-entry.ready:
	case <-ctx.Done():
		return domain.FloorSnapshot{}, nil, ctx.Err()
	case <-m.ctx.Done():
		return domain.FloorSnapshot{}, nil, ErrLiveFloorManagerClosed
	}
	if entry.err != nil {
		return domain.FloorSnapshot{}, nil, entry.err
	}

	m.mu.Lock()
	if m.closed || m.projections[key] != entry {
		m.mu.Unlock()
		return domain.FloorSnapshot{}, nil, ErrLiveFloorManagerClosed
	}
	entry.refs++
	snapshot, id, updates := entry.projection.addSubscriber(m.options.SubscriberQueueSize)
	m.mu.Unlock()
	m.observer.FloorProjectionSubscriberAdded()
	return snapshot, &liveFloorSubscription{
		manager: m, entry: entry, id: id, updates: updates,
	}, nil
}

func (m *LiveFloorProjectionManager) Close() {
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return
	}
	m.closed = true
	entries := make([]*floorProjectionEntry, 0, len(m.projections))
	for _, entry := range m.projections {
		entries = append(entries, entry)
	}
	m.projections = make(map[string]*floorProjectionEntry)
	m.mu.Unlock()
	m.cancel()
	for _, entry := range entries {
		<-entry.ready
		if entry.projection != nil {
			entry.projection.stop()
		}
	}
}

func (m *LiveFloorProjectionManager) loadOrCreateEntry(key string) (*floorProjectionEntry, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return nil, false, ErrLiveFloorManagerClosed
	}
	if entry := m.projections[key]; entry != nil {
		return entry, false, nil
	}
	entry := &floorProjectionEntry{ready: make(chan struct{})}
	m.projections[key] = entry
	return entry, true, nil
}

func (m *LiveFloorProjectionManager) initializeEntry(
	key string,
	buildingID string,
	floorID string,
	entry *floorProjectionEntry,
) {
	startedAt := time.Now()
	raw := m.broker.Subscribe(buildingID, floorID)
	ctx, cancel := context.WithTimeout(m.ctx, m.options.SnapshotTimeout)
	snapshot, err := m.snapshots.Snapshot(ctx, buildingID, floorID)
	cancel()
	m.observer.FloorSnapshotRefreshed("initial", outcome(err), time.Since(startedAt))
	if err == nil {
		entry.projection = newLiveFloorProjection(
			m.ctx, key, buildingID, floorID, snapshot, raw, m.snapshots,
			m.observer, m.options, m.dropSubscriber,
		)
		entry.projection.entry = entry
		m.observer.FloorProjectionOpened()
	} else {
		raw.Close()
		entry.err = err
		m.mu.Lock()
		if m.projections[key] == entry {
			delete(m.projections, key)
		}
		m.mu.Unlock()
	}
	close(entry.ready)
}

func (m *LiveFloorProjectionManager) unsubscribe(entry *floorProjectionEntry, id uint64) {
	m.mu.Lock()
	if entry.projection == nil || !entry.projection.removeSubscriber(id) {
		m.mu.Unlock()
		return
	}
	entry.refs--
	shouldStop := entry.refs == 0
	if shouldStop {
		if m.projections[entry.projection.key] == entry {
			delete(m.projections, entry.projection.key)
		}
	}
	m.mu.Unlock()
	m.observer.FloorProjectionSubscriberRemoved()
	if shouldStop {
		entry.projection.stop()
		m.observer.FloorProjectionClosed()
	}
}

func (m *LiveFloorProjectionManager) dropSubscriber(entry *floorProjectionEntry, id uint64) {
	m.unsubscribe(entry, id)
}

func outcome(err error) string {
	if err != nil {
		return "failed"
	}
	return "success"
}
