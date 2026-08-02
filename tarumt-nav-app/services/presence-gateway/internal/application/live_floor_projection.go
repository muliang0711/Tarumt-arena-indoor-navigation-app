package application

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type liveFloorProjection struct {
	key        string
	buildingID string
	floorID    string
	snapshots  floorSnapshotProvider
	raw        ports.Subscription
	observer   LiveFloorObserver
	options    LiveFloorOptions
	ctx        context.Context
	cancel     context.CancelFunc
	onDrop     func(*floorProjectionEntry, uint64)
	entry      *floorProjectionEntry

	mu                 sync.RWMutex
	snapshot           domain.FloorSnapshot
	representatives    map[string]struct{}
	subscribers        map[uint64]chan LiveFloorUpdate
	nextSubscriberID   uint64
	pendingMovements   map[string]domain.Presence
	movementTimer      *time.Timer
	membershipTimer    *time.Timer
	membershipDirty    bool
	refreshInFlight    bool
	refreshAgain       bool
	refreshAgainReason string
	stopped            bool
	stopOnce           sync.Once
}

func newLiveFloorProjection(
	parent context.Context,
	key string,
	buildingID string,
	floorID string,
	snapshot domain.FloorSnapshot,
	raw ports.Subscription,
	snapshots floorSnapshotProvider,
	observer LiveFloorObserver,
	options LiveFloorOptions,
	onDrop func(*floorProjectionEntry, uint64),
) *liveFloorProjection {
	ctx, cancel := context.WithCancel(parent)
	projection := &liveFloorProjection{
		key: key, buildingID: buildingID, floorID: floorID,
		snapshots: snapshots, raw: raw, observer: observer, options: options,
		ctx: ctx, cancel: cancel, onDrop: onDrop,
		snapshot: snapshot, representatives: representativeSet(snapshot),
		subscribers:      make(map[uint64]chan LiveFloorUpdate),
		pendingMovements: make(map[string]domain.Presence),
	}
	go projection.run()
	return projection
}

func (p *liveFloorProjection) addSubscriber(queueSize int) (domain.FloorSnapshot, uint64, <-chan LiveFloorUpdate) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.nextSubscriberID++
	updates := make(chan LiveFloorUpdate, queueSize)
	p.subscribers[p.nextSubscriberID] = updates
	return cloneSnapshot(p.snapshot), p.nextSubscriberID, updates
}

func (p *liveFloorProjection) removeSubscriber(id uint64) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	updates, exists := p.subscribers[id]
	if !exists {
		return false
	}
	delete(p.subscribers, id)
	close(updates)
	return true
}

func (p *liveFloorProjection) stop() {
	p.stopOnce.Do(func() {
		p.cancel()
		p.raw.Close()
		p.mu.Lock()
		p.stopped = true
		if p.movementTimer != nil {
			p.movementTimer.Stop()
		}
		if p.membershipTimer != nil {
			p.membershipTimer.Stop()
		}
		for id, updates := range p.subscribers {
			delete(p.subscribers, id)
			close(updates)
		}
		p.mu.Unlock()
	})
}

func (p *liveFloorProjection) run() {
	for {
		select {
		case <-p.ctx.Done():
			return
		case event, ok := <-p.raw.Events():
			if !ok {
				return
			}
			p.observer.FloorEventReceived(string(event.Type))
			p.handleEvent(event)
		}
	}
}

func (p *liveFloorProjection) handleEvent(event domain.Event) {
	switch event.Type {
	case domain.EventPresenceUpdated:
		if event.Presence != nil {
			p.handleMovement(*event.Presence)
		}
	case domain.EventPresenceJoined, domain.EventPresenceLeft, domain.EventOccupancyUpdated:
		p.scheduleMembershipRefresh()
	case domain.EventEdgeOccupancyChanged:
		p.handleEdgeOccupancyChanges(event.EdgeChanges, event.OccurredAt)
	case domain.EventResyncRequired:
		p.requestRefresh("resync")
	}
}

