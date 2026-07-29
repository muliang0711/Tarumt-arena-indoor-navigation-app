# PDR Memory

- No Expo sensor subscription in this folder.
- Do not store raw input batches.
- Keep the algorithm lightweight enough for a 200-300ms end-to-end target.
- Desired route heading is a strong ranking input so noisy heading examples cluster around the intended route direction.
- Step detection must reject small shake noise and extreme shake spikes before moving markers.
- Estimate heading should represent observed facing direction so marker arrows rotate when the phone turns.
- Current step detector is tuned toward real walking: lower step threshold, wider batch window, and relaxed quiet threshold.
- Opposite-facing steps move route progress backward instead of being blocked.
- Step length is meters first; current test value is `0.5m`, converted to pixels through the active EDGE route metric.
- At a turn, PDR desired heading can switch to the next segment only when the user heading already faces that next segment.
- Startup movement lock prevents marker drift while the user is picking up or orienting the phone.
- Backward movement requires a stronger step peak than forward movement.
- Threshold is currently tuned to reduce false positives from standing phone/heading adjustments.
- Repeated `SHAKE_TOO_HIGH` batches trigger `shake-cooldown`, blocking movement briefly while keeping heading live.
- Large non-backward heading changes trigger `turning-in-place`, blocking movement briefly while keeping heading live.
- `PHONE_ROTATION` rejects accepted-looking steps when short-window heading travel is high but average acceleration is too low for real walking.
- Current walking-test tuning uses `stillnessAccelerationMagnitude = 1.0` and `maxShakeAccelerationMagnitude = 5.5`.
