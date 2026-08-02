local payload = redis.call('HGET', KEYS[1], 'payload')
if not payload then
  redis.call('ZREM', KEYS[2], ARGV[2])
  return ''
end
local last_seen = tonumber(redis.call('HGET', KEYS[1], 'last_seen_ms'))
local cutoff = tonumber(ARGV[3])
if cutoff > 0 and last_seen > cutoff then
  return ''
end
local building = redis.call('HGET', KEYS[1], 'building_key')
local floor = redis.call('HGET', KEYS[1], 'floor_key')
local edge = redis.call('HGET', KEYS[1], 'edge_key')
redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[2], ARGV[2])
redis.call('ZREM', ARGV[1] .. ':building:' .. building .. ':active', ARGV[2])
redis.call('ZREM', ARGV[1] .. ':floor:' .. building .. ':' .. floor .. ':active', ARGV[2])
redis.call('ZREM', ARGV[1] .. ':floor:' .. building .. ':' .. floor .. ':representatives', ARGV[2])
if edge then
  redis.call('ZREM', ARGV[1] .. ':floor:' .. building .. ':' .. floor .. ':edge:' .. edge .. ':active', ARGV[2])
end
return payload
