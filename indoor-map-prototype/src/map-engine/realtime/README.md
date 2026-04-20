# Map Engine Realtime

## Purpose

`realtime/` will own realtime map entity behavior.

This includes shared nearby-user state, broker-driven synchronization, interpolation between updates, and cleanup of stale entities.

## Intended Ownership

Examples of future ownership:

- nearby-user models
- publish policies
- subscribe policies
- interpolation
- staleness cleanup

## Not For

- pathfinding
- localization fusion
- page flow logic

## Current Phase

Scaffold only. No runtime code has been moved here yet.
