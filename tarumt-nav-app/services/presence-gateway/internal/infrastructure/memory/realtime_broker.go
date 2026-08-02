package memory

import (
	"context"
	"sync"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type RealtimeBroker struct {
	mu        sync.RWMutex
	queueSize int
	nextID    uint64
	byFloor   map[string]map[uint64]*subscription
}

type subscription struct {
	broker *RealtimeBroker
	key    string
	id     uint64
	events chan domain.Event
	once   sync.Once
}

func NewRealtimeBroker(queueSize int) *RealtimeBroker {
	return &RealtimeBroker{queueSize: queueSize, byFloor: make(map[string]map[uint64]*subscription)}
}

func (b *RealtimeBroker) Publish(ctx context.Context, event domain.Event) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	key := floorKey(event.BuildingID, event.FloorID)
	b.mu.RLock()
	overflowed := make([]*subscription, 0)
	for _, subscriber := range b.byFloor[key] {
		select {
		case subscriber.events <- event:
		default:
			overflowed = append(overflowed, subscriber)
		}
	}
	b.mu.RUnlock()
	for _, subscriber := range overflowed {
		subscriber.Close()
	}
	return nil
}

func (b *RealtimeBroker) Subscribe(buildingID, floorID string) ports.Subscription {
	key := floorKey(buildingID, floorID)
	b.mu.Lock()
	defer b.mu.Unlock()
	b.nextID++
	subscriber := &subscription{
		broker: b, key: key, id: b.nextID,
		events: make(chan domain.Event, b.queueSize),
	}
	if b.byFloor[key] == nil {
		b.byFloor[key] = make(map[uint64]*subscription)
	}
	b.byFloor[key][subscriber.id] = subscriber
	return subscriber
}

func (s *subscription) Events() <-chan domain.Event { return s.events }

func (s *subscription) Close() {
	s.once.Do(func() {
		s.broker.mu.Lock()
		defer s.broker.mu.Unlock()
		if subscribers := s.broker.byFloor[s.key]; subscribers != nil {
			delete(subscribers, s.id)
			if len(subscribers) == 0 {
				delete(s.broker.byFloor, s.key)
			}
		}
		close(s.events)
	})
}

func floorKey(buildingID, floorID string) string {
	return buildingID + "\x00" + floorID
}
