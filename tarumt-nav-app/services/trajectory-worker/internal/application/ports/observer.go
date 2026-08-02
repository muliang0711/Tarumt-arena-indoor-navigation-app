package ports

import "time"

type Observer interface {
	BatchCollected(int, time.Duration, string)
	BatchRead(int)
	BatchInserted(int, time.Duration)
	Acknowledged(int)
	Reclaimed(int)
	DeadLettered()
	Failed(string)
	SetSourceStats(SourceStats)
}

type NoopObserver struct{}

func (NoopObserver) BatchCollected(int, time.Duration, string) {}
func (NoopObserver) BatchRead(int)                             {}
func (NoopObserver) BatchInserted(int, time.Duration)          {}
func (NoopObserver) Acknowledged(int)                          {}
func (NoopObserver) Reclaimed(int)                             {}
func (NoopObserver) DeadLettered()                             {}
func (NoopObserver) Failed(string)                             {}
func (NoopObserver) SetSourceStats(SourceStats)                {}
