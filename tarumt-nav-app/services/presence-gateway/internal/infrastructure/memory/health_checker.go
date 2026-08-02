package memory

import "context"

type HealthChecker struct{}

func (HealthChecker) Ready(context.Context) error { return nil }
