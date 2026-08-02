package redisinfra

import (
	"encoding/base64"
	"fmt"
	"strings"
)

type Keyspace struct {
	prefix string
}

func NewKeyspace(prefix string) Keyspace {
	prefix = strings.Trim(strings.TrimSpace(prefix), ":")
	if prefix == "" {
		prefix = "campus:presence:v1"
	}
	return Keyspace{prefix: prefix}
}

func (k Keyspace) Prefix() string { return k.prefix }

func (k Keyspace) Session(sessionID string) string {
	return k.prefix + ":session:" + encodePart(sessionID)
}

func (k Keyspace) ActiveSessions() string { return k.prefix + ":sessions:active" }

func (k Keyspace) ActiveDevices() string { return k.prefix + ":devices:active" }

func (k Keyspace) CurrentDeviceSession(deviceRef string) string {
	return k.prefix + ":device:" + encodePart(deviceRef) + ":current-session"
}

func (k Keyspace) SessionExpirations() string { return k.prefix + ":sessions:expires" }

func (k Keyspace) Presence(sessionID string) string {
	return k.prefix + ":presence:" + encodePart(sessionID)
}

func (k Keyspace) ActivePresences() string { return k.prefix + ":presences:active" }

func (k Keyspace) TrajectoryStream() string { return k.prefix + ":trajectory:events" }

func (k Keyspace) ActiveJourney(deviceRef string) string {
	return k.prefix + ":journey:active:" + encodePart(deviceRef)
}

func (k Keyspace) ActiveJourneys() string {
	return k.prefix + ":journeys:active"
}

func (k Keyspace) JourneyIdempotency(deviceRef, clientEventID string) string {
	return k.prefix + ":journey:idempotency:" +
		encodePart(deviceRef) + ":" + encodePart(clientEventID)
}

func (k Keyspace) EndedJourney(journeyID string) string {
	return k.EndedJourneyPrefix() + journeyID
}

func (k Keyspace) EndedJourneyPrefix() string {
	return k.prefix + ":journey:ended:"
}

func (k Keyspace) JourneyLifecycleStream() string {
	return k.prefix + ":journey:lifecycle:events"
}

func (k Keyspace) BuildingActive(buildingID string) string {
	return k.buildingActivePart(encodePart(buildingID))
}

func (k Keyspace) buildingActivePart(buildingPart string) string {
	return k.prefix + ":building:" + buildingPart + ":active"
}

func (k Keyspace) BuildingFloors(buildingID string) string {
	return k.prefix + ":building:" + encodePart(buildingID) + ":floors"
}

func (k Keyspace) FloorActive(buildingID, floorID string) string {
	return k.floorActiveParts(encodePart(buildingID), encodePart(floorID))
}

func (k Keyspace) floorActiveParts(buildingPart, floorPart string) string {
	return k.prefix + ":floor:" + buildingPart + ":" + floorPart + ":active"
}

func (k Keyspace) FloorRepresentatives(buildingID, floorID string) string {
	return k.floorRepresentativeParts(encodePart(buildingID), encodePart(floorID))
}

func (k Keyspace) floorRepresentativeParts(buildingPart, floorPart string) string {
	return k.prefix + ":floor:" + buildingPart + ":" + floorPart + ":representatives"
}

func (k Keyspace) FloorEdges(buildingID, floorID string) string {
	return k.floorEdgesParts(encodePart(buildingID), encodePart(floorID))
}

func (k Keyspace) floorEdgesParts(buildingPart, floorPart string) string {
	return k.prefix + ":floor:" + buildingPart + ":" + floorPart + ":edges"
}

func (k Keyspace) FloorEdgeActive(buildingID, floorID, fromNodeID, toNodeID string) string {
	fromNodeID, toNodeID = canonicalEdge(fromNodeID, toNodeID)
	return k.floorEdgeActiveParts(
		encodePart(buildingID),
		encodePart(floorID),
		encodeEdgePart(fromNodeID, toNodeID),
	)
}

func (k Keyspace) floorEdgeActiveParts(buildingPart, floorPart, edgePart string) string {
	return k.prefix + ":floor:" + buildingPart + ":" + floorPart + ":edge:" + edgePart + ":active"
}

func (k Keyspace) FloorChannel(buildingID, floorID string) string {
	return k.prefix + ":floor:" + encodePart(buildingID) + ":" + encodePart(floorID) + ":events"
}

func encodePart(value string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(value))
}

func decodePart(value string) (string, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	return string(decoded), err
}

func encodeEdgePart(fromNodeID, toNodeID string) string {
	fromNodeID, toNodeID = canonicalEdge(fromNodeID, toNodeID)
	return encodePart(fromNodeID + "\x00" + toNodeID)
}

func decodeEdgePart(value string) (string, string, error) {
	decoded, err := decodePart(value)
	if err != nil {
		return "", "", err
	}
	nodes := strings.SplitN(decoded, "\x00", 2)
	if len(nodes) != 2 || nodes[0] == "" || nodes[1] == "" {
		return "", "", fmt.Errorf("invalid encoded edge")
	}
	return nodes[0], nodes[1], nil
}

func canonicalEdge(fromNodeID, toNodeID string) (string, string) {
	fromNodeID = strings.TrimSpace(fromNodeID)
	toNodeID = strings.TrimSpace(toNodeID)
	if fromNodeID <= toNodeID {
		return fromNodeID, toNodeID
	}
	return toNodeID, fromNodeID
}
