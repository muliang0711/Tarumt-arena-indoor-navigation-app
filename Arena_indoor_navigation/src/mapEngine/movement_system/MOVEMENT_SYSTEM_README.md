# Movement System Architecture

`movement_system/` is responsible for converting phone sensor data into a stable estimated user position on the indoor 2D map.

This system is not designed for game-style keyboard movement. It is designed for indoor positioning, where phone sensors are collected, cleaned, estimated, corrected by positioning algorithms, constrained by map rules, and finally used to update the user actor position.

## Official public API

`movement_system/index.ts` is the only supported import path for files outside this subsystem. It exports the movement runtime, update function, constraint-provider factory, required state/result types, and neutral shared input contracts. Algorithms, estimates, preprocessing, constraint implementations, particle types, and sensor compatibility files remain private.

Movement depends on `../shared` for geometry, sensor samples, world positions, coordinate metadata, route data, and movement constraint input. It does not import actor, camera, or rendering code.

No real movement logic, sensor logic, collision logic, rendering logic, or positioning algorithms have been implemented yet.

## Folder Tree

```text
src/mapEngine/movement_system/
  algorithms/
  constraints/
  estimate/
  preprocessing/
  sensor/
  indoorposition_engine.ts
```

## Responsibilities

### Platform sensor owner

Real Expo sensor collection is owned by `src/sensors/useMovementSensors.ts`, outside this folder. This keeps `movement_system/` platform-neutral and allows the movement pipeline to accept the same `RawSensorSample` contract in tests or on another platform.

The collector checks sensor availability and permissions, creates native subscriptions once per active `MapScreen`, batches samples every 250 ms, caps pending samples at 128, and removes subscriptions during cleanup.

### `sensor/`

Responsible for collecting raw phone sensor data.

Examples include:

- accelerometer
- gyroscope
- magnetometer
- pedometer
- device motion

This layer should only collect raw data. It should not decide the user position, update actor position, handle collision, or render anything.

### `preprocessing/`

Responsible for cleaning and normalizing raw sensor data before estimation.

Examples include:

- noise filtering
- smoothing
- sensor axis normalization
- removing obvious invalid sensor values
- preparing recent sensor sample windows

This layer turns raw sensor data into cleaner input for estimation.

### `estimate/`

Responsible for producing lower-level movement estimates.

Estimate means a calculated guess, not absolute truth.

Examples include:

- `StepEstimate`: the user probably took one step
- `HeadingEstimate`: the user probably moved in this direction
- `DisplacementEstimate`: the user probably moved this distance
- `MotionEstimate`: combined movement estimate from step, heading, and distance

### `algorithms/`

Responsible for higher-level positioning algorithms that use estimates and map context to calculate a better final position.

Examples include:

- particle filter
- drift correction
- map matching
- position smoothing
- confidence calculation

Algorithms can use estimate results as input.

```text
Raw sensor data
  ↓
preprocessing/
  ↓
step / heading / displacement estimate
  ↓
particle filter algorithm
  ↓
final position estimate
```

### `constraints/`

Responsible for scoring or limiting possible positions based on map rules and navigation context.

Examples include:

- map constraint
- wall crossing constraint
- route constraint

`constraints/` does not generate the collision grid. It uses `collision/` to ask low-level map questions such as:

- Is this position inside a blocked tile?
- Did this movement cross a wall?
- Is this position outside the map?

Then `constraints/` converts those answers into algorithm scores or weight multipliers.

Example:

```text
collision/ answers:
"this position is blocked"

constraints/ decides:
"this particle should get weight 0"
```

### `indoorposition_engine.ts`

Responsible for orchestrating the full movement pipeline.

This file should coordinate sensor input, preprocessing, estimates, algorithms, constraints, and final actor position updates. It should not become a rendering component or a collision engine.

## Conceptual Data Flow

