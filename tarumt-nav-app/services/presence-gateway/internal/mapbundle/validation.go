package mapbundle

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image/png"

	"github.com/campus-navigator/presence-gateway/internal/mapgraph"
)

func validateSourceDocuments(
	source sourceManifest,
	documents map[string][]byte,
	graph mapgraph.Bundle,
) error {
	if err := validateRooms(documents["rooms.json"], graph); err != nil {
		return err
	}
	for _, floor := range source.Floors {
		if err := validateTiledSurface(
			documents[floor.FloorID+".tmj.json"],
			documents[floor.FloorID+".png"],
			floor.FloorID,
		); err != nil {
			return err
		}
		if err := validateRouteGraphDocuments(
			documents[floor.FloorID+".nodes.json"],
			documents[floor.FloorID+".edges.json"],
			floor.FloorID,
			graph,
		); err != nil {
			return err
		}
		if err := validateWiFiMapping(
			documents[floor.FloorID+".wifi-node-mapping.json"],
			documents[floor.FloorID+".nodes.json"],
			floor.FloorID,
			graph,
		); err != nil {
			return err
		}
	}
	return nil
}

func validateRooms(document []byte, graph mapgraph.Bundle) error {
	var catalog struct {
		Rooms []struct {
			RoomID  string `json:"id"`
			FloorID string `json:"floorId"`
			NodeID  string `json:"nodeId"`
		} `json:"rooms"`
	}
	if err := json.Unmarshal(document, &catalog); err != nil {
		return fmt.Errorf("%w: rooms: %v", ErrInvalidSource, err)
	}
	nodes := make(map[string]string)
	for _, floor := range graph.Floors {
		for _, node := range floor.Nodes {
			nodes[node.NodeID] = floor.FloorID
		}
	}
	for _, room := range catalog.Rooms {
		floorID, exists := nodes[room.NodeID]
		if !exists {
			return fmt.Errorf(
				"%w: room %s references unknown node %s",
				ErrInvalidSource, room.RoomID, room.NodeID,
			)
		}
		if floorID != room.FloorID {
			return fmt.Errorf(
				"%w: room %s floor %s does not match node floor %s",
				ErrInvalidSource, room.RoomID, room.FloorID, floorID,
			)
		}
	}
	return nil
}

func validateTiledSurface(tiledDocument, rasterDocument []byte, floorID string) error {
	var tiled struct {
		TileWidth  int `json:"tilewidth"`
		TileHeight int `json:"tileheight"`
		Layers     []struct {
			Type    string `json:"type"`
			Visible *bool  `json:"visible"`
			Chunks  []struct {
				X      int `json:"x"`
				Y      int `json:"y"`
				Width  int `json:"width"`
				Height int `json:"height"`
			} `json:"chunks"`
		} `json:"layers"`
	}
	if err := json.Unmarshal(tiledDocument, &tiled); err != nil {
		return fmt.Errorf("%w: tiled map for %s: %v", ErrInvalidSource, floorID, err)
	}
	if tiled.TileWidth <= 0 || tiled.TileHeight <= 0 {
		return fmt.Errorf("%w: tiled map for %s has invalid tile size", ErrInvalidSource, floorID)
	}
	hasChunk := false
	minX, minY, maxX, maxY := 0, 0, 0, 0
	for _, layer := range tiled.Layers {
		if layer.Type != "tilelayer" || (layer.Visible != nil && !*layer.Visible) {
			continue
		}
		for _, chunk := range layer.Chunks {
			if chunk.Width <= 0 || chunk.Height <= 0 {
				return fmt.Errorf("%w: tiled map for %s has invalid chunk", ErrInvalidSource, floorID)
			}
			if !hasChunk {
				minX, minY = chunk.X, chunk.Y
				maxX, maxY = chunk.X+chunk.Width, chunk.Y+chunk.Height
				hasChunk = true
				continue
			}
			minX = min(minX, chunk.X)
			minY = min(minY, chunk.Y)
			maxX = max(maxX, chunk.X+chunk.Width)
			maxY = max(maxY, chunk.Y+chunk.Height)
		}
	}
	if !hasChunk {
		return fmt.Errorf("%w: tiled map for %s has no visible tile chunks", ErrInvalidSource, floorID)
	}
	surfaceWidth := (maxX - minX) * tiled.TileWidth
	surfaceHeight := (maxY - minY) * tiled.TileHeight
	config, err := png.DecodeConfig(bytes.NewReader(rasterDocument))
	if err != nil {
		return fmt.Errorf("%w: raster for %s: %v", ErrInvalidSource, floorID, err)
	}
	if config.Width != surfaceWidth || config.Height != surfaceHeight {
		return fmt.Errorf(
			"%w: floor %s raster is %dx%d but tiled surface is %dx%d",
			ErrInvalidSource, floorID, config.Width, config.Height,
			surfaceWidth, surfaceHeight,
		)
	}
	return nil
}

