package httptransport

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/campus-navigator/analytics-api/internal/application"
	"github.com/campus-navigator/analytics-api/internal/domain"
)

type handlerClock struct{ now time.Time }

func (c handlerClock) Now() time.Time { return c.now }

type handlerRepository struct {
	rows    []domain.AggregateRow
	entered chan struct{}
	release chan struct{}
}

func (r *handlerRepository) FloorTraffic(ctx context.Context, _ domain.TrafficQuery, _ domain.QueryPolicy) ([]domain.AggregateRow, domain.QueryStats, error) {
	if r.entered != nil {
		select {
		case r.entered <- struct{}{}:
		default:
		}
	}
	if r.release != nil {
		select {
		case <-r.release:
		case <-ctx.Done():
			return nil, domain.QueryStats{}, ctx.Err()
		}
	}
	return r.rows, domain.QueryStats{}, nil
}

func (r *handlerRepository) RouteEdgeUsage(context.Context, domain.TrafficQuery, domain.QueryPolicy) ([]domain.AggregateRow, domain.QueryStats, error) {
	return r.rows, domain.QueryStats{}, nil
}

func (r *handlerRepository) Ping(context.Context) error { return nil }
func (r *handlerRepository) Close() error               { return nil }

type handlerMetrics struct{}

func (handlerMetrics) QueryCompleted(string, time.Duration, domain.QueryStats, int, int) {}
func (handlerMetrics) QueryFailed(string)                                                {}
func (handlerMetrics) ConcurrencyRejected()                                              {}
func (handlerMetrics) HTTPRequest()                                                      {}
func (handlerMetrics) WritePrometheus(io.Writer)                                         {}

func TestFloorTrafficHTTPContractContainsOnlyAggregateFields(t *testing.T) {
	t.Parallel()
	bucketStart := time.Date(2026, 7, 22, 11, 0, 0, 0, time.UTC)
	repository := &handlerRepository{rows: []domain.AggregateRow{{
		BucketStart: bucketStart, JourneyCount: 5, EventCount: 8,
	}}}
	server := newTestServer(repository, 1)
	response := httptest.NewRecorder()
	server.server.Handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, validQueryURL(), nil))

	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	body := response.Body.String()
	for _, expected := range []string{"\"building_id\":\"main\"", "\"journey_count\":5", "\"movement_event_count\":8"} {
		if !strings.Contains(body, expected) {
			t.Fatalf("response missing %s: %s", expected, body)
		}
	}
	for _, forbidden := range []string{"journey_id", "event_id", "session_id", "device_id", "installation_id"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("response leaked forbidden field %q: %s", forbidden, body)
		}
	}
}

func TestAnalyticsConcurrencyLimitRejectsWithoutQueueing(t *testing.T) {
	t.Parallel()
	repository := &handlerRepository{
		rows:    []domain.AggregateRow{{BucketStart: time.Date(2026, 7, 22, 11, 0, 0, 0, time.UTC), JourneyCount: 5}},
		entered: make(chan struct{}, 1),
		release: make(chan struct{}),
	}
	server := newTestServer(repository, 1)
	firstDone := make(chan struct{})
	go func() {
		defer close(firstDone)
		server.server.Handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, validQueryURL(), nil))
	}()
	select {
	case <-repository.entered:
	case <-time.After(time.Second):
		t.Fatal("first analytics query did not enter repository")
	}

	second := httptest.NewRecorder()
	server.server.Handler.ServeHTTP(second, httptest.NewRequest(http.MethodGet, validQueryURL(), nil))
	if second.Code != http.StatusTooManyRequests || !strings.Contains(second.Body.String(), "query_capacity_reached") {
		t.Fatalf("second response status=%d body=%s", second.Code, second.Body.String())
	}
	close(repository.release)
	select {
	case <-firstDone:
	case <-time.After(time.Second):
		t.Fatal("first analytics query did not finish")
	}
}

func newTestServer(repository *handlerRepository, concurrency int) *Server {
	metrics := handlerMetrics{}
	policy := domain.QueryPolicy{
		PrivacyThreshold: 5, MaxRange: 7 * 24 * time.Hour,
		MaxResultRows: 500, ModerateAt: 10, BusyAt: 25,
	}
	service := application.NewAnalyticsService(repository, handlerClock{now: time.Date(2026, 7, 22, 12, 5, 0, 0, time.UTC)}, metrics, policy)
	return NewServer(service, repository, metrics, slog.New(slog.NewTextHandler(io.Discard, nil)), RouterOptions{
		Address: ":0", ShutdownTimeout: time.Second, QueryTimeout: time.Second, MaxConcurrentQueries: concurrency,
	})
}

func validQueryURL() string {
	return "/v1/analytics/floor-traffic?building_id=main&floor_id=2&from=2026-07-22T11%3A00%3A00Z&to=2026-07-22T12%3A00%3A00Z&bucket=15m"
}
