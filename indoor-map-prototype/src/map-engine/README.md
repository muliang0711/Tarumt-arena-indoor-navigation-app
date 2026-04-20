# Map Engine Layer

## Purpose

`map-engine/` is the dedicated home for reusable map capability as the prototype grows beyond a single flow-plus-canvas implementation.

The intended direction is `indoor-first, engine-shaped`: the module is built primarily for indoor navigation, but its boundaries are defined by engine responsibilities rather than page or screen names.

## Contains

- `core/`: top-level engine composition and contracts
- `camera/`: map camera state and interaction policies
- `renderer/`: render-layer boundaries and scene models
- `routing/`: route and pathfinding capability
- `localization/`: sensor fusion, map matching, and correction pipelines
- `realtime/`: nearby-user and broker-driven realtime entity state
- `indoor/`: indoor-specific semantics such as floors, rooms, and vertical navigation rules
- `types/`: engine-owned contracts shared across engine modules

## Current Phase

This folder tree is currently scaffolded for architecture ownership only.

No existing runtime code has been moved here yet.

## Dependency Intent

The long-term direction is:

`presentation -> application -> map-engine -> integration`

With practical exceptions allowed when presentation must render engine-owned state or interact with engine-owned camera behavior.

## When To Read Deeper

Read this module when a task is about map capability itself rather than product journey flow or purely visual layout.
