package ports

import "context"

type DependencyHealth interface {
	Ready(context.Context) error
}
