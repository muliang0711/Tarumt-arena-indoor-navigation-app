# Indoor Navigation Flutter migration

This is the iOS-first Flutter + Dart migration of the Expo + TypeScript indoor
navigation application. The app uses MVVM: widgets bind to one immutable
`IndoorNavigationViewState`, and all behavior is coordinated by
`IndoorNavigationViewModel` through injected infrastructure ports.

Phase 8 provides the complete Flutter application surface, including the tiled
map and Bob actor, route simulation, navigation overlays, derived-estimate and
raw-motion controls, Edge Editor, responsive iPhone layouts, and lifecycle-safe
production composition.

## Verify

From this directory:

```sh
flutter analyze
flutter test
flutter test integration_test/app_smoke_test.dart -d <ios-simulator-id>
```

Physical iPhone sensor and export validation is intentionally deferred to the
next approved migration phase.
