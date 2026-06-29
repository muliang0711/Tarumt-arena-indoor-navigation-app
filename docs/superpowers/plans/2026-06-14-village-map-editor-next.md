# Village Map Editor Next Implementation Plan1ss

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `village_map_editor_next` as a React, TypeScript, and Vite map editor that exports the approved v2 JSON schema only.

**Architecture:** The app separates map data, validation/export logic, asset loading, canvas rendering, and React UI panels. Logic-heavy modules are tested first; UI wiring consumes those modules.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Node HTTP static/asset server, CSS modules via plain CSS.

---

## File Map

- Create `village_map_editor_next/package.json`: scripts and dependencies.
- Create `village_map_editor_next/index.html`: Vite entry page.
- Create `village_map_editor_next/vite.config.ts`: Vite and Vitest config.
- Create `village_map_editor_next/tsconfig.json`: TypeScript config.
- Create `village_map_editor_next/src/main.tsx`: React bootstrap.
- Create `village_map_editor_next/src/app/App.tsx`: app shell composition.
- Create `village_map_editor_next/src/app/editorReducer.ts`: editor state and reducer actions.
- Create `village_map_editor_next/src/app/editorState.ts`: initial state and storage helpers.
- Create `village_map_editor_next/src/editor/*.tsx`: UI panels and canvas component.
- Create `village_map_editor_next/src/map/schema.ts`: v2 map TypeScript types.
- Create `village_map_editor_next/src/map/validation.ts`: validation.
- Create `village_map_editor_next/src/map/exportMap.ts`: state-to-v2 export.
- Create `village_map_editor_next/src/assets/assetManifest.ts`: clean asset ids and footprint metadata.
- Create `village_map_editor_next/src/assets/assetLoader.ts`: browser image loading.
- Create `village_map_editor_next/src/rendering/*.ts`: canvas rendering helpers.
- Create `village_map_editor_next/server.js`: local static server and asset manifest endpoint.
- Create `village_map_editor_next/src/**/*.test.ts`: Vitest tests for schema, export, assets, reducer.

## Task 1: Scaffold App And Test Runner

**Files:**
- Create: `village_map_editor_next/package.json`
- Create: `village_map_editor_next/index.html`
- Create: `village_map_editor_next/vite.config.ts`
- Create: `village_map_editor_next/tsconfig.json`
- Create: `village_map_editor_next/src/main.tsx`
- Create: `village_map_editor_next/src/app/App.tsx`

- [ ] **Step 1: Create minimal Vite React TypeScript scaffold**

Use scripts:

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "server": "node server.js",
    "build": "tsc && vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: dependencies install with exit code 0.

- [ ] **Step 3: Verify baseline**

Run: `npm run typecheck`

Expected: TypeScript exits with code 0.

## Task 2: Schema And Validation TDD

**Files:**
- Create: `village_map_editor_next/src/map/schema.ts`
- Create: `village_map_editor_next/src/map/validation.ts`
- Create: `village_map_editor_next/src/map/validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Tests must cover valid maps, duplicate node ids, missing link endpoints, placement bounds, and invalid collision cells.

```ts
import { describe, expect, it } from "vitest";
import { validateMapDocument } from "./validation";
import type { MapDocumentV2 } from "./schema";

const validMap = (): MapDocumentV2 => ({
  schemaVersion: 2,
  map: { id: "village_demo_01", name: "Village Demo", tileSize: 16, width: 30, height: 20 },
  assets: { resourceRoot: "resources/serious_shit", items: [{ id: "classroom_1", src: "classroom_1.png", widthTiles: 2, heightTiles: 2, blocksMovement: true }] },
  layers: { visual: [{ id: "p1", assetId: "classroom_1", x: 1, y: 1 }], collision: [{ x: 0, y: 0, state: "walkable" }] },
  navigation: { nodes: [{ id: "a", label: "A", type: "destination", x: 1, y: 1 }], links: [] },
  spawn: { x: 1, y: 1, direction: "down" },
});

