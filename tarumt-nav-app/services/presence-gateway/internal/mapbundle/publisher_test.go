package mapbundle

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPublisherCreatesDeterministicImmutableBundle(t *testing.T) {
	workspace := t.TempDir()
	sourcePath, graphRevision := writeValidSource(t, workspace)
	outputRoot := filepath.Join(workspace, "published")

	publisher := NewPublisher()
	first, err := publisher.Publish(PublishRequest{
		WorkspaceRoot: workspace,
		SourcePath:    sourcePath,
		OutputRoot:    outputRoot,
	})
	if err != nil {
		t.Fatal(err)
	}
	second, err := publisher.Publish(PublishRequest{
		WorkspaceRoot: workspace,
		SourcePath:    sourcePath,
		OutputRoot:    outputRoot,
	})
	if err != nil {
		t.Fatal(err)
	}

	if first.BundleRevision == "" || first.BundleRevision != second.BundleRevision {
		t.Fatalf("expected a deterministic revision, got %q and %q",
			first.BundleRevision, second.BundleRevision)
	}
	if first.GraphRevision != graphRevision {
		t.Fatalf("unexpected graph revision %q", first.GraphRevision)
	}
	if len(first.Assets) != 8 {
		t.Fatalf("expected 8 published assets, got %d", len(first.Assets))
	}

	revisionDirectory := filepath.Join(outputRoot, "revisions", first.BundleRevision)
	for _, name := range []string{
		"manifest.json",
		"map-graph.json",
		"rooms.json",
		"floor-2.png",
		"floor-2.thumbnail.png",
		"floor-2.tmj.json",
		"floor-2.edges.json",
		"floor-2.nodes.json",
		"floor-2.wifi-node-mapping.json",
	} {
		if _, err := os.Stat(filepath.Join(revisionDirectory, name)); err != nil {
			t.Errorf("expected %s: %v", name, err)
		}
	}

	var pointer CurrentPointer
	decodeFile(t, filepath.Join(outputRoot, "current.json"), &pointer)
	if pointer.BundleRevision != first.BundleRevision ||
		pointer.ManifestPath != "revisions/"+first.BundleRevision+"/manifest.json" {
		t.Fatalf("unexpected current pointer: %#v", pointer)
	}
}

func TestPublisherRejectsGraphWithMismatchedRevision(t *testing.T) {
	workspace := t.TempDir()
	sourcePath, _ := writeValidSource(t, workspace)
	graphPath := filepath.Join(workspace, "map-graph.json")
	var graph map[string]any
	decodeFile(t, graphPath, &graph)
	graph["map_revision"] = "sha256:not-the-content-digest"
	writeJSON(t, graphPath, graph)

	_, err := NewPublisher().Publish(PublishRequest{
		WorkspaceRoot: workspace,
		SourcePath:    sourcePath,
		OutputRoot:    filepath.Join(workspace, "published"),
	})
	if !errors.Is(err, ErrInvalidSource) ||
		!strings.Contains(err.Error(), "map_revision mismatch") {
		t.Fatalf("expected map revision mismatch, got %v", err)
	}
}

func TestPublisherRejectsRoomThatReferencesUnknownNode(t *testing.T) {
	workspace := t.TempDir()
	sourcePath, _ := writeValidSource(t, workspace)
	roomsPath := filepath.Join(workspace, "rooms.json")
	var rooms map[string]any
	decodeFile(t, roomsPath, &rooms)
	roomList := rooms["rooms"].([]any)
	roomList[0].(map[string]any)["nodeId"] = "missing-node"
	writeJSON(t, roomsPath, rooms)

	_, err := NewPublisher().Publish(PublishRequest{
		WorkspaceRoot: workspace,
		SourcePath:    sourcePath,
		OutputRoot:    filepath.Join(workspace, "published"),
	})
	if !errors.Is(err, ErrInvalidSource) ||
		!strings.Contains(err.Error(), "room room-b references unknown node") {
		t.Fatalf("expected unknown room node error, got %v", err)
	}
}

