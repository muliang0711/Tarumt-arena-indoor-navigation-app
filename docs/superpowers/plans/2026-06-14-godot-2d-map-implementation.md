# Godot 2D Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Godot top-down 2D tile-map prototype with layered `TileMapLayer` nodes, a camera-followed actor, reusable PNG tile assets, and a Building A to Building B route.

**Architecture:** The project is a standalone Godot 4 project in `Godot_2D_Map/`. `Main.tscn` owns a map scene and actor scene. The map scene contains named `TileMapLayer` nodes, and `MapBuilder.gd` creates a runtime `TileSet` from small tile PNGs, fills each layer, and adds wall collision bodies.

**Tech Stack:** Godot 4.x, GDScript, `TileMapLayer`, `CharacterBody2D`, `Camera2D`, generated PNG tile assets.

---

## Files

- Create `Godot_2D_Map/project.godot`: Godot project metadata and main scene.
- Create `Godot_2D_Map/scenes/main/Main.tscn`: root playable scene.
- Create `Godot_2D_Map/scenes/map/LayeredMap.tscn`: map scene with `TileMapLayer` nodes.
- Create `Godot_2D_Map/scenes/actors/Actor.tscn`: controllable actor with camera.
- Create `Godot_2D_Map/scripts/map/MapBuilder.gd`: builds tile layers and collision bodies.
- Create `Godot_2D_Map/scripts/actors/ActorController.gd`: top-down movement.
- Create `Godot_2D_Map/scripts/camera/FollowCamera.gd`: follows actor smoothly.
- Create `Godot_2D_Map/assets/png/README.md`: documents PNG storage rule.
- Create `Godot_2D_Map/assets/tiles/*.png`: small reusable tiles.
- Create `Godot_2D_Map/docs/README.md`: prototype notes.

## Task 1: Create Project Skeleton

**Files:**
- Create: `Godot_2D_Map/project.godot`
- Create directories listed above.

- [ ] **Step 1: Create directories**

Run: `New-Item -ItemType Directory -Force Godot_2D_Map, Godot_2D_Map/assets/png, Godot_2D_Map/assets/tiles, Godot_2D_Map/scenes/main, Godot_2D_Map/scenes/map, Godot_2D_Map/scenes/actors, Godot_2D_Map/scripts/map, Godot_2D_Map/scripts/actors, Godot_2D_Map/scripts/camera, Godot_2D_Map/docs`

- [ ] **Step 2: Add Godot project file**

Create `project.godot` with application name `Layered 2D Map Prototype`, main scene `res://scenes/main/Main.tscn`, and keyboard actions for `move_up`, `move_down`, `move_left`, and `move_right`.

- [ ] **Step 3: Verify discoverability**

Run Godot MCP `list_projects` for the workspace root.
Expected: includes `Godot_2D_Map`.

## Task 2: Add Tile PNG Assets

**Files:**
- Create: `Godot_2D_Map/assets/tiles/floor.png`
- Create: `Godot_2D_Map/assets/tiles/path.png`
- Create: `Godot_2D_Map/assets/tiles/building.png`
- Create: `Godot_2D_Map/assets/tiles/wall.png`
- Create: `Godot_2D_Map/assets/tiles/marker_a.png`
- Create: `Godot_2D_Map/assets/tiles/marker_b.png`
- Create: `Godot_2D_Map/assets/png/README.md`

- [ ] **Step 1: Generate 32x32 PNG tile assets**

Use a local image generator script to create six reusable pixel tiles. Expected result: small PNG files, not one whole-map PNG.

- [ ] **Step 2: Document PNG policy**

Add a README stating that `assets/png/` stores imported/generated PNGs, while full-map PNGs are not used for the map itself.

## Task 3: Build Layered Map Scene

**Files:**
- Create: `Godot_2D_Map/scenes/map/LayeredMap.tscn`
- Create: `Godot_2D_Map/scripts/map/MapBuilder.gd`

- [ ] **Step 1: Create scene with layers**

Create a `Node2D` root named `LayeredMap` with children named `GroundLayer`, `PathLayer`, `BuildingLayer`, and `CollisionLayer`, each using `TileMapLayer`.

- [ ] **Step 2: Implement map builder**

`MapBuilder.gd` loads the tile PNGs into a `TileSet`, assigns that tileset to every layer, fills a 28x16 floor grid, draws Building A on the left, Building B on the right, and draws a walkable path between them.

- [ ] **Step 3: Add collisions**

Generate `StaticBody2D` collision rectangles over the wall/building boundary cells so the actor cannot walk through blocked areas.

## Task 4: Add Actor and Camera

**Files:**
- Create: `Godot_2D_Map/scenes/actors/Actor.tscn`
- Create: `Godot_2D_Map/scripts/actors/ActorController.gd`
- Create: `Godot_2D_Map/scripts/camera/FollowCamera.gd`

- [ ] **Step 1: Create actor scene**

Use `CharacterBody2D` with a visible `ColorRect`, `CollisionShape2D`, and child `Camera2D`.

- [ ] **Step 2: Implement actor movement**

Read `move_left`, `move_right`, `move_up`, and `move_down`, normalize direction, set velocity, and call `move_and_slide()`.

- [ ] **Step 3: Configure camera**

Make the camera current, position smoothing enabled, and zoomed to show the map route clearly.

## Task 5: Wire Main Scene and Verify

**Files:**
- Create: `Godot_2D_Map/scenes/main/Main.tscn`
- Create: `Godot_2D_Map/docs/README.md`

- [ ] **Step 1: Instance map and actor**

Create `Main.tscn` with `LayeredMap` and `Actor` instances. Start the actor near Building A.

- [ ] **Step 2: Add docs**

Document controls, folder structure, and the fact that the map is tile-built.

- [ ] **Step 3: Verify with Godot MCP**

Run `get_project_info` and `run_project` for `Godot_2D_Map`.
Expected: project metadata resolves, the run starts without script errors, and the output does not report missing resources.

- [ ] **Step 4: Commit implementation**

Run `git status --short`, add only Godot prototype files and the plan, then commit with message `Create Godot 2D layered map prototype`.

