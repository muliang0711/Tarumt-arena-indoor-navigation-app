# Indoor Map Prototype

Standalone Expo React Native prototype for an indoor-first campus navigation app.

What is different from the existing app:

- Lives in its own root folder: `indoor-map-prototype/`
- Uses `generated_maps/map_packages/village_demo_01` as the source for map data and sprite assets
- Renders the map from `map.json` plus tileset PNGs instead of using the old preview screenshot
- Focuses on a map-first indoor flow: detected, confirmed, navigating, arrived

Architecture overview:

- `assets/maps/`: copied reference map package and sprite assets
- `src/presentation/`: screens, map rendering, and viewport interaction
- `src/application/`: navigation flow orchestration and route-building logic
- `src/integration/`: map loading and parsing adapters
- `src/shared/`: shared types and theme tokens

Detailed layer notes live in [ARCHITECTURE.md](./ARCHITECTURE.md).

Run locally:

```bash
npm install
npm run start
```
