# Flutter Map Viewer

This folder contains a new Flutter app shell for reviewing a raster map image together with the JSON exported from `village_map_editor`.

## What it does

- Loads a bundled sample map image and sample JSON.
- Loads a user-picked `.json` map file.
- Loads a user-picked `.png` or `.jpg` map image.
- Shows nodes and links from the editor schema.
- Lets you tap nodes to set a start and destination.
- Computes a shortest path and renders a navigation-style overlay.
- Uses `InteractiveViewer` so the phone app can pan and zoom naturally.

## Supported JSON shape

The app matches the current editor export:

- `tileSize`
- `mapWidth`
- `mapHeight`
- `nodes`
- `links`
- `metadata.tiles`
- `metadata.resolvedTiles`
- `visual.placements` is ignored for now

## Current environment blocker

The local Flutter SDK on this machine is broken, so I could not run `flutter create`, `flutter pub get`, or `flutter run` here.

The app source is ready, but to execute it you need a working Flutter SDK first. Once Flutter is fixed:

1. Open a terminal in `flutter_map_viewer`
2. Run `flutter create .`
3. Run `flutter pub get`
4. Run `flutter run`

`flutter create .` will generate the missing Android, iOS, web, Windows, macOS, and Linux platform folders around the source files already in this folder.
