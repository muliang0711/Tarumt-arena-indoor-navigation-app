if redis.call('EXISTS', KEYS[1]) == 0 then
  return 0
end
local building = redis.call('HGET', KEYS[1], 'building_key')
local floor = redis.call('HGET', KEYS[1], 'floor_key')
redis.call('HSET', KEYS[1], 'payload', ARGV[1], 'last_seen_ms', ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[4])
redis.call('ZADD', KEYS[2], ARGV[3], ARGV[2])
redis.call('ZADD', ARGV[5] .. ':building:' .. building .. ':active', ARGV[3], ARGV[2])
redis.call('ZADD', ARGV[5] .. ':floor:' .. building .. ':' .. floor .. ':active', ARGV[3], ARGV[2])
return 1
