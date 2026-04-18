# Assets

## Purpose

This folder stores non-code inputs bundled with the prototype. In this repo the important assets are not logos or screenshots; they are the reference indoor map package and sprite PNGs that the integration layer turns into a parsed floor.

## Contains

- `maps/`: bundled indoor map packages used for local prototype rendering

## Entry Points

- `maps/village_demo_01/`: current package used by `src/integration/map/mapReference.ts`

## Dependencies And Coupling

- assets here are consumed indirectly through `src/integration/`, not by the presentation layer
- changing filenames or asset IDs can break the map registry in code even if the images themselves are valid

## When To Read Deeper

Read deeper when updating the demo floor package, replacing sprite art, or tracing a missing asset back from the integration layer.
