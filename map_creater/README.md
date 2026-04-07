# Navigation Graph Dataset Editor

Frontend-only indoor navigation graph dataset editor built with React, TypeScript, and Vite.

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## What it supports

- Left-side toolbar for `select`, `add node`, `add edge`, and `delete`
- Explicit node and edge schema editing for indoor navigation datasets
- Sparse dot-lattice canvas where each visible anchor point is a valid XY placement location
- Click-to-place nodes on anchor points with required `node_id`, `floor_id`, `x`, `y`, and `type`
- Dedicated `not_walkable` node type for blocked zones or obstacles
- Click-two-nodes edge creation with explicit `bidirectional` and `weight`
- Drag node movement snapped to lattice positions
- Automatic edge creation when a node is placed or dragged next to a same-floor junction
- Configurable canvas width and height with auto-fit sizing for larger maps
- Right-side property panel for node and edge fields
- JSON import/export with schema validation
- Optional background image tracing reference on the canvas
- Lattice spacing control for cleaner node-centric authoring
- Sample seed dataset and clear/reset flow

## Notes

- Panning works with middle mouse drag or `Space` + drag.
- Exported files contain only the navigation graph dataset JSON: `nodes` and `edges`.
- Background images are reference-only and are not exported.
- The faint line grid is optional; the primary interaction surface is the anchor-point lattice.
- `not_walkable` nodes are meant as obstruction markers and should remain disconnected from route edges.
- No backend, auth, routing, or database is included.
