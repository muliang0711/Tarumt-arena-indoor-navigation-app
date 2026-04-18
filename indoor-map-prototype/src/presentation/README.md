# Presentation Layer

## Purpose

This layer owns what the user sees and touches. It turns application models into cards, controls, map overlays, and gestures without becoming the source of truth for navigation flow decisions.

## Contains

- `components/`: reusable UI pieces such as buttons, layout shells, map canvas, and floating controls
- `hooks/`: presentation-only interaction logic, currently map viewport pan and pinch state
- `screens/`: screen assembly and page-level views for each step of the prototype journey

## Entry Points

- `screens/IndoorMapPrototypeScreen.tsx`: top-level presentation coordinator mounted from `App.tsx`
- `components/map/IndoorMapCanvas.tsx`: map renderer for tiles, rooms, route, destination, and user marker
- `hooks/useMapViewport.ts`: gesture model for pan, zoom, centering, and fit-to-bounds

## Dependencies And Coupling

- depends on `src/application/` for the flow model and route state
- depends on `src/shared/` for types and theme tokens
- should not import raw asset files or decide route logic independently

## When To Read Deeper

Read deeper when changing layout, map interactions, telemetry display, or how a particular navigation step is visually composed.
