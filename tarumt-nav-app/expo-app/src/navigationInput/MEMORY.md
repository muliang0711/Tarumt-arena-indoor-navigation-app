# Navigation Input Memory

- Raw sensor recording is disabled by policy.
- `expo-sensors` is allowed here only for transient `DeviceMotion` input.
- Raw samples may exist only in a tiny rolling in-memory batch around the latest PDR flush.
- Live heading may update the red marker directly without waiting for step detection.
- Prefer Magnetometer heading for red arrow rotation; DeviceMotion rotation alpha is fallback only.
- Panel `head` readout should change while turning the phone; use it to debug heading source before marker UI.
- PDR movement gate must use the same latest live heading shown by the red arrow.
- Current derived estimate cap is 15Hz for smoother UI without raw stream pressure.
- Blue marker movement still comes from route progress projection.
- Derived estimate bridge may move the red marker only.
- Debug replay injects derived estimates, not raw samples.
- If rendering feels heavy, tune `flushIntervalMs` and `maxDerivedUpdatesPerSecond` before expanding logic.
