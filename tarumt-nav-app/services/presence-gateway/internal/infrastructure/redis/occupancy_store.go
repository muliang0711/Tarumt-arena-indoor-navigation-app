package redisinfra

import (
	"context"
	"sort"
	"strconv"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
	redis "github.com/redis/go-redis/v9"
)

type OccupancyStore struct {
	client *redis.Client
	keys   Keyspace
}

func NewOccupancyStore(client *redis.Client, keys Keyspace) *OccupancyStore {
	return &OccupancyStore{client: client, keys: keys}
}

func (s *OccupancyStore) Snapshot(ctx context.Context, query ports.OccupancyQuery) (domain.FloorSnapshot, error) {
	cutoff := strconv.FormatInt(query.ActiveSince.UnixMilli(), 10)
	floorParts, err := s.client.SMembers(ctx, s.keys.BuildingFloors(query.BuildingID)).Result()
	if err != nil {
		return domain.FloorSnapshot{}, storeError("list building floors", err)
	}
	edgeParts, err := s.client.SMembers(ctx, s.keys.FloorEdges(query.BuildingID, query.FloorID)).Result()
	if err != nil {
		return domain.FloorSnapshot{}, storeError("list floor edges", err)
	}
	pipe := s.client.Pipeline()
	pipe.ZRemRangeByScore(ctx, s.keys.ActiveDevices(), "-inf", strconv.FormatInt(query.ActiveSince.UnixMilli()-1, 10))
	pipe.ZRemRangeByScore(ctx, s.keys.BuildingActive(query.BuildingID), "-inf", strconv.FormatInt(query.ActiveSince.UnixMilli()-1, 10))
	totalCommand := pipe.ZCount(ctx, s.keys.ActiveDevices(), cutoff, "+inf")
	buildingCommand := pipe.ZCount(ctx, s.keys.BuildingActive(query.BuildingID), cutoff, "+inf")
	floorCommands := make(map[string]*redis.IntCmd, len(floorParts))
	for _, floorPart := range floorParts {
		floorID, err := decodePart(floorPart)
		if err != nil {
			continue
		}
		floorKey := s.keys.floorActiveParts(encodePart(query.BuildingID), floorPart)
		pipe.ZRemRangeByScore(ctx, floorKey, "-inf", strconv.FormatInt(query.ActiveSince.UnixMilli()-1, 10))
		floorCommands[floorID] = pipe.ZCount(ctx, floorKey, cutoff, "+inf")
	}
	edgeCommands := make(map[string]*redis.IntCmd, len(edgeParts))
	for _, edgePart := range edgeParts {
		edgeKey := s.keys.floorEdgeActiveParts(encodePart(query.BuildingID), encodePart(query.FloorID), edgePart)
		pipe.ZRemRangeByScore(ctx, edgeKey, "-inf", strconv.FormatInt(query.ActiveSince.UnixMilli()-1, 10))
		edgeCommands[edgePart] = pipe.ZCount(ctx, edgeKey, cutoff, "+inf")
	}
	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return domain.FloorSnapshot{}, storeError("read occupancy counts", err)
	}
	counts := make([]domain.FloorCount, 0, len(floorCommands))
	for floorID, command := range floorCommands {
		count, err := command.Result()
		if err != nil {
			return domain.FloorSnapshot{}, storeError("read floor count", err)
		}
		if count > 0 {
			counts = append(counts, domain.FloorCount{FloorID: floorID, Count: int(count)})
		}
	}
	sort.Slice(counts, func(i, j int) bool { return counts[i].FloorID < counts[j].FloorID })
	edgeOccupancies := make([]domain.EdgeOccupancy, 0, len(edgeCommands))
	emptyEdgeParts := make([]any, 0)
	for edgePart, command := range edgeCommands {
		count, err := command.Result()
		if err != nil {
			return domain.FloorSnapshot{}, storeError("read edge occupancy", err)
		}
		if count == 0 {
			emptyEdgeParts = append(emptyEdgeParts, edgePart)
			continue
		}
		fromNodeID, toNodeID, err := decodeEdgePart(edgePart)
		if err != nil {
			continue
		}
		edgeOccupancies = append(edgeOccupancies, domain.EdgeOccupancy{
			FromNodeID: fromNodeID, ToNodeID: toNodeID, ActiveUsers: int(count),
		})
	}
	if len(emptyEdgeParts) > 0 {
		_ = s.client.SRem(ctx, s.keys.FloorEdges(query.BuildingID, query.FloorID), emptyEdgeParts...).Err()
	}
	sort.Slice(edgeOccupancies, func(i, j int) bool {
		if edgeOccupancies[i].FromNodeID != edgeOccupancies[j].FromNodeID {
			return edgeOccupancies[i].FromNodeID < edgeOccupancies[j].FromNodeID
		}
		return edgeOccupancies[i].ToNodeID < edgeOccupancies[j].ToNodeID
	})
	representatives, err := s.representatives(ctx, query)
	if err != nil {
		return domain.FloorSnapshot{}, err
	}
	return domain.FloorSnapshot{
		TotalActiveUsers: int(totalCommand.Val()), BuildingActiveUsers: int(buildingCommand.Val()),
		BuildingID: query.BuildingID, FloorID: query.FloorID, FloorCounts: counts,
		Representatives: representatives, EdgeOccupancies: edgeOccupancies,
		GeneratedAt: query.GeneratedAt.Format(time.RFC3339Nano),
	}, nil
}

func (s *OccupancyStore) representatives(ctx context.Context, query ports.OccupancyQuery) ([]domain.Presence, error) {
	scanLimit := max(query.RepresentativeLimit*50, 500)
	ids, err := representativesScript.Run(ctx, s.client, []string{
		s.keys.FloorRepresentatives(query.BuildingID, query.FloorID),
		s.keys.FloorActive(query.BuildingID, query.FloorID),
	}, query.ActiveSince.UnixMilli(), query.RepresentativeLimit, scanLimit).StringSlice()
	if err != nil {
		return nil, storeError("select representatives", err)
	}
	if len(ids) == 0 {
		return []domain.Presence{}, nil
	}
	pipe := s.client.Pipeline()
	commands := make([]*redis.StringCmd, 0, len(ids))
	for _, id := range ids {
		commands = append(commands, pipe.HGet(ctx, s.keys.Presence(id), "payload"))
	}
	_, _ = pipe.Exec(ctx)
	result := make([]domain.Presence, 0, len(commands))
	for _, command := range commands {
		payload, err := command.Bytes()
		if err == redis.Nil {
			continue
		}
		if err != nil {
			return nil, storeError("read representative", err)
		}
		presence, err := decodePresence(payload)
		if err != nil {
			return nil, err
		}
		if !presence.LastSeenAt.Before(query.ActiveSince) {
			result = append(result, presence)
		}
	}
	return result, nil
}
