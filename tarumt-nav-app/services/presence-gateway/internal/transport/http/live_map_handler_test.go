package httptransport

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type stubFloorSnapshots struct {
	snapshot domain.FloorSnapshot
	err      error
}

func (s stubFloorSnapshots) SnapshotAll(context.Context, string, string) (domain.FloorSnapshot, error) {
	return s.snapshot, s.err
}

func TestLiveMapHandlerReturnsPrivacySafeActorPositions(t *testing.T) {
	now := time.Date(2026, 8, 28, 2, 0, 0, 0, time.UTC)
	handler := NewLiveMapHandler(stubFloorSnapshots{snapshot: domain.FloorSnapshot{
		TotalActiveUsers: 1, BuildingActiveUsers: 1, BuildingID: "main-campus", FloorID: "floor-2",
		Representatives: []domain.Presence{{
			SessionID: "private-session", JourneyID: "private-journey", DisplayName: "Aina",
			Position: domain.Position{BuildingID: "main-campus", FloorID: "floor-2", FromNodeID: "node-14", ToNodeID: "node-15", EdgeProgress: 0.4, Heading: 90, MovementState: "walking"},
			Sequence: 7, LastSeenAt: now,
		}}, GeneratedAt: now.Format(time.RFC3339Nano),
	}})
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/live/floors/{building_id}/{floor_id}", handler.FloorSnapshot)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/live/floors/main-campus/floor-2", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", response.Code, response.Body)
	}
	body := response.Body.String()
	if strings.Contains(body, "private-session") || strings.Contains(body, "private-journey") {
		t.Fatalf("response leaked private identifiers: %s", body)
	}
	if !strings.Contains(body, `"display_name":"Aina"`) || !strings.Contains(body, `"from_node_id":"node-14"`) {
		t.Fatalf("response omitted public actor position: %s", body)
	}
}

func TestLiveMapHandlerMapsUnavailableSnapshot(t *testing.T) {
	handler := NewLiveMapHandler(stubFloorSnapshots{err: ports.ErrUnavailable})
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/live/floors/{building_id}/{floor_id}", handler.FloorSnapshot)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/live/floors/main-campus/floor-2", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", response.Code)
	}
}
