# Shared Support

## Purpose

This folder holds low-level artifacts that more than one runtime layer needs. It is deliberately small: the goal is to share contracts and tokens, not to create a vague dumping ground for unrelated utilities.

## Contains

- `types.ts`: shared TypeScript contracts for parsed map data, routes, telemetry, viewport state, and presentation-facing models
- `theme/`: design tokens used by presentation components

## Entry Points

- `types.ts`: imported across presentation, application, and integration
- `theme/tokens.ts`: primary theme source for colors, spacing, and radii

## Dependencies And Coupling

- every runtime layer depends on this folder
- changes here have wide impact, especially edits to `types.ts`
- this folder should stay free of feature logic; if a file only makes sense for one layer, it probably belongs elsewhere

## When To Read Deeper

Read deeper when types drift between layers, a new shared contract is needed, or UI styling should be updated consistently across multiple screens.
