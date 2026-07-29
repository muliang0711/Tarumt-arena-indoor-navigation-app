# Phase 9 iOS device validation record

This record captures physical-device evidence without changing Phase 2
fixtures, golden output, approved tolerances, or PDR algorithm behavior.

## Preflight

- Flutter: 3.44.6 stable
- Xcode: 26.6
- iOS deployment target: 13.0
- Bundle identifier: `com.puihockyang.indoorNavigation`
- Unsigned iPhoneOS debug build: passed
- Physical iPhone detected: passed; Flutter and CoreDevice report the physical
  device as connected and available
- Development Team / signing identity: passed; Personal Team `8L4KWYUJVW`,
  automatic signing, registered device, and generated iOS Team provisioning
  profile
- Mac LAN address observed during preflight: `192.168.100.127` (`en0`)
- Sensor debug URL for this LAN: `http://192.168.100.127:8787`

## Launch commands

Terminal 1, from the repository root:

```text
npm --prefix expo-app run sensor-debug-server
```

Terminal 2, from `flutter_app`:

```text
flutter run -d <physical-ios-device-id> \
  --dart-define=SENSOR_DEBUG_LOG_URL=http://<mac-lan-ip>:8787
```

Debug mode was used for initial installation and VM attachment. Profile mode
was then used for the exploratory physical sessions so iOS could launch the app
from the Home Screen:

```text
flutter run --profile -d <physical-ios-device-id> \
  --dart-define=SENSOR_DEBUG_LOG_URL=http://<mac-lan-ip>:8787
```

The diagnostic sink is intentionally disabled in release mode, but remains
available in debug and profile modes. Only aggregate PDR diagnostics are
recorded; raw sensor sample arrays are never persisted.

## Device and environment

- Device model: iPhone 15 (`iPhone15,4`)
- iOS version: 26.5.2 (`23F84`)
- Connection: paired wired USB, followed by wireless profile testing; DDI
  services and developer mode enabled
- Test location / magnetic interference notes: pending
- Mac and iPhone on same LAN: passed; the Mac received physical-device session
  and batch events at `192.168.100.127:8787`
- Motion permission: passed; physical Core Motion batches were received
- Local Network permission: passed; session, batch, and stop events reached the
  Mac diagnostic server

## Scenarios

### 1. Install, launch, and permission

- App installs and launches: passed; signed `Indoor Navigation` app is running
  with an attached Flutter VM service
- Bundled map and 46m route render: user reported the exploratory app check was
  good; no formal 46m walk was completed
- Motion permission prompt and granted state: granted; confirmed by live Core
  Motion batches
- Permission-revoked state reports `permission-denied`: pending

### 2. Sensor availability and heading

- Start reaches `running`: passed during exploratory physical sessions
- Batch count increases: passed during exploratory physical sessions
- Heading is finite and responds to device rotation: passed in exploratory
  diagnostics; observed heading covered approximately 0.27–359.35 degrees
- Raw samples in memory never exceed 32: passed; observed maximum was 24
- Stop prevents further batch growth: passed for three completed exploratory
  sessions, each with a server-side `session-stop`

### 3. Controlled motion sessions

Record separate session IDs and exact observations. Do not invent or relax a
numeric acceptance tolerance from these non-deterministic physical samples.

| Scenario | Session ID | Actual steps | Detected | Moved | Batches | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Stationary | pending | 0 | pending | pending | pending | pending |
| Phone rotation / shake | pending | 0 | pending | pending | pending | pending |
| Short controlled walk | pending | pending | pending | pending | pending | pending |
| 46m route walk | pending | pending | pending | pending | pending | pending |

Exploratory physical sessions were captured locally before the user elected to
stop Phase 9. They are not relabeled as formal scenarios because exact actions
and actual step counts were not recorded:

- `step-test-2026-07-17T03-13-29Z`: aborted when the debug tool connection was
  lost; 125 batches, 3 detected steps, 2 moved steps, no stop event.
- `step-test-2026-07-17T03-17-31Z`: completed; 569 batches, 20 detected steps,
  12 moved steps, average latency 15.485 ms.
- `step-test-2026-07-17T03-18-50Z`: completed; 44 batches, no detected or moved
  steps, average latency 23.273 ms.
- `step-test-2026-07-17T03-25-12Z`: completed; 98 batches, 1 detected step, no
  moved steps, average latency 13.276 ms.

These generated session directories remain ignored by repository policy.

For every session, retain `session.json`, `summary.json`, and
`batch-diagnostics.jsonl`. Record latency, rejection reasons, heading blocks,
shake cooldowns, snap drift, and any non-finite or route-escape behavior.

### 4. Lifecycle and repeated ownership

- Three Start/Stop cycles create no duplicate stream: pending
- Backgrounding stops sensor batches: pending
- Foregrounding resumes exactly one run: pending
- Lock/unlock or interruption recovery: pending
- Portrait and landscape layouts remain usable: pending

### 5. Navigation and wrong-way behavior

- Marker remains constrained to the fixed route: pending
- Forward movement advances route progress: pending
- Opposite heading is reflected in diagnostics/UI: pending
- Wrong-way state appears only under the existing approved rules: pending

### 6. Edge Editor and share sheet

- Select two route nodes and save an edge: pending
- Share sheet opens: pending
- Exported name is `demo_1.edges.json`: pending
- UTF-8 JSON matches the current editor document: pending
- Dismissed and successful share outcomes remain distinct: pending

## Defects and fixes

- Core Motion error `nativeCode`: Swift emits an integer while Dart previously
  accepted only string/null. Phase 9 updated the decoder to accept the strict
  native wire union of integer, string, or null and added end-to-end adapter
  coverage. No domain behavior or numerical configuration changed.
- Sensor availability: the production Swift engine previously mirrored device
  motion availability into both capability fields. It now reports Core Motion
  device-motion and magnetometer availability independently, matching the Expo
  contract. Native coverage verifies the independent mapping. No PDR threshold,
  formula, fixture, golden output, or tolerance changed.

## Final verification

- `dart format`: passed (199 files checked, 0 changed)
- `flutter analyze`: passed (no issues)
- `flutter test`: passed (340/340)
- Phase 2 parity replay: passed (3/3); fixture hashes unchanged
- TypeScript typecheck and tests: passed (83/83)
- Xcode native tests: passed (21/21)
- Unsigned iPhoneOS debug build: passed
- Simulator integration test: passed (1/1)
- Physical device validation: partial; signing, installation, permissions,
  Core Motion, heading, bounded batching, network logging, and Stop completed.
  The formal stationary/shake/walk/46m/lifecycle/orientation/wrong-way/share
  matrix was stopped at the user's request and remains unverified.
- Independent review: not run because the formal Phase 9 matrix was stopped
