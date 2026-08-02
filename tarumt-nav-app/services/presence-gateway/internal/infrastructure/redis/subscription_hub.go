package redisinfra

import (
	"context"
	"sync"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type floorHub struct {
	broker     *RealtimeBroker
	key        string
	buildingID string
	floorID    string
	channel    string
	ctx        context.Context
	cancel     context.CancelFunc

	mu          sync.RWMutex
	nextID      uint64
	subscribers map[uint64]*redisSubscription
	ready       chan struct{}
	readyOnce   sync.Once
}

type redisSubscription struct {
	hub    *floorHub
	id     uint64
	events chan domain.Event
	once   sync.Once
}

func newFloorHub(broker *RealtimeBroker, key, buildingID, floorID string) *floorHub {
	ctx, cancel := context.WithCancel(broker.ctx)
	return &floorHub{
		broker: broker, key: key, buildingID: buildingID, floorID: floorID,
		channel: broker.keys.FloorChannel(buildingID, floorID), ctx: ctx, cancel: cancel,
		subscribers: make(map[uint64]*redisSubscription),
		ready:       make(chan struct{}),
	}
}

func (h *floorHub) add(queueSize int) *redisSubscription {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.nextID++
	subscription := &redisSubscription{hub: h, id: h.nextID, events: make(chan domain.Event, queueSize)}
	h.subscribers[subscription.id] = subscription
	return subscription
}

func (h *floorHub) broadcast(event domain.Event) {
	h.mu.RLock()
	overflowed := make([]*redisSubscription, 0)
	for _, subscriber := range h.subscribers {
		select {
		case subscriber.events <- event:
		default:
			overflowed = append(overflowed, subscriber)
		}
	}
	h.mu.RUnlock()
	for _, subscriber := range overflowed {
		subscriber.Close()
	}
}

func (h *floorHub) run() {
	backoff := 100 * time.Millisecond
	everConnected := false
	failedBeforeFirstConnection := false
	for h.ctx.Err() == nil {
		pubsub := h.broker.client.Subscribe(h.ctx, h.channel)
		if _, err := pubsub.Receive(h.ctx); err != nil {
			_ = pubsub.Close()
			h.broker.setHubHealthy(h.key, false)
			if !everConnected {
				failedBeforeFirstConnection = true
			}
			if !waitContext(h.ctx, backoff) {
				return
			}
			backoff = min(backoff*2, 5*time.Second)
			continue
		}
		h.broker.setHubHealthy(h.key, true)
		h.readyOnce.Do(func() { close(h.ready) })
		if everConnected || failedBeforeFirstConnection {
			h.broadcast(domain.Event{
				Type: domain.EventResyncRequired, BuildingID: h.buildingID,
				FloorID: h.floorID, OccurredAt: time.Now().UTC(),
			})
		}
		everConnected = true
		failedBeforeFirstConnection = false
		backoff = 100 * time.Millisecond
		for h.ctx.Err() == nil {
			message, err := pubsub.ReceiveMessage(h.ctx)
			if err != nil {
				h.broker.setHubHealthy(h.key, false)
				if h.ctx.Err() == nil {
					h.broker.logger.Warn("Redis floor subscription interrupted", "building_id", h.buildingID, "floor_id", h.floorID, "error", err)
				}
				break
			}
			event, err := decodeEvent([]byte(message.Payload))
			if err != nil {
				h.broker.logger.Warn("discarding invalid Redis presence event", "channel", h.channel, "error", err)
				continue
			}
			h.broadcast(event)
		}
		_ = pubsub.Close()
	}
}

func (s *redisSubscription) Events() <-chan domain.Event { return s.events }

func (s *redisSubscription) Close() {
	s.once.Do(func() {
		s.hub.broker.removeSubscription(s)
	})
}

func waitContext(ctx context.Context, duration time.Duration) bool {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
