package ports

type IDGenerator interface {
	NewID() (string, error)
}
