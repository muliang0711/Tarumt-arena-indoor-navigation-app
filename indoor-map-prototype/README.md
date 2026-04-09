# Indoor Map Prototype

Standalone Expo React Native prototype for an indoor-first campus navigation app.

What is different from the existing app:

- Lives in its own root folder: `indoor-map-prototype/`
- Uses `generated_maps/map_packages/village_demo_01` as the source for map data and sprite assets
- Renders the map from `map.json` plus tileset PNGs instead of using the old preview screenshot
- Focuses on a map-first indoor flow: detected, confirmed, navigating, arrived

Architecture overview:

- `assets/maps/`: copied reference map package and sprite assets
- `src/data/`: static map registry and indoor route scenario layer
- `src/utils/mapParser.ts`: converts raw map package data into renderable floor objects
- `src/hooks/useMapViewport.ts`: one-finger pan and two-finger pinch interactions
- `src/components/map/`: SVG-based base map and overlay rendering
- `src/components/ui/`: floating controls and state sheet
- `src/screens/`: top-level prototype screen

Run locally:

```bash
npm install
npm run start
```
