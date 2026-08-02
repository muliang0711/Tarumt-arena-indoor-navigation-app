// Package mapbundle publishes a validated set of indoor-map resources as one
// immutable, content-addressed bundle. Callers provide source paths and receive
// a manifest; they do not need to coordinate file copying, hashing, or pointer
// replacement themselves.
package mapbundle

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"image/png"

	"github.com/campus-navigator/presence-gateway/internal/mapgraph"
)

var (
	ErrInvalidSource      = errors.New("invalid map bundle source")
	ErrPublishedIntegrity = errors.New("published map bundle integrity failure")
)

type PublishRequest struct {
	WorkspaceRoot string
	SourcePath    string
	OutputRoot    string
}

type Manifest struct {
	SchemaVersion  int     `json:"schema_version"`
	MapID          string  `json:"map_id"`
	BundleRevision string  `json:"bundle_revision"`
	GraphRevision  string  `json:"graph_revision"`
	Assets         []Asset `json:"assets"`
}

type Asset struct {
	AssetID     string `json:"asset_id"`
	Kind        string `json:"kind"`
	FloorID     string `json:"floor_id,omitempty"`
	Path        string `json:"path"`
	SHA256      string `json:"sha256"`
	ByteSize    int64  `json:"byte_size"`
	ContentType string `json:"content_type"`
	Width       int    `json:"width,omitempty"`
	Height      int    `json:"height,omitempty"`
}

type CurrentPointer struct {
	SchemaVersion  int    `json:"schema_version"`
	MapID          string `json:"map_id"`
	BundleRevision string `json:"bundle_revision"`
	GraphRevision  string `json:"graph_revision"`
	ManifestPath   string `json:"manifest_path"`
}

type Publisher struct{}

func NewPublisher() *Publisher {
	return &Publisher{}
}

func (p *Publisher) Publish(request PublishRequest) (Manifest, error) {
	source, err := loadSource(request)
	if err != nil {
		return Manifest{}, err
	}
	graphDocument, err := readWorkspaceFile(request.WorkspaceRoot, source.MapGraph)
	if err != nil {
		return Manifest{}, err
	}
	var graph struct {
		MapID       string `json:"map_id"`
		MapRevision string `json:"map_revision"`
	}
	if err := json.Unmarshal(graphDocument, &graph); err != nil {
		return Manifest{}, fmt.Errorf("%w: map graph: %v", ErrInvalidSource, err)
	}
	if graph.MapID != source.MapID {
		return Manifest{}, fmt.Errorf(
			"%w: map graph map_id %q does not match %q",
			ErrInvalidSource, graph.MapID, source.MapID,
		)
	}
	registry, err := mapgraph.NewRegistry(graphDocument)
	if err != nil {
		return Manifest{}, fmt.Errorf("%w: map graph: %v", ErrInvalidSource, err)
	}
	graphBundle, err := registry.Bundle(graph.MapID, graph.MapRevision)
	if err != nil {
		return Manifest{}, fmt.Errorf("%w: map graph: %v", ErrInvalidSource, err)
	}

	planned := planAssets(source)
	documents := make(map[string][]byte, len(planned))
	assets := make([]Asset, 0, len(planned))
	for _, item := range planned {
		document, readErr := readWorkspaceFile(request.WorkspaceRoot, item.sourcePath)
		if readErr != nil {
			return Manifest{}, readErr
		}
		digest := sha256.Sum256(document)
		asset := Asset{
			AssetID: item.assetID, Kind: item.kind, FloorID: item.floorID,
			Path: item.outputName, SHA256: revision(digest[:]),
			ByteSize: int64(len(document)), ContentType: item.contentType,
		}
		if item.readDimensions {
			config, decodeErr := png.DecodeConfig(bytes.NewReader(document))
			if decodeErr != nil {
				return Manifest{}, fmt.Errorf(
					"%w: %s: %v", ErrInvalidSource, item.sourcePath, decodeErr,
				)
			}
			asset.Width, asset.Height = config.Width, config.Height
		}
		assets = append(assets, asset)
		documents[item.outputName] = document
	}
	if err := validateSourceDocuments(source, documents, graphBundle); err != nil {
		return Manifest{}, err
	}

	manifest := Manifest{
		SchemaVersion: 1,
		MapID:         source.MapID,
		GraphRevision: graph.MapRevision,
		Assets:        assets,
	}
	canonical, err := canonicalManifest(manifest)
	if err != nil {
		return Manifest{}, err
	}
	digest := sha256.Sum256(canonical)
	manifest.BundleRevision = revision(digest[:])

	if err := publishFiles(request.OutputRoot, manifest, documents); err != nil {
		return Manifest{}, err
	}
	return manifest, nil
}

func canonicalManifest(manifest Manifest) ([]byte, error) {
	document, err := json.Marshal(manifest)
	if err != nil {
		return nil, err
	}
	var value map[string]any
	if err := json.Unmarshal(document, &value); err != nil {
		return nil, err
	}
	delete(value, "bundle_revision")
	return json.Marshal(value)
}
