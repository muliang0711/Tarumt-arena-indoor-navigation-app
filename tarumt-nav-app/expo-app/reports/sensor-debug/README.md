# Sensor Debug Reports

Run `npm run sensor-debug-server` before starting a walking test in Expo Go or
the Flutter migration.

For Phase 9 Flutter device validation, start the app in debug or profile mode
with the Mac's LAN address compiled into the non-release sink:

```text
flutter run -d <physical-ios-device-id> \
  --dart-define=SENSOR_DEBUG_LOG_URL=http://<mac-lan-ip>:8787
```

Use `flutter run --profile` with the same arguments when the app must remain
launchable from the iOS Home Screen during an untethered physical test.

The Flutter sink is disabled in release builds and when the define is absent.
The iPhone and Mac must be on the same network, and the iPhone must grant the
app's Local Network permission.

The Expo app/dev server may run on `8082`; keep this writer on a separate port such as `8787`. If both use `8082`, requests will hit the Expo server instead of the report writer.

If Expo Go cannot infer the Mac host, start Expo with an explicit URL:

```text
EXPO_PUBLIC_SENSOR_DEBUG_LOG_URL=http://<mac-lan-ip>:8787 npm run start
```

Or let the project detect the Mac LAN IP for you:

```text
npm run start:sensor-debug -- --port 8082
```

Recommended test setup:

```text
Terminal 1: npm run sensor-debug-server
Terminal 2: npm run start:sensor-debug -- --port 8082
```

Restart Expo after changing `EXPO_PUBLIC_SENSOR_DEBUG_LOG_URL`; Expo embeds that value when it builds the JS bundle. The iPhone and Mac must be on the same network if the URL uses the Mac LAN IP.

To compare a standing phone-shake session with a real walking session:

```text
npm run sensor-debug-compare -- <idle-shake-session> <walk-session>
```

Recommended calibration flow:

```text
1. Record one standing phone-shake / heading-adjustment session.
2. Record one real walking session.
3. Compare both with npm run sensor-debug-compare -- <idle> <walk>.
```

If the report shows `movementBlockedReasonCounts.shake-cooldown`, phone-shake protection is blocking marker movement after repeated high-acceleration spikes.

Each raw motion Start/Stop session creates a folder:

```text
reports/sensor-debug/<sessionId>/
```

Files:

- `batch-diagnostics.jsonl`: one aggregate PDR diagnostic per flush. The current app flushes about every 60ms.
- `summary.json`: human-readable calibration summary. Edit `actualSteps` here after the test if you want to compare detected steps with real steps.
- `session.json`: start/stop timestamps and config snapshots.

The app does not persist raw accelerometer sample arrays.
