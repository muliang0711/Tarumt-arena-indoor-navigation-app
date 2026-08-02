local cached = redis.call('GET', KEYS[2])
if cached then
  return {'DEDUP', cached, ''}
end

local function append_event(payload, event_id)
  if tonumber(ARGV[12]) > 0 then
    redis.call('XADD', KEYS[4], 'MAXLEN', '~', ARGV[12], '*',
      'schema_version', ARGV[13], 'event_id', event_id, 'payload', payload)
  else
    redis.call('XADD', KEYS[4], '*',
      'schema_version', ARGV[13], 'event_id', event_id, 'payload', payload)
  end
end

local function remove_presence(presence_key, session_id)
  if not presence_key or presence_key == '' then
    return ''
  end
  local payload = redis.call('HGET', presence_key, 'payload')
  if not payload then
    return ''
  end
  local building = redis.call('HGET', presence_key, 'building_key')
  local floor = redis.call('HGET', presence_key, 'floor_key')
  local edge = redis.call('HGET', presence_key, 'edge_key')
  redis.call('DEL', presence_key)
  redis.call('ZREM', KEYS[5], session_id)
  if building and floor then
    redis.call('ZREM', ARGV[11] .. ':building:' .. building .. ':active', session_id)
    redis.call('ZREM', ARGV[11] .. ':floor:' .. building .. ':' .. floor .. ':active', session_id)
    redis.call('ZREM', ARGV[11] .. ':floor:' .. building .. ':' .. floor .. ':representatives', session_id)
    if edge then
      redis.call('ZREM', ARGV[11] .. ':floor:' .. building .. ':' .. floor .. ':edge:' .. edge .. ':active', session_id)
    end
  end
  return payload
end

local removed_presence = ''
local previous_payload = redis.call('GET', KEYS[1])
if previous_payload then
  local previous = cjson.decode(previous_payload)
  local ended = {
    event_type = 'journey_ended',
    event_id = ARGV[5],
    client_event_id = ARGV[2],
    journey_id = previous['journey_id'],
    client_journey_key = previous['client_journey_key'],
    map_id = previous['map_id'],
    map_revision = previous['map_revision'],
    lifecycle_sequence = tonumber(previous['lifecycle_sequence']) + 1,
    route_revision = tonumber(previous['route_revision']),
    occurred_at = cjson.decode(ARGV[4])['occurred_at'],
    ingested_at = cjson.decode(ARGV[4])['ingested_at'],
    outcome = 'superseded'
  }
  append_event(cjson.encode(ended), ARGV[5])
  redis.call('SET', ARGV[9] .. previous['journey_id'], '1', 'PXAT', ARGV[8])
  removed_presence = remove_presence(previous['presence_key'], previous['session_id'])
end

redis.call('SET', KEYS[1], ARGV[3])
redis.call('ZADD', KEYS[3], ARGV[16], ARGV[1])
append_event(ARGV[4], ARGV[15])
redis.call('SET', KEYS[2], ARGV[14], 'PXAT', ARGV[7])
return {'OK', ARGV[14], removed_presence}
