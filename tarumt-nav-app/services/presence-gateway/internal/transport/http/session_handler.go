package httptransport

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/campus-navigator/presence-gateway/internal/application"
	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/identity"
)

type SessionHandler struct {
	sessions        *application.SessionService
	maxRequestBytes int64
}

type createSessionRequest struct {
	InstallationID string  `json:"installation_id"`
	DisplayName    *string `json:"display_name,omitempty"`
}

type createSessionResponse struct {
	SessionID        string `json:"session_id"`
	AccessToken      string `json:"access_token"`
	TokenType        string `json:"token_type"`
	TokenExpiresAt   string `json:"token_expires_at"`
	SessionExpiresAt string `json:"session_expires_at"`
	WebSocketPath    string `json:"websocket_path"`
}

func NewSessionHandler(sessions *application.SessionService, maxRequestBytes int64) *SessionHandler {
	return &SessionHandler{sessions: sessions, maxRequestBytes: maxRequestBytes}
}

func (h *SessionHandler) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		response.Header().Set("Allow", http.MethodPost)
		writeError(response, http.StatusMethodNotAllowed, "method_not_allowed", "only POST is supported")
		return
	}
	request.Body = http.MaxBytesReader(response, request.Body, h.maxRequestBytes)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	var input createSessionRequest
	if err := decoder.Decode(&input); err != nil || strings.TrimSpace(input.InstallationID) == "" {
		writeError(response, http.StatusBadRequest, "invalid_request", "installation_id is required")
		return
	}
	created, err := h.sessions.CreateWithDisplayName(request.Context(), input.InstallationID, input.DisplayName)
	if errors.Is(err, identity.ErrInvalidInstallationID) {
		writeError(response, http.StatusBadRequest, "invalid_installation_id", err.Error())
		return
	}
	if errors.Is(err, domain.ErrInvalidDisplayName) {
		writeError(response, http.StatusBadRequest, "invalid_display_name", err.Error())
		return
	}
	if errors.Is(err, ports.ErrUnavailable) {
		writeError(response, http.StatusServiceUnavailable, "service_unavailable", "session service is temporarily unavailable")
		return
	}
	if err != nil {
		writeError(response, http.StatusInternalServerError, "internal_error", "session could not be created")
		return
	}
	writeJSON(response, http.StatusCreated, createSessionResponse{
		SessionID: created.Session.ID, AccessToken: created.AccessToken, TokenType: "Bearer",
		TokenExpiresAt:   created.TokenExpiresAt.Format("2006-01-02T15:04:05.999999999Z07:00"),
		SessionExpiresAt: created.Session.ExpiresAt.Format("2006-01-02T15:04:05.999999999Z07:00"),
		WebSocketPath:    "/v1/presence",
	})
}
