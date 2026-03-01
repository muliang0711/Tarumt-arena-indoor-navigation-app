# Indoor Navigation MVP — Technical Stack & Data Flow Analysis

> Audit based on actual codebase inspection, not guesses.

---

## 1. Runtime Stack

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| **Framework** | Expo (Managed) | SDK 54 (`~54.0.0`) | App runtime + Metro bundler |
| **UI** | React Native | `0.81.5` | Component renderer |
| **React** | React 19 | `19.1.0` | State management (hooks only) |
| **Language** | TypeScript | `~5.9.2` | Static typing, `strict: true` |
| **Sensors** | expo-sensors | `~15.0.8` | Accelerometer + Gyroscope access |
| **Rendering** | react-native-svg | `15.12.1` | Map SVG (nodes, edges, corridors, user dot) |
| **Utility** | expo-keep-awake | `~15.0.8` | Prevents screen sleep during testing |
| **Bundler** | Metro | (via Expo) | JS bundling, JSON imports |

> **No backend, no network calls, no database.** Everything runs 100% on-device. The graph data is bundled as a JSON import.

---

## 2. File Architecture

```
indoor-nav-app/
├── App.tsx                          # Entry: SafeAreaView → MapScreen
├── index.ts                         # registerRootComponent(App)
├── package.json                     # SDK 54 deps
├── tsconfig.json                    # strict + resolveJsonModule
└── src/
    ├── types/index.ts               # All TS interfaces (119 lines)
    ├── config/navigationConfig.ts   # 16 tunable constants (68 lines)
    ├── data/
    │   ├── mvp_system_data.json     # 24 nodes + 26 edges (406 lines)
    │   └── mapData.ts               # Graph loader + geometry pre-compute
    ├── engine/
    │   ├── NavigationEngine.ts      # Corridor constraint + edge switching (410 lines)
    │   └── Pathfinder.ts            # Dijkstra shortest path (119 lines)
    ├── services/
    │   └── SensorService.ts         # IMU wrapper: step/heading/turn (234 lines)
    ├── components/
    │   └── DebugOverlay.tsx         # Real-time debug panel (164 lines)
    └── screens/
        └── MapScreen.tsx            # Main UI: SVG map + controls (~600 lines)
```

**Total: ~2,120 lines of TypeScript/TSX** (excluding JSON data)

---