func (p *liveFloorProjection) handleEdgeOccupancyChanges(changes []domain.EdgeOccupancyChange, occurredAt time.Time) {
	p.mu.Lock()
	if p.stopped || p.membershipDirty {
		p.mu.Unlock()
		return
	}
	counts := make(map[[2]string]int, len(p.snapshot.EdgeOccupancies))
	for _, occupancy := range p.snapshot.EdgeOccupancies {
		fromNodeID, toNodeID := domain.CanonicalEdge(occupancy.FromNodeID, occupancy.ToNodeID)
		counts[[2]string{fromNodeID, toNodeID}] = occupancy.ActiveUsers
	}
	changed := make([]domain.EdgeOccupancy, 0, len(changes))
	for _, change := range changes {
		fromNodeID, toNodeID := domain.CanonicalEdge(change.FromNodeID, change.ToNodeID)
		key := [2]string{fromNodeID, toNodeID}
		count := max(0, counts[key]+change.Delta)
		counts[key] = count
		changed = append(changed, domain.EdgeOccupancy{
			FromNodeID: fromNodeID, ToNodeID: toNodeID, ActiveUsers: count,
		})
	}
	p.snapshot.EdgeOccupancies = edgeOccupanciesFromCounts(counts)
	if !occurredAt.IsZero() {
		p.snapshot.GeneratedAt = occurredAt.UTC().Format(time.RFC3339Nano)
	}
	p.mu.Unlock()
	sort.Slice(changed, func(i, j int) bool {
		if changed[i].FromNodeID != changed[j].FromNodeID {
			return changed[i].FromNodeID < changed[j].FromNodeID
		}
		return changed[i].ToNodeID < changed[j].ToNodeID
	})
	p.broadcast(LiveFloorUpdate{
		Type:       LiveFloorEdgeOccupancyUpdate,
		BuildingID: p.buildingID, FloorID: p.floorID,
		EdgeOccupancies: changed,
	})
}

func edgeOccupanciesFromCounts(counts map[[2]string]int) []domain.EdgeOccupancy {
	result := make([]domain.EdgeOccupancy, 0, len(counts))
	for edge, count := range counts {
		if count > 0 {
			result = append(result, domain.EdgeOccupancy{
				FromNodeID: edge[0], ToNodeID: edge[1], ActiveUsers: count,
			})
		}
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].FromNodeID != result[j].FromNodeID {
			return result[i].FromNodeID < result[j].FromNodeID
		}
		return result[i].ToNodeID < result[j].ToNodeID
	})
	return result
}

func (p *liveFloorProjection) handleMovement(presence domain.Presence) {
	p.mu.Lock()
	if p.stopped || p.membershipDirty {
		p.mu.Unlock()
		p.observer.FloorMovementHandled("ignored_membership_dirty")
		return
	}
	if _, representative := p.representatives[presence.SessionID]; !representative {
		p.mu.Unlock()
		p.observer.FloorMovementHandled("ignored_non_representative")
		return
	}
	if _, exists := p.pendingMovements[presence.SessionID]; exists {
		p.observer.FloorMovementHandled("coalesced")
	}
	p.pendingMovements[presence.SessionID] = presence
	updateSnapshotPresence(&p.snapshot, presence)
	if p.movementTimer == nil {
		p.movementTimer = time.AfterFunc(p.options.MovementCoalesceInterval, p.flushMovements)
	}
	p.mu.Unlock()
}

func (p *liveFloorProjection) flushMovements() {
	p.mu.Lock()
	if p.stopped {
		p.mu.Unlock()
		return
	}
	p.movementTimer = nil
	ids := make([]string, 0, len(p.pendingMovements))
	for id := range p.pendingMovements {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	updates := make([]LiveFloorUpdate, 0, len(ids))
	for _, id := range ids {
		presence := p.pendingMovements[id]
		delete(p.pendingMovements, id)
		copyOfPresence := presence
		updates = append(updates, LiveFloorUpdate{
			Type: LiveFloorPresenceUpdate, Presence: &copyOfPresence,
		})
	}
	p.mu.Unlock()
	for _, update := range updates {
		p.observer.FloorMovementHandled("broadcast")
		p.broadcast(update)
	}
}

func (p *liveFloorProjection) scheduleMembershipRefresh() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.stopped {
		return
	}
	p.membershipDirty = true
	p.pendingMovements = make(map[string]domain.Presence)
	if p.movementTimer != nil {
		p.movementTimer.Stop()
		p.movementTimer = nil
	}
	if p.membershipTimer == nil {
		p.membershipTimer = time.AfterFunc(p.options.MembershipDebounce, func() {
			p.mu.Lock()
			p.membershipTimer = nil
			p.mu.Unlock()
			p.requestRefresh("membership")
		})
	}
}

