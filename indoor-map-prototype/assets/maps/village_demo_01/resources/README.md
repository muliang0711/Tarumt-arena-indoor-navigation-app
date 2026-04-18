# Map Resources

## Purpose

This folder holds the raster assets referenced by the current map package. The package points its `resourceRoot` at `resources/serious_shit`, so that subfolder is the concrete asset namespace used by the code today.

## Contains

- `serious_shit/`: the actual sprite PNG set used by the demo package

## Dependencies And Coupling

- this directory structure is part of the package contract because `map.json` names it explicitly
- renaming folders here requires updating both the package metadata and the integration registry

## When To Read Deeper

Read deeper only when changing the package resource root or reorganizing sprite storage.
