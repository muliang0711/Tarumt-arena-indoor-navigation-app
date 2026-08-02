package httptransport

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestParseTrafficQueryRejectsIdentityAndUnknownParameters(t *testing.T) {
	t.Parallel()
	base := "/v1/analytics/floor-traffic?building_id=main&floor_id=2&from=2026-07-22T10:00:00Z&to=2026-07-22T11:00:00Z&bucket=15m"
	request := httptest.NewRequest("GET", base, nil)
	if _, err := parseTrafficQuery(request); err != nil {
		t.Fatal(err)
	}
	for _, parameter := range []string{"journey_id", "event_id", "session_id", "device_ref"} {
		request = httptest.NewRequest("GET", base+"&"+parameter+"=private", nil)
		if _, err := parseTrafficQuery(request); err == nil || !strings.Contains(err.Error(), "forbidden") {
			t.Fatalf("identity parameter %q error = %v", parameter, err)
		}
	}
	request = httptest.NewRequest("GET", base+"&sql=select", nil)
	if _, err := parseTrafficQuery(request); err == nil {
		t.Fatal("unknown SQL parameter was accepted")
	}
}
