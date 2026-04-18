# Map Integration

## Purpose

This folder adapts the bundled map package into a runtime floor model. It is the thin seam between static asset files in `assets/maps/village_demo_01/` and the higher-level route logic in the application layer.

The code here is intentionally small but high leverage: any change to parsing or asset registration affects every screen that renders the map.

## Contains

- `mapReference.ts`: imports the raw `map.json`, registers sprite PNGs, and assigns semantic categories such as `room`, `road`, and `surface`
- `mapParser.ts`: resolves placements, background tiles, rooms, roads, and focus bounds into `ParsedMapFloor`
- `loadPrototypeFloor.ts`: memoized accessor that prevents reparsing on every hook render

## Entry Points

- `getPrototypeFloor()`: main application-facing entry point

## Dependencies And Coupling

- directly coupled to the folder structure and asset IDs under `assets/maps/village_demo_01/`
- coupled to `src/shared/types.ts` because parsing outputs are shared across layers
- should remain stateless apart from the intentional floor cache in `loadPrototypeFloor.ts`

## When To Read Deeper

Open these files when debugging missing sprites, wrong room bounds, incorrect focus framing, or changes to how map JSON should be interpreted.
