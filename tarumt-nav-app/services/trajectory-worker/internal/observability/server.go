package observability

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

type ReadinessCheck func(context.Context) error

type PrometheusWriter interface {
	WritePrometheus(io.Writer)
}

type Server struct {
	server          *http.Server
	metrics         PrometheusWriter
	readiness       ReadinessCheck
	shutdownTimeout time.Duration
}

func NewServer(address string, metrics PrometheusWriter, readiness ReadinessCheck, shutdownTimeout time.Duration) *Server {
	instance := &Server{metrics: metrics, readiness: readiness, shutdownTimeout: shutdownTimeout}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health/live", instance.live)
	mux.HandleFunc("GET /health/ready", instance.ready)
	mux.HandleFunc("GET /metrics", instance.prometheus)
	instance.server = &http.Server{
		Addr: address, Handler: mux, ReadHeaderTimeout: 3 * time.Second,
		IdleTimeout: 30 * time.Second,
	}
	return instance
}

func (s *Server) Run(ctx context.Context) error {
	result := make(chan error, 1)
	go func() {
		result <- s.server.ListenAndServe()
	}()
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

func (s *Server) live(response http.ResponseWriter, _ *http.Request) {
	response.WriteHeader(http.StatusOK)
	_, _ = response.Write([]byte("ok\n"))
}

func (s *Server) ready(response http.ResponseWriter, request *http.Request) {
	ctx, cancel := context.WithTimeout(request.Context(), 2*time.Second)
	defer cancel()
	if err := s.readiness(ctx); err != nil {
		http.Error(response, fmt.Sprintf("unavailable: %v", err), http.StatusServiceUnavailable)
		return
	}
	response.WriteHeader(http.StatusOK)
	_, _ = response.Write([]byte("ready\n"))
}

func (s *Server) prometheus(response http.ResponseWriter, _ *http.Request) {
	response.Header().Set("Content-Type", "text/plain; version=0.0.4")
	s.metrics.WritePrometheus(response)
}
