package ports

import (
	"context"

	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type Subscription interface {
	Events() <-chan domain.Event
	Close()
}

type RealtimeBroker interface {
	Publish(context.Context, domain.Event) error
	Subscribe(buildingID, floorID string) Subscription
}
