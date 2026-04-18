# Application Layer

## Purpose

This layer owns feature flow and navigation behavior. In the current prototype it is where page transitions, destination selection, route generation, and sensor-driven progress are coordinated into one screen-ready model.

Presentation code should treat this folder as the source of truth for "what state is the navigation flow in?" rather than rebuilding that state inside components.

## Contains

- `flows/`: feature-specific controllers and route helpers
- `modules/`: reserved space for larger product modules that sit beside the main flow

## Entry Points

- `flows/indoor-map/useIndoorMapFlow.ts`: top-level hook that presentation consumes
- `flows/indoor-map/navigationScenario.ts`: builds destination anchors and route geometry
- `flows/indoor-map/useSensorRouteTracking.ts`: fuses step and heading sensor data onto the active route

## Dependencies And Coupling

- depends on `src/integration/` for parsed floor data
- depends on `src/shared/` for route, floor, and telemetry contracts
- should stay asset-agnostic; raw PNG and JSON imports belong in integration

## When To Read Deeper

Open this folder when you need to change page sequencing, route estimates, live navigation behavior, or any state that spans more than one screen.
