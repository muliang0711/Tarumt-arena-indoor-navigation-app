# Campus Navigator

## Backend deployment

For Google Cloud backend setup, start with the
[Compute Engine deployment guide](tarumt-nav-app/docs/operations/google-cloud-deployment.md).
See [frontend public API addresses](tarumt-nav-app/docs/operations/frontend-api-addresses.md)
for connecting the admin website and Flutter app, and
[operations](tarumt-nav-app/deploy/OPERATIONS.md) for maintenance.

For the Wi-Fi positioning backend, follow
[KNN API server and Supabase setup](#knn-api-server-and-supabase-setup) below,
including local installation, database migrations, and Render deployment.

Campus Navigator is a Flutter indoor-navigation application for browsing a
campus building, selecting a room, and following a map-based route to the
destination. It combines pedestrian dead reckoning (PDR) with optional Wi-Fi
RSSI positioning to limit accumulated drift during a navigation session.

The production app is in [`flutter_app/`](flutter_app/). The original
Expo + TypeScript implementation remains in [`expo-app/`](expo-app/) as a
migration and behavior-parity reference.

## App preview

<p align="center">
  <img src="docs/images/campus-navigator-home.jpeg" width="23%" alt="Campus Navigator home screen">
  <img src="docs/images/campus-navigator-popular-places.jpeg" width="23%" alt="Popular campus places">
  <img src="docs/images/campus-navigator-select-floor.jpeg" width="23%" alt="Floor selection screen">
  <img src="docs/images/campus-navigator-floor-rooms.jpeg" width="23%" alt="Room selection screen">
</p>

## Features

- Home, floor selection, room search, filters, saved places, and settings.
- Data-driven campus rooms, facilities, route nodes, and graph edges.
- Indoor map rendered from bundled Tiled/PNG assets.
- Shortest-route generation from the selected start and destination nodes.
- Animated Bob position marker, destination beacon, view cone, and arrival UI.
- Motion-based PDR using native Android sensors and Apple Core Motion.
- Wrong-way detection, heading correction, route snapping, and rerouting
  support.
- Android Wi-Fi scanning with a shared Flutter KNN API client.
- Wi-Fi/PDR fusion with smooth correction, confirmed teleport correction, and
  session-safe arrival handling.
- Manual RSSI Test Lab for exercising the real positioning API on iOS without
  native Wi-Fi scanning.
- MVVM architecture with platform services isolated behind application ports.

## Repository layout

```text
.
├── flutter_app/                 # Current Flutter application
│   ├── android/                 # Android motion and Wi-Fi native bridges
│   ├── ios/                     # Apple Core Motion bridge and Xcode project
│   ├── assets/
│   │   ├── actors/              # Bob animation frames
│   │   ├── campus/              # Editable room catalog
│   │   ├── maps/                # Map, nodes, edges, and Tiled data
│   │   └── positioning/         # Wi-Fi mapping and validation samples
│   ├── lib/                     # Dart application source
│   ├── integration_test/        # Device-level smoke tests
│   └── test/                    # Unit, widget, parity, and adapter tests
├── expo-app/                    # Legacy Expo migration reference
├── validation/                  # Source Wi-Fi RSSI validation captures
└── docs/images/                 # README screenshots
```

## Architecture

The Flutter application follows MVVM and keeps domain logic independent from
Flutter and native frameworks.

```text
UI widgets
    ↓ bind to immutable state and send user actions
ViewModels
    ↓ coordinate lifecycle and application use cases
Application engines + ports
    ↓ call pure navigation/PDR behavior and abstract capabilities
Domain models and algorithms
    ↑ implemented by
Infrastructure + Android/iOS native bridges
```

Key source boundaries:

- `lib/domain/` — pure models and navigation, PDR, routing, and fusion logic.
- `lib/application/view_models/` — UI-facing immutable state and actions.
- `lib/application/orchestration/` — lifecycle-safe application engines.
- `lib/application/ports/` — interfaces for sensors, time, storage, Wi-Fi, and
  logging.
- `lib/infrastructure/` — HTTP, assets, timers, sharing, and platform-channel
  adapters.
- `lib/ui/` — Flutter screens, navigation shell, map, actor, and effects.
- `lib/composition/` — production dependency assembly.

## Requirements

- Flutter 3.44.6 stable or a compatible newer stable release.
- Dart 3.12.2 or the version bundled with Flutter.
- macOS with Xcode for iOS development.
- Android Studio/Android SDK and Java 17 for Android development.
- A physical device for motion and native Wi-Fi validation.

Check the local toolchain before starting:

```sh
flutter doctor -v
flutter devices
```

## Setup

```sh
git clone <repository-url>
cd <repository-directory>/flutter_app
flutter pub get
```

For a physical iPhone, open `ios/Runner.xcworkspace` or `ios/Runner.xcodeproj`
in Xcode once, select your Apple Development team under **Signing &
Capabilities**, and confirm that the bundle identifier is valid for that team.

## KNN API server and Supabase setup

The Wi-Fi positioning backend consists of the FastAPI service in
`knn-api-server/` and the shared database configuration in `supabase/`.
Supabase stores the node registry in `public.nodes`. The API loads the selected
Triplet Loss WKNN model from a local `bundle.pt` file and provides
`/calcPosition` and `/findClosestNode`. The Android diagnostics client is in
`diagnostic-app/`.

The commands in this section use Bash and start from the **`fyp_backend`
repository root**, which contains `supabase/config.toml` and `knn-api-server/`.
Set up the database before starting the API.

### Prerequisites

- Python 3.11 or newer with `venv` and `pip`, as required by the WKNN package.
- Git and the initialized KNN API submodule.
- Node.js 20 or newer for `npx supabase`, plus Docker or a compatible running
  container runtime for local database validation. See the
  [Supabase CLI setup guide](https://supabase.com/docs/guides/local-development/cli/getting-started).
- A Supabase project for hosted operation, and a Render account for API deployment.

```bash
cd /path/to/fyp_backend
git submodule update --init --recursive
test -f supabase/config.toml
```

### Set up the Supabase node registry

The repository already includes the Supabase configuration and migrations;
there is no need to run `supabase init`. For a fresh local database, start the
container runtime and apply and validate the migrations:

```bash
npx supabase start
npx supabase db reset
npx supabase db lint --level error
npx supabase migration list --local
```

`db reset` recreates the local database, so save any local data changes first.
The migrations create `public.nodes`, enable read-only access through Row Level
Security, and insert the initial 13-node registry.

For hosted setup, create a project in the Supabase Dashboard, copy its project
reference, and run these commands from the same repository root:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Review the dry-run output before applying the hosted migrations. In the
project's SQL Editor, verify the bootstrap registry:

```sql
select * from public.nodes order by node_id;
```

A fresh installation should return 13 rows. Copy the project URL and
publishable API key from the Dashboard for the API configuration below.
For local-only operation, use the local URL and key shown by
`npx supabase status` instead.

Use new migrations for subsequent schema changes and the Table Editor for
ordinary node-data edits. Do not run `db reset --linked` against the hosted
database. See [database setup and migrations](supabase/docs/02_database_setup_and_migrations.md)
for the full workflow.

### Install and run the KNN API locally

From the repository root, create and activate the API's Python environment:

```bash
cd knn-api-server
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
test -f triplet-loss-wknn/training/results/selected/bundle.pt
```

The requirements install FastAPI, Uvicorn, the API dependencies, and the local
WKNN package. The selected model is included at the path checked above; a normal
installation does not require retraining. Run the following in the same shell,
replacing the Supabase placeholders with values from your project:

```bash
export SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
export SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
export MODEL_BUNDLE_PATH=triplet-loss-wknn/training/results/selected/bundle.pt
export MODEL_DEVICE=cpu
export MODEL_VARIANT=baseline
export SUPABASE_NODE_REFRESH_SECONDS=300
export PORT=8000
python main.py
```

The server listens on `0.0.0.0:8000` by default. It must be able to fetch a valid
Supabase registry and load a bundle whose reference node IDs exist in that
registry. Missing configuration, an unreadable bundle, or incompatible registry
data prevents startup. The API uses the publishable key for read access;
it does not need a Supabase secret key.

In another terminal, check the running server:

```bash
curl --fail http://localhost:8000/heartbeat
curl --fail http://localhost:8000/status
curl --fail http://localhost:8000/nodes
```

`/heartbeat` should return `{"status":"ok"}`; `/status` reports the commit and
model-bundle hash, and `/nodes` returns the loaded registry. Interactive API
documentation is available at `http://localhost:8000/docs`.

For a positioning smoke test using recorded validation and test scans, run
the following from `knn-api-server/` with the virtual environment active and
the local server still running:

```bash
python tests/triplet_loss/manual_test_wknn_api.py --seed 12345
```

This checks both positioning endpoints and reports coordinate error and node
accuracy. See [API operations and testing](knn-api-server/documentation/api-server/05_operations_and_testing.md)
for automated tests and acceptance-threshold options.

### Deploy the KNN API to Render

Use the settings in [render.yaml](knn-api-server/render.yaml). Connect the
standalone KNN API Git repository to a Render Python web service; its root
directory is the repository root. If deploying from the full `fyp_backend`
repository instead, set the service's root directory to `knn-api-server` and
ensure the submodule contents are available in the deployed checkout.

| Setting | Value |
| --- | --- |
| Runtime | Python, version 3.11 or newer compatible with the package dependencies |
| Build command | `pip install -r requirements.txt` |
| Start command | `python main.py` |
| Health check path | `/heartbeat` |
| `SUPABASE_URL` | Hosted Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Hosted project's publishable key |
| `MODEL_BUNDLE_PATH` | `triplet-loss-wknn/training/results/selected/bundle.pt` |
| `MODEL_DEVICE` | `cpu` |
| `MODEL_VARIANT` | `baseline` (the application default) |
| `SUPABASE_NODE_REFRESH_SECONDS` | `300` |

Enter the project-specific environment values in Render. The application reads
Render's `PORT` environment variable automatically. Ensure the selected
`bundle.pt` is included in the deployed revision or supplied at the configured
path; the model is stored with the API, not in Supabase Storage.

After deployment, repeat the `/heartbeat`, `/status`, and `/nodes` checks using
the service's HTTPS URL. Confirm the expected commit and model hash in `/status`.
Use that HTTPS base URL with the Flutter `WIFI_POSITIONING_BASE_URL` setting
described in [Positioning configuration](#positioning-configuration).

For hosting details, see Render's [FastAPI deployment guide](https://render.com/docs/deploy-fastapi)
and [root-directory configuration](https://render.com/docs/monorepo-support).
For replacing or retraining the model, see
[model deployment](knn-api-server/documentation/api-server/06_model_deployment.md).

### Maintain the registry and model

The API refreshes the registry every 300 seconds by default. Valid updates are
adopted automatically; failed or incompatible refreshes retain the last valid
registry. Restart the API for an immediate reload. Replacing the model bundle
requires an API restart or redeployment.

For registry comparison and export, keep the API virtual environment active,
return to the `fyp_backend` repository root, and use the same Supabase URL and
publishable key:

```bash
cd /path/to/fyp_backend
python -m pip install -r supabase/requirements.txt
python supabase/scripts/sync_node_registry.py diff
python supabase/scripts/sync_node_registry.py download
```

`download` prints the registry; add `--apply` to update the local
`knn-api-server/resources/node-registry.json` before retraining. Bulk uploads
also require the administration-only `SUPABASE_SECRET_KEY`; keep it out of
client apps and source control. See [registry updates and exports](supabase/docs/04_node_registry_updates.md)
for preview and upload commands.

## Run the app

List the available device identifiers:

```sh
flutter devices
```

Run with the platform defaults:

```sh
cd flutter_app
flutter run -d <device-id>
```

The default Wi-Fi positioning behavior is:

| Platform | Default source | Behavior |
| --- | --- | --- |
| Android | `native` | Collects nearby Wi-Fi RSSI through the Android bridge and calls the positioning API. |
| iOS | `off` | Runs motion/PDR navigation without native Wi-Fi scanning. |

### Test Wi-Fi positioning on iOS

iOS does not expose the same general nearby Wi-Fi scan data used by the Android
implementation. Start the app in manual mode to show the removable Wi-Fi Test
Lab on the navigation map:

```sh
flutter run -d <ios-device-id> \
  --dart-define=WIFI_POSITIONING_SOURCE=manual
```

Tap a mapped node in the Test Lab to select a recorded RSSI sample and submit
it to the real KNN API. The map starts a positioning scan immediately. A large
correction or destination fix still requires two matching predictions inside
the confirmation window before the user marker moves.

### Positioning configuration

Supported Wi-Fi sources are `auto`, `native`, `manual`, and `off`:

```sh
flutter run -d <device-id> \
  --dart-define=WIFI_POSITIONING_SOURCE=off
```

The production KNN endpoint defaults to:

```text
https://uni-rssi-knn-api-server.onrender.com/findClosestNode
```

Override its HTTPS base URL when needed:

```sh
flutter run -d <device-id> \
  --dart-define=WIFI_POSITIONING_BASE_URL=https://example.com
```

## Editing rooms, maps, and Wi-Fi nodes

The app loads its campus and positioning content from version-controlled JSON
assets:

| Data | File |
| --- | --- |
| Rooms and facilities | `flutter_app/assets/campus/main_campus.rooms.json` |
| Route nodes | `flutter_app/assets/maps/demo_1.nodes.json` |
| Route graph edges and distances | `flutter_app/assets/maps/demo_1.edges.json` |
| Tiled map metadata | `flutter_app/assets/maps/demo_1.tmj.json` |
| Rendered map image | `flutter_app/assets/maps/demo_1.png` |
| Server-to-map Wi-Fi nodes | `flutter_app/assets/positioning/floor-2.wifi-node-mapping.json` |
| Bundled RSSI Test Lab samples | `flutter_app/assets/positioning/wifiscans-15Jul2026.validation.json` |

When adding a navigable room, its `nodeId` must exist in the local node graph.
When adding a Wi-Fi location, its server node ID must also be explicitly mapped
to a valid local map node before the app will use it for correction.

## Validation and builds

Run commands from `flutter_app/`:

```sh
flutter analyze
flutter test
flutter test integration_test/app_smoke_test.dart -d <device-id>
```

Build debug artifacts:

```sh
flutter build apk --debug
flutter build ios --simulator --debug
```

Physical-device testing is required for motion behavior, Android Wi-Fi
permissions/scanning, iOS signing, and real walking accuracy.

## Platform notes

- Android requires Wi-Fi, precise location permission, Location Services, and
  internet access for native RSSI positioning.
- iOS uses Core Motion for PDR. Use manual mode for repeatable Wi-Fi API and
  fusion testing.
- The Render-hosted positioning service may need extra time on its first
  request after inactivity.
- Test Lab samples are scoped to the current navigation session and are cleared
  after arrival so a new route cannot inherit the previous destination fix.
