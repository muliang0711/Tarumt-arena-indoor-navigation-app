# Navigation Input Type Memory

- `DerivedNavigationEstimate` is already processed/low-rate input.
- There is intentionally no `RawSensorSample` type.
- `NavigationInputPolicy.rawSensorRecordingEnabled` must remain `false`.
- `NavigationInputPolicy.transientRawSensorBatchingEnabled` must remain `true`.
- Buffer/source types are for already-derived inputs only.
