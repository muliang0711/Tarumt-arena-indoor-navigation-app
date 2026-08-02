// Package mapgraph owns loading, integrity checking, and route validation for
// versioned canonical indoor-map graphs. Callers do not need to understand the
// JSON representation or graph traversal rules.
package mapgraph

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
)

var (
	ErrInvalidBundle   = errors.New("invalid map graph bundle")
	ErrUnknownRevision = errors.New("unknown map revision")
	ErrInvalidRoute    = errors.New("invalid planned route")
)

type Bundle struct {
	SchemaVersion   int     `json:"schema_version"`
	MapID           string  `json:"map_id"`
	Floors          []Floor `json:"floors"`
	InterFloorEdges []Edge  `json:"inter_floor_edges"`
	MapRevision     string  `json:"map_revision"`
}

type Floor struct {
	FloorID string `json:"floor_id"`
	Nodes   []Node `json:"nodes"`
	Edges   []Edge `json:"edges"`
}

type Node struct {
	NodeID string  `json:"node_id"`
	Kind   string  `json:"kind"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
}

type Edge struct {
	EdgeID        string  `json:"edge_id"`
	FromNodeID    string  `json:"from_node_id"`
	ToNodeID      string  `json:"to_node_id"`
	Distance      float64 `json:"distance"`
	Bidirectional bool    `json:"bidirectional"`
}

type Registry struct {
	graphs map[string]graph
}

type graph struct {
	bundle Bundle
	nodes  map[string]string
	edges  map[string]edgeOnFloor
}

type edgeOnFloor struct {
	edge    Edge
	floorID string
}

func NewRegistry(documents ...[]byte) (*Registry, error) {
	registry := &Registry{graphs: make(map[string]graph, len(documents))}
	for _, document := range documents {
		parsed, err := parse(document)
		if err != nil {
			return nil, err
		}
		key := revisionKey(parsed.bundle.MapID, parsed.bundle.MapRevision)
		if _, exists := registry.graphs[key]; exists {
			return nil, fmt.Errorf("%w: duplicate map revision", ErrInvalidBundle)
		}
		registry.graphs[key] = parsed
	}
	if len(registry.graphs) == 0 {
		return nil, fmt.Errorf("%w: at least one revision is required", ErrInvalidBundle)
	}
	return registry, nil
}

func (r *Registry) Bundle(mapID, revision string) (Bundle, error) {
	value, ok := r.graphs[revisionKey(mapID, revision)]
	if !ok {
		return Bundle{}, ErrUnknownRevision
	}
	return value.bundle, nil
}

func (r *Registry) ValidateRoute(
	mapID string,
	revision string,
	originNodeID string,
	destinationNodeID string,
	plannedEdgeIDs []string,
) error {
	value, ok := r.graphs[revisionKey(mapID, revision)]
	if !ok {
		return ErrUnknownRevision
	}
	if strings.TrimSpace(originNodeID) == "" ||
		strings.TrimSpace(destinationNodeID) == "" ||
		len(plannedEdgeIDs) == 0 {
		return ErrInvalidRoute
	}
	current := originNodeID
	if _, exists := value.nodes[current]; !exists {
		return ErrInvalidRoute
	}
	for _, edgeID := range plannedEdgeIDs {
		located, exists := value.edges[edgeID]
		if !exists {
			return ErrInvalidRoute
		}
		switch {
		case located.edge.FromNodeID == current:
			current = located.edge.ToNodeID
		case located.edge.Bidirectional && located.edge.ToNodeID == current:
			current = located.edge.FromNodeID
		default:
			return ErrInvalidRoute
		}
	}
	if current != destinationNodeID {
		return ErrInvalidRoute
	}
	return nil
}

func parse(document []byte) (graph, error) {
	var bundle Bundle
	decoder := json.NewDecoder(bytes.NewReader(document))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&bundle); err != nil {
		return graph{}, fmt.Errorf("%w: %v", ErrInvalidBundle, err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return graph{}, fmt.Errorf("%w: trailing JSON value", ErrInvalidBundle)
	}
	if bundle.SchemaVersion != 1 || strings.TrimSpace(bundle.MapID) == "" ||
		len(bundle.Floors) == 0 || bundle.InterFloorEdges == nil {
		return graph{}, ErrInvalidBundle
	}
	revision, err := calculateRevision(document)
	if err != nil || revision != bundle.MapRevision {
		return graph{}, fmt.Errorf("%w: map_revision mismatch", ErrInvalidBundle)
	}

	result := graph{
		bundle: bundle,
		nodes:  make(map[string]string),
		edges:  make(map[string]edgeOnFloor),
	}
	floors := make(map[string]struct{}, len(bundle.Floors))
	for _, floor := range bundle.Floors {
		if strings.TrimSpace(floor.FloorID) == "" || len(floor.Nodes) == 0 {
			return graph{}, ErrInvalidBundle
		}
		if _, duplicate := floors[floor.FloorID]; duplicate {
			return graph{}, ErrInvalidBundle
		}
		floors[floor.FloorID] = struct{}{}
		for _, node := range floor.Nodes {
			if !validNode(node) {
				return graph{}, ErrInvalidBundle
			}
			if _, duplicate := result.nodes[node.NodeID]; duplicate {
				return graph{}, ErrInvalidBundle
			}
			result.nodes[node.NodeID] = floor.FloorID
		}
	}
	for _, floor := range bundle.Floors {
		for _, edge := range floor.Edges {
			if err := result.addEdge(edge, floor.FloorID, false); err != nil {
				return graph{}, err
			}
		}
	}
	for _, edge := range bundle.InterFloorEdges {
		if err := result.addEdge(edge, "", true); err != nil {
			return graph{}, err
		}
	}
	return result, nil
}

func (g *graph) addEdge(edge Edge, floorID string, interFloor bool) error {
	if strings.TrimSpace(edge.EdgeID) == "" || edge.Distance <= 0 {
		return ErrInvalidBundle
	}
	if _, duplicate := g.edges[edge.EdgeID]; duplicate {
		return ErrInvalidBundle
	}
	fromFloor, fromExists := g.nodes[edge.FromNodeID]
	toFloor, toExists := g.nodes[edge.ToNodeID]
	if !fromExists || !toExists {
		return ErrInvalidBundle
	}
	if interFloor {
		if fromFloor == toFloor {
			return ErrInvalidBundle
		}
	} else if fromFloor != floorID || toFloor != floorID {
		return ErrInvalidBundle
	}
	g.edges[edge.EdgeID] = edgeOnFloor{edge: edge, floorID: floorID}
	return nil
}

func validNode(node Node) bool {
	if strings.TrimSpace(node.NodeID) == "" {
		return false
	}
	switch node.Kind {
	case "junction", "room", "connector":
		return true
	default:
		return false
	}
}

func calculateRevision(document []byte) (string, error) {
	var value map[string]any
	if err := json.Unmarshal(document, &value); err != nil {
		return "", err
	}
	delete(value, "map_revision")
	canonical, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(canonical)
	return "sha256:" + hex.EncodeToString(digest[:]), nil
}

func revisionKey(mapID, revision string) string {
	return strings.TrimSpace(mapID) + "\x00" + strings.TrimSpace(revision)
}
