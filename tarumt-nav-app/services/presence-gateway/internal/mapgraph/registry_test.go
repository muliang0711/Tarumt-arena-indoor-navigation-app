package mapgraph

import (
	"encoding/json"
	"errors"
	"os"
	"testing"
)

const canonicalRevision = "sha256:9ce75cc7224ccc08e343761fb981c1625ca1b58231db1eb9c7270f1cf0a7865b"

func loadCanonicalBundle(t *testing.T) []byte {
	t.Helper()
	document, err := os.ReadFile(
		"../../../../contracts/maps/main-campus/map-graph-bundle.v1.json",
	)
	if err != nil {
		t.Fatal(err)
	}
	return document
}

func TestRegistryLoadsCanonicalRevision(t *testing.T) {
	registry, err := NewRegistry(loadCanonicalBundle(t))
	if err != nil {
		t.Fatal(err)
	}
	bundle, err := registry.Bundle("main-campus", canonicalRevision)
	if err != nil {
		t.Fatal(err)
	}
	if bundle.MapID != "main-campus" || len(bundle.Floors) != 1 {
		t.Fatalf("unexpected bundle: %#v", bundle)
	}
}

func TestRegistryRejectsTamperedBundle(t *testing.T) {
	document := loadCanonicalBundle(t)
	for index := range document {
		if document[index] == '9' {
			document[index] = '8'
			break
		}
	}
	_, err := NewRegistry(document)
	if !errors.Is(err, ErrInvalidBundle) {
		t.Fatalf("expected invalid bundle, got %v", err)
	}
}

func TestValidateRouteAcceptsConnectedBidirectionalEdges(t *testing.T) {
	registry, err := NewRegistry(loadCanonicalBundle(t))
	if err != nil {
		t.Fatal(err)
	}
	err = registry.ValidateRoute(
		"main-campus",
		canonicalRevision,
		"node-21",
		"node-17",
		[]string{
			"edge-node-1-node-21",
			"edge-node-1-node-2",
			"edge-node-15-node-2",
			"edge-node-14-node-15",
			"edge-node-14-node-13",
			"edge-node-13-node-12",
			"edge-node-12-node-16",
			"edge-node-17-node-16",
		},
	)
	if err != nil {
		t.Fatal(err)
	}
}

func TestValidateRouteRejectsDisconnectedAndUnknownRevisions(t *testing.T) {
	registry, err := NewRegistry(loadCanonicalBundle(t))
	if err != nil {
		t.Fatal(err)
	}
	if err := registry.ValidateRoute(
		"main-campus", canonicalRevision, "node-21", "node-17",
		[]string{"edge-node-17-node-16"},
	); !errors.Is(err, ErrInvalidRoute) {
		t.Fatalf("expected invalid route, got %v", err)
	}
	if err := registry.ValidateRoute(
		"main-campus", "sha256:missing", "node-21", "node-17",
		[]string{"edge-node-17-node-16"},
	); !errors.Is(err, ErrUnknownRevision) {
		t.Fatalf("expected unknown revision, got %v", err)
	}
}

func TestValidateRouteSupportsInterFloorEdges(t *testing.T) {
	document := bundleDocument(t, map[string]any{
		"schema_version": 1,
		"map_id":         "two-floor-map",
		"floors": []any{
			map[string]any{
				"floor_id": "floor-1",
				"nodes": []any{
					map[string]any{
						"node_id": "stairs-f1", "kind": "connector",
						"x": 1, "y": 1,
					},
				},
				"edges": []any{},
			},
			map[string]any{
				"floor_id": "floor-2",
				"nodes": []any{
					map[string]any{
						"node_id": "stairs-f2", "kind": "connector",
						"x": 1, "y": 1,
					},
				},
				"edges": []any{},
			},
		},
		"inter_floor_edges": []any{
			map[string]any{
				"edge_id": "stairs-f1-f2", "from_node_id": "stairs-f1",
				"to_node_id": "stairs-f2", "distance": 4,
				"bidirectional": true,
			},
		},
	})
	registry, err := NewRegistry(document)
	if err != nil {
		t.Fatal(err)
	}
	var bundle Bundle
	if err := json.Unmarshal(document, &bundle); err != nil {
		t.Fatal(err)
	}
	err = registry.ValidateRoute(
		"two-floor-map", bundle.MapRevision, "stairs-f1", "stairs-f2",
		[]string{"stairs-f1-f2"},
	)
	if err != nil {
		t.Fatal(err)
	}
}

func bundleDocument(t *testing.T, value map[string]any) []byte {
	t.Helper()
	value["map_revision"] = ""
	document, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	revision, err := calculateRevision(document)
	if err != nil {
		t.Fatal(err)
	}
	value["map_revision"] = revision
	document, err = json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return document
}
