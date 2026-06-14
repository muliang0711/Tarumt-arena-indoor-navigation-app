# Village Map Editor Next Design

Date: 2026-06-14

## Goal

Build a new map editor in a separate `village_map_editor_next` folder. The original `village_map_editor` remains untouched and is used only as a reference for behavior, asset loading, and the existing map authoring workflow.

The new editor will export a cleaner v2 JSON map format only. It will not emit the old `schemaVersion: 1` format.

## Chosen Approach

Use React, TypeScript, and Vite for the new editor.

This is the best fit because the editor has stateful UI, a canvas drawing surface, structured map data, validation rules, and multiple tools. React keeps UI panels manageable, TypeScript makes the map schema explicit, and Vite keeps local development simple.

Rejected alternatives:

- Next.js: useful for full web apps, but heavier than this local editor needs.
- Improved vanilla JavaScript: low setup cost, but the current editor already shows the maintenance problem of concentrating state, rendering, export, and UI wiring into one large file.

## Project Structure

```text
village_map_editor_next/
  package.json
  index.html
  vite.config.ts
  tsconfig.json
  src/
    main.tsx
    app/
      App.tsx
      appState.ts
      editorReducer.ts
    editor/
      MapCanvas.tsx
      ToolPanel.tsx
      AssetPalette.tsx
      InspectorPanel.tsx
      ExportPanel.tsx
      MapSettingsPanel.tsx
    map/
      schema.ts
      mapModel.ts
      exportMap.ts
      importMap.ts
      validation.ts
    assets/
      assetManifest.ts
      assetLoader.ts
    rendering/
      renderMap.ts
      renderGrid.ts
      renderOverlays.ts
    server/
      server.ts
    test/
      fixtures.ts
```

The browser app owns the editor experience. A small local Node server can serve the app, expose an asset manifest for `../village_tileset_placeholders/serious_shit`, and optionally write exported JSON files later. The first implementation only needs browser download for export.

## Core Editor Features

The first complete version includes:

- Asset palette loaded from `village_tileset_placeholders/serious_shit`.
- Canvas map editor with zoom, pan, grid, and tile coordinate display.
- Visual placement tools: place asset, select asset, move asset, erase asset.
- Metadata tools: paint walkable or blocked collision tiles, place navigation nodes, connect nodes with links, and erase metadata.
- Inspector panel for selected placement, node, or link.
- Map settings for map id, map name, width, height, tile size, and resource root.
- Undo and redo for editing operations.
- Local browser save and load for work in progress.
- Export of clean v2 JSON only.
- Validation before export for duplicate node ids, links pointing to missing nodes, placements outside map bounds, and metadata outside map bounds.

PNG export and phone preview are outside the first implementation. The editing canvas still renders the live map visually.

## V2 JSON Schema

The new export format groups related data and removes old compatibility aliases.

```json
{
  "schemaVersion": 2,
  "map": {
    "id": "village_demo_01",
    "name": "Village Demo",
    "tileSize": 16,
    "width": 100,
    "height": 100
  },
  "assets": {
    "resourceRoot": "resources/serious_shit",
    "items": [
      {
        "id": "classroom_1",
        "src": "classroom_1.png",
        "widthTiles": 6,
        "heightTiles": 5,
        "blocksMovement": true
      }
    ]
  },
  "layers": {
    "visual": [
      {
        "id": "placement_01",
        "assetId": "classroom_1",
        "x": 10,
        "y": 10
      }
    ],
    "collision": [
      {
        "x": 10,
        "y": 12,
        "state": "blocked"
      },
      {
        "x": 11,
        "y": 12,
        "state": "walkable"
      }
    ]
  },
  "navigation": {
    "nodes": [
      {
        "id": "classroom_a",
        "label": "Classroom A",
        "type": "destination",
        "x": 12,
        "y": 16
      }
    ],
    "links": [
      {
        "id": "classroom_a_to_hall",
        "from": "classroom_a",
        "to": "hall_01",
        "bidirectional": true
      }
    ]
  },
  "spawn": {
    "x": 1,
    "y": 1,
    "direction": "down"
  }
}
```

