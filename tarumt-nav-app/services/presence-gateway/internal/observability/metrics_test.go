package observability

import (
	"bytes"
	"strings"
	"testing"
	"time"
)

func TestMetricsExposeBoundedHTTPAndWebSocketSignals(t *testing.T) {
	t.Parallel()
	metrics := NewMetrics()
	metrics.ObserveHTTPRequest("POST", "/v1/anonymous-sessions", 201, 12*time.Millisecond)
	metrics.ObserveHTTPRequest("DELETE", "/unbounded/value", 404, 4*time.Millisecond)
	metrics.WebSocketOpened()
	metrics.WebSocketMessage("location_update", "accepted", 20*time.Millisecond)
	metrics.WebSocketMessage("user-controlled-type", "anything", 30*time.Millisecond)
	metrics.WebSocketTerminated("slow_consumer")
	metrics.WebSocketTerminated("unbounded-reason")
	metrics.WebSocketClosed()
	metrics.FloorProjectionOpened()
	metrics.FloorProjectionSubscriberAdded()
	metrics.FloorEventReceived("presence_updated")
	metrics.FloorEventReceived("user-floor")
	metrics.FloorSnapshotRefreshed("membership", "success", 15*time.Millisecond)
	metrics.FloorSnapshotRefreshed("user-reason", "anything", 30*time.Millisecond)
	metrics.FloorMovementHandled("coalesced")
	metrics.FloorMovementHandled("user-outcome")
	metrics.FloorProjectionSubscriberRemoved()
	metrics.FloorProjectionClosed()
	var output bytes.Buffer
	metrics.WritePrometheus(&output)

	for _, expected := range []string{
		"presence_gateway_websocket_connections_active 0",
		"presence_gateway_websocket_connections_opened_total 1",
		"presence_gateway_websocket_connections_closed_total 1",
		`presence_gateway_websocket_terminations_total{reason="slow_consumer"} 1`,
		`presence_gateway_websocket_terminations_total{reason="other"} 1`,
		`presence_gateway_http_request_duration_seconds_count{method="POST",path="/v1/anonymous-sessions",status="201"} 1`,
		`presence_gateway_http_request_duration_seconds_count{method="other",path="other",status="404"} 1`,
		`presence_gateway_websocket_message_duration_seconds_count{type="location_update",outcome="accepted"} 1`,
		`presence_gateway_websocket_message_duration_seconds_count{type="unknown",outcome="failed"} 1`,
		"presence_gateway_floor_projections_active 0",
		"presence_gateway_floor_projection_subscribers_active 0",
		`presence_gateway_floor_events_total{type="presence_updated"} 1`,
		`presence_gateway_floor_events_total{type="unknown"} 1`,
		`presence_gateway_floor_snapshot_refresh_duration_seconds_count{reason="membership",outcome="success"} 1`,
		`presence_gateway_floor_snapshot_refresh_duration_seconds_count{reason="unknown",outcome="failed"} 1`,
		`presence_gateway_floor_movement_events_total{outcome="coalesced"} 1`,
		`presence_gateway_floor_movement_events_total{outcome="unknown"} 1`,
	} {
		if !strings.Contains(output.String(), expected) {
			t.Fatalf("metrics missing %q:\n%s", expected, output.String())
		}
	}
}

func TestMetricsKeepJourneyCommandsObservable(t *testing.T) {
	t.Parallel()
	metrics := NewMetrics()
	metrics.WebSocketMessage("journey_start", "accepted", time.Millisecond)
	metrics.WebSocketMessage("route_recalculate", "accepted", time.Millisecond)
	metrics.WebSocketMessage("journey_end", "accepted", time.Millisecond)
	var output bytes.Buffer
	metrics.WritePrometheus(&output)
	encoded := output.String()
	for _, messageType := range []string{
		"journey_start",
		"route_recalculate",
		"journey_end",
	} {
		expected := `type="` + messageType + `",outcome="accepted"} 1`
		if !strings.Contains(encoded, expected) {
			t.Fatalf("Journey metrics missing %q:\n%s", expected, encoded)
		}
	}
}
