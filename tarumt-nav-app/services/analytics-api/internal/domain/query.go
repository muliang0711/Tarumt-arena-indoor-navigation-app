package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrInvalidQuery   = errors.New("invalid analytics query")
	ErrResultTooLarge = errors.New("analytics result exceeds the row limit")
)

type Bucket string

const (
	Bucket15Minutes Bucket = "15m"
	BucketHour      Bucket = "1h"
	BucketDay       Bucket = "1d"
)

func ParseBucket(value string) (Bucket, error) {
	bucket := Bucket(strings.TrimSpace(value))
	switch bucket {
	case Bucket15Minutes, BucketHour, BucketDay:
		return bucket, nil
	default:
		return "", fmt.Errorf("%w: bucket must be 15m, 1h, or 1d", ErrInvalidQuery)
	}
}

func (b Bucket) Duration() time.Duration {
	switch b {
	case Bucket15Minutes:
		return 15 * time.Minute
	case BucketHour:
		return time.Hour
	case BucketDay:
		return 24 * time.Hour
	default:
		return 0
	}
}

type TrafficQuery struct {
	BuildingID string
	FloorID    string
	From       time.Time
	To         time.Time
	Bucket     Bucket
}

type QueryPolicy struct {
	PrivacyThreshold uint64
	MaxRange         time.Duration
	MaxResultRows    int
	ModerateAt       uint64
	BusyAt           uint64
}

func (q TrafficQuery) Normalized() TrafficQuery {
	q.BuildingID = strings.TrimSpace(q.BuildingID)
	q.FloorID = strings.TrimSpace(q.FloorID)
	q.From = q.From.UTC()
	q.To = q.To.UTC()
	return q
}

func (q TrafficQuery) Validate(policy QueryPolicy, now time.Time) error {
	q.BuildingID = strings.TrimSpace(q.BuildingID)
	q.FloorID = strings.TrimSpace(q.FloorID)
	if q.BuildingID == "" || q.FloorID == "" || len(q.BuildingID) > 128 || len(q.FloorID) > 128 {
		return fmt.Errorf("%w: building_id and floor_id are required and limited to 128 characters", ErrInvalidQuery)
	}
	duration := q.Bucket.Duration()
	if duration == 0 || q.From.IsZero() || q.To.IsZero() || !q.From.Before(q.To) {
		return fmt.Errorf("%w: invalid time window", ErrInvalidQuery)
	}
	from := q.From.UTC()
	to := q.To.UTC()
	if !from.Equal(from.Truncate(duration)) || !to.Equal(to.Truncate(duration)) {
		return fmt.Errorf("%w: from and to must align to UTC bucket boundaries", ErrInvalidQuery)
	}
	if to.Sub(from) > policy.MaxRange {
		return fmt.Errorf("%w: time range exceeds %s", ErrInvalidQuery, policy.MaxRange)
	}
	if to.After(now.UTC().Truncate(duration).Add(duration)) {
		return fmt.Errorf("%w: time range cannot extend beyond the current bucket", ErrInvalidQuery)
	}
	if policy.PrivacyThreshold < 5 || policy.MaxResultRows < 1 || policy.ModerateAt < policy.PrivacyThreshold || policy.BusyAt <= policy.ModerateAt {
		return fmt.Errorf("%w: server query policy is invalid", ErrInvalidQuery)
	}
	return nil
}
