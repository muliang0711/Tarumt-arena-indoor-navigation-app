import type { ImageSourcePropType } from 'react-native';

export type TileDirection = 'up' | 'down' | 'left' | 'right';

export type CollisionState = 'walkable' | 'blocked';

export type NavigationNodeType = 'destination' | 'waypoint' | 'spawn';

export type TilePosition = {
  x: number;
  y: number;
};

export type MapMetadata = {
  id: string;
  name: string;
  tileSize: number;
  width: number;
  height: number;
};

export type MapAssetDefinition = {
  id: string;
  src: string;
  widthTiles: number;
  heightTiles: number;
  blocksMovement: boolean;
  blockedOffsets: TilePosition[];
};

export type VisualPlacement = {
  id: string;
  assetId: string;
  x: number;
  y: number;
};

export type CollisionCell = TilePosition & {
  state: CollisionState;
};

export type NavigationNode = TilePosition & {
  id: string;
  label: string;
  type: NavigationNodeType;
};

export type NavigationLink = {
  id: string;
  from: string;
  to: string;
  bidirectional: boolean;
};

export type SpawnPoint = TilePosition & {
  direction: TileDirection;
};

export type RawGeneratedMap = {
  schemaVersion: number;
  map: MapMetadata;
  assets: {
    resourceRoot: string;
    items: MapAssetDefinition[];
  };
  layers: {
    visual: VisualPlacement[];
    collision: CollisionCell[];
  };
  navigation: {
    nodes: NavigationNode[];
    links: NavigationLink[];
  };
  spawn: SpawnPoint;
};

export type NormalizedMapData = {
  schemaVersion: number;
  map: MapMetadata;
  resourceRoot: string;
  assets: MapAssetDefinition[];
  assetsById: Record<string, MapAssetDefinition>;
  visualPlacements: VisualPlacement[];
  collisionCells: CollisionCell[];
  navigationNodes: NavigationNode[];
  navigationNodesById: Record<string, NavigationNode>;
  navigationLinks: NavigationLink[];
  spawn: SpawnPoint;
};

export type RegisteredMapAsset = {
  id: string;
  source: ImageSourcePropType;
};
