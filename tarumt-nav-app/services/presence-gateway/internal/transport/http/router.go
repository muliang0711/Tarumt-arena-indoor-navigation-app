package httptransport

import (
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
)

type OperationalMetrics interface {
	ObserveHTTPRequest(method, path string, status int, duration time.Duration)
	WritePrometheus(io.Writer)
}

type noopMetrics struct{}

func (noopMetrics) ObserveHTTPRequest(string, string, int, time.Duration) {}
func (noopMetrics) WritePrometheus(io.Writer)                             {}

func NewRouter(
	sessionHandler, websocketHandler http.Handler,
	mapHandler *MapHandler,
	health ports.DependencyHealth,
	metrics OperationalMetrics,
	logger *slog.Logger,
) http.Handler {
	if metrics == nil {
		metrics = noopMetrics{}
	}
	mux := http.NewServeMux()
	healthHandler := NewHealthHandler(health)
	mux.Handle("POST /v1/anonymous-sessions", sessionHandler)
	mux.Handle("GET /v1/presence", websocketHandler)
	if mapHandler != nil {
		mux.HandleFunc("GET /v1/maps/{map_id}/current", mapHandler.Current)
		mux.HandleFunc(
			"GET /v1/maps/{map_id}/revisions/{revision}/{asset_path}",
			mapHandler.Asset,
		)
	}
	mux.HandleFunc("GET /health/live", liveHandler)
	mux.HandleFunc("GET /health/ready", healthHandler.Ready)
	mux.HandleFunc("GET /metrics", func(response http.ResponseWriter, _ *http.Request) {
		response.Header().Set("Content-Type", "text/plain; version=0.0.4")
		metrics.WritePrometheus(response)
	})
	return withMetrics(withRecovery(withAccessLog(mux, logger), logger), metrics)
}
