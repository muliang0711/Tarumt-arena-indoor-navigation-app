# Real sensor follow-up issues

Date: 2026-06-21
Branch: `feat/map-navigation-ui`
Status: implementation applied; real-device acceptance verification pending

## Scope

These issues were observed during real-device testing in real sensor mode. They are intentionally being recorded now and deferred for a later movement-focused fix pass.

## Issue 1: real sensor mode has an empty startup window

Observed behavior:

- After opening or switching to real sensor mode, there are often a few seconds with no sensor data.
- In some runs the empty window can last longer than expected.
- During this period Bob does not move and the screen appears stalled.

Expected behavior:

- Real sensor subscriptions should become active quickly.
- The app should either receive live samples promptly or clearly represent that the sensor pipeline is still warming up.

Notes for later investigation:

- check Expo sensor subscription startup timing
- check pedometer/device-motion listener readiness
- check batching delay before first processed samples appear
- check whether permission/subscription state is ready before the UI expects live movement

Implemented:

- independent Expo device sensors now initialize concurrently
- the real collector emits its first valid sample immediately
- collector and per-sensor startup timestamps/statuses are exposed in diagnostics
- the map UI distinguishes starting, live, unavailable, and error states

Real-device verification pending:

- record collector start-to-first-sample and start-to-first-batch duration
- confirm permission denial and unavailable hardware produce the expected visible state

## Issue 2: Bob heading does not react well when the user turns in real life

Observed behavior:

- Turning the phone/body in the real world does not make Bob turn promptly on the map.
- Bob heading feels unresponsive compared with the user’s real orientation change.

Expected behavior:

- Bob should visibly react to heading/orientation changes even when position change is small.

Notes for later investigation:

- inspect real heading source frequency and latency
- inspect confidence gating for heading updates
- inspect fallback behavior when heading confidence is low
- confirm whether heading is too dependent on displacement instead of live orientation

Implemented:

- heading and heading confidence are stored separately from position confidence
- DeviceMotion heading updates are applied when the pedometer step delta is zero
- the heading indicator uses shortest-angle render smoothing across the 0/360-degree boundary
- Bob's directional sprite continues to represent travel direction

Real-device verification pending:

- rotate at least 90 degrees while stationary and measure perceived response latency
- confirm DeviceMotion attitude conventions match the intended map orientation on Android and iOS

## Issue 3: Bob movement is still bursty instead of feeling real-time

Observed behavior:

- After walking for a while, Bob can still appear to jump/suddenly re-render at a later position instead of moving continuously.
- The current smoothing helps, but it does not fully remove the bursty feeling in real sensor mode.

Expected behavior:

- Bob should feel continuously updated while walking, not delayed and then suddenly repositioned.

Notes for later investigation:

- inspect whether real pedometer events arrive in sparse bursts
- inspect processed batch timing versus render cadence
- inspect whether multi-step updates are still visually too coarse
- inspect whether the smoothing layer needs stronger interpolation for real-sensor bursts

Implemented:

- the movement engine returns every accepted intermediate step position
- accepted positions are queued in order for visual playback
- per-step duration uses pedometer cadence, event interval, or a bounded fallback
- stale visual backlog is capped and navigation reset clears pending targets

Real-device verification pending:

- walk continuously for at least 30 seconds and record pedometer event burst sizes
- confirm the visual queue does not create noticeable catch-up lag on the target device

## Implemented fix order

1. instrument and reduce real sensor startup delay
2. decouple heading updates from displacement
3. expose accepted logical step positions
4. queue and smooth real-sensor visual movement

## Important constraint

Automated tests cover the implemented runtime behavior. The issues must not be
considered fully closed until the real-device acceptance checks above are
recorded.
