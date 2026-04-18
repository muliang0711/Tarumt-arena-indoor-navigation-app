# Presentation Pages

## Purpose

This folder contains the page-level components for each step of the prototype journey. Each page assumes that flow state has already been prepared elsewhere and focuses on rendering the right information and invoking the right callbacks.

## Contains

- `HomeStep.tsx`: indoor detection entry screen and camera request CTA
- `DestinationStep.tsx`: destination picker for the available rooms on the active floor
- `ConfirmStep.tsx`: route summary before opening the live map
- `NavigationMapStep.tsx`: live navigation page with map canvas, telemetry, and floating controls

## Entry Points

- these pages are selected by `../IndoorMapPrototypeScreen.tsx`

## Dependencies And Coupling

- relies on shared layout and control components under `../../components/`
- expects route, floor, and telemetry props to already be prepared by the application hook
- should not own persistent navigation state; keeping that state here would make page switching harder to reason about

## When To Read Deeper

Open these files when changing copy, layout, or controls for a specific step in the user journey.
