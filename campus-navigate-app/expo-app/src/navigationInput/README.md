# Navigation Input

Boundary for future navigation inputs.

This app may collect raw device-motion events only as short transient in-memory batches. It must not record, persist, export, or keep raw sensor history.

Live device motion, external, or debug replay sources pass low-rate derived estimates into this layer after preprocessing/PDR. The current app policy accepts at most 15 derived updates per second.

The bridge keeps a small accepted-estimate buffer for UI state and drops estimates that arrive faster than the policy. The red marker can consume the newest accepted estimate; the blue marker remains route-progress only.

The live sensor consumer uses `expo-sensors` `DeviceMotion`, keeps at most 32 raw samples in a rolling transient buffer, timestamps samples with receive time for PDR freshness checks, and flushes about every 60ms.

The same accepted estimate feeds both markers: red shows the free estimate, while blue snaps the estimate to the fixed route before rendering.

Heading also has a direct path to the red marker. The app prefers `Magnetometer` heading and falls back to live `DeviceMotion.rotation.alpha`. This lets the red arrow rotate when the phone turns even if no walking step is detected.

The latest live heading is also stamped onto transient motion samples before PDR runs, so the movement gate uses the same direction shown by the red arrow.
