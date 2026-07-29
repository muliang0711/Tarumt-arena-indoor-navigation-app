# Tiled Memory

- Base rendering uses `assets/maps/demo_1.png`; do not revive tile-sprite rendering for performance testing.
- TMJ coordinates need the chunk-origin correction from the computed surface.
- Current fixed route is the EDGE-backed turn-test path `node-21 -> node-20 -> node-19 -> node-18 -> node-17 -> node-16 -> node-12 -> node-13 -> node-14 -> node-15 -> node-2 -> node-1`.
- Blue marker uses turn-gated route progress instead of nearest-point snapping across the whole route.
- Near a turn, PDR may accept the next segment heading for usability, but blue marker segment progress must not switch before the turn capture zone.
- Room labels display `object.name` only; ignore `object.text.text`.