```text
Raw phone sensor data
  ↓
sensor/
  ↓
preprocessing/
  ↓
estimate/
  ↓
algorithms/
  ↓
constraints/ uses collision/ for map rule checks
  ↓
final position estimate
  ↓
actors/ updates user actor position
  ↓
camera follows actor
  ↓
renderer draws actor
```

## Pipeline Diagram

```text
Phone Sensors
  ↓
sensor/
  ↓
preprocessing/
  ↓
estimate/
  ↓
algorithms/
  ↓
constraints/
  ↓
indoorposition_engine.ts
  ↓
actors/
  ↓
camera/
  ↓
renderer/
```

## Relationship Between Internal Folders

`sensor/` collects raw values from the phone.

`preprocessing/` cleans those values so later calculations receive stable input.

`estimate/` turns cleaned sensor data into lower-level movement guesses, such as step, heading, distance, or combined motion.

`algorithms/` takes those estimates and applies higher-level positioning logic, such as particle filtering, drift correction, smoothing, and map matching.

`constraints/` uses map rules and collision answers to score or reject possible positions.

`indoorposition_engine.ts` orchestrates the full pipeline and produces the final estimated position that can be applied to the user actor.

`ArenaMapEngineView` owns the persistent `MovementSystemState` through `MovementRuntime`. Each accepted batch receives the exact state returned by the previous batch, including particle-filter generation and pedometer step count. Empty, duplicate, invalid, and older batches are ignored. The runtime resets only when the map or starting route node changes.

## Coordinate invariant

All movement-system geometry is world-space meters. Route nodes, constraints, motion estimates, particle positions, and final positions must never be converted to pixels inside this subsystem. Meter-to-pixel conversion belongs to actor rendering and camera targeting.

## Boundary With `collision/`

`collision/` provides low-level map collision checks. It answers yes/no questions:

- Is this tile blocked?
- Is this world position blocked?
- Did this line cross a blocked tile?

`movement_system/constraints/` uses collision checks to score estimated positions or particles. It answers probability and weight questions:

- How believable is this estimated position?
- Should this particle be rejected?
- Should this route-following estimate receive higher confidence?

The movement system should not duplicate collision grid generation. It should depend on `collision/` for low-level map blockage checks.

## Boundary With `actors/`

`actors/` stores the final user actor state.

The actor should receive the final estimated position after the movement pipeline has processed sensor data, estimates, algorithms, and constraints.

The actor should not directly read accelerometer, gyroscope, magnetometer, pedometer, or device motion data. Direct sensor access inside actors would mix raw input collection with map state management and make movement correction harder to control.

## Boundary With `renderer/`

`renderer/` only draws the current map state.

It should render the actor after `movement_system/` and `actors/` have updated state.

The renderer should not know anything about particle filters, sensors, estimation logic, preprocessing, or movement algorithms. Keeping rendering separate makes it possible to change positioning logic without changing drawing code.

## Boundary With `camera/`

`camera/` can follow the actor position.

Camera logic should use the actor's final position. It should not read sensor data directly or run positioning algorithms.

## Why Actors Should Not Read Sensor Data

Actors represent dynamic objects on the map. They should store final runtime state such as position, direction, and status.

Raw sensor data is noisy and incomplete. It needs preprocessing, estimation, algorithmic correction, and map constraints before it becomes a believable map position.

If actors read sensors directly, the app would couple raw device input to actor state. That would make it harder to test, harder to smooth movement, harder to apply collision constraints, and harder to replace the positioning algorithm later.

## Why Renderer Should Not Know About Sensors Or Algorithms

The renderer's job is to draw the current map state.

It should not collect sensor data, calculate estimates, run particle filters, apply constraints, or decide user position. Those responsibilities belong to `movement_system/`.

Keeping renderer independent means the visual layer can stay simple:

```text
current map state + current actor state
  ↓
renderer draws the scene
```

This separation keeps the system easier to maintain as positioning logic becomes more complex.
