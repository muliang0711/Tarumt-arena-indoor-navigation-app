package application

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/campus-navigator/analytics-api/internal/domain"
)

type journeySummaryRepository interface {
	JourneySummary(context.Context, string, time.Time, time.Time) ([]domain.JourneySummaryRow, error)
}

func (s *AnalyticsService) Dashboard(ctx context.Context, mapID, period string) (domain.DashboardReport, error) {
	if mapID == "" || len(mapID) > 128 || (period != "today" && period != "week") {
		return domain.DashboardReport{}, fmt.Errorf("%w: map_id and period=today|week required", domain.ErrInvalidQuery)
	}
	repository, ok := s.repository.(journeySummaryRepository)
	if !ok {
		return domain.DashboardReport{}, fmt.Errorf("journey analytics unavailable")
	}
	zone := time.FixedZone("Asia/Kuala_Lumpur", 8*60*60)
	now := s.clock.Now().In(zone)
	from := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, zone)
	if period == "week" {
		from = from.AddDate(0, 0, -(int(from.Weekday())+6)%7)
	}
	rows, err := repository.JourneySummary(ctx, mapID, from.UTC(), now.UTC())
	if err != nil {
		return domain.DashboardReport{}, err
	}
	report := domain.DashboardReport{From: from, To: now, Timezone: "Asia/Kuala_Lumpur", GeneratedAt: now.UTC(), Destinations: []domain.DestinationSummary{}, Days: []domain.DailyJourneys{}}
	destinations := map[string]uint64{}
	days := map[string]uint64{}
	for _, row := range rows {
		report.Total += row.Count
		destinations[row.DestinationNodeID] += row.Count
		days[row.Day] += row.Count
		switch row.Outcome {
		case "arrived":
			report.Arrived += row.Count
		case "cancelled", "superseded":
			report.Cancelled += row.Count
		case "expired":
			report.Expired += row.Count
		default:
			report.Active += row.Count
		}
	}
	for node, count := range destinations {
		if count >= s.policy.PrivacyThreshold {
			report.Destinations = append(report.Destinations, domain.DestinationSummary{NodeID: node, Count: count})
		}
	}
	sort.Slice(report.Destinations, func(i, j int) bool {
		if report.Destinations[i].Count == report.Destinations[j].Count {
			return report.Destinations[i].NodeID < report.Destinations[j].NodeID
		}
		return report.Destinations[i].Count > report.Destinations[j].Count
	})
	for day := from; !day.After(now); day = day.AddDate(0, 0, 1) {
		key := day.Format("2006-01-02")
		report.Days = append(report.Days, domain.DailyJourneys{Day: key, Count: days[key]})
	}
	return report, nil
}
