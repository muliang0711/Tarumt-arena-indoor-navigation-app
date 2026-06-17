# Developer DO's and DON'T's

Follow these guidelines at every step of the implementation to maintain code quality and architectural integrity.

## General Principles
- **DO** keep Android platform APIs (WifiManager, Context, etc.) at the very edges of the app.
- **DO** keep positioning math and business logic in pure Kotlin modules with NO Android dependencies.
- **DON'T** use `Context` inside ViewModels, Repositories, or Engines.
- **DO** prefer immutable data models (`data class` with `val`).

## Coding Style
- **DO** use clear, descriptive names (e.g., `MultilaterationSolver` instead of `MathHelper`).
- **DO** follow standard Kotlin idioms (extension functions, null safety, coroutines).
- **DO** keep classes small and focused on one responsibility.
- **DON'T** allow a single function to exceed 30 lines if possible.
- **DO** use `Result<T>` or a custom `sealed class` for error handling instead of throwing exceptions.

## Android Specifics
- **DO** handle Wi-Fi scan throttling (Android 9+ limits scans to 4 times per 2 minutes for foreground apps).
- **DO** ensure `ACCESS_FINE_LOCATION` and `ACCESS_WIFI_STATE` permissions are handled gracefully.
- **DON'T** perform Wi-Fi scans on the Main thread. Use `Dispatchers.IO` or a dedicated background thread.
- **DO** use `StateFlow` or `LiveData` for exposing state from ViewModels to the UI.

## React Native Collaboration
- **DO** treat the React Native module as a **read-only renderer**.
- **DON'T** modify any files inside `Arena_indoor_navigation/` directly.
- **DO** suggest changes to your teammate if you need a new feature in the map renderer.
- **DO** ensure the JSON data sent across the bridge strictly follows the agreed-upon schema.

## Data & Persistence
- **DO** use a local-first strategy for the AP catalog.
- **DON'T** block the UI or positioning engine while waiting for a network response.
- **DO** validate the `Node` and `Edge` graph on load (e.g., check for broken links).

## Testing & Observability
- **DO** write unit tests for every pure logic component (Engine, Normalizer, Repository).
- **DO** use structured logs with correlation IDs to track a positioning session from scan to UI.
- **DON'T** log sensitive user data or BSSIDs in production without masking if required by privacy policies.
- **DO** provide "Fake" implementations for all hardware-dependent interfaces (`WifiScanSource`, `ApCatalogDataSource`).

## Maintenance
- **DO** document the "Why" behind complex math or architectural decisions in comments.
- **DO** keep public APIs narrow; use `internal` visibility for module-private logic.
- **DON'T** create "Utils" classes. Use extension functions or dedicated helper classes with specific names.
