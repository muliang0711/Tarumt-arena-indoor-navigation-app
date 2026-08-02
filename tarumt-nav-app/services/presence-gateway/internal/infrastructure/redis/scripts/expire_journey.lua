local active_payload = redis.call('GET', KEYS[1])
if not active_payload then
  return {'NOT_ACTIVE', ''}
end
local active = cjson.decode(active_payload)
if active['journey_id'] ~= ARGV[1] then
  return {'NOT_ACTIVE', ''}
end
local due = false
if active['last_position_at_ms'] then
  due = tonumber(active['last_position_at_ms']) <= tonumber(ARGV[3])
else
  due = tonumber(active['started_at_ms']) <= tonumber(ARGV[2])
end
if not due then
  return {'NOT_DUE', ''}
end

local event = cjson.decode(ARGV[4])
event['client_journey_key'] = active['client_journey_key']
event['map_id'] = active['map_id']
event['map_revision'] = active['map_revision']
event['lifecycle_sequence'] = tonumber(active['lifecycle_sequence']) + 1
event['route_revision'] = tonumber(active['route_revision'])

local removed_presence = ''
local presence_key = active['presence_key']
if presence_key and presence_key ~= '' then
  removed_presence = redis.call('HGET', presence_key, 'payload') or ''
  if removed_presence ~= '' then
    local building = redis.call('HGET', presence_key, 'building_key')
    local floor = redis.call('HGET', presence_key, 'floor_key')
    local edge = redis.call('HGET', presence_key, 'edge_key')
    redis.call('DEL', presence_key)
    redis.call('ZREM', KEYS[5], active['session_id'])
    if building and floor then
      redis.call('ZREM', ARGV[9] .. ':building:' .. building .. ':active', active['session_id'])
      redis.call('ZREM', ARGV[9] .. ':floor:' .. building .. ':' .. floor .. ':active', active['session_id'])
      redis.call('ZREM', ARGV[9] .. ':floor:' .. building .. ':' .. floor .. ':representatives', active['session_id'])
      if edge then
        redis.call('ZREM', ARGV[9] .. ':floor:' .. building .. ':' .. floor .. ':edge:' .. edge .. ':active', active['session_id'])
      end
    end
  end
end

redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[2], ARGV[8])
redis.call('SET', KEYS[3], '1', 'PXAT', ARGV[5])
if tonumber(ARGV[6]) > 0 then
  redis.call('XADD', KEYS[4], 'MAXLEN', '~', ARGV[6], '*',
    'schema_version', ARGV[7], 'event_id', event['event_id'], 'payload', cjson.encode(event))
else
  redis.call('XADD', KEYS[4], '*',
    'schema_version', ARGV[7], 'event_id', event['event_id'], 'payload', cjson.encode(event))
end
return {'OK', removed_presence}
