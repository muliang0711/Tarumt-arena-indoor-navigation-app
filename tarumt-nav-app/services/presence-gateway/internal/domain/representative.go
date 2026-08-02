package domain

import (
	"crypto/sha256"
	"encoding/binary"
	"sort"
)

const maxExactRedisScore = uint64(1<<53 - 1)

func RepresentativeScore(buildingID, floorID, sessionID string) uint64 {
	hash := sha256.Sum256([]byte(buildingID + "\x00" + floorID + "\x00" + sessionID))
	return binary.BigEndian.Uint64(hash[:8]) & maxExactRedisScore
}

func SelectRepresentatives(buildingID, floorID string, presences []Presence, limit int) []Presence {
	if limit < 1 {
		return nil
	}
	result := append([]Presence(nil), presences...)
	sort.Slice(result, func(i, j int) bool {
		left := RepresentativeScore(buildingID, floorID, result[i].SessionID)
		right := RepresentativeScore(buildingID, floorID, result[j].SessionID)
		if left == right {
			return result[i].SessionID < result[j].SessionID
		}
		return left < right
	})
	if len(result) > limit {
		result = result[:limit]
	}
	return result
}
