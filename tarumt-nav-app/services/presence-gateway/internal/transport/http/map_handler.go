package httptransport

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/mapbundle"
)

type MapHandler struct {
	catalog *mapbundle.Catalog
}

func NewMapHandler(catalog *mapbundle.Catalog) *MapHandler {
	return &MapHandler{catalog: catalog}
}

func (h *MapHandler) Current(response http.ResponseWriter, request *http.Request) {
	document, err := h.catalog.Current(request.PathValue("map_id"))
	if err != nil {
		writeMapError(response, err)
		return
	}
	response.Header().Set("Content-Type", "application/json")
	response.Header().Set("Cache-Control", "no-cache")
	etag := `"` + document.BundleRevision + `"`
	response.Header().Set("ETag", etag)
	if etagMatches(request.Header.Get("If-None-Match"), etag) {
		response.WriteHeader(http.StatusNotModified)
		return
	}
	response.WriteHeader(http.StatusOK)
	_, _ = response.Write(document.Content)
}

func (h *MapHandler) Asset(response http.ResponseWriter, request *http.Request) {
	asset, err := h.catalog.Asset(
		request.PathValue("map_id"),
		request.PathValue("revision"),
		request.PathValue("asset_path"),
	)
	if err != nil {
		writeMapError(response, err)
		return
	}
	defer asset.Content.Close()

	response.Header().Set("Content-Type", asset.ContentType)
	response.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	etag := `"` + asset.SHA256 + `"`
	response.Header().Set("ETag", etag)
	if etagMatches(request.Header.Get("If-None-Match"), etag) {
		response.WriteHeader(http.StatusNotModified)
		return
	}
	http.ServeContent(response, request, asset.Name, time.Time{}, asset.Content)
}

func etagMatches(header, current string) bool {
	for _, candidate := range strings.Split(header, ",") {
		candidate = strings.TrimSpace(candidate)
		if candidate == "*" || strings.TrimPrefix(candidate, "W/") == current {
			return true
		}
	}
	return false
}

func writeMapError(response http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, mapbundle.ErrInvalidMapRequest):
		writeError(response, http.StatusBadRequest, "invalid_map_request", "map request is invalid")
	case errors.Is(err, mapbundle.ErrMapNotFound):
		writeError(response, http.StatusNotFound, "map_not_found", "map resource was not found")
	default:
		writeError(response, http.StatusInternalServerError, "map_unavailable", "map resource is unavailable")
	}
}
