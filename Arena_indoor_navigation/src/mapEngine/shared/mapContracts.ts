import type { MapCoordinateSystem } from './coordinateSystem';
import type { MovementRouteGraph } from './movementContracts';

export type MapAsset = {
  id: string;
  src: string;
  widthTiles: number;
  heightTiles: number;
  widthPixels: number;
  heightPixels: number;
  blocksMovement: boolean;
};

export type VisualLayer = {
  id: string;
  assetId: string;
  x: number;
  y: number;
  z: number;
};

export type NormalizedMapSchema = {
  metadata: {
    id: string;
    name: string;
    floor?: string;
  };
  coordinateSystem: MapCoordinateSystem;
  tileSize: number;
  width: number;
  height: number;
  worldWidth: number;
  worldHeight: number;
  resourceRoot: string;
  assets: MapAsset[];
  visualLayers: VisualLayer[];
  movement: {
    coordinateSystem: MapCoordinateSystem;
    routeGraph: MovementRouteGraph;
  };
};
