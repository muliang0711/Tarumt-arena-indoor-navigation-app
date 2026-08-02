local stale = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', '(' .. ARGV[1])
for _, member in ipairs(stale) do
  redis.call('ZREM', KEYS[2], member)
  redis.call('ZREM', KEYS[1], member)
end
local members = redis.call('ZRANGE', KEYS[1], 0, tonumber(ARGV[3]) - 1)
local selected = {}
for _, member in ipairs(members) do
  local last_seen = redis.call('ZSCORE', KEYS[2], member)
  if last_seen and tonumber(last_seen) >= tonumber(ARGV[1]) then
    table.insert(selected, member)
    if #selected >= tonumber(ARGV[2]) then
      break
    end
  end
end
return selected
