package mapgraph

import (
	_ "embed"
	"fmt"
)

//go:generate cp ../../../../contracts/maps/main-campus/map-graph-bundle.v1.json assets/main-campus.map-graph.v1.json

//go:embed assets/main-campus.map-graph.v1.json
var mainCampusBundle []byte

func NewDefaultRegistry() (*Registry, error) {
	registry, err := NewRegistry(mainCampusBundle)
	if err != nil {
		return nil, fmt.Errorf("load bundled map graph: %w", err)
	}
	return registry, nil
}
