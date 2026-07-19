# Flutter source boundaries

- `domain/` contains immutable models and pure behavior. It has no dependency
  on Flutter widgets, platform channels, repositories, ViewModels, or UI state
  management.
- `application/ports/` defines the external capabilities needed by
  orchestration. Ports may depend on domain models, but domain code must never
  import application ports.
- `application/orchestration/` owns the plain-Dart Phase 7 engines for map
  bootstrap, route simulation, derived estimates, raw-motion PDR, wrong-way
  checks, and Edge Editor behavior.
- `application/view_models/IndoorNavigationViewModel` is the single public
  MVVM boundary. It exposes an immutable current state plus an ordered state
  stream and owns every child engine's lifecycle.
- Hand-written deterministic port fakes live under `test/support/fakes/`; no
  fake implementation is included in the production source tree.
- `ui/` may depend on application and domain models. Domain and application
  code must never import `ui/`.
- `infrastructure/` contains the Phase 6 iOS Core Motion channel adapter and
  the real clock, timer, bundled-map, optional debug HTTP, and share/export
  adapters. These implementations are injected through application ports.
- `ui/` contains the completed Phase 8 Flutter presentation layer: the scaled
  map and actor rendering, navigation and derived-input controls, Edge Editor,
  loading/error surfaces, responsive iPhone layouts, and app-lifecycle binding.
- `composition/` is the production dependency root used by `main.dart`. It
  injects the real Phase 6 infrastructure adapters into the single ViewModel;
  widgets do not construct repositories, sensors, schedulers, or exporters.
- Widget and iOS integration tests cover production composition, state-driven
  rendering, user interactions, mode changes, and background/foreground
  ownership. Physical-device validation remains deferred to Phase 9.
- The Android native sensor adapter is intentionally unimplemented and remains
  deferred beyond this iOS-first phase.
- Sensor package/native event types must be normalized into the application
  sensor event contract before they can enter domain algorithms.
