package mapbundle

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type sourceManifest struct {
	SchemaVersion int           `json:"schema_version"`
	MapID         string        `json:"map_id"`
	MapGraph      string        `json:"map_graph"`
	Rooms         string        `json:"rooms"`
	Floors        []sourceFloor `json:"floors"`
}

type sourceFloor struct {
	FloorID         string `json:"floor_id"`
	MapRaster       string `json:"map_raster"`
	Thumbnail       string `json:"thumbnail"`
	TiledMap        string `json:"tiled_map"`
	RouteEdges      string `json:"route_edges"`
	Nodes           string `json:"nodes"`
	WiFiNodeMapping string `json:"wifi_node_mapping"`
}

type plannedAsset struct {
	assetID        string
	kind           string
	floorID        string
	sourcePath     string
	outputName     string
	contentType    string
	readDimensions bool
}

func loadSource(request PublishRequest) (sourceManifest, error) {
	sourcePath := request.SourcePath
	if filepath.IsAbs(sourcePath) {
		workspace, err := filepath.Abs(request.WorkspaceRoot)
		if err != nil {
			return sourceManifest{}, err
		}
		sourcePath, err = filepath.Rel(workspace, sourcePath)
		if err != nil {
			return sourceManifest{}, err
		}
	}
	document, err := readWorkspaceFile(request.WorkspaceRoot, sourcePath)
	if err != nil {
		return sourceManifest{}, err
	}
	var source sourceManifest
	decoder := json.NewDecoder(bytes.NewReader(document))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&source); err != nil {
		return sourceManifest{}, fmt.Errorf("%w: source manifest: %v", ErrInvalidSource, err)
	}
	if source.SchemaVersion != 1 || strings.TrimSpace(source.MapID) == "" ||
		strings.TrimSpace(source.MapGraph) == "" || strings.TrimSpace(source.Rooms) == "" ||
		len(source.Floors) == 0 {
		return sourceManifest{}, ErrInvalidSource
	}
	return source, nil
}

func planAssets(source sourceManifest) []plannedAsset {
	planned := []plannedAsset{
		{
			assetID: "map-graph", kind: "map_graph",
			sourcePath: source.MapGraph, outputName: "map-graph.json",
			contentType: "application/json",
		},
		{
			assetID: "rooms", kind: "rooms",
			sourcePath: source.Rooms, outputName: "rooms.json",
			contentType: "application/json",
		},
	}
	for _, floor := range source.Floors {
		planned = append(planned,
			plannedAsset{
				assetID: floor.FloorID + "-map-raster", kind: "map_raster",
				floorID: floor.FloorID, sourcePath: floor.MapRaster,
				outputName: floor.FloorID + ".png", contentType: "image/png",
				readDimensions: true,
			},
			plannedAsset{
				assetID: floor.FloorID + "-thumbnail", kind: "thumbnail",
				floorID: floor.FloorID, sourcePath: floor.Thumbnail,
				outputName: floor.FloorID + ".thumbnail.png", contentType: "image/png",
				readDimensions: true,
			},
			plannedAsset{
				assetID: floor.FloorID + "-tiled-map", kind: "tiled_map",
				floorID: floor.FloorID, sourcePath: floor.TiledMap,
				outputName: floor.FloorID + ".tmj.json", contentType: "application/json",
			},
			plannedAsset{
				assetID: floor.FloorID + "-route-edges", kind: "route_edges",
				floorID: floor.FloorID, sourcePath: floor.RouteEdges,
				outputName: floor.FloorID + ".edges.json", contentType: "application/json",
			},
			plannedAsset{
				assetID: floor.FloorID + "-nodes", kind: "nodes",
				floorID: floor.FloorID, sourcePath: floor.Nodes,
				outputName: floor.FloorID + ".nodes.json", contentType: "application/json",
			},
			plannedAsset{
				assetID: floor.FloorID + "-wifi-node-mapping", kind: "wifi_node_mapping",
				floorID: floor.FloorID, sourcePath: floor.WiFiNodeMapping,
				outputName:  floor.FloorID + ".wifi-node-mapping.json",
				contentType: "application/json",
			},
		)
	}
	return planned
}

func readWorkspaceFile(workspaceRoot, name string) ([]byte, error) {
	root, err := filepath.Abs(workspaceRoot)
	if err != nil {
		return nil, err
	}
	path, err := filepath.Abs(filepath.Join(root, name))
	if err != nil {
		return nil, err
	}
	relative, err := filepath.Rel(root, path)
	if err != nil || relative == ".." ||
		strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return nil, fmt.Errorf(
			"%w: asset path escapes workspace: %s", ErrInvalidSource, name,
		)
	}
	document, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("%w: read %s: %v", ErrInvalidSource, name, err)
	}
	return document, nil
}
