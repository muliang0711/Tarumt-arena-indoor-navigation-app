# Sprite Resources

## Purpose

This folder contains the PNG sprites used by the `village_demo_01` map package. Despite the temporary folder name, these files are semantically important: application-visible rooms, walkable road tiles, utilities, and blocked/background surfaces are all sourced from here.

## Contains

- room sprites such as `classroom_1.png`, `examroom_1.png`, and `meetingroom_1.png`
- utility markers such as `elevator.png`, `staris.png`, and `toilet.png`
- surface and road tiles such as `walkable_road_clean.png` and `unwalkable_tile_clean.png`

## Entry Points

- every file used at runtime is explicitly registered in `src/integration/map/mapReference.ts`

## Dependencies And Coupling

- filenames must stay aligned with the `require(...)` calls and asset IDs in `mapReference.ts`
- image dimensions are also part of the runtime contract because the registry assigns fixed `widthPx` and `heightPx` values

## When To Read Deeper

Open this folder when replacing sprite art, debugging a missing image, or reconciling asset dimensions with rendered room bounds.
