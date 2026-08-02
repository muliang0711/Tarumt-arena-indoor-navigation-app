package httptransport

import (
	"crypto/sha256"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/campus-navigator/presence-gateway/internal/mapbundle"
)

const deliveryRevision = "sha256:2532c53621439362a101ea00de68894118b352089a15e131b54e22fa637c230d"

func TestCurrentMapReturnsCompleteManifest(t *testing.T) {
	mapDataRoot, manifest := writeMapDeliveryFixture(t)
	handler := NewMapHandler(mapbundle.NewCatalog(mapDataRoot))
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/maps/{map_id}/current", handler.Current)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodGet, "/v1/maps/main-campus/current", nil,
	)
	mux.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", response.Code, response.Body)
	}
	if response.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("content type = %q", response.Header().Get("Content-Type"))
	}
	if response.Header().Get("Cache-Control") != "no-cache" {
		t.Fatalf("cache control = %q", response.Header().Get("Cache-Control"))
	}
	if response.Header().Get("ETag") != `"`+deliveryRevision+`"` {
		t.Fatalf("ETag = %q", response.Header().Get("ETag"))
	}
	if response.Body.String() != manifest {
		t.Fatalf("body = %s, want %s", response.Body, manifest)
	}
}

func TestCurrentMapReturnsNotModifiedForMatchingETag(t *testing.T) {
	mapDataRoot, _ := writeMapDeliveryFixture(t)
	handler := NewMapHandler(mapbundle.NewCatalog(mapDataRoot))
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/maps/{map_id}/current", handler.Current)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodGet, "/v1/maps/main-campus/current", nil,
	)
	request.Header.Set("If-None-Match", `"`+deliveryRevision+`"`)
	mux.ServeHTTP(response, request)

	if response.Code != http.StatusNotModified {
		t.Fatalf("status = %d, want 304; body = %s", response.Code, response.Body)
	}
	if response.Body.Len() != 0 {
		t.Fatalf("304 response contained body %q", response.Body)
	}
}

func TestImmutableMapAssetIsStreamedFromManifest(t *testing.T) {
	mapDataRoot, _ := writeMapDeliveryFixture(t)
	handler := NewMapHandler(mapbundle.NewCatalog(mapDataRoot))
	mux := http.NewServeMux()
	mux.HandleFunc(
		"GET /v1/maps/{map_id}/revisions/{revision}/{asset_path}",
		handler.Asset,
	)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodGet,
		"/v1/maps/main-campus/revisions/"+deliveryRevision+"/floor-2.nodes.json",
		nil,
	)
	mux.ServeHTTP(response, request)

	expectedBody := `{"nodes":[]}`
	expectedDigest := fmt.Sprintf("sha256:%x", sha256.Sum256([]byte(expectedBody)))
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", response.Code, response.Body)
	}
	if response.Body.String() != expectedBody {
		t.Fatalf("body = %q, want %q", response.Body, expectedBody)
	}
	if response.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("content type = %q", response.Header().Get("Content-Type"))
	}
	if response.Header().Get("Cache-Control") !=
		"public, max-age=31536000, immutable" {
		t.Fatalf("cache control = %q", response.Header().Get("Cache-Control"))
	}
	if response.Header().Get("ETag") != `"`+expectedDigest+`"` {
		t.Fatalf("ETag = %q", response.Header().Get("ETag"))
	}
}

func TestCorruptedMapAssetIsNotServed(t *testing.T) {
	mapDataRoot, _ := writeMapDeliveryFixture(t)
	assetPath := filepath.Join(
		mapDataRoot, "main-campus", "revisions", deliveryRevision,
		"floor-2.nodes.json",
	)
	if err := os.WriteFile(assetPath, []byte(`{"nudes":[]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	handler := NewMapHandler(mapbundle.NewCatalog(mapDataRoot))
	mux := http.NewServeMux()
	mux.HandleFunc(
		"GET /v1/maps/{map_id}/revisions/{revision}/{asset_path}",
		handler.Asset,
	)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodGet,
		"/v1/maps/main-campus/revisions/"+deliveryRevision+"/floor-2.nodes.json",
		nil,
	)
	mux.ServeHTTP(response, request)

	if response.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500; body = %s", response.Code, response.Body)
	}
}

func TestTamperedCurrentManifestIsNotServed(t *testing.T) {
	mapDataRoot, manifest := writeMapDeliveryFixture(t)
	manifestPath := filepath.Join(
		mapDataRoot, "main-campus", "revisions", deliveryRevision,
		"manifest.json",
	)
	tampered := strings.Replace(manifest, `"kind":"nodes"`, `"kind":"rooms"`, 1)
	if err := os.WriteFile(manifestPath, []byte(tampered), 0o644); err != nil {
		t.Fatal(err)
	}
	handler := NewMapHandler(mapbundle.NewCatalog(mapDataRoot))
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/maps/{map_id}/current", handler.Current)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodGet, "/v1/maps/main-campus/current", nil,
	)
	mux.ServeHTTP(response, request)

	if response.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500; body = %s", response.Code, response.Body)
	}
}

func TestRouterExposesMapDeliveryEndpoints(t *testing.T) {
	mapDataRoot, _ := writeMapDeliveryFixture(t)
	mapHandler := NewMapHandler(mapbundle.NewCatalog(mapDataRoot))
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	router := NewRouter(
		http.NotFoundHandler(),
		http.NotFoundHandler(),
		mapHandler,
		fakeHealth{},
		nil,
		logger,
	)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodGet, "/v1/maps/main-campus/current", nil,
	)
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", response.Code, response.Body)
	}
}

func writeMapDeliveryFixture(t *testing.T) (string, string) {
	t.Helper()
	root := t.TempDir()
	revisionDirectory := filepath.Join(
		root, "main-campus", "revisions", deliveryRevision,
	)
	if err := os.MkdirAll(revisionDirectory, 0o755); err != nil {
		t.Fatal(err)
	}
	asset := `{"nodes":[]}`
	assetDigest := fmt.Sprintf("sha256:%x", sha256.Sum256([]byte(asset)))
	manifest := `{"schema_version":1,"map_id":"main-campus","bundle_revision":"` +
		deliveryRevision +
		`","graph_revision":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","assets":[{"asset_id":"floor-2-nodes","kind":"nodes","floor_id":"floor-2","path":"floor-2.nodes.json","sha256":"` +
		assetDigest +
		`","byte_size":12,"content_type":"application/json"}]}`
	if err := os.WriteFile(
		filepath.Join(revisionDirectory, "manifest.json"),
		[]byte(manifest),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(revisionDirectory, "floor-2.nodes.json"),
		[]byte(asset),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	current := `{"schema_version":1,"map_id":"main-campus","bundle_revision":"` +
		deliveryRevision +
		`","graph_revision":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","manifest_path":"revisions/` +
		deliveryRevision + `/manifest.json"}`
	if err := os.WriteFile(
		filepath.Join(root, "main-campus", "current.json"),
		[]byte(current),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	return root, manifest
}