describe("validateMapDocument", () => {
  it("accepts a valid v2 map", () => {
    expect(validateMapDocument(validMap())).toEqual([]);
  });

  it("rejects duplicate node ids", () => {
    const map = validMap();
    map.navigation.nodes.push({ ...map.navigation.nodes[0], label: "Duplicate" });
    expect(validateMapDocument(map)).toContain("Duplicate node id: a.");
  });

  it("rejects links to missing nodes", () => {
    const map = validMap();
    map.navigation.links.push({ id: "bad", from: "a", to: "missing", bidirectional: true });
    expect(validateMapDocument(map)).toContain("Link bad points to missing node missing.");
  });

  it("rejects placements outside map bounds", () => {
    const map = validMap();
    map.layers.visual[0].x = 29;
    expect(validateMapDocument(map)).toContain("Placement p1 is outside map bounds.");
  });

  it("rejects collision cells outside map bounds", () => {
    const map = validMap();
    map.layers.collision[0].x = 30;
    expect(validateMapDocument(map)).toContain("Collision cell 30,0 is outside map bounds.");
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm test -- src/map/validation.test.ts`

Expected: fails because validation module/types do not exist yet.

- [ ] **Step 3: Implement schema and validation**

Define `MapDocumentV2`, `MapAsset`, `MapPlacement`, `CollisionCell`, `NavigationNode`, `NavigationLink`, and `validateMapDocument`.

- [ ] **Step 4: Run tests and verify green**

Run: `npm test -- src/map/validation.test.ts`

Expected: all validation tests pass.

## Task 3: Asset Manifest TDD

**Files:**
- Create: `village_map_editor_next/src/assets/assetManifest.ts`
- Create: `village_map_editor_next/src/assets/assetManifest.test.ts`

- [ ] **Step 1: Write failing asset manifest tests**

```ts
import { describe, expect, it } from "vitest";
import { createAssetManifestItems, cleanAssetId, inferBlocksMovement } from "./assetManifest";

describe("assetManifest", () => {
  it("uses clean base filenames as asset ids", () => {
    expect(cleanAssetId("serious_shit/classroom_1.png")).toBe("classroom_1");
  });

  it("marks roads and white tiles as non-blocking", () => {
    expect(inferBlocksMovement("walkable_road_clean.png")).toBe(false);
    expect(inferBlocksMovement("white_tile.png")).toBe(false);
  });

  it("creates sorted manifest items", () => {
    expect(createAssetManifestItems(["toilet.png", "classroom_1.png"], 16)).toEqual([
      expect.objectContaining({ id: "classroom_1", src: "classroom_1.png" }),
      expect.objectContaining({ id: "toilet", src: "toilet.png" }),
    ]);
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm test -- src/assets/assetManifest.test.ts`

Expected: fails because module does not exist.

- [ ] **Step 3: Implement asset manifest helpers**

Implement id cleanup, movement inference, and manifest creation.

- [ ] **Step 4: Run tests and verify green**

Run: `npm test -- src/assets/assetManifest.test.ts`

Expected: asset manifest tests pass.

## Task 4: Editor Reducer TDD

**Files:**
- Create: `village_map_editor_next/src/app/editorReducer.ts`
- Create: `village_map_editor_next/src/app/editorState.ts`
- Create: `village_map_editor_next/src/app/editorReducer.test.ts`

- [ ] **Step 1: Write failing reducer tests**

Tests cover placing/moving/deleting assets, painting collision, creating nodes, creating links, undo, and redo.

- [ ] **Step 2: Run tests and verify red**

Run: `npm test -- src/app/editorReducer.test.ts`

Expected: fails because reducer does not exist.

- [ ] **Step 3: Implement reducer and initial state**

Actions include `placeAsset`, `movePlacement`, `deletePlacement`, `paintCollision`, `createNode`, `createLink`, `undo`, and `redo`.

- [ ] **Step 4: Run tests and verify green**

Run: `npm test -- src/app/editorReducer.test.ts`

Expected: reducer tests pass.

## Task 5: Export TDD

**Files:**
- Create: `village_map_editor_next/src/map/exportMap.ts`
- Create: `village_map_editor_next/src/map/exportMap.test.ts`

- [ ] **Step 1: Write failing export tests**

Tests verify `schemaVersion: 2`, grouped `map`, explicit `assets.items`, `layers.visual`, `layers.collision`, `navigation`, and no legacy top-level `nodes` or `links`.

- [ ] **Step 2: Run tests and verify red**

Run: `npm test -- src/map/exportMap.test.ts`

Expected: fails because exporter does not exist.

- [ ] **Step 3: Implement exporter**

Convert `EditorState` to `MapDocumentV2` and return validation errors with the document.

- [ ] **Step 4: Run tests and verify green**

Run: `npm test -- src/map/exportMap.test.ts`

Expected: export tests pass.

## Task 6: Canvas Rendering And React UI

**Files:**
- Create: `village_map_editor_next/src/editor/MapCanvas.tsx`
- Create: `village_map_editor_next/src/editor/ToolPanel.tsx`
- Create: `village_map_editor_next/src/editor/AssetPalette.tsx`
- Create: `village_map_editor_next/src/editor/InspectorPanel.tsx`
- Create: `village_map_editor_next/src/editor/ExportPanel.tsx`
- Create: `village_map_editor_next/src/editor/MapSettingsPanel.tsx`
- Create: `village_map_editor_next/src/rendering/renderMap.ts`
- Create: `village_map_editor_next/src/rendering/renderGrid.ts`
- Create: `village_map_editor_next/src/rendering/renderOverlays.ts`
- Create: `village_map_editor_next/src/styles.css`

- [ ] **Step 1: Implement the full editor shell**

Use a work-focused editor layout: left tool rail, center canvas, right inspector/export rail, compact controls, visible asset palette, and stable canvas dimensions.

- [ ] **Step 2: Wire mouse interaction**

Map pointer events to tile coordinates. Support place, select, move, erase, collision paint, node creation, and link creation.

- [ ] **Step 3: Add responsive styling**

Keep controls dense on desktop and stack side panels under the canvas at narrower widths.

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`

Expected: typecheck exits with code 0.

## Task 7: Local Server, Assets, Storage, Export Download

**Files:**
- Create: `village_map_editor_next/server.js`
- Create: `village_map_editor_next/src/assets/assetLoader.ts`
- Modify: `village_map_editor_next/src/app/App.tsx`
- Modify: `village_map_editor_next/src/app/editorState.ts`

- [ ] **Step 1: Implement local server**

Serve static Vite build-compatible files and expose `/api/assets` using files from `../village_tileset_placeholders/serious_shit`.

- [ ] **Step 2: Implement asset loading**

Fetch `/api/assets`, load images, and keep loaded dimensions for rendering and footprints.

- [ ] **Step 3: Implement local browser save/load**

Persist editor state to local storage and restore it on demand.

- [ ] **Step 4: Implement JSON download**

Export validates first. If errors exist, show them. If no errors exist, download formatted v2 JSON.

- [ ] **Step 5: Verify build and tests**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: build exits with code 0.

## Task 8: Browser Verification

**Files:**
- No code files unless verification finds defects.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

Expected: Vite serves the app on a local URL.

- [ ] **Step 2: Open app in browser**

Verify assets load, canvas is nonblank, placing an asset changes the canvas, collision/node/link tools update the map, and export produces v2 JSON.

- [ ] **Step 3: Check responsive layout**

Verify desktop and narrow viewports do not overlap controls or hide essential workflow actions.

- [ ] **Step 4: Final verification**

Run: `npm test`, `npm run typecheck`, and `npm run build`.

Expected: all exit with code 0.
