package websockettransport

import (
	"context"
	"errors"
	"time"

	"github.com/coder/websocket"
)

var ErrSlowConsumer = errors.New("websocket client outbound queue is full")

type client struct {
	connection *websocket.Conn
	outbound   chan []byte
}

func newClient(connection *websocket.Conn, queueSize int) *client {
	return &client{connection: connection, outbound: make(chan []byte, queueSize)}
}

func (c *client) enqueue(message []byte) error {
	select {
	case c.outbound <- message:
		return nil
	default:
		return ErrSlowConsumer
	}
}

func (c *client) writeLoop(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case message := <-c.outbound:
			writeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			err := c.connection.Write(writeCtx, websocket.MessageText, message)
			cancel()
			if err != nil {
				return err
			}
		}
	}
}
