import { ArenaMapView } from './map-controller';
import {
  getVisualBounds,
  normalizeMapSchema,
  orderVisualLayers,
} from './map_rendering_system/mapRendererModel';

const parsed = normalizeMapSchema({
  schemaVersion: 3,
  map: { id: 'test-map', tileSize: 16, width: 70, height: 60 },
  assets: {
    resourceRoot: 'resources/serious_shit',
    items: [{ id: 'road_1', src: 'road_1.png', widthTiles: 2, heightTiles: 1 }],
  },
  layers: {
    visual: [
      { id: 'wall', assetId: 'wall_up', x: 1, y: 1 },
      { id: 'floor', assetId: 'walkable_road_clean', x: 1, y: 1 },
    ],
  },
  movement: {
    coordinateSystem: { pixelsPerMeter: 40 },
    routeGraph: {
      nodes: [{ node_id: 'node_1', position: { x: 4.8, y: 5.2 } }],
      edges: [],
    },
  },
});

const orderedIds: string[] = orderVisualLayers(parsed.visualLayers).map((layer) => layer.id);
const bounds = getVisualBounds(parsed);

void ArenaMapView;
void orderedIds;
void bounds;