func TestPublisherRejectsWiFiMappingThatReferencesUnknownNode(t *testing.T) {
	workspace := t.TempDir()
	sourcePath, _ := writeValidSource(t, workspace)
	mappingPath := filepath.Join(workspace, "floor-2.wifi.json")
	var mapping map[string]any
	decodeFile(t, mappingPath, &mapping)
	mappings := mapping["mappings"].([]any)
	mappings[0].(map[string]any)["localNodeId"] = "missing-node"
	writeJSON(t, mappingPath, mapping)

	_, err := NewPublisher().Publish(PublishRequest{
		WorkspaceRoot: workspace,
		SourcePath:    sourcePath,
		OutputRoot:    filepath.Join(workspace, "published"),
	})
	if !errors.Is(err, ErrInvalidSource) ||
		!strings.Contains(err.Error(), "WiFi mapping references unknown local node") {
		t.Fatalf("expected unknown WiFi mapping node error, got %v", err)
	}
}

func TestPublisherRejectsRouteEdgeWithUnknownEndpoint(t *testing.T) {
	workspace := t.TempDir()
	sourcePath, _ := writeValidSource(t, workspace)
	edgesPath := filepath.Join(workspace, "floor-2.edges.json")
	var edges map[string]any
	decodeFile(t, edgesPath, &edges)
	edgeList := edges["edges"].([]any)
	edgeList[0].(map[string]any)["to"] = "missing-node"
	writeJSON(t, edgesPath, edges)

	_, err := NewPublisher().Publish(PublishRequest{
		WorkspaceRoot: workspace,
		SourcePath:    sourcePath,
		OutputRoot:    filepath.Join(workspace, "published"),
	})
	if !errors.Is(err, ErrInvalidSource) ||
		!strings.Contains(err.Error(), "edge edge-a-b references unknown node") {
		t.Fatalf("expected unknown route edge node error, got %v", err)
	}
}

func TestPublisherRejectsRasterThatDoesNotMatchTiledSurface(t *testing.T) {
	workspace := t.TempDir()
	sourcePath, _ := writeValidSource(t, workspace)
	tiledMapPath := filepath.Join(workspace, "floor-2.tmj.json")
	var tiledMap map[string]any
	decodeFile(t, tiledMapPath, &tiledMap)
	layers := tiledMap["layers"].([]any)
	chunks := layers[0].(map[string]any)["chunks"].([]any)
	chunks[0].(map[string]any)["width"] = float64(3)
	writeJSON(t, tiledMapPath, tiledMap)

	_, err := NewPublisher().Publish(PublishRequest{
		WorkspaceRoot: workspace,
		SourcePath:    sourcePath,
		OutputRoot:    filepath.Join(workspace, "published"),
	})
	if !errors.Is(err, ErrInvalidSource) ||
		!strings.Contains(err.Error(), "raster is 32x16 but tiled surface is 48x16") {
		t.Fatalf("expected raster surface mismatch, got %v", err)
	}
}

func TestPublisherRejectsCorruptedExistingRevision(t *testing.T) {
	workspace := t.TempDir()
	sourcePath, _ := writeValidSource(t, workspace)
	outputRoot := filepath.Join(workspace, "published")
	publisher := NewPublisher()
	published, err := publisher.Publish(PublishRequest{
		WorkspaceRoot: workspace,
		SourcePath:    sourcePath,
		OutputRoot:    outputRoot,
	})
	if err != nil {
		t.Fatal(err)
	}
	corruptedPath := filepath.Join(
		outputRoot, "revisions", published.BundleRevision, "rooms.json",
	)
	if err := os.WriteFile(corruptedPath, []byte(`{"corrupted":true}`), 0o644); err != nil {
		t.Fatal(err)
	}

	_, err = publisher.Publish(PublishRequest{
		WorkspaceRoot: workspace,
		SourcePath:    sourcePath,
		OutputRoot:    outputRoot,
	})
	if !errors.Is(err, ErrPublishedIntegrity) {
		t.Fatalf("expected published revision integrity error, got %v", err)
	}
}

