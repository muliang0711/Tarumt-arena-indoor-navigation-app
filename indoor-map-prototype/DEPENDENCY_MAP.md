# Dependency Map: indoor-map-prototype

## Main Flows

- App startup: `App.tsx` -> `src/presentation/screens/IndoorMapPrototypeScreen.tsx`
- Navigation flow: `src/presentation/` -> `src/application/flows/indoor-map/` -> `src/integration/map/`
- Data loading: `src/integration/map/` -> `assets/maps/village_demo_01/`
- Shared support: all runtime layers may depend on `src/shared/`

## Top-Level Dependencies

- `src/presentation/` depends on `src/application/` for flow state and route models
- `src/presentation/` depends on `src/shared/` for types and theme tokens
- `src/application/` depends on `src/integration/` for parsed map data
- `src/application/` depends on `src/shared/` for route, telemetry, and floor contracts
- `src/integration/` depends on `src/shared/` for parsed-model shapes
- `src/integration/` depends on `assets/maps/` for the bundled prototype package

## Shared Foundations

- `src/shared/types.ts` defines the contracts that connect presentation, application, and integration
- `src/shared/theme/tokens.ts` gives presentation code a single token source for colors, spacing, and radii
- `ARCHITECTURE.md` explains the intended layer direction at a repo-wide level

## External Boundaries

- Expo runtime enters through `App.tsx` and `index.ts`
- Device sensors are accessed only from `src/application/flows/indoor-map/useSensorRouteTracking.ts`
- Static map JSON and sprite PNGs are bundled from `assets/maps/village_demo_01/`

## Change Impact Guide

- Editing `src/presentation/` usually affects rendering and interaction only unless props need new fields
- Editing `src/application/flows/indoor-map/` can affect both UI state transitions and sensor behavior
- Editing `src/integration/map/` can change every screen that consumes the parsed floor model
- Editing `src/shared/types.ts` has the widest blast radius because all runtime layers compile against it