## 3. Data Flow — Complete Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                     INITIALIZATION                            │
│                                                              │
│  mvp_system_data.json                                        │
│       │  (imported at build time via Metro bundler)           │
│       ▼                                                      │
│  mapData.ts::processGraphData()                              │
│       │  grid coords × METERS_PER_GRID_UNIT(10) → meters    │
│       │  pre-compute: angle, length, direction, halfWidth    │
│       │  build adjacency map: nodeId → [edgeId...]           │
│       ▼                                                      │
│  ProcessedGraph (singleton)                                  │
│       │  nodes: Map<string, RawNode>      (24 entries)       │
│       │  edges: Map<string, EdgeGeometry> (26 entries)       │
│       │  adjacency: Map<string, NodeAdjacency>               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                          │
│                                                              │
│  ① Tap node A → initializeAtNode(A) → NavState at s=0       │
│  ② Tap node B → findShortestPath(A, B) → PathResult         │
│       │  Dijkstra with edge.length as cost → O(V²)           │
│       │  returns: nodeIds[], edgeIds[], totalDistance         │
│       ▼                                                      │
│  engine.setPlannedPath(edgeIds)  →  pathEdgeIds: Set<>       │
│  ③ Press "Navigate" → SensorService.start()                  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│              REAL-TIME NAVIGATION LOOP                        │
│                                                              │
│  Accelerometer (20Hz)      Gyroscope (50Hz)                  │
│       │                         │                            │
│       ▼                         ▼                            │
│  Peak Detection            Yaw Integration                   │
│  mag > 1.15g &&            heading += z × dt                 │
│  cooldown 300ms            heading = wrapAngle(h)            │
│       │                         │                            │
│       ▼                         ▼                            │
│  onStep(0.65m)             onHeading(rad)                    │
│       │                         │                            │
│       │                    Sliding Window                    │
│       │                    (800ms window)                    │
│       │                    |Δyaw| > 30°?                    │
│       │                         │                            │
│       │                    onTurn(deltaYaw)                  │
│       │                         │                            │
│       ▼                         ▼                            │
│  ┌─────────────────────────────────────────────────┐         │
│  │         NavigationEngine.processStep()          │         │
│  │                                                 │         │
│  │  1. Heading Correction (α=0.10)                 │         │
│  │     corrected = heading - 0.10 × (h - edgeφ)   │         │
│  │                                                 │         │
│  │  2. Project onto edge                           │         │
│  │     Δs = step × cos(corrected - edgeφ) × dir   │         │
│  │     Δd = step × sin(corrected - edgeφ)          │         │
│  │                                                 │         │
│  │  3. Clamp                                       │         │
│  │     s ∈ [0, edgeLength]                         │         │
│  │     d ∈ [-1.5m, +1.5m]                          │         │
│  │                                                 │         │
│  │  4. Stall Detection                             │         │
│  │     if |Δs| < 0.1m for 5 steps → re-snap       │         │
│  │                                                 │         │
│  │  5. Near Node? → autoEdgeSwitch()               │         │
│  │     Score all edges: Gaussian(heading, σ=25°)   │         │
│  │     Path edges get ×3 bonus                     │         │
│  │     Switch if best > current × 1.5              │         │
│  │                                                 │         │
│  │  6. Compute world position                      │         │
│  │     pos = P0 + s/L × (P1-P0) + d × normal      │         │
│  └─────────────────────────────────────────────────┘         │
│       │                         │                            │
│       ▼                         ▼                            │
│  ┌─────────────────────────────────────────────────┐         │
│  │         NavigationEngine.handleTurn()            │         │
│  │  (Same scoring as above, but triggered by turn)  │         │
│  └─────────────────────────────────────────────────┘         │
│       │                                                      │
│       ▼                                                      │
│  NavState → setNavState() → React re-render                  │
│       │                                                      │
│       ▼                                                      │
│  Arrival Check: nearNode === endNodeId?                      │
│       │  YES → Alert + stop sensors                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     SVG RENDERING                            │
│                                                              │
│  MapScreen re-render (triggered by NavState change):         │
│                                                              │
│  Layer 1: Corridor bands (wide semi-transparent lines)       │
│  Layer 2: Edge lines (gray / green-dashed path / blue active)│
│  Layer 3: Node circles (color by type, S/E badges)           │
│  Layer 4: User dot (blue circle + heading line)              │
│                                                              │
│  Coordinate transform: toSvg()                               │
│  x_svg = PADDING + (x_m - minX) × PPM                       │
│  y_svg = PADDING + (maxY - y_m) × PPM  (Y flipped)          │
│  PPM = 5 pixels/meter                                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Key Algorithms

### 4a. Pedestrian Dead Reckoning (PDR)

