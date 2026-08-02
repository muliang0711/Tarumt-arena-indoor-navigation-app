package mapbundle

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
)

func publishFiles(outputRoot string, manifest Manifest, documents map[string][]byte) error {
	if strings.TrimSpace(outputRoot) == "" {
		return fmt.Errorf("%w: output root is required", ErrInvalidSource)
	}
	revisionsRoot := filepath.Join(outputRoot, "revisions")
	if err := os.MkdirAll(revisionsRoot, 0o755); err != nil {
		return err
	}
	destination := filepath.Join(revisionsRoot, manifest.BundleRevision)
	if _, err := os.Stat(destination); errors.Is(err, os.ErrNotExist) {
		temporary, createErr := os.MkdirTemp(revisionsRoot, ".publishing-*")
		if createErr != nil {
			return createErr
		}
		defer os.RemoveAll(temporary)
		for name, document := range documents {
			if writeErr := os.WriteFile(
				filepath.Join(temporary, name), document, 0o644,
			); writeErr != nil {
				return writeErr
			}
		}
		if err := writeJSONFile(filepath.Join(temporary, "manifest.json"), manifest); err != nil {
			return err
		}
		if err := verifyPublished(temporary, manifest, documents); err != nil {
			return err
		}
		if err := os.Rename(temporary, destination); err != nil {
			return err
		}
	} else if err != nil {
		return err
	} else if err := verifyPublished(destination, manifest, documents); err != nil {
		return err
	}

	pointer := CurrentPointer{
		SchemaVersion:  1,
		MapID:          manifest.MapID,
		BundleRevision: manifest.BundleRevision,
		GraphRevision:  manifest.GraphRevision,
		ManifestPath: filepath.ToSlash(filepath.Join(
			"revisions", manifest.BundleRevision, "manifest.json",
		)),
	}
	temporaryPointer, err := os.CreateTemp(outputRoot, ".current-*.json")
	if err != nil {
		return err
	}
	temporaryPath := temporaryPointer.Name()
	defer os.Remove(temporaryPath)
	encoder := json.NewEncoder(temporaryPointer)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(pointer); err != nil {
		_ = temporaryPointer.Close()
		return err
	}
	if err := temporaryPointer.Close(); err != nil {
		return err
	}
	return os.Rename(temporaryPath, filepath.Join(outputRoot, "current.json"))
}

func writeJSONFile(path string, value any) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(value); err != nil {
		_ = file.Close()
		return err
	}
	return file.Close()
}

func verifyPublished(
	directory string,
	expectedManifest Manifest,
	expectedDocuments map[string][]byte,
) error {
	manifestDocument, err := os.ReadFile(filepath.Join(directory, "manifest.json"))
	if err != nil {
		return fmt.Errorf("%w: manifest: %v", ErrPublishedIntegrity, err)
	}
	var actualManifest Manifest
	if err := json.Unmarshal(manifestDocument, &actualManifest); err != nil {
		return fmt.Errorf("%w: manifest: %v", ErrPublishedIntegrity, err)
	}
	if !reflect.DeepEqual(actualManifest, expectedManifest) {
		return fmt.Errorf("%w: manifest content mismatch", ErrPublishedIntegrity)
	}
	for name, expected := range expectedDocuments {
		actual, err := os.ReadFile(filepath.Join(directory, name))
		if err != nil {
			return fmt.Errorf("%w: %s: %v", ErrPublishedIntegrity, name, err)
		}
		expectedDigest := sha256.Sum256(expected)
		actualDigest := sha256.Sum256(actual)
		if expectedDigest != actualDigest || len(expected) != len(actual) {
			return fmt.Errorf("%w: %s content mismatch", ErrPublishedIntegrity, name)
		}
	}
	return nil
}

func revision(digest []byte) string {
	return "sha256:" + hex.EncodeToString(digest)
}
