# Map Navigation Debugger Design

## Goal

Make camera follow mode an explicit user choice and add removable, on-screen diagnostics for testing sensor-driven movement. Node 4 is the default visual destination, but it does not constrain or correct Bob's position.

## Scope

This change includes:

- a camera mode that changes only through the follow/free-look button;
- live visibility into sensor input and movement-engine output;
- a visual destination marker at Node 4;
- a reset control for repeated navigation tests;
- isolation of temporary UI and formatting code under `src/mapEngine/debugger/`.

This change does not include:

- route finding or turn-by-turn navigation;
- snapping Bob to the route;
- forcing movement toward Node 4;
- changing the movement algorithm to use the destination;
- persisting debug state between application launches.

## Camera Mode

The map engine owns an explicit camera mode with two values:

- `following`: the camera is centered on Bob as his sensor-derived position changes;
- `free-look`: Bob continues to move, but camera position is independent of Bob.

Only pressing the camera-mode button changes this mode. Pan and pinch gestures update the camera but do not change the mode. Sensor batches, movement results, viewport layout, camera fitting, React rerenders, and elapsed time must not switch modes.

The button displays the current state and toggles between the two states. Switching to `following` immediately centers the camera on Bob. Switching to `free-look` preserves the current camera position.

The camera-follow update and initial viewport-fitting update must be separate effects. A Bob position update may recenter the camera only when the explicit mode is `following`; it must never write the mode itself.

## Destination Behavior

Node 4 is the default selected destination. The debugger renders a clear target marker at Node 4 using the route graph's meter-space position and the existing world-to-pixel conversion.

The destination is visual information only:

- Bob's position remains entirely controlled by sensor data and the movement engine;
- Bob may move away from the route;
- the particle filter and movement constraints receive no destination input;
- the system does not snap or pull Bob toward Node 4;
- reset does not change the selected destination.

If Node 4 is absent from the loaded map, the marker is omitted and the debug panel reports that the destination node is unavailable. The map remains usable.

## Debugger Boundary

Temporary diagnostics live under:

```text
src/mapEngine/debugger/
  movementDebugModel.ts
  MovementDebugPanel.tsx
  DestinationDebugLayer.tsx
  index.ts
```

Responsibilities:

- `movementDebugModel.ts` defines the immutable debug snapshot and pure functions that summarize sensor batches and movement results.
- `MovementDebugPanel.tsx` displays live values and exposes the reset action.
- `DestinationDebugLayer.tsx` renders the Node 4 target marker without owning navigation behavior.
- `index.ts` is the only import surface used by core map-engine files.

`ArenaMapEngineView.tsx` remains the runtime owner because it already owns `MovementRuntime`, Bob's position, and the camera. It passes data into debugger components and calls debugger model helpers, but temporary components do not mutate movement state directly.

Removing the debugger directory and its imports removes the panel and marker without requiring changes inside the movement algorithm, actor system, rendering system, or sensor adapter.

## Live Movement Snapshot

The panel updates when a sensor batch is received or the movement runtime produces a result. It shows:

- total samples currently supplied to the map engine;
- counts by sensor kind;
- latest sample kind and timestamp;
- latest pedometer count, or `unavailable`;
- processing status: `processed`, `ignored`, `reset`, or `waiting`;
- Bob's world position in meters;
- heading in degrees;
- movement confidence;
- particle-filter generation;
- selected destination: `Node 4` or `unavailable`.

`ignored` means a non-empty incoming batch produced no movement result because the runtime found no new valid samples. `waiting` means no sensor batch has arrived since startup or reset.

The panel is diagnostic only. Rendering it must not start sensors, alter samples, invoke the movement engine, or change Bob's position.

## Reset Semantics

Pressing `Reset navigation`:

1. resets `MovementRuntime` to Node 1's position;
2. marks the currently supplied sensor batch as already consumed;
3. sets Bob's rendered position to Node 1;
4. clears particle-filter, confidence-history, and heading progress through the runtime reset;
5. records debug status as `reset`;
6. keeps Node 4 selected;
7. preserves the user's current camera mode.

If the camera mode is `following`, the camera recenters on the reset Bob position through the normal follow behavior. In `free-look`, reset does not move the camera.

Marking the current batch as consumed prevents reset from immediately replaying old pedometer or motion samples. The next genuinely new sample resumes movement processing from Node 1.

## Data Flow

```text
useMovementSensors
  -> sensorSamples
  -> ArenaMapEngineView
     -> MovementRuntime.process
        -> MovementSystemResult
        -> Bob position
        -> movement debug snapshot
     -> explicit camera mode
        -> following: center camera on Bob
        -> free-look: preserve independent camera
     -> debugger UI
        -> live panel
        -> Node 4 visual marker
        -> reset callback
```

The destination marker has no data path back into `MovementRuntime`.

## Error Handling

- Empty sensor input produces `waiting`, not an error.
- Duplicate, stale, or invalid samples produce `ignored` when the supplied batch is non-empty and no update is accepted.
- Missing pedometer data is shown as `unavailable`; other sensor diagnostics continue.
- Missing Node 4 hides the marker and reports an unavailable destination.
- Reset uses the existing actor construction path for Node 1. A malformed map or missing Node 1 retains the existing map-engine validation behavior rather than adding a debugger-only fallback.

## Testing

Automated tests will cover:

- camera mode changes only for an explicit button-toggle event;
- gestures and movement updates cannot change camera mode;
- entering follow mode requests immediate recentering;
- sensor summaries count each sample kind and select the latest sample correctly;
- debug status distinguishes waiting, processed, ignored, and reset;
- reset restores the initial position and prevents replay of the current sample batch;
- Node 4 lookup returns its position without modifying movement input;
- the architecture boundary permits core code to import only `debugger/index.ts`;
- type checking and the full existing test suite remain clean.

Manual verification on a sensor-capable phone will confirm:

- free-look remains selected for an extended period while walking;
- Bob continues to update while the camera is in free-look;
- the debug panel receives changing sensor timestamps and counts;
- pedometer and movement-engine values reveal whether lack of movement originates before or after runtime processing;
- reset repeatedly returns Bob to Node 1;
- Node 4 remains displayed as the destination without pulling Bob toward it.