func validateRouteGraphDocuments(
	nodesDocument []byte,
	edgesDocument []byte,
	floorID string,
	graph mapgraph.Bundle,
) error {
	var nodesCatalog struct {
		FloorID string `json:"floorId"`
		Nodes   []struct {
			NodeID string `json:"id"`
		} `json:"nodes"`
	}
	if err := json.Unmarshal(nodesDocument, &nodesCatalog); err != nil {
		return fmt.Errorf("%w: nodes for %s: %v", ErrInvalidSource, floorID, err)
	}
	if nodesCatalog.FloorID != floorID {
		return fmt.Errorf(
			"%w: node catalog floor %s does not match %s",
			ErrInvalidSource, nodesCatalog.FloorID, floorID,
		)
	}
	nodes := make(map[string]struct{}, len(nodesCatalog.Nodes))
	for _, node := range nodesCatalog.Nodes {
		nodes[node.NodeID] = struct{}{}
	}

	var edgesCatalog struct {
		Edges []struct {
			EdgeID     string `json:"id"`
			FromNodeID string `json:"from"`
			ToNodeID   string `json:"to"`
		} `json:"edges"`
	}
	if err := json.Unmarshal(edgesDocument, &edgesCatalog); err != nil {
		return fmt.Errorf("%w: route edges for %s: %v", ErrInvalidSource, floorID, err)
	}
	for _, edge := range edgesCatalog.Edges {
		if _, exists := nodes[edge.FromNodeID]; !exists {
			return fmt.Errorf(
				"%w: edge %s references unknown node %s",
				ErrInvalidSource, edge.EdgeID, edge.FromNodeID,
			)
		}
		if _, exists := nodes[edge.ToNodeID]; !exists {
			return fmt.Errorf(
				"%w: edge %s references unknown node %s",
				ErrInvalidSource, edge.EdgeID, edge.ToNodeID,
			)
		}
	}

	canonicalNodes := make(map[string]struct{})
	for _, floor := range graph.Floors {
		if floor.FloorID != floorID {
			continue
		}
		for _, node := range floor.Nodes {
			canonicalNodes[node.NodeID] = struct{}{}
		}
	}
	for nodeID := range nodes {
		if _, exists := canonicalNodes[nodeID]; !exists {
			return fmt.Errorf(
				"%w: local node %s is absent from canonical graph floor %s",
				ErrInvalidSource, nodeID, floorID,
			)
		}
	}
	return nil
}

func validateWiFiMapping(
	mappingDocument []byte,
	nodesDocument []byte,
	floorID string,
	graph mapgraph.Bundle,
) error {
	var catalog struct {
		FloorID string `json:"floorId"`
		Nodes   []struct {
			NodeID string `json:"id"`
		} `json:"nodes"`
	}
	if err := json.Unmarshal(nodesDocument, &catalog); err != nil {
		return fmt.Errorf("%w: nodes for %s: %v", ErrInvalidSource, floorID, err)
	}
	if catalog.FloorID != floorID {
		return fmt.Errorf(
			"%w: node catalog floor %s does not match %s",
			ErrInvalidSource, catalog.FloorID, floorID,
		)
	}
	localNodes := make(map[string]struct{}, len(catalog.Nodes))
	for _, node := range catalog.Nodes {
		localNodes[node.NodeID] = struct{}{}
	}
	serverNodes := make(map[string]struct{})
	for _, floor := range graph.Floors {
		if floor.FloorID != floorID {
			continue
		}
		for _, node := range floor.Nodes {
			serverNodes[node.NodeID] = struct{}{}
		}
	}

	var mapping struct {
		FloorID  string `json:"floorId"`
		Mappings []struct {
			ServerNodeID string `json:"serverNodeId"`
			LocalNodeID  string `json:"localNodeId"`
		} `json:"mappings"`
	}
	if err := json.Unmarshal(mappingDocument, &mapping); err != nil {
		return fmt.Errorf("%w: WiFi mapping for %s: %v", ErrInvalidSource, floorID, err)
	}
	if mapping.FloorID != floorID {
		return fmt.Errorf(
			"%w: WiFi mapping floor %s does not match %s",
			ErrInvalidSource, mapping.FloorID, floorID,
		)
	}
	for _, item := range mapping.Mappings {
		if _, exists := localNodes[item.LocalNodeID]; !exists {
			return fmt.Errorf(
				"%w: WiFi mapping references unknown local node %s",
				ErrInvalidSource, item.LocalNodeID,
			)
		}
		if _, exists := serverNodes[item.ServerNodeID]; !exists {
			return fmt.Errorf(
				"%w: WiFi mapping references unknown server node %s",
				ErrInvalidSource, item.ServerNodeID,
			)
		}
	}
	return nil
}
