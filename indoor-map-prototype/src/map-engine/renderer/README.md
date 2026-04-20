# Map Engine Renderer

## Purpose

`renderer/` will define map rendering boundaries and layer ownership.

The goal is to separate mostly static scene content from high-frequency dynamic entities so the prototype can grow without redrawing everything unnecessarily.

## Intended Ownership

Examples of future ownership:

- render-layer contracts
- static map scene models
- route layer models
- dynamic entity layer models

## Not For

- raw screen layout
- page composition
- sensor processing
- broker synchronization logic

## Current Phase

Scaffold only. No runtime code has been moved here yet.
