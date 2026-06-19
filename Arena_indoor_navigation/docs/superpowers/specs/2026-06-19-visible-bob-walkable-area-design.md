# Visible Bob Translation And Walkable Area Overlay Design

## Goal

Make Bob visibly translate on the map when the movement system advances his position, and add a temporary walkable-area overlay that also becomes the real movement constraint surface.

## Current Findings

- Bob direction and run/idle state now react to movement updates, but `routeNodeToPixels` rounds positions to whole pixels, so small world-position changes can remain visually stuck at spawn.
- The movement system already supports real walkable-area constraints through `walkableAreas` and blocked-area checks.
- The current map data has `movement.walkableAreas: []`, so the engine falls back to the full map bounds rather than a meaningful walkable surface.
- The visual map already contains floor-like road tiles (`walkable_*`, `road_*`, related floor assets) that can serve as a temporary source for walkable cells and a visible overlay.

## Requirements

- Bob must visibly move around the map when debugger position values change, even for small sensor-driven deltas.
- Bob must remain sensor-driven only; no snapping to Node 4 and no assisted projection toward the destination.
- The map must show a removable walkable-area overlay so the user can inspect where Bob is allowed to move.
- The same temporary walkable area shown on screen must also be used by the movement constraints so Bob cannot leave it.
- Node 4 remains visual-only.

## Design

### 1. Visible Bob translation

The actor render path will stop rounding Bob’s world position to whole pixels. Rendering should preserve fractional pixel coordinates so the actor visibly translates when the movement runtime advances by sub-pixel meter increments.

This is a rendering change only. The movement system remains unchanged in ownership: it still produces world-space positions, and actor rendering simply stops collapsing small motion into the same integer pixel.

### 2. Temporary walkable-area source

Rather than hand-authoring `movement.walkableAreas` polygons in `map.json`, this pass will infer walkable cells from the visual floor layers already present in the map.

The extraction rule is temporary and removable:

- visual layers whose asset ids match floor-like patterns such as `walkable_`, `road_`, or other existing floor classifications become one-tile walkable polygons
- blocked areas from room/tree/wall assets continue to apply as they do now

This means the map’s visible road/floor network becomes both the debugging overlay and the actual movement surface.

### 3. Shared walkable-area derivation

Walkable-area derivation should live in a pure helper so both the movement constraint builder and the overlay renderer use the exact same polygons. That avoids the overlay showing one thing while constraints enforce another.

The helper should:

- scan normalized visual layers or raw visual placements
- identify temporary walkable tiles by asset id
- convert each matching tile into a world-space polygon using the validated coordinate system

### 4. Walkable-area overlay

Add a temporary overlay layer in `mapEngine/debugger/` that renders the inferred walkable polygons as translucent shapes above the map and below Bob.

The overlay should be visibly distinct but not overwhelming: a semi-transparent fill with a subtle outline is enough. This is debugging UI, not production map styling.

### 5. Constraint integration

`extractMovementConstraintMapInput` should use the inferred walkable polygons when explicit `movement.walkableAreas` are empty.

That gives the desired behavior:

- Bob remains sensor-driven
- Bob can only move inside the inferred walkable surface
- Node 4 is still only a marker and does not alter movement direction

### 6. Testing

Tests should cover:

- actor pixel conversion preserves fractional positions instead of rounding away motion
- temporary walkable-area extraction finds expected floor tiles and converts them to polygons
- movement constraint extraction uses inferred walkable polygons when explicit walkable areas are empty
- debugger overlay is exposed through the debugger public entry and depends on shared walkable polygons, not a duplicate rule

## Risks And Constraints

- Inferring walkable area from visual floor tiles is a temporary heuristic. If the floor art and intended walkability diverge later, the helper should be replaced with authored movement polygons.
- This pass constrains Bob to walkable space but does not make him reach Node 4 automatically.
- Overlay rendering will verify geometry presence and shared wiring, but final readability still needs device/manual review.

## Success Criteria

- Bob visibly translates on the map whenever debugger position values change.
- The map shows a visible walkable-area overlay.
- Bob cannot move outside that shown walkable area.
- Node 4 remains visual-only and Bob is not pulled toward it.
