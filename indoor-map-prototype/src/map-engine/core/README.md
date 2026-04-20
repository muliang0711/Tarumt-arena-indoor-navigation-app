# Map Engine Core

## Purpose

`core/` will hold the top-level composition surface for the map engine.

This folder is for engine-wide contracts and orchestration that do not belong to just one subsystem such as camera, routing, or localization.

## Intended Ownership

Examples of future ownership:

- engine root interfaces
- engine state composition
- cross-subsystem contracts
- top-level exports

## Not For

- screen flow state
- React view components
- indoor-only policies that belong in `../indoor/`

## Current Phase

Scaffold only. No runtime code has been moved here yet.
