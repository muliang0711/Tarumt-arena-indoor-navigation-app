local pending = redis.call('XPENDING', KEYS[1], ARGV[1], ARGV[2], ARGV[2], 1)
if #pending == 0 then
  return 0
end
redis.call('XADD', KEYS[2], '*',
  'source_stream', KEYS[1],
  'source_message_id', ARGV[2],
  'schema_version', ARGV[3],
  'event_id_sha256', ARGV[4],
  'payload_sha256', ARGV[5],
  'reason', ARGV[6],
  'failed_at', ARGV[7])
return redis.call('XACK', KEYS[1], ARGV[1], ARGV[2])