func writeValidSource(t *testing.T, root string) (string, string) {
	t.Helper()
	graph := map[string]any{
		"schema_version": 1,
		"map_id":         "test-map",
		"floors": []any{map[string]any{
			"floor_id": "floor-2",
			"nodes": []any{
				map[string]any{
					"node_id": "node-a", "kind": "junction",
					"x": 0, "y": 0,
				},
				map[string]any{
					"node_id": "node-b", "kind": "room",
					"x": 16, "y": 0,
				},
			},
			"edges": []any{map[string]any{
				"edge_id": "edge-a-b", "from_node_id": "node-a",
				"to_node_id": "node-b", "distance": 16,
				"bidirectional": true,
			}},
		}},
		"inter_floor_edges": []any{},
	}
	graphDocument, err := json.Marshal(graph)
	if err != nil {
		t.Fatal(err)
	}
	graphDigest := sha256.Sum256(graphDocument)
	graphRevision := fmt.Sprintf("sha256:%x", graphDigest)
	graph["map_revision"] = graphRevision
	writeJSON(t, filepath.Join(root, "map-graph.json"), graph)
	writeJSON(t, filepath.Join(root, "rooms.json"), map[string]any{
		"schemaVersion": 1,
		"building": map[string]any{
			"id": "test-map", "name": "Test Map", "defaultFloorId": "floor-2",
		},
		"floors": []any{map[string]any{"id": "floor-2"}},
		"rooms": []any{map[string]any{
			"id": "room-b", "floorId": "floor-2", "nodeId": "node-b",
		}},
	})
	writeJSON(t, filepath.Join(root, "floor-2.nodes.json"), map[string]any{
		"schemaVersion": 1,
		"floorId":       "floor-2",
		"nodes": []any{
			map[string]any{"id": "node-a", "kind": "junction", "x": 0, "y": 0},
			map[string]any{"id": "node-b", "kind": "room", "x": 16, "y": 0},
		},
	})
	writeJSON(t, filepath.Join(root, "floor-2.edges.json"), map[string]any{
		"version": 1,
		"edges": []any{map[string]any{
			"id": "edge-a-b", "from": "node-a", "to": "node-b",
			"distance": 16,
		}},
	})
	writeJSON(t, filepath.Join(root, "floor-2.wifi.json"), map[string]any{
		"schemaVersion": 1,
		"floorId":       "floor-2",
		"mappings": []any{
			map[string]any{"serverNodeId": "node-a", "localNodeId": "node-a"},
		},
		"unmappedServerNodes": []any{},
	})
	writeJSON(t, filepath.Join(root, "floor-2.tmj.json"), map[string]any{
		"tilewidth": 16, "tileheight": 16, "infinite": true,
		"layers": []any{map[string]any{
			"type": "tilelayer", "visible": true,
			"chunks": []any{map[string]any{
				"x": 0, "y": 0, "width": 2, "height": 1,
			}},
		}},
	})
	writePNG(t, filepath.Join(root, "floor-2.png"), 32, 16)
	writePNG(t, filepath.Join(root, "floor-2.thumbnail.png"), 16, 8)

	sourcePath := filepath.Join(root, "source.json")
	writeJSON(t, sourcePath, map[string]any{
		"schema_version": 1,
		"map_id":         "test-map",
		"map_graph":      "map-graph.json",
		"rooms":          "rooms.json",
		"floors": []any{map[string]any{
			"floor_id":          "floor-2",
			"map_raster":        "floor-2.png",
			"thumbnail":         "floor-2.thumbnail.png",
			"tiled_map":         "floor-2.tmj.json",
			"route_edges":       "floor-2.edges.json",
			"nodes":             "floor-2.nodes.json",
			"wifi_node_mapping": "floor-2.wifi.json",
		}},
	})
	return sourcePath, graphRevision
}

func writeJSON(t *testing.T, path string, value any) {
	t.Helper()
	document, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, document, 0o644); err != nil {
		t.Fatal(err)
	}
}

func writePNG(t *testing.T, path string, width, height int) {
	t.Helper()
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(file, image.NewRGBA(image.Rect(0, 0, width, height))); err != nil {
		_ = file.Close()
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
}

func decodeFile(t *testing.T, path string, destination any) {
	t.Helper()
	document, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(document, destination); err != nil {
		t.Fatal(err)
	}
}
