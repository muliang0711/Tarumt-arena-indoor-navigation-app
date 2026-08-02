package httptransport

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeHealth struct{ err error }

func (h fakeHealth) Ready(context.Context) error { return h.err }

func TestReadinessReflectsDependencyHealth(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name   string
		err    error
		status int
	}{
		{name: "ready", status: http.StatusOK},
		{name: "unavailable", err: errors.New("Redis unavailable"), status: http.StatusServiceUnavailable},
	}
	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			handler := NewHealthHandler(fakeHealth{err: test.err})
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
			handler.Ready(response, request)
			if response.Code != test.status {
				t.Fatalf("status = %d, want %d", response.Code, test.status)
			}
		})
	}
}
