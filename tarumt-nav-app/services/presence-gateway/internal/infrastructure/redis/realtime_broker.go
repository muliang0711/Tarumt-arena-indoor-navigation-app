package redisinfra

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/identity"
	redis "github.com/redis/go-redis/v9"
)

type RealtimeBroker struct {
	client     *redis.Client
	keys       Keyspace
	instanceID string
	queueSize  int
	logger     *slog.Logger
	ctx        context.Context
	cancel     context.CancelFunc

	mu      sync.RWMutex
	hubs    map[string]*floorHub
	healthy map[string]bool
	closed  bool
}

func NewRealtimeBroker(client *redis.Client, keys Keyspace, instanceID string, queueSize int, logger *slog.Logger) *RealtimeBroker {
	ctx, cancel := context.WithCancel(context.Background())
	return &RealtimeBroker{
		client: client, keys: keys, instanceID: instanceID, queueSize: queueSize,
		logger: logger, ctx: ctx, cancel: cancel,
		hubs: make(map[string]*floorHub), healthy: make(map[string]bool),
	}
}

func (b *RealtimeBroker) Publish(ctx context.Context, event domain.Event) error {
	eventID, err := (identity.UUIDGenerator{}).NewID()
	if err != nil {
		return err
	}
	payload, err := encodeEvent(event, eventID, b.instanceID)
	if err != nil {
		return err
	}
	if err := b.client.Publish(ctx, b.keys.FloorChannel(event.BuildingID, event.FloorID), payload).Err(); err != nil {
		return storeError("publish presence event", err)
	}
	return nil
}

func (b *RealtimeBroker) Subscribe(buildingID, floorID string) ports.Subscription {
	key := buildingID + "\x00" + floorID
	b.mu.Lock()
	hub := b.hubs[key]
	if hub == nil && !b.closed {
		hub = newFloorHub(b, key, buildingID, floorID)
		b.hubs[key] = hub
		b.healthy[key] = true
		go hub.run()
	}
	if hub == nil {
		b.mu.Unlock()
		return closedSubscription()
	}
	subscription := hub.add(b.queueSize)
	b.mu.Unlock()
	select {
	case <-hub.ready:
	case <-b.ctx.Done():
	case <-time.After(5 * time.Second):
	}
	return subscription
}

func (b *RealtimeBroker) Healthy() bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.closed {
		return false
	}
	for key := range b.hubs {
		if !b.healthy[key] {
			return false
		}
	}
	return true
}

func (b *RealtimeBroker) Close() error {
	b.mu.Lock()
	if b.closed {
		b.mu.Unlock()
		return nil
	}
	b.closed = true
	hubs := make([]*floorHub, 0, len(b.hubs))
	for _, hub := range b.hubs {
		hubs = append(hubs, hub)
	}
	b.hubs = make(map[string]*floorHub)
	b.healthy = make(map[string]bool)
	b.mu.Unlock()
	b.cancel()
	for _, hub := range hubs {
		hub.cancel()
	}
	return nil
}

func (b *RealtimeBroker) setHubHealthy(key string, healthy bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, exists := b.hubs[key]; exists {
		b.healthy[key] = healthy
	}
}

func (b *RealtimeBroker) removeSubscription(subscription *redisSubscription) {
	b.mu.Lock()
	hub := subscription.hub
	if b.hubs[hub.key] != hub {
		b.mu.Unlock()
		close(subscription.events)
		return
	}
	hub.mu.Lock()
	delete(hub.subscribers, subscription.id)
	empty := len(hub.subscribers) == 0
	hub.mu.Unlock()
	if empty {
		delete(b.hubs, hub.key)
		delete(b.healthy, hub.key)
	}
	b.mu.Unlock()
	close(subscription.events)
	if empty {
		hub.cancel()
	}
}

type inertSubscription struct {
	events chan domain.Event
}

func closedSubscription() ports.Subscription {
	events := make(chan domain.Event)
	close(events)
	return &inertSubscription{events: events}
}

func (s *inertSubscription) Events() <-chan domain.Event { return s.events }
func (s *inertSubscription) Close()                      {}