Schema decisions:

- `schemaVersion` is `2`.
- `map` contains identity and dimensions.
- `assets.items` contains explicit asset definitions derived from `serious_shit` PNGs.
- `layers.visual` contains placed visual objects.
- `layers.collision` contains authored collision cells with `state` values of `walkable` or `blocked`.
- `navigation.nodes` and `navigation.links` are the only navigation graph fields.
- No duplicated top-level `nodes` or `links`.
- No old `metadata.tiles`, `metadata.resolvedTiles`, or `visual.placementOriginVersion` fields.

## State And Data Flow

The editor keeps an internal `EditorState` with map settings, loaded assets, placements, collision tiles, nodes, links, selected item, active tool, viewport, and history stacks.

State changes happen through reducer actions such as:

- `placeAsset`
- `movePlacement`
- `deletePlacement`
- `paintCollision`
- `createNode`
- `updateNode`
- `createLink`
- `deleteLink`
- `undo`
- `redo`

Rendering reads normalized state and loaded image assets, then draws in this order:

1. Background grid.
2. Visual placements.
3. Collision overlay.
4. Navigation links.
5. Navigation nodes.
6. Selection and hover overlays.

Export converts `EditorState` into the v2 schema, validates it, and downloads formatted JSON.

## Asset Handling

The asset manifest will read PNG files from `village_tileset_placeholders/serious_shit`.

Asset ids are clean base filenames without the old `serious_shit__` prefix. For example:

- `classroom_1.png` becomes `classroom_1`.
- `walkable_road_clean.png` becomes `walkable_road_clean`.

Each asset definition includes source filename, tile footprint, and whether it blocks movement by default. The footprint is derived from loaded image dimensions and the current tile size. Default movement blocking can be inferred conservatively from asset name and later edited in the inspector if needed.

## Validation And Errors

Validation runs before export and returns actionable errors.

Required checks:

- Map id is non-empty.
- Width, height, and tile size are positive integers.
- Placement ids are unique.
- Placement asset ids exist.
- Placements stay inside map bounds.
- Collision cells stay inside map bounds.
- Collision state is `walkable` or `blocked`.
- Node ids are unique and non-empty.
- Node positions stay inside map bounds.
- Link ids are unique.
- Link endpoints point to existing nodes.
- Spawn position stays inside map bounds.

The export panel shows validation errors and blocks JSON download until they are fixed.

## Testing Plan

Logic-heavy behavior will be tested first.

Unit tests cover:

- Valid v2 map passes validation.
- Duplicate node ids fail validation.
- Links to missing nodes fail validation.
- Placements outside bounds fail validation.
- Export produces stable `schemaVersion: 2` JSON.
- Asset manifest maps `serious_shit/*.png` filenames to clean asset ids.
- Reducer actions place, move, erase, paint collision, create nodes, and create links.

UI verification after implementation:

- Vite app loads locally.
- Assets appear in the palette.
- Canvas is nonblank.
- Basic place, move, collision paint, node, link, and export workflow works.
- Layout remains usable on desktop and narrower widths.

## Non-Goals For First Implementation

- Do not replace or modify `village_map_editor`.
- Do not export old `schemaVersion: 1` JSON.
- Do not implement phone preview.
- Do not implement PNG export.
- Do not integrate directly into the Expo mobile app yet.
- Do not build runtime pathfinding for the mobile app.

## Acceptance Criteria

- `village_map_editor_next` exists as an independent React, TypeScript, and Vite app.
- The original `village_map_editor` remains untouched.
- The app loads `serious_shit` PNG assets into an asset palette.
- Users can place, select, move, and erase visual assets on a tile grid.
- Users can paint collision tiles, create navigation nodes, and connect links.
- Users can edit map settings and selected item properties.
- Users can undo and redo editor operations.
- Users can save and load work in browser local storage.
- Users can export validated v2 JSON.
- Tests cover schema validation, export, asset manifest behavior, and core reducer actions.
