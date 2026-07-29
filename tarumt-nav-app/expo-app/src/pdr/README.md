# PDR

Pure lightweight PDR/preprocessing algorithms.

This folder does not subscribe to phone sensors. It accepts a transient short batch, reduces it, rejects shake-like acceleration, ranks movement heading candidates against the desired route heading, and returns one derived navigation estimate.

`DerivedNavigationEstimate.headingDegrees` is the observed facing heading for marker arrows. The route-ranked heading is used only for movement displacement.

Default batch window is `180ms`, with a `200ms` freshness cap. Step detection is peak-based: a batch needs a quiet-to-peak pattern, must stay below the shake spike cap, and must respect the minimum step interval.

Current test-tuning uses a `1.0` quiet threshold and a `5.5` shake cap. This is meant to reduce false stops during handheld walking while still rejecting extreme shake spikes.

Movement is also heading-gated: a detected step moves only when the observed facing heading is within the configured forward cone of the desired route heading.

PDR step length is stored in meters. The current test value is `0.5m` per moved step. The app converts meters to map pixels with the current route segment's `pixelsPerMeter` from `demo_1.edges.json` before moving the marker.

Startup movement is locked briefly so picking up or rotating the phone can update heading without moving the marker. Backward movement also requires a stronger peak than forward movement to reduce reverse drift during phone adjustment.

Current calibration favors fewer false positives: the default step peak threshold is tuned upward so standing phone-heading adjustments are less likely to move the marker.

Repeated shake spikes trigger a short movement cooldown. During cooldown the app still updates heading, but accepted-looking step batches do not move the marker.

Large heading changes can also trigger a short `turning-in-place` movement block. This lets the marker arrow rotate while the user prepares a turn, without letting small phone-rotation acceleration push the marker forward.

Standing phone rotation is rejected before movement as `PHONE_ROTATION`. The gate uses short-window cumulative heading travel plus low average acceleration, so slow turn-in-place behavior does not become route progress while real walking turns with stronger average acceleration can still move.
