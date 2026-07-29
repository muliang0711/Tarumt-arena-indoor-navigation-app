# Reroute

Pure wrong-way/reroute candidate logic.

This folder does not show UI and does not read map files directly. It evaluates already-derived signals:

- observed heading
- expected route heading
- current route node type
- optional future Wi-Fi node confidence summaries
- optional future route graph adjacency
- optional active planned route node IDs

Current app behavior is intentionally lightweight: the monitor runs automatically every `1000ms`, controlled by `WRONG_WAY_CHECK_INTERVAL_MS`.

The interval check always executes. The suggestion becomes active when the observed heading stays outside the allowed deviation from the rounded expected heading for the configured duration. The default `allowedHeadingDeviationDegrees` is `90`, so a route heading of `0deg` accepts roughly forward-facing movement and flags headings at `90deg` or beyond as wrong-way candidates.

When the app is approaching a turn, it can pass multiple accepted route headings into the evaluator. This prevents a right/left turn preparation from showing wrong-way while the user is still near the junction.

Wi-Fi confidence and edge legality are still supported as optional inputs for the future main modules. If those inputs are absent, they do not block the current junction heading check.
