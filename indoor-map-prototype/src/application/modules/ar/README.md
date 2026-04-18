# AR Module Placeholder

## Purpose

This folder marks the intended home for a future AR guidance module. Nothing in the current prototype imports it yet, but the directory exists so AR-specific concerns do not have to be retrofitted into the existing flow structure later.

## Expected Responsibilities

- coordinate AR-specific flow state with the broader application layer
- translate indoor route state into AR guidance cues or anchors
- consume camera, sensor, or anchor adapters from `src/integration/`

## Dependencies And Coupling

- likely upstream input: route and destination state from `src/application/flows/`
- likely downstream boundaries: device and environment adapters in `src/integration/`
- should reuse `src/shared/` contracts where possible instead of inventing parallel models

## When To Read Deeper

You can ignore this folder for current map-rendering work. Read it only when the prototype starts mixing camera or world-anchor behavior into navigation.
