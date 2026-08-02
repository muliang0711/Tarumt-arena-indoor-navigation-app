local previous_payload = redis.call('HGET', KEYS[1], 'payload')
local previous_sequence = redis.call('HGET', KEYS[1], 'sequence')
if previous_sequence and tonumber(ARGV[3]) <= tonumber(previous_sequence) then
  return {0, ''}
end

local previous_journey = redis.call('HGET', KEYS[1], 'journey_id')
local accepted_journey = ARGV[14]
if ARGV[16] ~= '1' and previous_journey and previous_journey ~= '' then
  accepted_journey = previous_journey
end
if ARGV[16] == '1' then
  local active_payload = redis.call('GET', KEYS[8])
  if not active_payload then
    if redis.call('EXISTS', KEYS[9]) == 1 then
      return {-2, ''}
    end
    return {-3, ''}
  end
  local active = cjson.decode(active_payload)
  if active['journey_id'] ~= accepted_journey then
    return {-4, ''}
  end
  active['session_id'] = ARGV[2]
  active['presence_key'] = KEYS[1]
  active['last_position_at'] = ARGV[17]
  active['last_position_at_ms'] = tonumber(ARGV[18])
  redis.call('SET', KEYS[8], cjson.encode(active))
end
local trajectory_payload = ARGV[10]
local trajectory = cjson.decode(trajectory_payload)
trajectory['journey_id'] = accepted_journey
trajectory_payload = cjson.encode(trajectory)

local old_building = redis.call('HGET', KEYS[1], 'building_key')
local old_floor = redis.call('HGET', KEYS[1], 'floor_key')
local old_edge = redis.call('HGET', KEYS[1], 'edge_key')
if old_building and old_floor and (old_building ~= ARGV[4] or old_floor ~= ARGV[5]) then
  redis.call('ZREM', ARGV[9] .. ':building:' .. old_building .. ':active', ARGV[2])
  redis.call('ZREM', ARGV[9] .. ':floor:' .. old_building .. ':' .. old_floor .. ':active', ARGV[2])
  redis.call('ZREM', ARGV[9] .. ':floor:' .. old_building .. ':' .. old_floor .. ':representatives', ARGV[2])
end
if old_building and old_floor and old_edge and
    (old_building ~= ARGV[4] or old_floor ~= ARGV[5] or old_edge ~= ARGV[19]) then
  redis.call('ZREM', ARGV[9] .. ':floor:' .. old_building .. ':' .. old_floor .. ':edge:' .. old_edge .. ':active', ARGV[2])
end

redis.call('HSET', KEYS[1],
  'payload', ARGV[1],
  'journey_id', accepted_journey,
  'sequence', ARGV[3],
  'building_key', ARGV[4],
  'floor_key', ARGV[5],
  'edge_key', ARGV[19],
  'last_seen_ms', ARGV[6])
redis.call('PEXPIRE', KEYS[1], ARGV[7])
redis.call('ZADD', KEYS[2], ARGV[6], ARGV[2])
redis.call('ZADD', KEYS[3], ARGV[6], ARGV[2])
redis.call('SADD', KEYS[4], ARGV[5])
redis.call('ZADD', KEYS[5], ARGV[6], ARGV[2])
redis.call('ZADD', KEYS[6], ARGV[8], ARGV[2])
redis.call('SADD', ARGV[9] .. ':floor:' .. ARGV[4] .. ':' .. ARGV[5] .. ':edges', ARGV[19])
redis.call('ZADD', ARGV[9] .. ':floor:' .. ARGV[4] .. ':' .. ARGV[5] .. ':edge:' .. ARGV[19] .. ':active', ARGV[6], ARGV[2])
if ARGV[11] == '1' then
  local max_length = tonumber(ARGV[12])
  if max_length and max_length > 0 then
    redis.call('XADD', KEYS[7], 'MAXLEN', '~', max_length, '*', 'schema_version', ARGV[15], 'event_id', ARGV[13], 'payload', trajectory_payload)
  else
    redis.call('XADD', KEYS[7], '*', 'schema_version', ARGV[15], 'event_id', ARGV[13], 'payload', trajectory_payload)
  end
end
return {1, previous_payload or '', previous_journey or '', accepted_journey, trajectory_payload}
