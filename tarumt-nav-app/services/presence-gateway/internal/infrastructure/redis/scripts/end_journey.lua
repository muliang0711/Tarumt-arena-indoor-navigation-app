local cached = redis.call('GET', KEYS[2])
if cached then
  return {'DEDUP', cached, ''}
end
if redis.call('EXISTS', KEYS[3]) == 1 then
  return {'ENDED', '', ''}
end
local active_payload = redis.call('GET', KEYS[1])
if not active_payload then
  return {'NOT_ACTIVE', '', ''}
end
local active = cjson.decode(active_payload)
if active['journey_id'] ~= ARGV[1] or active['client_journey_key'] ~= ARGV[2] then
  return {'OWNER', '', ''}
end

local event = cjson.decode(ARGV[3])
event['map_id'] = active['map_id']
event['map_revision'] = active['map_revision']
event['lifecycle_sequence'] = tonumber(active['lifecycle_sequence']) + 1
event['route_revision'] = tonumber(active['route_revision'])
local result = {
  journey_id = active['journey_id'],
  lifecycle_sequence = event['lifecycle_sequence'],
  route_revision = event['route_revision']
}
local result_payload = cjson.encode(result)

local removed_presence = ''
local presence_key = active['presence_key']
if presence_key and presence_key ~= '' then
  removed_presence = redis.call('HGET', presence_key, 'payload') or ''
  if removed_presence ~= '' then
    local building = redis.call('HGET', presence_key, 'building_key')
    local floor = redis.call('HGET', presence_key, 'floor_key')
    local edge = redis.call('HGET', presence_key, 'edge_key')
    redis.call('DEL', presence_key)
    redis.call('ZREM', KEYS[6], active['session_id'])
    if building and floor then
      redis.call('ZREM', ARGV[10] .. ':building:' .. building .. ':active', active['session_id'])
      redis.call('ZREM', ARGV[10] .. ':floor:' .. building .. ':' .. floor .. ':active', active['session_id'])
      redis.call('ZREM', ARGV[10] .. ':floor:' .. building .. ':' .. floor .. ':representatives', active['session_id'])
      if edge then
        redis.call('ZREM', ARGV[10] .. ':floor:' .. building .. ':' .. floor .. ':edge:' .. edge .. ':active', active['session_id'])
      end
    end
  end
end

redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[4], ARGV[9])
redis.call('SET', KEYS[3], '1', 'PXAT', ARGV[5])
if tonumber(ARGV[7]) > 0 then
  redis.call('XADD', KEYS[5], 'MAXLEN', '~', ARGV[7], '*',
    'schema_version', ARGV[8], 'event_id', ARGV[4], 'payload', cjson.encode(event))
else
  redis.call('XADD', KEYS[5], '*',
    'schema_version', ARGV[8], 'event_id', ARGV[4], 'payload', cjson.encode(event))
end
redis.call('SET', KEYS[2], result_payload, 'PXAT', ARGV[6])
return {'OK', result_payload, removed_presence}
