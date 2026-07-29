# Tiled Model Memory

- `pngMapModel` is the assembly point.
- Keep route path construction separate from route progress interpolation.
- Keep marker state construction separate from marker rendering.
- Offset correction lives in `surfaceModel`.
- Route snapping should keep the blue marker on the EDGE-backed turn-test route even when the red/free estimate drifts away.
- Blue marker progress must not auto-turn at route corners. It can enter the next segment only when the user heading faces that next segment near the turn.
- Blue marker progress can move backward on the route when the user walks opposite the planned direction.
