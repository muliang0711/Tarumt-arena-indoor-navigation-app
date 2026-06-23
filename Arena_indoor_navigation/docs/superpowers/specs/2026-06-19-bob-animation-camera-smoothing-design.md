# Bob Animation And Free-Look Camera Smoothing Design

## Goal

Make Bob visibly animate when sensor-driven movement changes his map position, and remove the laggy feel when the user drags the map in free-look mode.

## Current Findings

- `actor_system/ActorLayer.tsx` always renders a single idle Bob sprite.
- The repo already contains full Bob idle and run sprite sheets in `src/storage/bob`.
- `ArenaMapEngineView.tsx` updates Bob position from the persistent `MovementRuntime`, so movement truth should stay sensor-driven.
- `cameran_system/CameraViewport.tsx` currently runs gesture updates on the JS thread and pushes camera values through React-facing state callbacks, which is the most likely cause of drag lag in free-look mode.

## Requirements

- Bob animation must be driven by real map-position changes, not by a fake debug loop.
- Bob direction must follow the observed movement delta: `up`, `down`, `left`, `right`.
- Bob should use `run_*` frames while moving and the matching `idle_*` frame when stopped.
- Free-look must remain a manual camera mode selected only by the follow/free-look button.
- The free-look drag path must feel smoother without changing zoom rules, destination behavior, or movement ownership.

## Design

### 1. Actor animation model

The actor system will own sprite selection. The Bob asset registry will be expanded to expose:

- idle frames for each direction
- six run frames for each direction

The actor model will keep using `direction` and `action`, but rendering will also need a frame index. Direction is derived from the latest meaningful position delta between the previous and current Bob position. Action becomes:

- `run` when a movement update changes position beyond a small epsilon
- `idle` when no new movement is observed

The last non-zero direction is preserved so Bob can stop and face the direction he was last moving.

### 2. Actor rendering

`ActorLayer.tsx` will stop hardcoding `idleDown`. Instead, it will render the correct frame from the actor asset registry using:

- `actor.direction`
- `actor.action`
- a frame index that advances while Bob is in `run`

Animation should stay local to actor rendering so the map engine only provides movement state, not frame timing internals. A small frame timer in the actor layer is enough for now because Bob is the only animated actor and this is not a general sprite engine yet.

### 3. Map-engine integration

`ArenaMapEngineView.tsx` already owns both the previous and current actor positions through React state. That layer will:

- compare previous and next Bob positions
- derive the visible direction
- set Bob action to `run` only when position actually changes
- fall back to `idle` when no movement update advances position

This keeps movement truth in the movement runtime while keeping animation truth in the map-composition/actor path.

### 4. Free-look camera smoothing

The camera mode contract stays unchanged: only the button toggles follow/free-look.

The implementation change is in gesture execution, not camera semantics:

- pan and pinch visual updates should happen directly inside the viewport gesture path
- React-facing `onCameraChange` should only fire when a gesture finishes
- during a free-look gesture, the viewport should not bounce through React state on every frame

This reduces JS-thread churn and should remove the "camera lags behind the finger" feel without changing follow-mode centering logic.

### 5. Testing

Tests should cover:

- Bob asset registry exposes the expected directional idle/run frames
- actor-facing direction selection from movement deltas
- actor action switches between `idle` and `run` based on position change
- actor layer no longer hardcodes a single sprite
- architecture boundary still enforces manual follow/free-look mode
- camera viewport no longer requires gesture-start follow toggling and only commits camera state at gesture end

Focused tests should be added before implementation for the new direction/action behavior and the updated viewport contract.

## Risks And Constraints

- Because drag feel is an interaction issue, automated tests can only verify the architecture change, not the physical quality of the gesture. Device/manual verification is still required.
- If the camera still feels laggy after removing per-frame React churn, the next step would be a larger Reanimated/shared-value migration. That is intentionally out of scope for this pass.
- This pass assumes one animated Bob actor. General multi-actor animation infrastructure is not part of the change.

## Success Criteria

- Bob visibly runs when sensor-driven map movement advances his position.
- Bob faces the direction implied by actual movement delta and returns to the matching idle pose when stopped.
- Free-look remains selected until the user presses the mode button again.
- Dragging in free-look feels more direct and less delayed than the current implementation.
