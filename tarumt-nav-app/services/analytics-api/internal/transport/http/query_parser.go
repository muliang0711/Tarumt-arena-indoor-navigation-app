package httptransport

import (
	"fmt"
	"net/http"
	"time"

	"github.com/campus-navigator/analytics-api/internal/domain"
)

var allowedQueryParameters = map[string]struct{}{
	"building_id": {}, "floor_id": {}, "from": {}, "to": {}, "bucket": {},
}

var forbiddenIdentityParameters = map[string]struct{}{
	"journey_id": {}, "event_id": {}, "session_id": {}, "installation_id": {}, "device_id": {}, "device_ref": {},
}

func parseTrafficQuery(request *http.Request) (domain.TrafficQuery, error) {
	values := request.URL.Query()
	for key := range values {
		if _, forbidden := forbiddenIdentityParameters[key]; forbidden {
			return domain.TrafficQuery{}, fmt.Errorf("query parameter %q is forbidden by the analytics privacy policy", key)
		}
		if _, allowed := allowedQueryParameters[key]; !allowed {
			return domain.TrafficQuery{}, fmt.Errorf("unknown query parameter %q", key)
		}
		if len(values[key]) != 1 {
			return domain.TrafficQuery{}, fmt.Errorf("query parameter %q must occur exactly once", key)
		}
	}
	for key := range allowedQueryParameters {
		if len(values[key]) != 1 || values.Get(key) == "" {
			return domain.TrafficQuery{}, fmt.Errorf("query parameter %q is required", key)
		}
	}
	from, err := time.Parse(time.RFC3339, values.Get("from"))
	if err != nil {
		return domain.TrafficQuery{}, fmt.Errorf("from must be an RFC3339 timestamp")
	}
	to, err := time.Parse(time.RFC3339, values.Get("to"))
	if err != nil {
		return domain.TrafficQuery{}, fmt.Errorf("to must be an RFC3339 timestamp")
	}
	bucket, err := domain.ParseBucket(values.Get("bucket"))
	if err != nil {
		return domain.TrafficQuery{}, err
	}
	return domain.TrafficQuery{
		BuildingID: values.Get("building_id"), FloorID: values.Get("floor_id"),
		From: from, To: to, Bucket: bucket,
	}, nil
}
