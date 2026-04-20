# Map Engine Routing

## Purpose

`routing/` will own route capability inside the map engine.

This starts with route models and geometry helpers, and should evolve toward graph-based pathfinding, reroute logic, and multi-floor route support.

## Intended Ownership

Examples of future ownership:

- route contracts
- graph contracts
- pathfinding
- reroute policy
- route geometry helpers

## Not For

- destination page state
- screen-specific wording
- indoor semantics that belong in `../indoor/`

## Current Phase

Scaffold only. No runtime code has been moved here yet.