func (p *liveFloorProjection) requestRefresh(reason string) {
	p.mu.Lock()
	if p.stopped {
		p.mu.Unlock()
		return
	}
	if reason == "resync" {
		p.membershipDirty = true
		p.pendingMovements = make(map[string]domain.Presence)
		if p.membershipTimer != nil {
			p.membershipTimer.Stop()
			p.membershipTimer = nil
		}
	}
	if p.refreshInFlight {
		p.refreshAgain = true
		p.refreshAgainReason = reason
		p.mu.Unlock()
		return
	}
	p.refreshInFlight = true
	p.mu.Unlock()
	go p.refresh(reason)
}

func (p *liveFloorProjection) refresh(reason string) {
	startedAt := time.Now()
	ctx, cancel := context.WithTimeout(p.ctx, p.options.SnapshotTimeout)
	snapshot, err := p.snapshots.Snapshot(ctx, p.buildingID, p.floorID)
	cancel()
	p.observer.FloorSnapshotRefreshed(reason, outcome(err), time.Since(startedAt))

	p.mu.Lock()
	if err == nil && !p.stopped {
		p.snapshot = snapshot
		p.representatives = representativeSet(snapshot)
		p.pendingMovements = make(map[string]domain.Presence)
		p.membershipDirty = false
	}
	p.refreshInFlight = false
	refreshAgain := p.refreshAgain
	nextReason := p.refreshAgainReason
	p.refreshAgain = false
	p.refreshAgainReason = ""
	p.mu.Unlock()

	if err == nil {
		copyOfSnapshot := cloneSnapshot(snapshot)
		p.broadcast(LiveFloorUpdate{
			Type: LiveFloorSnapshotUpdate, Snapshot: &copyOfSnapshot,
		})
	}
	if refreshAgain {
		p.requestRefresh(nextReason)
	}
}

func (p *liveFloorProjection) broadcast(update LiveFloorUpdate) {
	p.mu.RLock()
	if p.stopped {
		p.mu.RUnlock()
		return
	}
	slow := make([]uint64, 0)
	for id, updates := range p.subscribers {
		select {
		case updates <- update:
		default:
			slow = append(slow, id)
		}
	}
	p.mu.RUnlock()
	for _, id := range slow {
		p.observer.FloorMovementHandled("dropped_slow_subscriber")
		if p.entry != nil {
			p.onDrop(p.entry, id)
		}
	}
}

func representativeSet(snapshot domain.FloorSnapshot) map[string]struct{} {
	result := make(map[string]struct{}, len(snapshot.Representatives))
	for _, presence := range snapshot.Representatives {
		result[presence.SessionID] = struct{}{}
	}
	return result
}

func updateSnapshotPresence(snapshot *domain.FloorSnapshot, presence domain.Presence) {
	for index := range snapshot.Representatives {
		if snapshot.Representatives[index].SessionID == presence.SessionID {
			snapshot.Representatives[index] = presence
			snapshot.GeneratedAt = presence.LastSeenAt.UTC().Format(time.RFC3339Nano)
			return
		}
	}
}

func cloneSnapshot(snapshot domain.FloorSnapshot) domain.FloorSnapshot {
	snapshot.FloorCounts = append([]domain.FloorCount(nil), snapshot.FloorCounts...)
	snapshot.Representatives = append([]domain.Presence(nil), snapshot.Representatives...)
	snapshot.EdgeOccupancies = append([]domain.EdgeOccupancy(nil), snapshot.EdgeOccupancies...)
	return snapshot
}
