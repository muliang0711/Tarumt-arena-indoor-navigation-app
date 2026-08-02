local active_payload = redis.call('GET', KEYS[1])
if not active_payload then
  if redis.call('EXISTS', KEYS[2]) == 1 then
    return 'ENDED'
  end
  return 'NOT_ACTIVE'
end
local active = cjson.decode(active_payload)
if active['journey_id'] ~= ARGV[1] then
  return 'OWNER'
end
local received_ms = tonumber(ARGV[2])
if not active['last_position_at_ms'] or received_ms > tonumber(active['last_position_at_ms']) then
  active['last_position_at'] = ARGV[3]
  active['last_position_at_ms'] = received_ms
end
active['session_id'] = ARGV[4]
active['presence_key'] = ARGV[5]
redis.call('SET', KEYS[1], cjson.encode(active))
redis.call('ZADD', KEYS[3], ARGV[7], ARGV[6])
return 'OK'
