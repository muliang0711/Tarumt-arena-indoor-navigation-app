# Development Walkthrough

Step-by-step record of how the Node System was built, for onboarding and reference.

---

## Phase 1: Schema Design

**Goal**: Define the data model for the navigation graph.

1. Created `schema/node.ts` — Node interface with required fields (`node_id`, `floor_id`, `x`, `y`, `type`) and optional fields (`tags`, `name`, `enabled`, `metadata`).
2. Created `schema/edge.ts` — Edge interface with required fields (`edge_id`, `from_node`, `to_node`, `bidirectional`, `weight`) and optional fields (`distance_m`, `time_s`, `accessibility`).
3. Created `schema/index.ts` — Barrel re-exports for clean imports.

**Key Decision**: `distance_m` is optional. For MVP, pathfinding uses hop count (BFS). When real distances are measured, Dijkstra takes over.

---

## Phase 2: Data Collection

**Goal**: Map the physical building into a node-edge graph.

1. Created a Python visualizer (`script/map_visualizer.py`) to draw the map from JSON.
2. Used `script/map_data.json` as a simple input format for the visualizer.
3. Iterated on the map data, verifying against the physical layout:
   - Connected N-14 to N-13 (missing connection).
   - Converted corridor nodes to rooms (ta226/235, ta257).
4. Established a **Node ID Convention**: `N_` (corridor), `R_` (room), `EL_` (elevator), `WC_` (toilet).
5. Produced the final `mvp_data/mvp_system_data.json` with 24 nodes and 26 edges.

---

## Phase 3: Pathfinding API

**Goal**: Create a REST API that returns the shortest path between two nodes.

### Layer 1: Repository (`repo/NodeRepository.ts`)
- Reads `mvp_system_data.json` at startup.
- Indexes nodes by `node_id` into a `Map<string, Node>`.
- Builds an adjacency list `Map<string, AdjacencyEntry[]>` from edges.
- Respects `bidirectional` flag when building the adjacency list.

### Layer 2: Service (`service/PathfindingService.ts`)
- **`findPathBFS(start, end)`**: Breadth-First Search. Finds fewest hops. Active for MVP.
- **`findPathDijkstra(start, end)`**: Dijkstra's algorithm. Uses `distance_m` when available, falls back to `weight`.
- Both methods validate inputs and return a `PathResult` with the full `Node[]` path.

### Layer 3: Controller (`controller/PathController.ts`)
- `GET /api/path?start=...&end=...&algorithm=bfs|dijkstra`
- Input validation with descriptive error messages.
- Returns structured JSON with `success`, `path`, `totalCost`, `algorithmUsed`.

### Entry Point (`app.ts`)
- Wires up Repository → Service → Controller via constructor injection.
- Runs on port 3000.

---

## Phase 4: Next Steps

- [ ] **Measure Distances**: Walk the paths and fill in `distance_m` in `mvp_system_data.json`.
- [ ] **Switch to Dijkstra**: Once distances are populated, use `?algorithm=dijkstra` for accurate routing.
- [ ] **Add More Floors**: Extend the data with floor 2, 3, etc. The schema supports it via `floor_id`.
- [ ] **Navigation Instructions**: Convert the node path into human-readable directions (e.g., "Turn left", "Take elevator to floor 2").
- [ ] **Frontend Integration**: Display the path on a visual map.

---

## Test Results

| Test | Endpoint | Result |
|:---|:---|:---|
| BFS: Central → Room D003 | `/api/path?start=N_1_01&end=R_1_D003` | ✅ 3 nodes, 2 hops |
| Dijkstra: Central → Room TA258 | `/api/path?start=N_1_01&end=R_1_TA258&algorithm=dijkstra` | ✅ 6 nodes, cost 5 |
| Invalid node | `/api/path?start=INVALID&end=R_1_D003` | ✅ 404 error |
| Missing params | `/api/path` | ✅ 400 error |
