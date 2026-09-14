# Journey outbox timestamp migration

Journey commands previously reused their persisted event time as the WebSocket
envelope timestamp. After five minutes offline, the gateway rejected every retry
before processing the journey. FIFO replay then blocked current navigation and
the client withheld position updates while awaiting a journey acknowledgement.

The client now generates a fresh envelope timestamp on each transmission and
keeps the immutable event time in `payload.occurred_at`. The gateway preserves
this event time for start, recalculation, and end operations. The existing
five-minute envelope freshness check is unchanged. Zero event times and event
times more than five minutes ahead of transmission are rejected. Historical
event times are allowed for authenticated offline replay; existing ownership,
route validation, and event-id idempotency checks still apply.

## Deployment order

1. Deploy the updated Presence Gateway first. The added payload field is optional,
   so clients omitting it retain their previous behaviour. Old clients with stale
   envelope timestamps will still need the client update to recover.
2. Build and install the updated Flutter client for the existing cloud origin.
   Do not install it against the old Gateway: strict payload decoding there
   rejects the new `occurred_at` field.
3. Preserve the existing outbox and app data. Start navigation in the foreground.
   Verify the queue drains, the current journey receives an ID, and the live map
   displays its position and name. Confirm historical events retain their dates.

No Redis flush, database schema migration, admin-web update, or disabling of
timestamp validation is required. Updating Gateway interrupts its WebSockets;
clients must reconnect. Do not remove Redis or persistent volumes.

The local integration test exercises both a legacy client and a 48-hour-old
journey event with fresh transmission time, including acknowledgement,
deduplicated retry, position association, and preserved historical event time.
Cloud deployment and physical-device acceptance must be checked separately.
