export type CollisionState = "walkable" | "blocked";

export type NodeType = "destination" | "junction" | "stairs" | "elevator";

export type SpawnDirection = "up" | "down" | "left" | "right";

export interface MapInfo {
  id: string;
  name: string;
  tileSize: number;
  width: number;
  height: number;
}

export interface MapAsset {
  id: string;
  src: string;
  widthTiles: number;
  heightTiles: number;
  blocksMovement: boolean;
}

export interface MapAssets {
  resourceRoot: string;
  items: MapAsset[];
}

export interface MapPlacement {
  id: string;
  assetId: string;
  x: number;
  y: number;
}

export interface CollisionCell {
  x: number;
  y: number;
  state: CollisionState;
}

export interface NavigationNode {
  id: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
}

export interface NavigationLink {
  id: string;
  from: string;
  to: string;
  bidirectional: boolean;
}

export interface SpawnPoint {
  x: number;
  y: number;
  direction: SpawnDirection;
}

export interface MapDocumentV2 {
  schemaVersion: 2;
  map: MapInfo;
  assets: MapAssets;
  layers: {
    visual: MapPlacement[];
    collision: CollisionCell[];
  };
  navigation: {
    nodes: NavigationNode[];
    links: NavigationLink[];
  };
  spawn: SpawnPoint;
}
