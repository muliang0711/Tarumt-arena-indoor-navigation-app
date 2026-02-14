# Node System - Indoor Navigation API

A REST API for indoor shortest-path navigation built with **Express + TypeScript**.

## Architecture

```
Controller (PathController)
    │  Validates input, formats response
Service (PathfindingService)
    │  BFS (unweighted) + Dijkstra (weighted)
Repository (NodeRepository)
    │  Loads JSON, builds adjacency list
Schema (Node, Edge)
    │  Type definitions for all data
Data (mvp_system_data.json)
```

## Quick Start

```bash
cd node_system
npm install
npm run dev        # dev server with hot reload (port 3000)
```

## API Reference

### `GET /api/path`

Find shortest path between two nodes.

| Param | Type | Required | Description |
|:---|:---|:---|:---|
| `start` | string | ✅ | Starting node_id (e.g. `N_1_01`) |
| `end` | string | ✅ | Destination node_id (e.g. `R_1_D003`) |
| `algorithm` | string | ❌ | `bfs` (default) or `dijkstra` |

**Example:**
```
GET /api/path?start=N_1_01&end=R_1_D003
```

**Response:**
```json
{
  "success": true,
  "data": {
    "path": [
      { "node_id": "N_1_01", "floor_id": 1, "x": 0, "y": 0, "type": "junction", "name": "Central Junction" },
      { "node_id": "N_1_07", "floor_id": 1, "x": 1, "y": 0, "type": "corridor_turn", "name": "Corridor East 1" },
      { "node_id": "R_1_D003", "floor_id": 1, "x": 2, "y": 0, "type": "room", "name": "Room D003" }
    ],
    "totalCost": 2,
    "algorithmUsed": "BFS",
    "nodeCount": 3
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Start node \"INVALID\" does not exist."
}
```

### `GET /health`

Health check endpoint. Returns `{ "status": "ok" }`.

## Pathfinding Algorithms

| Algorithm | When to Use | Cost Metric |
|:---|:---|:---|
| **BFS** | MVP (no distances yet) | Number of hops (edges) |
| **Dijkstra** | When `distance_m` is populated | Real distance in meters |

> **Current default**: BFS. When you fill in `distance_m` values in `mvp_system_data.json`, switch to Dijkstra for accurate routing.

## Node ID Convention

| Prefix | Type | Example |
|:---|:---|:---|
| `N_` | Corridor / Junction | `N_1_01`, `N_1_07` |
| `R_` | Room | `R_1_D003`, `R_1_TA225` |
| `EL_` | Elevator | `EL_1_01` |
| `WC_` | Toilet | `WC_1_01` |

Format: `{TYPE}_{FLOOR}_{ID}`

## Project Structure

```
node_system/
├── app.ts                  # Express entry point
├── controller/
│   └── PathController.ts   # API endpoint
├── service/
│   └── PathfindingService.ts  # BFS + Dijkstra
├── repo/
│   └── NodeRepository.ts   # Data access layer
├── schema/
│   ├── node.ts             # Node type definitions
│   ├── edge.ts             # Edge type definitions
│   └── index.ts            # Re-exports
├── mvp_data/
│   └── mvp_system_data.json  # Graph data (nodes + edges)
├── script/
│   ├── map_visualizer.py   # Python visualization tool
│   └── map_data.json       # Visualizer input
└── docs/
    ├── README.md           # This file
    └── walkthrough.md      # Development walkthrough
```