| Component | Implementation | Location |
|-----------|----------------|----------|
| Step Detection | Accelerometer magnitude peak > 1.15g, cooldown 300ms | [SensorService.ts:137–162](file:///c:/Code/project/New%20folder/indoor-nav-app/src/services/SensorService.ts#L137-L162) |
| Step Length | Fixed constant 0.65m (no calibration) | `NAV_CONFIG.STEP_LENGTH_DEFAULT` |
| Heading | Gyroscope z-axis integration: `heading += z × dt` | [SensorService.ts:167–180](file:///c:/Code/project/New%20folder/indoor-nav-app/src/services/SensorService.ts#L167-L180) |
| Turn Detection | Sliding window (800ms), yaw change > 30° | [SensorService.ts:184–210](file:///c:/Code/project/New%20folder/indoor-nav-app/src/services/SensorService.ts#L184-L210) |

### 4b. Corridor Constraint (Map Matching)

| Component | Implementation | Location |
|-----------|----------------|----------|
| Position Model | [(edge_id, s, d)](file:///c:/Code/project/New%20folder/indoor-nav-app/App.tsx#8-15) — along-edge + lateral offset | [NavState](file:///c:/Code/project/New%20folder/indoor-nav-app/src/types/index.ts#82-102) in types |
| Projection | `Δs = step × cos(θ)`, `Δd = step × sin(θ)` | [NavigationEngine.ts:160–163](file:///c:/Code/project/New%20folder/indoor-nav-app/src/engine/NavigationEngine.ts#L160-L163) |
| Corridor Clamp | `d ∈ [-1.5m, +1.5m]`, `s ∈ [0, L]` | [NavigationEngine.ts:167–175](file:///c:/Code/project/New%20folder/indoor-nav-app/src/engine/NavigationEngine.ts#L167-L175) |
| Node Detection | `s < 2m` from either edge endpoint | [NavigationEngine.ts:388–393](file:///c:/Code/project/New%20folder/indoor-nav-app/src/engine/NavigationEngine.ts#L388-L393) |

### 4c. Edge Switching (v2.0 with 3 improvements)

| Component | Implementation | Location |
|-----------|----------------|----------|
| Heading Scoring | Gaussian: `exp(-Δθ² / 2σ²)` with σ=25° | [NavigationEngine.ts:240–241](file:///c:/Code/project/New%20folder/indoor-nav-app/src/engine/NavigationEngine.ts#L240-L241) |
| ① Path Bonus | Path edges scored ×3 | [NavigationEngine.ts:243–246](file:///c:/Code/project/New%20folder/indoor-nav-app/src/engine/NavigationEngine.ts#L243-L246) |
| ② Heading Correction | Per-step blend: `h' = h - 0.10 × (h - φ_edge)` | [NavigationEngine.ts:153–158](file:///c:/Code/project/New%20folder/indoor-nav-app/src/engine/NavigationEngine.ts#L153-L158) |
| ③ Stall Recovery | 5 consecutive steps with \|Δs\| < 0.1m → re-snap | [NavigationEngine.ts:177–187](file:///c:/Code/project/New%20folder/indoor-nav-app/src/engine/NavigationEngine.ts#L177-L187) |
| Auto Edge Switch | At nodes, switch if best > current × 1.5 | [NavigationEngine.ts:269–304](file:///c:/Code/project/New%20folder/indoor-nav-app/src/engine/NavigationEngine.ts#L269-L304) |

---

## 5. State Management

**No state library** — pure React hooks (`useState`, `useRef`, `useCallback`).

| State Variable | Type | Updates From | Used By |
|---------------|------|-------------|---------|
| `navState` | `NavState \| null` | Engine callbacks | Map (user dot), DebugOverlay, InfoBar |
| `sensorData` | [SensorData](file:///c:/Code/project/New%20folder/indoor-nav-app/src/types/index.ts#104-110) | Raw sensor callback | DebugOverlay |
| `phase` | [SelectionPhase](file:///c:/Code/project/New%20folder/indoor-nav-app/src/screens/MapScreen.tsx#81-82) | User taps, navigation events | Header, Controls, Rendering logic |
| `pathResult` | `PathResult \| null` | Dijkstra computation | Path highlighting, step chips |
| `userPosition` | `{x, y} \| null` | [toSvg()](file:///c:/Code/project/New%20folder/indoor-nav-app/src/screens/MapScreen.tsx#48-54) of NavState.position | SVG user dot render |

Engine and Sensor are stored in `useRef` (imperative instances, not React state).

---

## 6. Identified Weaknesses & Optimization Directions

### 🔴 Critical (Accuracy / Correctness)

| # | Issue | Root Cause | Proposed Fix |
|---|-------|-----------|--------------|
| 1 | **Fixed step length (0.65m)** | No individual calibration. Short/tall users, different speeds all get same distance. | Adaptive step length from accelerometer peak amplitude, or calibration walk at startup. |
| 2 | **Pure gyro heading (no magnetometer)** | Gyroscope integrates drift indefinitely. Heading correction (α=0.10) helps but doesn't solve absolute drift. | Fuse magnetometer (`expo-sensors` has it) as absolute reference. Complementary filter: `h = 0.95 × gyro + 0.05 × mag`. |
| 3 | **No gravity filtering on accelerometer** | Step detection uses raw magnitude. Phone tilt/rotation adds noise. | Apply a high-pass filter or use `expo-sensors` `DeviceMotion` which provides gravity-separated acceleration. |
| 4 | **Phone orientation assumed fixed** | Code assumes phone is held upright (gyro z = yaw). Doesn't work in pocket or flat-held. | Use rotation matrix from `DeviceMotion` to project angular velocity into world frame before integrating yaw. |

### 🟡 Important (Robustness / UX)

| # | Issue | Root Cause | Proposed Fix |
|---|-------|-----------|--------------|
| 5 | **Stall re-snap only works near nodes** | [attemptReSnap()](file:///c:/Code/project/New%20folder/indoor-nav-app/src/engine/NavigationEngine.ts#309-350) requires `nearNode ≠ null`. If user drifted mid-edge, stall detection does nothing. | Allow re-snap mid-edge: project current world position onto all nearby edges (closest-point-on-segment) and switch to best match. |
| 6 | **autoEdgeSwitch fires EVERY step near a node** | Can cause oscillating between edges if scores are close. | Add a cooldown: don't re-evaluate for N steps after a switch. Or require a minimum distance from last switch. |
| 7 | **No rerouting if user goes off-path** | If user ignores planned path, the system still shows the old path. | Detect off-path (currentEdgeId not in pathEdgeIds for N steps) → recompute Dijkstra from current position. |
| 8 | **No map zoom / pan** | Map is rendered at fixed zoom (PPM=5). Large buildings will be too small, small areas too big. | Add pinch-to-zoom + pan via `react-native-gesture-handler` or `PanResponder`. |

### 🟢 Nice-to-Have (Performance / Polish)

| # | Issue | Root Cause | Proposed Fix |
|---|-------|-----------|--------------|
| 9 | **SVG re-renders entire map on each step** | Every NavState change triggers full MapScreen re-render, rebuilding all SVG elements. | Memoize static layers (corridors, edges, nodes); only update user dot layer. Or use `React.memo` / separate the moving SVG group. |
| 10 | **Dijkstra is O(V²)** | Linear scan for min-distance node. With 24 nodes it's fine, but won't scale. | Use a binary heap / priority queue. Or keep as-is (24 nodes = ~576 ops, negligible). |
| 11 | **[wrapAngle](file:///c:/Code/project/New%20folder/indoor-nav-app/src/services/SensorService.ts#226-234) uses while loops** | `while (a > π) a -= 2π` could loop many times with extreme angles. | Use `a = a - 2π × Math.floor((a + π) / (2π))` for O(1) wrap. |
| 12 | **No floor switching** | All data is Floor_2. `floor_id` exists in schema but unused. | Add floor selector + filter nodes/edges by floor_id. |

### 💡 Future Optimization Directions

| Area | Direction | Impact |
|------|-----------|--------|
| **WiFi fingerprinting** | Periodically correct absolute position using WiFi RSSI + KNN (backend ML). Resets accumulated PDR drift. | Eliminates unbounded drift; reduces reliance on IMU accuracy. |
| **Particle filter** | Replace single-point NavState with N particles. Each particle is (edge, s, d, heading). Reweight by sensor observations. | Handles ambiguity at junctions; naturally probabilistic. More robust than single-hypothesis scoring. |
| **BLE beacons** | Use BLE RSSI from building beacons for proximity-based correction. | Complements WiFi; more precise for node-level position resets. |
| **Step length calibration** | Short calibration walk at startup (known distance) → personalized step length. | Reduces along-edge error by 20-40% based on literature. |
| **Map compression** | Current JSON is 406 lines (small). For larger buildings, use binary format or tile-based loading. | Scalability for campus-sized deployments. |

---

## 7. Summary

The current system is a **fully on-device, IMU-only, corridor-constrained navigation engine** with:

- ✅ Graph-based map matching (edge parameterization)
- ✅ Path planning (Dijkstra)
- ✅ Path-aware edge switching (3× bonus)
- ✅ Drift mitigation (heading correction + stall recovery)
- ✅ Arrival detection
- ❌ No absolute position source (WiFi/BLE/magnetometer)
- ❌ No adaptive step length
- ❌ No gravity compensation for step detection
- ❌ No off-path rerouting

The **highest-impact next step** is adding magnetometer fusion (#2) — it's available in `expo-sensors`, requires ~50 lines of code, and directly addresses the root cause of most current issues (heading drift).
