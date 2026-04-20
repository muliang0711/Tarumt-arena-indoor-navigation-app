# Map Engine Types

## Purpose

`types/` will hold contracts that are owned by the map engine itself.

As the engine becomes real, this folder should absorb types that no longer belong in the global shared layer.

## Intended Ownership

Examples of future ownership:

- engine-level contracts
- render-layer types
- route and graph types
- camera contracts
- entity and geometry types that are engine-specific

## Not For

- presentation-only props
- product-flow-only types
- generic theme tokens

## Current Phase

Scaffold only. No runtime code has been moved here yet.
