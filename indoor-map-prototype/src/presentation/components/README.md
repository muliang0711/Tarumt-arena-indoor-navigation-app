# Presentation Components

## Purpose

This folder holds reusable visual building blocks used by one or more screens. The split here is by UI responsibility rather than by feature: layout framing, interaction controls, and the map renderer itself each live in their own subfolder.

## Contains

- `controls/`: shared buttons, floor selector, zoom controls, and recenter affordances
- `layout/`: reusable page shell for the non-map steps
- `map/`: SVG-based map canvas that renders tiles, route overlays, rooms, and the user marker

## Entry Points

- `map/IndoorMapCanvas.tsx`: primary rendering surface for the indoor floor
- `controls/FloatingControls.tsx`: overlays floor and zoom controls on the map screen
- `layout/ScreenShell.tsx`: shared frame for the home, destination, and confirm pages

## Dependencies And Coupling

- heavily coupled to `src/shared/theme/tokens.ts` for visual consistency
- accepts data-rich props from `src/application/` and `src/presentation/screens/` instead of fetching its own state

## When To Read Deeper

Open this folder when a change is about shared UI pieces, map visuals, or control affordances rather than page sequencing.
