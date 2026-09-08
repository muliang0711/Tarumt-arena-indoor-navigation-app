package httptransport

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
)

type FloorSnapshotService interface {
	SnapshotAll(context.Context, string, string) (domain.FloorSnapshot, error)
}

type LiveMapHandler struct {
	snapshots FloorSnapshotService
}

type liveMapActor struct {
	ActorID     string          `json:"actor_id"`
	DisplayName string          `json:"display_name,omitempty"`
	Position    domain.Position `json:"position"`
	Sequence    uint64          `json:"sequence"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type liveMapSnapshot struct {
	TotalActiveUsers    int                    `json:"total_active_users"`
	BuildingActiveUsers int                    `json:"building_active_users"`
	BuildingID          string                 `json:"building_id"`
	FloorID             string                 `json:"floor_id"`
	FloorCounts         []domain.FloorCount    `json:"floor_counts"`
	Representatives     []liveMapActor         `json:"representatives"`
	EdgeOccupancies     []domain.EdgeOccupancy `json:"edge_occupancies"`
	GeneratedAt         string                 `json:"generated_at"`
}

func NewLiveMapHandler(snapshots FloorSnapshotService) *LiveMapHandler {
	return &LiveMapHandler{snapshots: snapshots}
}

func (h *LiveMapHandler) FloorSnapshot(response http.ResponseWriter, request *http.Request) {
	buildingID := strings.TrimSpace(request.PathValue("building_id"))
	floorID := strings.TrimSpace(request.PathValue("floor_id"))
	if buildingID == "" || floorID == "" || len(buildingID) > 128 || len(floorID) > 128 {
		writeError(response, http.StatusBadRequest, "invalid_floor", "building_id and floor_id are required")
		return
	}
	ctx, cancel := context.WithTimeout(request.Context(), 2*time.Second)
	defer cancel()
	snapshot, err := h.snapshots.SnapshotAll(ctx, buildingID, floorID)
	if err != nil {
		if errors.Is(err, ports.ErrUnavailable) || errors.Is(err, context.DeadlineExceeded) {
			writeError(response, http.StatusServiceUnavailable, "presence_unavailable", "live presence is temporarily unavailable")
			return
		}
		writeError(response, http.StatusInternalServerError, "snapshot_failed", "live snapshot could not be created")
		return
	}
	actors := make([]liveMapActor, 0, len(snapshot.Representatives))
	for _, presence := range snapshot.Representatives {
		actors = append(actors, liveMapActor{
			ActorID: publicLiveActorID(presence.SessionID), DisplayName: presence.DisplayName,
			Position: presence.Position, Sequence: presence.Sequence, UpdatedAt: presence.LastSeenAt,
		})
	}
	writeJSON(response, http.StatusOK, liveMapSnapshot{
		TotalActiveUsers: snapshot.TotalActiveUsers, BuildingActiveUsers: snapshot.BuildingActiveUsers,
		BuildingID: snapshot.BuildingID, FloorID: snapshot.FloorID, FloorCounts: snapshot.FloorCounts,
		Representatives: actors, EdgeOccupancies: snapshot.EdgeOccupancies, GeneratedAt: snapshot.GeneratedAt,
	})
}

func publicLiveActorID(sessionID string) string {
	digest := sha256.Sum256([]byte(sessionID))
	return hex.EncodeToString(digest[:8])
}
