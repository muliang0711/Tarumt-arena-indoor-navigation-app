# Live Map

The Live Map is intentionally separated from destination navigation. It shows
building and floor occupancy plus at most ten representative anonymous actors;
it does not expose identity or claim that the mock actors are exact people.

The dependency flow is:

```text
LiveMapScreen -> LiveMapViewModel -> PresenceRepository
                                      -> MockPresenceRepository (Stage 1)
                                      -> RealtimePresenceRepository (Stage 4)
```

Presence locations use route edge endpoints and normalized progress rather
than screen coordinates. `presence_position_resolver.dart` maps those values
onto the loaded Tiled route graph at the UI boundary. This keeps the future
wire protocol independent of Flutter layout and zoom.

The UI consumes only `PresenceSnapshot` and `PresenceConnectionState`. It has
no HTTP, WebSocket, JSON, token, or Redis knowledge. Map loading and connection
status are separate: a reconnect keeps the map visible, shows a compact status
banner, and replaces stale client state with the next authoritative snapshot.

The shared marker animation compensates between network targets and snaps
unusually large jumps instead of animating an actor through walls.

Only Floor 2 currently has an approved map asset. Other floors continue to
show occupancy with an explicit map-unavailable state until their PNG, TMJ,
and edge assets are registered.
