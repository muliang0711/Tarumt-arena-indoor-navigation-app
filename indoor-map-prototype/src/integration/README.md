# Integration Layer

## Purpose

This layer owns boundaries to external or low-level inputs. In the current repo that mainly means adapting the bundled map package and sprite assets into a parsed floor model that the application layer can consume without caring about raw JSON shape or asset lookup details.

## Contains

- `map/`: static prototype map loading, asset registry wiring, and parsing helpers

## Entry Points

- `map/loadPrototypeFloor.ts`: returns the cached parsed floor used by the application layer
- `map/mapParser.ts`: converts `map.json` records plus assets into runtime models

## Dependencies And Coupling

- depends on `assets/maps/` for the bundled prototype package
- depends on `src/shared/` for map and parsed-model types
- should not import presentation code or embed UI-specific decisions

## When To Read Deeper

Read deeper when the map package changes, a new asset source is introduced, or application code needs a different parsed shape than the current adapter returns.
