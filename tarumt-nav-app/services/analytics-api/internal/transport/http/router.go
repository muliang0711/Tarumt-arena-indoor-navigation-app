package httptransport

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/campus-navigator/analytics-api/internal/application"
	"github.com/campus-navigator/analytics-api/internal/domain"
)

type DependencyHealth interface {
	Ping(context.Context) error
}

type OperationalMetrics interface {
	ConcurrencyRejected()
	HTTPRequest()
	WritePrometheus(io.Writer)
}

type RouterOptions struct {
	Address              string
	ShutdownTimeout      time.Duration
	QueryTimeout         time.Duration
	MaxConcurrentQueries int
}

type Server struct {
	server          *http.Server
	shutdownTimeout time.Duration
}

func NewServer(service *application.AnalyticsService, health DependencyHealth, metrics OperationalMetrics, logger *slog.Logger, options RouterOptions) *Server {
	handlers := &handlers{service: service, health: health, metrics: metrics, logger: logger, queryTimeout: options.QueryTimeout}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/analytics/floor-traffic", handlers.floorTraffic)
	mux.HandleFunc("GET /v1/analytics/route-edges", handlers.routeEdges)
	mux.HandleFunc("GET /health/live", handlers.live)
	mux.HandleFunc("GET /health/ready", handlers.ready)
	mux.HandleFunc("GET /metrics", handlers.prometheus)
	limited := withRequestMetrics(withRecovery(withConcurrencyLimit(mux, options.MaxConcurrentQueries, metrics), logger), metrics)
	return &Server{
		server: &http.Server{
			Addr: options.Address, Handler: limited, ReadHeaderTimeout: 3 * time.Second,
			IdleTimeout: 30 * time.Second,
		},
		shutdownTimeout: options.ShutdownTimeout,
	}
}

func (s *Server) Run(ctx context.Context) error {
	result := make(chan error, 1)
	go func() { result <- s.server.ListenAndServe() }()
	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), s.shutdownTimeout)
		defer cancel()
		return s.server.Shutdown(shutdownCtx)
	case err := <-result:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

type handlers struct {
	service      *application.AnalyticsService
	health       DependencyHealth
	metrics      OperationalMetrics
	logger       *slog.Logger
	queryTimeout time.Duration
}

func (h *handlers) floorTraffic(response http.ResponseWriter, request *http.Request) {
	query, err := parseTrafficQuery(request)
	if err != nil {
		writeError(response, http.StatusBadRequest, "invalid_query", err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(request.Context(), h.queryTimeout)
	defer cancel()
	report, err := h.service.FloorTraffic(ctx, query)
	if err != nil {
		h.handleQueryError(response, err)
		return
	}
	writeJSON(response, http.StatusOK, report)
}

func (h *handlers) routeEdges(response http.ResponseWriter, request *http.Request) {
	query, err := parseTrafficQuery(request)
	if err != nil {
		writeError(response, http.StatusBadRequest, "invalid_query", err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(request.Context(), h.queryTimeout)
	defer cancel()
	report, err := h.service.RouteEdgeUsage(ctx, query)
	if err != nil {
		h.handleQueryError(response, err)
		return
	}
	writeJSON(response, http.StatusOK, report)
}

func (h *handlers) handleQueryError(response http.ResponseWriter, err error) {
	if errors.Is(err, domain.ErrInvalidQuery) {
		writeError(response, http.StatusBadRequest, "invalid_query", err.Error())
		return
	}
	if errors.Is(err, domain.ErrResultTooLarge) {
		writeError(response, http.StatusUnprocessableEntity, "result_too_large", "analytics result is too large; narrow the requested time range")
		return
	}
	if errors.Is(err, context.DeadlineExceeded) {
		writeError(response, http.StatusServiceUnavailable, "query_timeout", "analytics query timed out")
		return
	}
	h.logger.Error("analytics query failed", "error", err)
	writeError(response, http.StatusServiceUnavailable, "analytics_unavailable", "analytics query is temporarily unavailable")
}

func (h *handlers) live(response http.ResponseWriter, _ *http.Request) {
	response.WriteHeader(http.StatusOK)
	_, _ = response.Write([]byte("ok\n"))
}

func (h *handlers) ready(response http.ResponseWriter, request *http.Request) {
	ctx, cancel := context.WithTimeout(request.Context(), 2*time.Second)
	defer cancel()
	if err := h.health.Ping(ctx); err != nil {
		writeError(response, http.StatusServiceUnavailable, "not_ready", "ClickHouse is unavailable")
		return
	}
	response.WriteHeader(http.StatusOK)
	_, _ = response.Write([]byte("ready\n"))
}

func (h *handlers) prometheus(response http.ResponseWriter, _ *http.Request) {
	response.Header().Set("Content-Type", "text/plain; version=0.0.4")
	h.metrics.WritePrometheus(response)
}

func writeJSON(response http.ResponseWriter, status int, body any) {
	response.Header().Set("Content-Type", "application/json")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(body)
}

func writeError(response http.ResponseWriter, status int, code, message string) {
	writeJSON(response, status, map[string]string{"code": code, "message": message})
}

func withConcurrencyLimit(next http.Handler, limit int, metrics OperationalMetrics) http.Handler {
	semaphore := make(chan struct{}, limit)
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/v1/analytics/floor-traffic" && request.URL.Path != "/v1/analytics/route-edges" {
			next.ServeHTTP(response, request)
			return
		}
		select {
		case semaphore <- struct{}{}:
			defer func() { <-semaphore }()
			next.ServeHTTP(response, request)
		default:
			metrics.ConcurrencyRejected()
			writeError(response, http.StatusTooManyRequests, "query_capacity_reached", "analytics query capacity is currently full")
		}
	})
}

func withRequestMetrics(next http.Handler, metrics OperationalMetrics) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		metrics.HTTPRequest()
		next.ServeHTTP(response, request)
	})
}

func withRecovery(next http.Handler, logger *slog.Logger) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("analytics HTTP handler panicked", "panic", recovered, "path", request.URL.Path)
				writeError(response, http.StatusInternalServerError, "internal_error", "analytics request failed")
			}
		}()
		next.ServeHTTP(response, request)
	})
}
