# Simulation Memory

- Keep red marker state independent from route progress.
- Blue marker movement must stay route-constrained.
- Sensor/PDR work belongs in a later layer, not in this hook.
- Raw sensor collection is intentionally skipped; only derived estimates may be added later.
