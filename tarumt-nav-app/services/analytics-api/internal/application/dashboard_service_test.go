package application

import (
	"context"
	"github.com/campus-navigator/analytics-api/internal/domain"
	"testing"
	"time"
)

type dashboardRepository struct {
	fakeRepository
	from, to time.Time
}

func (r *dashboardRepository) JourneySummary(_ context.Context, _ string, from, to time.Time) ([]domain.JourneySummaryRow, error) {
	r.from, r.to = from, to
	return []domain.JourneySummaryRow{
		{Day: "2026-09-07", DestinationNodeID: "node-14", Outcome: "arrived", Count: 8},
		{Day: "2026-09-07", DestinationNodeID: "node-14", Outcome: "", Count: 12},
		{Day: "2026-09-07", DestinationNodeID: "node-11", Outcome: "cancelled", Count: 6},
		{Day: "2026-09-07", DestinationNodeID: "node-4", Outcome: "expired", Count: 2},
	}, nil
}
func TestDashboardUsesMalaysiaCalendarAndCountsJourneys(t *testing.T) {
	// UTC Sunday evening is already Monday in Malaysia.
	now := time.Date(2026, 9, 6, 17, 0, 0, 0, time.UTC)
	for _, period := range []string{"today", "week"} {
		r := &dashboardRepository{}
		s := NewAnalyticsService(r, fakeClock{now: now}, nil, testPolicy())
		report, err := s.Dashboard(context.Background(), "main-campus", period)
		if err != nil {
			t.Fatal(err)
		}
		wantFrom := time.Date(2026, 9, 6, 16, 0, 0, 0, time.UTC)
		if !r.from.Equal(wantFrom) || !r.to.Equal(now) {
			t.Fatalf("incorrect local-calendar window: %v – %v", r.from, r.to)
		}
		if report.Total != 28 || report.Arrived != 8 || report.Active != 12 || report.Cancelled != 6 || report.Expired != 2 {
			t.Fatalf("incorrect totals: %+v", report)
		}
		if len(report.Destinations) != 2 || report.Destinations[0].Count != 20 {
			t.Fatalf("ranking must combine outcomes and suppress small destination cohorts: %+v", report.Destinations)
		}
		if len(report.Days) != 1 || report.Days[0].Day != "2026-09-07" || report.Days[0].Count != 28 {
			t.Fatalf("wrong trend: %+v", report.Days)
		}
	}
}
