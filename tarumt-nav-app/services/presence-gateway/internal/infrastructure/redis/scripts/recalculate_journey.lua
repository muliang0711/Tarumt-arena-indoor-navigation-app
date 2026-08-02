local cached = redis.call('GET', KEYS[2])
if cached then
  return {'DEDUP', cached}
end
if redis.call('EXISTS', KEYS[3]) == 1 then
  return {'ENDED', ''}
end
local active_payload = redis.call('GET', KEYS[1])
if not active_payload then
  return {'NOT_ACTIVE', ''}
end
local active = cjson.decode(active_payload)
if active['journey_id'] ~= ARGV[1] or active['client_journey_key'] ~= ARGV[2] then
  return {'OWNER', ''}
end
if active['map_id'] ~= ARGV[3] or active['map_revision'] ~= ARGV[4] then
  return {'MAP', ''}
end
local route = cjson.decode(ARGV[5])
if active['planned_route']['destination_node_id'] ~= route['destination_node_id'] then
  return {'DESTINATION', ''}
end

active['planned_route'] = route
active['lifecycle_sequence'] = tonumber(active['lifecycle_sequence']) + 1
active['route_revision'] = tonumber(active['route_revision']) + 1
local event = cjson.decode(ARGV[6])
event['lifecycle_sequence'] = active['lifecycle_sequence']
event['route_revision'] = active['route_revision']
local result = {
  journey_id = active['journey_id'],
  lifecycle_sequence = active['lifecycle_sequence'],
  route_revision = active['route_revision']
}
local result_payload = cjson.encode(result)
redis.call('SET', KEYS[1], cjson.encode(active))
if tonumber(ARGV[9]) > 0 then
  redis.call('XADD', KEYS[4], 'MAXLEN', '~', ARGV[9], '*',
    'schema_version', ARGV[10], 'event_id', ARGV[7], 'payload', cjson.encode(event))
else
  redis.call('XADD', KEYS[4], '*',
    'schema_version', ARGV[10], 'event_id', ARGV[7], 'payload', cjson.encode(event))
end
redis.call('SET', KEYS[2], result_payload, 'PXAT', ARGV[8])
return {'OK', result_payload}
