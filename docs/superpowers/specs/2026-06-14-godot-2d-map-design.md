# Godot 2D Layered Map Prototype Design

## Goal

Create a new Godot project beside the existing Expo app. The Godot project will prototype a top-down 2D map built from tiles and pixels, not from one full-map PNG. The first playable slice must show a layer-based map with Building A, Building B, a walkable route between them, a camera, and an actor movement system.

## Project Location

The new project will live at:

```text
Godot_2D_Map/
```

This keeps the Godot prototype separate from the existing `Arena_indoor_navigation` Expo project.

## Folder Structure

```text
Godot_2D_Map/
  project.godot
  assets/
    png/
    tiles/
  scenes/
    main/
    map/
    actors/
  scripts/
    actors/
    camera/
    map/
  docs/
```

`assets/png/` is the storage location for imported or generated PNG files. `assets/tiles/` stores tile textures and tile source images used by the map. Scenes and scripts are split by responsibility so map, actor, and camera behavior can evolve independently.

## Map Architecture

The first map will use Godot 4 `TileMapLayer` nodes. Each layer has one responsibility:

- `GroundLayer`: floor/base terrain tiles.
- `PathLayer`: route tiles between Building A and Building B.
- `BuildingLayer`: visible building footprint and wall tiles.
- `CollisionLayer`: blocking tiles for walls and building boundaries.

The map will be assembled from small tiles. A single full-map PNG is out of scope because it would make editing, collision, and path logic weaker.

## First Playable Scene

`Main.tscn` will instantiate the first map scene and a controllable actor. The scene should open directly in Godot and render the map immediately.

Initial content:

- Building A on the left side of the map.
- Building B on the right side of the map.
- A walkable path connecting A to B.
- Blocking tiles around walls and building boundaries.
- A visible actor starting near Building A.
- A `Camera2D` that follows the actor.

## Actor Movement

The actor will use a simple top-down movement controller. The first version will support keyboard movement with collision, so the actor can move from Building A toward Building B while being blocked by walls and non-walkable map areas.

Pathfinding can be added later. The first slice only needs reliable direct movement and collision.

## PNG and Tile Asset Policy

PNG files may be used for tiles, sprites, and small pixel assets. PNG files must not be used as a single image representing the whole map.

Initial tiles can be simple generated pixel textures, such as floor, path, wall, building, and marker tiles. These assets should be small and reusable.

## Testing and Verification

After scaffolding, verify through Godot tooling that:

- The project is discoverable by the Godot MCP connection.
- The project can launch or provide project metadata.
- The main scene renders a tile-built 2D map.
- The actor and camera nodes exist in the scene tree.
- The project structure contains a dedicated PNG asset folder.

Manual visual inspection in Godot is acceptable for the first prototype render, but scene and script files should remain organized enough for later automated checks.

