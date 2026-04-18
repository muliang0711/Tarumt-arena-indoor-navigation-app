# Indoor Map Prototype

## Root Summary

Standalone Expo React Native prototype for an indoor-first campus navigation experience. The current product slice is intentionally narrow: detect a fixed indoor location, choose a destination on Level 3, confirm the route, then open a live map that advances along the route using device sensors.

Runtime code lives under `src/`. Static prototype map data and sprite assets live under `assets/maps/`. Root files mostly define the Expo shell, TypeScript/tooling config, and architecture notes.

## Start Here

- Product flow and route orchestration: [`src/application/README.md`](./src/application/README.md)
- UI composition, map rendering, and gestures: [`src/presentation/README.md`](./src/presentation/README.md)
- Map package loading and parsing: [`src/integration/README.md`](./src/integration/README.md)
- Shared contracts and design tokens: [`src/shared/README.md`](./src/shared/README.md)
- Stable folder-to-folder dependency directions: [`DEPENDENCY_MAP.md`](./DEPENDENCY_MAP.md)

## Top-Level Map

- `assets/`: prototype map packages and PNG sprite resources used by the integration layer
- `src/`: runtime code split into presentation, application, integration, and shared layers
- `App.tsx`: root React Native shell that mounts the prototype screen inside a phone-sized frame
- `index.ts`, `app.json`: Expo bootstrap and app metadata
- `ARCHITECTURE.md`: concise explanation of the intended layer boundaries
- `package.json`, `tsconfig.json`: scripts and TypeScript configuration

## Common Task Routing

- Add a new screen state, route rule, or navigation behavior: start in `src/application/`
- Change how the map looks or behaves on touch: start in `src/presentation/`
- Swap the demo map package or change parsing rules: start in `src/integration/` and `assets/maps/`
- Add shared types or theme primitives: start in `src/shared/`
- Trace impact before editing multiple layers: read `DEPENDENCY_MAP.md`

## Related Docs

- [`src/README.md`](./src/README.md)
- [`assets/README.md`](./assets/README.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)

## Run Locally

```bash
npm install
npm run start
```
