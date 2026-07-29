# Indoor Navigation Flutter migration

This is the iOS-first Flutter + Dart migration of the Expo + TypeScript indoor
navigation application. The app uses MVVM: widgets bind to one immutable
`IndoorNavigationViewState`, and all behavior is coordinated by
`IndoorNavigationViewModel` through injected infrastructure ports.

Phase 8 provides the complete Flutter application surface, including the tiled
map and Bob actor, route simulation, navigation overlays, derived-estimate and
raw-motion controls, Edge Editor, responsive iPhone layouts, and lifecycle-safe
production composition.

## Realtime presence

The Live Map supports four build-time modes:

- `mock` (default) keeps the deterministic Stage 1 demo.
- `realtime` creates a privacy-preserving anonymous session and connects to the
  Go Presence Gateway over WebSocket.
- `hybrid` keeps one fixed-red local test actor visible while also connecting
  to the real Gateway. The remote actor limit defaults to one, and the combined
  map never shows more than ten representatives.
- `off` disables network presence without removing the Live Map.

Run the Go gateway, then launch a simulator with:

```sh
flutter run \
  --dart-define=PRESENCE_MODE=realtime \
  --dart-define=PRESENCE_BASE_URL=http://127.0.0.1:8080
```

For an Android emulator, either use `http://10.0.2.2:8080` or run
`adb reverse tcp:8080 tcp:8080` and keep the loopback URL. A physical device
should use a reachable HTTPS endpoint for production-like testing.
The Android debug manifest permits cleartext traffic for this local workflow;
release composition still rejects a realtime base URL that is not HTTPS.

### Hybrid friend-testing APK

Use Hybrid mode when one APK must prove both the local renderer and remote
Presence Gateway flow. The local actor is always red; remote actors never use
red. If the Gateway disconnects, remote actors are removed while the red local
actor continues moving.

Build against a deployed HTTPS Gateway:

```sh
./dev/build-hybrid-test-apk.sh https://presence.example.com
```

The initial test profile displays exactly one local actor and at most one
remote actor. `PRESENCE_REMOTE_VISIBLE_LIMIT` can later be raised to `9`, giving
one local plus nine remote actors while preserving the ten-actor UI limit.

Production releases must continue to use `PRESENCE_MODE=realtime`; Hybrid mode
is an explicit test profile.

### Android phone test on the same Wi-Fi

From the workspace root, start one development Gateway:

```sh
./dev/run-phone-test-server.sh
```

Find the Mac's Wi-Fi IP and build an APK whose Gateway URL points at that IP:

```sh
ipconfig getifaddr en0
./dev/build-phone-test-apk.sh 192.168.1.25
```

Install
`flutter_app/build/app/outputs/flutter-apk/app-debug.apk` on the phone. The
phone and Mac must be on the same network, macOS Firewall must allow the Go
process, and the server terminal must remain open. Verify this URL from the
phone's browser first:

```text
http://192.168.1.25:8080/health/ready
```

The app resolves the current `main-campus` Map Bundle once at startup. TMJ,
EDGE, PNG, rooms, nodes, and Wi-Fi node mapping are pinned to that single
verified revision. A later launch revalidates with ETag. If the Gateway is
unavailable and a last-known-good bundle exists, that cache is used; on a
first-ever offline launch, the complete bundled resource set is used instead.

The helper uses the in-memory Gateway backend, which is enough for multiple
phones connected to one process. To exercise shared Redis, start Redis with
`make redis-up` inside `services/presence-gateway`, then run:

```sh
PRESENCE_BACKEND=redis \
PRESENCE_REDIS_URL=redis://127.0.0.1:16379/0 \
./dev/run-phone-test-server.sh
```

The app generates a random installation ID and persists it with
`SharedPreferencesAsync`. It never reads a hardware identifier. Access tokens
stay in memory and are replaced after reconnect or relaunch. Flutter
communicates only with the Go HTTP/WebSocket API; Redis remains private server
infrastructure.

The App Shell owns the connection while the app is foregrounded. The Live Map
selects an observed floor, while active navigation independently publishes the
user's route-relative actual position at no more than two updates per second.
Network events update targets and Flutter animates between them.

Realtime navigation also sends a separate Journey lifecycle
(`journey_start`, `journey_route_recalculate`, and `journey_end`). Commands are
persisted in a `SharedPreferencesAsync` outbox before transmission and retried
with the same `client_event_id` after reconnect. Local route rendering never
waits for the network, but location publication begins only after the Gateway
acknowledges `journey_start` with its canonical `journey_id`. Leaving navigation
records `cancelled`; reaching the destination records `arrived`. Backgrounding
disconnects presence without ending the Journey, so a foreground resume can
drain the outbox and continue it.

Run the opt-in real gateway integration test with:

```sh
PRESENCE_INTEGRATION_BASE_URL=http://127.0.0.1:8080 \
  flutter test \
  test/infrastructure/presence/realtime_presence_repository_integration_test.dart
```

## Verify

From this directory:

```sh
flutter analyze
flutter test
flutter test integration_test/app_smoke_test.dart -d <ios-simulator-id>
```

Physical iPhone sensor and export validation is intentionally deferred to the
next approved migration phase.
