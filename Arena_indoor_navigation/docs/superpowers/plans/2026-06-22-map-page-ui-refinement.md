# Map Page UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the Map page into a compact iOS-style indoor navigation layout where the rounded map viewport is the primary visual focus.

**Architecture:** `MapScreen` owns page composition and navigation information overlays. Existing map-engine camera and movement behavior remain unchanged; only camera-control styling and debug-panel presentation receive minor UI integration changes.

**Tech Stack:** React Native 0.81, Expo 54, TypeScript, Expo Vector Icons, Node test runner.

---

### Task 1: Protect the compact page composition

**Files:**
- Modify: `src/mapEngine/architecture-boundaries.test.ts`

- [x] Add a source-level contract asserting that `MapScreen` uses fixed layout, a rounded viewport shell, a route overlay, a compact trip card, and collapsed developer tools.
- [x] Run `npx tsx --test src/mapEngine/architecture-boundaries.test.ts`.
- [x] Confirm failure because the new UI components and layout markers do not exist.

### Task 2: Build page-level navigation UI

**Files:**
- Create: `src/components/MapRouteInstructionCard.tsx`
- Create: `src/components/MapTripSummaryCard.tsx`
- Modify: `src/screens/MapScreen.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/SearchBar.tsx`
- Modify: `src/components/ScreenScaffold.tsx`

- [x] Add compact variants for Header and SearchBar.
- [x] Make MapScreen use a non-scrolling fixed shell.
- [x] Render a responsive rounded map viewport with the instruction card overlaid at the upper-left.
- [x] Replace the old route summary and destination list with one compact trip summary card.
- [x] Run the architecture contract and TypeScript typecheck.

### Task 3: Collapse developer diagnostics and polish map controls

**Files:**
- Modify: `src/sensors/debugger/MovementSensorDevPanel.tsx`
- Modify: `src/mapEngine/debugger/MovementDebugPanel.tsx`
- Modify: `src/mapEngine/ArenaMapEngineView.tsx`

- [x] Make both developer panels collapsed by default with explicit expand controls.
- [x] Keep zoom and follow/recenter handlers unchanged while refining their visual size and position.
- [x] Ensure collapsed diagnostics do not create empty dark space below the map.
- [x] Run focused tests and TypeScript typecheck.

### Task 4: Final verification

**Files:**
- Verify all modified files.

- [x] Run `npm test`.
- [x] Run `npm run typecheck`.
- [x] Run `git diff --check`.
- [x] Confirm no movement-system or camera-mode implementation files changed.
