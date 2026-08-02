package application

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/campus-navigator/analytics-api/internal/application/ports"
	"github.com/campus-navigator/analytics-api/internal/domain"
)

type AnalyticsService struct {
	repository ports.AnalyticsRepository
	clock      ports.Clock
	observer   ports.Observer
	policy     domain.QueryPolicy
}

func NewAnalyticsService(repository ports.AnalyticsRepository, clock ports.Clock, observer ports.Observer, policy domain.QueryPolicy) *AnalyticsService {
	if observer == nil {
		observer = ports.NoopObserver{}
	}
	return &AnalyticsService{repository: repository, clock: clock, observer: observer, policy: policy}
}

func (s *AnalyticsService) FloorTraffic(ctx context.Context, query domain.TrafficQuery) (domain.FloorTrafficReport, error) {
	query = query.Normalized()
	if err := query.Validate(s.policy, s.clock.Now()); err != nil {
		return domain.FloorTrafficReport{}, err
	}
	startedAt := time.Now()
	rows, stats, err := s.repository.FloorTraffic(ctx, query, s.policy)
	if err != nil {
		s.observer.QueryFailed("floor_traffic")
		return domain.FloorTrafficReport{}, fmt.Errorf("query floor traffic: %w", err)
	}
	points := make([]domain.FloorTrafficPoint, 0, len(rows))
	filtered := 0
	for _, row := range rows {
		if row.JourneyCount < s.policy.PrivacyThreshold {
			filtered++
			continue
		}
		points = append(points, domain.FloorTrafficPoint{
			BucketStart: row.BucketStart.UTC(), JourneyCount: row.JourneyCount,
			MovementEventCount: row.EventCount, TrafficLevel: domain.TrafficLevel(row.JourneyCount, s.policy),
		})
	}
	if len(points) > s.policy.MaxResultRows {
		s.observer.QueryFailed("floor_traffic")
		return domain.FloorTrafficReport{}, fmt.Errorf("%w: narrow the requested time range", domain.ErrResultTooLarge)
	}
	s.observer.QueryCompleted("floor_traffic", time.Since(startedAt), stats, len(points), filtered)
	return domain.FloorTrafficReport{
		BuildingID: query.BuildingID, FloorID: query.FloorID,
		From: query.From, To: query.To, Bucket: query.Bucket,
		GeneratedAt: s.clock.Now().UTC(), Points: points,
	}, nil
}

func (s *AnalyticsService) RouteEdgeUsage(ctx context.Context, query domain.TrafficQuery) (domain.RouteEdgeReport, error) {
	query = query.Normalized()
	if err := query.Validate(s.policy, s.clock.Now()); err != nil {
		return domain.RouteEdgeReport{}, err
	}
	startedAt := time.Now()
	rows, stats, err := s.repository.RouteEdgeUsage(ctx, query, s.policy)
	if err != nil {
		s.observer.QueryFailed("route_edges")
		return domain.RouteEdgeReport{}, fmt.Errorf("query route edges: %w", err)
	}
	filteredRows := make([]domain.AggregateRow, 0, len(rows))
	filtered := 0
	for _, row := range rows {
		if row.JourneyCount < s.policy.PrivacyThreshold {
			filtered++
			continue
		}
		filteredRows = append(filteredRows, row)
	}
	sort.Slice(filteredRows, func(i, j int) bool {
		if !filteredRows[i].BucketStart.Equal(filteredRows[j].BucketStart) {
			return filteredRows[i].BucketStart.Before(filteredRows[j].BucketStart)
		}
		if filteredRows[i].JourneyCount != filteredRows[j].JourneyCount {
			return filteredRows[i].JourneyCount > filteredRows[j].JourneyCount
		}
		if filteredRows[i].FromNodeID != filteredRows[j].FromNodeID {
			return filteredRows[i].FromNodeID < filteredRows[j].FromNodeID
		}
		return filteredRows[i].ToNodeID < filteredRows[j].ToNodeID
	})
	edges := make([]domain.RouteEdgeUsage, 0, min(len(filteredRows), s.policy.MaxResultRows))
	var activeBucket time.Time
	rank := 0
	for _, row := range filteredRows {
		if !row.BucketStart.Equal(activeBucket) {
			activeBucket = row.BucketStart
			rank = 0
		}
		rank++
		edges = append(edges, domain.RouteEdgeUsage{
			BucketStart: row.BucketStart.UTC(), FromNodeID: row.FromNodeID, ToNodeID: row.ToNodeID,
			JourneyCount: row.JourneyCount, TraversalEventCount: row.EventCount, UsageRank: rank,
		})
	}
	if len(edges) > s.policy.MaxResultRows {
		s.observer.QueryFailed("route_edges")
		return domain.RouteEdgeReport{}, fmt.Errorf("%w: narrow the requested time range", domain.ErrResultTooLarge)
	}
	s.observer.QueryCompleted("route_edges", time.Since(startedAt), stats, len(edges), filtered)
	return domain.RouteEdgeReport{
		BuildingID: query.BuildingID, FloorID: query.FloorID,
		From: query.From, To: query.To, Bucket: query.Bucket,
		GeneratedAt: s.clock.Now().UTC(), Edges: edges,
	}, nil
}
