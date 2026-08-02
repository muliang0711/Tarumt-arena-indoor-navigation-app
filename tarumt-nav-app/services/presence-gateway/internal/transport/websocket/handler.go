package websockettransport

import (
	"errors"
	"net/http"
	"strings"

	"github.com/campus-navigator/presence-gateway/internal/application"
	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/coder/websocket"
)

type Handler struct {
	sessions       *application.SessionService
	runner         *SessionRunner
	allowedOrigins []string
}

func NewHandler(sessions *application.SessionService, runner *SessionRunner, allowedOrigins []string) *Handler {
	return &Handler{sessions: sessions, runner: runner, allowedOrigins: allowedOrigins}
}

func (h *Handler) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	token := bearerToken(request.Header.Get("Authorization"))
	session, err := h.sessions.Authenticate(request.Context(), token)
	if err != nil {
		if errors.Is(err, ports.ErrUnavailable) {
			http.Error(response, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	options := &websocket.AcceptOptions{OriginPatterns: h.allowedOrigins}
	connection, err := websocket.Accept(response, request, options)
	if err != nil {
		return
	}
	h.runner.Run(request.Context(), connection, session)
}

func bearerToken(value string) string {
	parts := strings.Fields(value)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}
