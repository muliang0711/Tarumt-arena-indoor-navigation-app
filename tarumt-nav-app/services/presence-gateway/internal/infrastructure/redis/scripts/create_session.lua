redis.call('SET', KEYS[1], ARGV[1], 'PXAT', ARGV[5])
redis.call('ZADD', KEYS[2], ARGV[3], ARGV[2])
redis.call('ZADD', KEYS[3], ARGV[5], ARGV[2])
redis.call('SET', KEYS[4], ARGV[2], 'PXAT', ARGV[5])
redis.call('ZADD', KEYS[5], ARGV[3], ARGV[6])
return 1
