export type CollisionState = "walkable" | "blocked";

export type NodeType = "destination" | "junction" | "stairs" | "elevator";

export type SpawnDirection = "up" | "down" | "left" | "right";

export interface MapInfo {
  id: string;
  name: string;
  floor?: string;
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
  blockedOffsets?: Array<{ x: number; y: number }>;
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

export interface MapDisplayLabel {
  id: string;
  text: string;
  position: {
    x: number;
    y: number;
  };
  sourceId?: string;
}

export interface MapDisplayIcon {
  id: string;
  iconId: string;
  position: {
    x: number;
    y: number;
  };
  sourceId?: string;
}

export interface MapDisplay {
  assets: MapAsset[];
  visualLayers: MapPlacement[];
  labels: MapDisplayLabel[];
  icons: MapDisplayIcon[];
  layerOrder: string[];
}

export interface MovementCoordinateSystem {
  unit: "meter";
  origin: "top-left";
  scale: number;
  pixelsPerMeter: number;
  tilesPerMeter: number;
}

export interface MovementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WalkableArea {
  id: string;
  type: string;
  polygon: Array<{
    x: number;
    y: number;
  }>;
}

export interface SemanticRoom {
  id: string;
  name?: string;
  polygon: Array<{
    x: number;
    y: number;
  }>;
  sourceId?: string;
}

export interface SemanticCorridor {
  id: string;
  name?: string;
  polygon: Array<{
    x: number;
    y: number;
  }>;
  sourceId?: string;
}

export interface MovementWall {
  id: string;
  from: {
    x: number;
    y: number;
  };
  to: {
    x: number;
    y: number;
  };
}

export interface MovementDoor {
  id: string;
  position: {
    x: number;
    y: number;
  };
  placeId?: string;
  connectsTo?: string;
}

export interface MovementEntrance {
  id: string;
  placeId?: string;
  position: {
    x: number;
    y: number;
  };
  connectsTo: string;
}

export interface MovementRouteNode {
  node_id: string;
  floor_id: number;
  position: {
    x: number;
    y: number;
  };
  type: string;
  name: string;
  enabled: boolean;
}

export interface MovementRouteEdge {
  edge_id: string;
  from_node: string;
  to_node: string;
  bidirectional: boolean;
  weight: number;
  distance_m: number;
  time_s: number;
  accessibility: string;
  enabled: boolean;
}

export interface MovementRouteGraph {
  nodes: MovementRouteNode[];
  edges: MovementRouteEdge[];
}

export interface MovementSection {
  coordinateSystem: MovementCoordinateSystem;
  bounds: MovementBounds;
  rooms: SemanticRoom[];
  corridors: SemanticCorridor[];
  walkableAreas: WalkableArea[];
  walls: MovementWall[];
  doors: MovementDoor[];
  entrances: MovementEntrance[];
  routeGraph: MovementRouteGraph;
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

export interface MapDocumentV3 {
  schemaVersion: 3;
  map: MapInfo;
  display: MapDisplay;
  movement: MovementSection;
  spawn: SpawnPoint;
  assets: MapAssets;
  layers: {
    visual: MapPlacement[];
    collision: CollisionCell[];
  };
  navigation: {
    nodes: NavigationNode[];
    links: NavigationLink[];
  };
}

export type MapDocument = MapDocumentV2 | MapDocumentV3;
