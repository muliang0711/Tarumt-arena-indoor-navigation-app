# Map Packages

## Purpose

This folder groups bundled indoor map packages. A package is the static input that describes one environment: raw map JSON plus the sprite resources needed to render rooms, roads, and background surfaces.

## Contains

- `village_demo_01/`: the only package currently wired into the prototype

## Entry Points

- `village_demo_01/map.json`: primary structured input consumed by the map parser

## Dependencies And Coupling

- package folder names and asset IDs are effectively part of the integration contract
- additional map packages can live here later, but application code will need a way to select them

## When To Read Deeper

Open this folder when adding another demo environment or replacing the current package with a newer export.
