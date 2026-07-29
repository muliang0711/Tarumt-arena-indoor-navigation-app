# Reroute Memory

- This layer is pure logic plus a small React monitor hook; it should not subscribe to sensors or fetch map files.
- Wrong-way monitor execution is interval-based, not triggered by entering a junction.
- The default monitor interval is `1000ms`, controlled by `WRONG_WAY_CHECK_INTERVAL_MS`.
- Current wrong-way detection starts when observed heading is outside the allowed route-heading deviation, even when the TMJ node is not marked `junctions`.
- The default opposite heading duration is `1000ms`, controlled by `WRONG_WAY_OPPOSITE_HEADING_DURATION_MS`.
- The default allowed heading deviation is `90deg`, controlled by `allowedHeadingDeviationDegrees`.
- Expected heading is rounded before allowed-deviation comparison.
- Near a turn, accepted route headings may include both current and next segment headings.
- Wi-Fi confidence and edge legality are optional future inputs; do not make them required until the main modules exist.
- If edge input exists, do not trigger reroute on illegal graph jumps.
