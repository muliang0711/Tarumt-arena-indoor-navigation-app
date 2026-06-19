# Map Navigation UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add spawn-aware destination selection, graph route highlighting, and a constraint-derived unwalkable overlay without coupling navigation guidance to Bob's sensor movement.

**Architecture:** Normalize typed route edges at the map boundary, implement immutable Dijkstra/navigation state under the debugger boundary, and render controls plus overlay layers through the existing map overlay hook. The movement runtime continues to receive the same sensor samples and constraint input and remains the sole owner of Bob's position.

**Tech Stack:** React 19, React Native 0.81, Expo 54, TypeScript 5.9, Node test runner via `tsx --test`.

---

### Task 1: Type and normalize route edges

**Files:**
- Modify: `src/mapEngine/shared/movementContracts.ts`
- Modify: `src/mapEngine/mapEngineController.ts`
- Modify: `src/mapEngine/map_rendering_system/mapRendererModel.ts`
- Test: `src/mapEngine/map-engine-contract.test.ts`

- [ ] Add a failing contract test asserting normalized edge IDs, endpoints, direction, enabled state, and weights.
- [ ] Run the focused test and confirm it fails because edges remain `unknown[]`.
- [ ] Add `RouteEdge`, update `MovementRouteGraph`, and normalize schema edge fields.
- [ ] Run the focused test and typecheck.
- [ ] Commit the typed route graph.

### Task 2: Build the pure navigation model with TDD

**Files:**
- Create: `src/mapEngine/debugger/navigationDebugModel.ts`
- Create: `src/mapEngine/debugger/navigationDebugModel.test.ts`
- Modify: `src/mapEngine/debugger/index.ts`

- [ ] Write failing tests for spawn-derived origin and selectable Nodes 2-4.
- [ ] Implement immutable initial state and destination selection.
- [ ] Write failing tests for Node 2, Node 3, and Node 4 paths, including Node 4's intermediate turn.
- [ ] Implement deterministic Dijkstra over enabled graph edges.
- [ ] Write failing tests for route replacement, clearing, no-route, and Bob-position immutability.
- [ ] Implement route state transitions without movement-state writes.
- [ ] Run focused tests and commit.

### Task 3: Build the constraint overlay model with TDD

**Files:**
- Create: `src/mapEngine/debugger/unwalkableOverlayModel.ts`
- Create: `src/mapEngine/debugger/unwalkableOverlayModel.test.ts`
- Modify: `src/mapEngine/debugger/index.ts`

- [ ] Write a failing test proving the model retains the exact normalized walkable, blocked, and wall geometry.
- [ ] Write a failing test proving outside-walkable cells are classified through the movement constraint provider.
- [ ] Implement tile-center classification and merge adjacent red cells into row rectangles.
- [ ] Run focused tests and commit.

### Task 4: Render navigation and unwalkable layers

**Files:**
- Create: `src/mapEngine/debugger/NavigationNodeLayer.tsx`
- Create: `src/mapEngine/debugger/RouteDebugLayer.tsx`
- Create: `src/mapEngine/debugger/UnwalkableAreaDebugLayer.tsx`
- Create: `src/mapEngine/debugger/NavigationDebugPanel.tsx`
- Modify: `src/mapEngine/debugger/index.ts`
- Test: `src/mapEngine/architecture-boundaries.test.ts`

- [ ] Add failing boundary assertions for public debugger exports.
- [ ] Implement distinct start/destination markers, rotated route segments, blocked polygons, walls, and outside-walkable rectangles.
- [ ] Implement destination, calculate, clear, and overlay toggle controls with visible state/no-route messaging.
- [ ] Run boundary tests and typecheck.
- [ ] Commit the UI components.

### Task 5: Integrate without changing Bob movement

**Files:**
- Modify: `src/mapEngine/ArenaMapEngineView.tsx`
- Modify: `src/mapEngine/README.md`
- Test: `src/mapEngine/debugger/navigationDebugModel.test.ts`

- [ ] Add/confirm a failing immutability test using a Bob position object.
- [ ] Derive origin from `startingActor.nodeId`, store only navigation debugger state, and pass the existing route graph and constraint input into debugger helpers.
- [ ] Render route/marker/constraint layers before `ActorLayer`, preserving Bob's visual priority.
- [ ] Document route guidance versus full legal movement geometry.
- [ ] Run focused tests and typecheck.
- [ ] Commit integration.

### Task 6: Full verification and visual evidence

**Files:**
- Modify only if verification exposes a defect.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Start Expo web and inspect destination switching, route replacement/clear, Node 4 L-turn, and overlay toggle.
- [ ] Capture screenshots or record a precise visual description if browser capture is unavailable.
- [ ] Review `git diff`, confirm sensor and movement behavior files are untouched, and commit final fixes.
