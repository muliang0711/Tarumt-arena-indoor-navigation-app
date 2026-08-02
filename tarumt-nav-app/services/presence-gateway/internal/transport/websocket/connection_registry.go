package websockettransport

import (
	"context"
	"sync"

	"github.com/coder/websocket"
)

type ConnectionRegistry struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]struct{}
}

func NewConnectionRegistry() *ConnectionRegistry {
	return &ConnectionRegistry{clients: make(map[*websocket.Conn]struct{})}
}

func (r *ConnectionRegistry) Add(connection *websocket.Conn) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clients[connection] = struct{}{}
}

func (r *ConnectionRegistry) Remove(connection *websocket.Conn) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.clients, connection)
}

func (r *ConnectionRegistry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients)
}

func (r *ConnectionRegistry) CloseAll(ctx context.Context) {
	r.mu.RLock()
	connections := make([]*websocket.Conn, 0, len(r.clients))
	for connection := range r.clients {
		connections = append(connections, connection)
	}
	r.mu.RUnlock()
	var group sync.WaitGroup
	for _, connection := range connections {
		group.Add(1)
		go func(connection *websocket.Conn) {
			defer group.Done()
			_ = connection.Close(websocket.StatusGoingAway, "server shutting down")
		}(connection)
	}
	done := make(chan struct{})
	go func() {
		group.Wait()
		close(done)
	}()
	select {
	case <-ctx.Done():
		for _, connection := range connections {
			connection.CloseNow()
		}
	case <-done:
	}
}
