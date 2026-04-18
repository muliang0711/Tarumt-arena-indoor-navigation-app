# Indoor Map Flow

## Purpose

This folder contains the real product logic for the prototype. It converts one parsed floor into a guided journey with four major states: detected, destination selection, route confirmation, and live navigation until arrival.

It is also the only place where device sensor updates are constrained back onto a known indoor route, so both UX flow and lightweight navigation math meet here.

## Contains

- `useIndoorMapFlow.ts`: orchestrates pages, selected destination, active floor, route progress, and user actions
- `navigationScenario.ts`: derives destinations, current position, route geometry, distance, ETA, and heading helpers
- `useSensorRouteTracking.ts`: uses pedometer, motion, and magnetometer data to advance a particle-filtered route estimate

## Entry Points

- `useIndoorMapFlow()`: consumed by `src/presentation/screens/IndoorMapPrototypeScreen.tsx`
- `getPrototypeFloor()`: imported from integration to seed the flow

## Dependencies And Coupling

- tightly coupled to `src/shared/types.ts` because the flow exposes most shared runtime models
- depends on `src/integration/map/` for the parsed floor, but should not know where the raw assets came from
- sensor logic is intentionally kept here instead of presentation so UI components stay mostly declarative

## When To Read Deeper

Read these files when changing destination generation, route drawing inputs, arrival logic, or how device sensors move the user marker along the path.
