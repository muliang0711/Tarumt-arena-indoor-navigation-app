# Presentation Hooks

## Purpose

This folder is for interaction logic that is purely visual or viewport-related. It keeps imperative touch handling out of screen components while avoiding leakage of business state into generic hooks.

## Contains

- `useMapViewport.ts`: manages viewport size, pan and pinch transforms, fit-to-bounds behavior, and recenter/zoom helpers

## Entry Points

- `useMapViewport()`: consumed by `screens/IndoorMapPrototypeScreen.tsx`

## Dependencies And Coupling

- depends on `src/shared/types.ts` for bounds, points, and transform models
- should stay presentation-only; route logic and sensor state belong in `src/application/`

## When To Read Deeper

Read deeper when map gestures feel wrong, zoom limits need tuning, or the camera should focus on a different region during navigation.
