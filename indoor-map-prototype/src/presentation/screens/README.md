# Presentation Screens

## Purpose

This folder assembles page-sized views from the flow model and reusable components. It is where the presentation layer decides which step to render, not where it computes the navigation logic behind those steps.

## Contains

- `IndoorMapPrototypeScreen.tsx`: top-level screen controller for the prototype
- `pages/`: step-specific page components for home, destination selection, confirmation, and the live map

## Entry Points

- `IndoorMapPrototypeScreen.tsx`: mounted by `App.tsx`

## Dependencies And Coupling

- depends on `src/application/flows/indoor-map/useIndoorMapFlow.ts` for state and actions
- depends on `../hooks/useMapViewport.ts` to manage map-camera transforms
- composes from `../components/` rather than implementing common controls inline

## When To Read Deeper

Read deeper when adding a new screen step, changing screen transitions, or debugging how application state is mapped onto page props.
