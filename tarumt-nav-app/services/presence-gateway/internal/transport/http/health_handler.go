package httptransport

import (
	"net/http"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
)

type HealthHandler struct {
	health ports.DependencyHealth
}

func NewHealthHandler(health ports.DependencyHealth) *HealthHandler {
	return &HealthHandler{health: health}
}

func liveHandler(response http.ResponseWriter, _ *http.Request) {
	writeJSON(response, http.StatusOK, map[string]string{"status": "live"})
}

func (h *HealthHandler) Ready(response http.ResponseWriter, request *http.Request) {
	if err := h.health.Ready(request.Context()); err != nil {
		writeError(response, http.StatusServiceUnavailable, "not_ready", "service dependency is unavailable")
		return
	}
	writeJSON(response, http.StatusOK, map[string]string{"status": "ready"})
}
