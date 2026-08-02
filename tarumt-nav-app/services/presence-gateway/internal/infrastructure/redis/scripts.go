package redisinfra

import (
	_ "embed"

	redis "github.com/redis/go-redis/v9"
)

var (
	//go:embed scripts/create_session.lua
	createSessionSource string
	//go:embed scripts/touch_session.lua
	touchSessionSource string
	//go:embed scripts/apply_presence.lua
	applyPresenceSource string
	//go:embed scripts/touch_presence.lua
	touchPresenceSource string
	//go:embed scripts/remove_presence.lua
	removePresenceSource string
	//go:embed scripts/representatives.lua
	representativesSource string
	//go:embed scripts/start_journey.lua
	startJourneySource string
	//go:embed scripts/recalculate_journey.lua
	recalculateJourneySource string
	//go:embed scripts/end_journey.lua
	endJourneySource string
	//go:embed scripts/record_journey_position.lua
	recordJourneyPositionSource string
	//go:embed scripts/expire_journey.lua
	expireJourneySource string
)

var (
	createSessionScript         = redis.NewScript(createSessionSource)
	touchSessionScript          = redis.NewScript(touchSessionSource)
	applyPresenceScript         = redis.NewScript(applyPresenceSource)
	touchPresenceScript         = redis.NewScript(touchPresenceSource)
	removePresenceScript        = redis.NewScript(removePresenceSource)
	representativesScript       = redis.NewScript(representativesSource)
	startJourneyScript          = redis.NewScript(startJourneySource)
	recalculateJourneyScript    = redis.NewScript(recalculateJourneySource)
	endJourneyScript            = redis.NewScript(endJourneySource)
	recordJourneyPositionScript = redis.NewScript(recordJourneyPositionSource)
	expireJourneyScript         = redis.NewScript(expireJourneySource)
)
