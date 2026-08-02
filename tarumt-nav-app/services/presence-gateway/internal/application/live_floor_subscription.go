package application

import "sync"

type liveFloorSubscription struct {
	manager *LiveFloorProjectionManager
	entry   *floorProjectionEntry
	id      uint64
	updates <-chan LiveFloorUpdate
	once    sync.Once
}

func (s *liveFloorSubscription) Updates() <-chan LiveFloorUpdate {
	return s.updates
}

func (s *liveFloorSubscription) Close() {
	s.once.Do(func() {
		s.manager.unsubscribe(s.entry, s.id)
	})
}
