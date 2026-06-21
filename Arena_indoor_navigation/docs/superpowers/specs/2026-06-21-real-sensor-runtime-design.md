# Real Sensor Runtime Design

Date: 2026-06-21

## Goal

Make real-sensor navigation visibly responsive during startup, stationary turns, and irregular pedometer delivery without weakening movement constraints.

## Scope

This change covers:

- real sensor startup lifecycle and first-sample delivery;
- heading updates when no new step is reported;
- visual playback of multi-step pedometer bursts;
- diagnostics and automated regression tests for these behaviors.

It does not replace Expo Sensors, redesign the particle filter, or alter map collision rules.

## Architecture

The runtime will separate three independent concerns:

1. **Sensor acquisition** receives raw device events and reports subscription state.
2. **Logical movement** applies heading, steps, particle filtering, and map constraints.
3. **Visual movement** interpolates accepted logical positions according to event timing.

This separation prevents batching cadence from directly controlling Bob's visible responsiveness.

## Sensor Startup

Independent device sensors will initialize concurrently. Each sensor subscription will report a lifecycle state:

- `starting`
- `receiving`
- `permission-denied`
- `unavailable`
- `error`

The collector will immediately emit its first non-empty batch. Later samples may continue using the configured batch interval.

The UI will expose a warming-up state while subscriptions are starting and no sample has arrived. Startup errors must remain visible in diagnostics instead of being silently indistinguishable from a slow sensor.

Diagnostic timestamps will cover:

- collector start;
- subscription attempt;
- subscription readiness;
- first raw sample;
- first emitted batch.

## Heading Updates

The movement state will store heading confidence separately from position/filter confidence.

Every batch containing a valid DeviceMotion attitude may update heading, including batches where `stepDelta` is zero. A zero-step heading update must:

- preserve the exact logical position;
- preserve movement-attempt diagnostics;
- update the live heading and heading confidence;
- avoid injecting position noise or advancing movement distance.

The displayed heading will use shortest-angle interpolation, including transitions across the `0`/`2π` boundary. Low-confidence or missing heading data will retain the last reliable heading rather than replacing it with movement confidence.

The heading indicator will follow live orientation. Bob's four-direction sprite will continue to represent visual travel direction; it will not rotate continuously because the current artwork only provides four directional frames.

## Bursty Pedometer Movement

Logical movement remains authoritative and synchronous: every reported step is checked individually against map constraints, and the final accepted logical position is stored immediately.

For visual presentation, accepted intermediate step positions will be returned as a path. The view will enqueue these positions with timing derived from:

1. pedometer cadence when available;
2. elapsed time between pedometer events;
3. a bounded default step duration when neither is usable.

The renderer will consume the queue in order. It must:

- animate each accepted step instead of jumping directly to the final batch position;
- keep the logical state ahead of or equal to the visual state;
- cap stale backlog so Bob does not remain seconds behind reality;
- snap safely after exceptionally long pauses or invalid timing data;
- preserve collision-rejected partial progress.

The existing render smoothing helper may remain as the per-segment interpolation mechanism, but its target will come from the timed queue rather than only the latest final position.

## Error Handling

- Permission denial and unavailable sensors are explicit states.
- A failed sensor does not prevent other independent sensors from subscribing.
- Invalid timestamps, headings, cadence, or positions are ignored or replaced with bounded defaults.
- Empty batches do not change movement state.
- A mode switch or navigation reset clears pending visual movement and establishes a fresh pedometer baseline.

## Testing

Automated tests will cover:

- first sensor sample bypasses the normal batch delay;
- concurrent sensor initialization is not blocked by a slower independent sensor;
- startup lifecycle transitions and failure states;
- stationary DeviceMotion batches update heading without changing position;
- heading confidence is independent from position confidence;
- shortest-angle interpolation across `359° → 1°`;
- a multi-step increment returns ordered accepted intermediate positions;
- rejected movement preserves only accepted partial progress;
- timed visual playback consumes steps in order;
- reset clears queued visual movement;
- backlog and invalid timing are bounded safely.

Existing movement, collision, reset, mock-sensor, typecheck, and full test suites must remain green.

## Success Criteria

- The UI distinguishes sensor warm-up from failure.
- The first useful real sensor sample is delivered without waiting for the regular 250 ms flush.
- Turning the device while stationary visibly updates the heading.
- Multi-step pedometer events are displayed as continuous ordered movement.
- Logical collision behavior and pedometer baseline behavior remain unchanged.
