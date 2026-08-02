package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/campus-navigator/analytics-api/internal/domain"
)

type fakeClock struct{ now time.Time }

func (c fakeClock) Now() time.Time { return c.now }

type fakeRepository struct {
	floorRows []domain.AggregateRow
	edgeRows  []domain.AggregateRow
	err       error
}

func (r *fakeRepository) FloorTraffic(context.Context, domain.TrafficQuery, domain.QueryPolicy) ([]domain.AggregateRow, domain.QueryStats, error) {
	return r.floorRows, domain.QueryStats{RowsRead: 100, BytesRead: 200}, r.err
}
func (r *fakeRepository) RouteEdgeUsage(context.Context, domain.TrafficQuery, domain.QueryPolicy) ([]domain.AggregateRow, domain.QueryStats, error) {
	return r.edgeRows, domain.QueryStats{RowsRead: 100, BytesRead: 200}, r.err
}
func (r *fakeRepository) Ping(context.Context) error { return r.err }
func (r *fakeRepository) Close() error               { return nil }

type fakeObserver struct {
	completed int
	failed    int
	filtered  int
}

func (o *fakeObserver) QueryCompleted(_ string, _ time.Duration, _ domain.QueryStats, _ int, filtered int) {
	o.completed++
	o.filtered += filtered
}
func (o *fakeObserver) QueryFailed(string) { o.failed++ }

func TestFloorTrafficAppliesSecondPrivacyBoundary(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 7, 22, 12, 5, 0, 0, time.UTC)
	bucket := time.Date(2026, 7, 22, 11, 0, 0, 0, time.UTC)
	repository := &fakeRepository{floorRows: []domain.AggregateRow{
		{BucketStart: bucket, JourneyCount: 4, EventCount: 20},
		{BucketStart: bucket.Add(15 * time.Minute), JourneyCount: 12, EventCount: 40},
	}}
	observer := &fakeObserver{}
	service := NewAnalyticsService(repository, fakeClock{now: now}, observer, testPolicy())
	report, err := service.FloorTraffic(context.Background(), testQuery())
	if err != nil {
		t.Fatal(err)
	}
	if len(report.Points) != 1 || report.Points[0].JourneyCount != 12 || report.Points[0].TrafficLevel != "moderate" {
		t.Fatalf("privacy-filtered report = %+v", report)
	}
	if observer.completed != 1 || observer.filtered != 1 {
		t.Fatalf("observer = %+v", observer)
	}
}

func TestRouteEdgesRanksInsideEachBucketAndFiltersSmallCohorts(t *testing.T) {
	t.Parallel()
	bucket := time.Date(2026, 7, 22, 11, 0, 0, 0, time.UTC)
	repository := &fakeRepository{edgeRows: []domain.AggregateRow{
		{BucketStart: bucket, FromNodeID: "b", ToNodeID: "c", JourneyCount: 7, EventCount: 8},
		{BucketStart: bucket, FromNodeID: "a", ToNodeID: "b", JourneyCount: 15, EventCount: 20},
		{BucketStart: bucket, FromNodeID: "private", ToNodeID: "edge", JourneyCount: 2, EventCount: 2},
	}}
	service := NewAnalyticsService(repository, fakeClock{now: time.Date(2026, 7, 22, 12, 5, 0, 0, time.UTC)}, nil, testPolicy())
	report, err := service.RouteEdgeUsage(context.Background(), testQuery())
	if err != nil {
		t.Fatal(err)
	}
	if len(report.Edges) != 2 || report.Edges[0].FromNodeID != "a" || report.Edges[0].UsageRank != 1 || report.Edges[1].UsageRank != 2 {
		t.Fatalf("ranked edge report = %+v", report)
	}
}

func TestRepositoryFailureIsReturnedAndObserved(t *testing.T) {
	t.Parallel()
	observer := &fakeObserver{}
	service := NewAnalyticsService(&fakeRepository{err: errors.New("unavailable")}, fakeClock{now: time.Date(2026, 7, 22, 12, 5, 0, 0, time.UTC)}, observer, testPolicy())
	if _, err := service.FloorTraffic(context.Background(), testQuery()); err == nil || observer.failed != 1 {
		t.Fatalf("error=%v observer=%+v", err, observer)
	}
}

func TestFloorTrafficRejectsOversizedResultInsteadOfSilentlyTruncating(t *testing.T) {
	t.Parallel()
	policy := testPolicy()
	policy.MaxResultRows = 1
	repository := &fakeRepository{floorRows: []domain.AggregateRow{
		{BucketStart: time.Date(2026, 7, 22, 11, 0, 0, 0, time.UTC), JourneyCount: 5},
		{BucketStart: time.Date(2026, 7, 22, 11, 15, 0, 0, time.UTC), JourneyCount: 6},
	}}
	service := NewAnalyticsService(repository, fakeClock{now: time.Date(2026, 7, 22, 12, 5, 0, 0, time.UTC)}, nil, policy)
	if _, err := service.FloorTraffic(context.Background(), testQuery()); !errors.Is(err, domain.ErrResultTooLarge) {
		t.Fatalf("oversized aggregate error = %v", err)
	}
}

func testPolicy() domain.QueryPolicy {
	return domain.QueryPolicy{PrivacyThreshold: 5, MaxRange: 7 * 24 * time.Hour, MaxResultRows: 500, ModerateAt: 10, BusyAt: 25}
}

func testQuery() domain.TrafficQuery {
	return domain.TrafficQuery{
		BuildingID: "main", FloorID: "2", Bucket: domain.Bucket15Minutes,
		From: time.Date(2026, 7, 22, 11, 0, 0, 0, time.UTC),
		To:   time.Date(2026, 7, 22, 12, 0, 0, 0, time.UTC),
	}
}
