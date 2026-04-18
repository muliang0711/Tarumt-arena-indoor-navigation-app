# Map Package: village_demo_01

## Purpose

This folder contains the bundled map package used by the prototype today. It is a self-contained snapshot of one indoor environment, including the structured map description and the PNG sprites needed to render rooms, corridors, and background tiles.

The current application treats this package as a single Level 3 "Student Center" demo, even though some runtime labels are layered on later inside the integration and application code.

## Contains

- `map.json`: raw package data including placements, resolved tiles, background asset IDs, and spawn metadata
- `resources/`: image assets referenced by `map.json`

## Entry Points

- `map.json`: imported by `src/integration/map/mapReference.ts`
- `resources/serious_shit/`: sprite directory referenced by the package's `resourceRoot`

## Dependencies And Coupling

- asset IDs in `map.json` must match the registry keys declared in `src/integration/map/mapReference.ts`
- parser assumptions in `src/integration/map/mapParser.ts` depend on this package exposing placements and resolved tiles in the current shape

## When To Read Deeper

Read deeper when room bounds, corridor tiles, or sprite selection are wrong on the rendered map, or when importing a fresh map export into the prototype.
