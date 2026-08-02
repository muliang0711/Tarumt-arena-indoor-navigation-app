package mapbundle

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sync"
)

var (
	ErrMapNotFound       = errors.New("map bundle not found")
	ErrInvalidMapRequest = errors.New("invalid map bundle request")
	ErrMapIntegrity      = errors.New("map bundle integrity failure")
)

var mapIdentifierPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)
var revisionPattern = regexp.MustCompile(`^sha256:[a-f0-9]{64}$`)
var assetPathPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$`)

type Document struct {
	Content        []byte
	BundleRevision string
}

type AssetResource struct {
	Content     *os.File
	Name        string
	ContentType string
	SHA256      string
	Size        int64
}

type Catalog struct {
	root     string
	verified sync.Map
}

func NewCatalog(root string) *Catalog {
	return &Catalog{root: root}
}

type verifiedAsset struct {
	size             int64
	modifiedUnixNano int64
	sha256           string
}

func (c *Catalog) Current(mapID string) (Document, error) {
	if !mapIdentifierPattern.MatchString(mapID) {
		return Document{}, ErrInvalidMapRequest
	}
	mapRoot := filepath.Join(c.root, mapID)
	pointerDocument, err := os.ReadFile(filepath.Join(mapRoot, "current.json"))
	if errors.Is(err, os.ErrNotExist) {
		return Document{}, ErrMapNotFound
	}
	if err != nil {
		return Document{}, err
	}
	var pointer CurrentPointer
	if err := decodeExact(pointerDocument, &pointer); err != nil {
		return Document{}, fmt.Errorf("%w: current pointer: %v", ErrMapIntegrity, err)
	}
	expectedPath := filepath.ToSlash(filepath.Join(
		"revisions", pointer.BundleRevision, "manifest.json",
	))
	if pointer.SchemaVersion != 1 || pointer.MapID != mapID ||
		!revisionPattern.MatchString(pointer.BundleRevision) ||
		!revisionPattern.MatchString(pointer.GraphRevision) ||
		pointer.ManifestPath != expectedPath {
		return Document{}, fmt.Errorf("%w: invalid current pointer", ErrMapIntegrity)
	}
	manifestDocument, err := os.ReadFile(filepath.Join(mapRoot, filepath.FromSlash(expectedPath)))
	if errors.Is(err, os.ErrNotExist) {
		return Document{}, ErrMapNotFound
	}
	if err != nil {
		return Document{}, err
	}
	var manifest Manifest
	if err := decodeExact(manifestDocument, &manifest); err != nil {
		return Document{}, fmt.Errorf("%w: manifest: %v", ErrMapIntegrity, err)
	}
	if manifest.SchemaVersion != 1 || manifest.MapID != mapID ||
		manifest.BundleRevision != pointer.BundleRevision ||
		manifest.GraphRevision != pointer.GraphRevision {
		return Document{}, fmt.Errorf("%w: current manifest mismatch", ErrMapIntegrity)
	}
	if err := validateManifestRevision(manifest); err != nil {
		return Document{}, err
	}
	return Document{
		Content: manifestDocument, BundleRevision: manifest.BundleRevision,
	}, nil
}

func (c *Catalog) Asset(mapID, bundleRevision, assetPath string) (AssetResource, error) {
	if !mapIdentifierPattern.MatchString(mapID) ||
		!revisionPattern.MatchString(bundleRevision) ||
		!assetPathPattern.MatchString(assetPath) {
		return AssetResource{}, ErrInvalidMapRequest
	}
	revisionDirectory := filepath.Join(c.root, mapID, "revisions", bundleRevision)
	manifestDocument, err := os.ReadFile(filepath.Join(revisionDirectory, "manifest.json"))
	if errors.Is(err, os.ErrNotExist) {
		return AssetResource{}, ErrMapNotFound
	}
	if err != nil {
		return AssetResource{}, err
	}
	var manifest Manifest
	if err := decodeExact(manifestDocument, &manifest); err != nil {
		return AssetResource{}, fmt.Errorf("%w: manifest: %v", ErrMapIntegrity, err)
	}
	if manifest.SchemaVersion != 1 || manifest.MapID != mapID ||
		manifest.BundleRevision != bundleRevision {
		return AssetResource{}, fmt.Errorf("%w: revision manifest mismatch", ErrMapIntegrity)
	}
	if err := validateManifestRevision(manifest); err != nil {
		return AssetResource{}, err
	}
	var selected *Asset
	for index := range manifest.Assets {
		if manifest.Assets[index].Path == assetPath {
			selected = &manifest.Assets[index]
			break
		}
	}
	if selected == nil {
		return AssetResource{}, ErrMapNotFound
	}
	if !revisionPattern.MatchString(selected.SHA256) ||
		(selected.ContentType != "application/json" &&
			selected.ContentType != "image/png") {
		return AssetResource{}, fmt.Errorf("%w: invalid asset metadata", ErrMapIntegrity)
	}
	file, err := os.Open(filepath.Join(revisionDirectory, assetPath))
	if errors.Is(err, os.ErrNotExist) {
		return AssetResource{}, ErrMapNotFound
	}
	if err != nil {
		return AssetResource{}, err
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return AssetResource{}, err
	}
	if !info.Mode().IsRegular() || info.Size() != selected.ByteSize {
		_ = file.Close()
		return AssetResource{}, fmt.Errorf("%w: asset size mismatch", ErrMapIntegrity)
	}
	cacheKey := filepath.Join(revisionDirectory, assetPath)
	stamp := verifiedAsset{
		size: info.Size(), modifiedUnixNano: info.ModTime().UnixNano(),
		sha256: selected.SHA256,
	}
	if cached, exists := c.verified.Load(cacheKey); !exists || cached != stamp {
		digest := sha256.New()
		if _, err := io.Copy(digest, file); err != nil {
			_ = file.Close()
			return AssetResource{}, err
		}
		actual := revision(digest.Sum(nil))
		if actual != selected.SHA256 {
			_ = file.Close()
			return AssetResource{}, fmt.Errorf("%w: asset digest mismatch", ErrMapIntegrity)
		}
		c.verified.Store(cacheKey, stamp)
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		_ = file.Close()
		return AssetResource{}, err
	}
	return AssetResource{
		Content: file, Name: selected.Path, ContentType: selected.ContentType,
		SHA256: selected.SHA256, Size: selected.ByteSize,
	}, nil
}

func validateManifestRevision(manifest Manifest) error {
	canonical, err := canonicalManifest(manifest)
	if err != nil {
		return fmt.Errorf("%w: canonical manifest: %v", ErrMapIntegrity, err)
	}
	digest := sha256.Sum256(canonical)
	if revision(digest[:]) != manifest.BundleRevision {
		return fmt.Errorf("%w: bundle revision mismatch", ErrMapIntegrity)
	}
	return nil
}

func decodeExact(document []byte, destination any) error {
	decoder := json.NewDecoder(bytes.NewReader(document))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("trailing JSON value")
		}
		return err
	}
	return nil
}
