local current = redis.call('GET', KEYS[1])
if not current then
  return 0
end
local session = cjson.decode(current)
session['last_seen_at'] = ARGV[2]
redis.call('SET', KEYS[1], cjson.encode(session), 'KEEPTTL')
redis.call('ZADD', KEYS[2], ARGV[3], ARGV[1])
redis.call('ZADD', KEYS[3], ARGV[3], session['device_ref'])
return 1
