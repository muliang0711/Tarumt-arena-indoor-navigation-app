export type FlowState = 'detected' | 'confirmed' | 'navigating' | 'arrived';

export type SpriteCategory = 'room' | 'road' | 'utility' | 'surface';

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapPlacementRecord {
  assetId: string;
  id: string;
  tileX: number;
  tileY: number;
}

export interface ResolvedTileRecord {
  x: number;
  y: number;
  kind: 'blocked' | 'walkable';
}

export interface MapPackageJson {
  schemaVersion: number;
  mapId: string;
  tileSize: number;
  mapWidth: number;
  mapHeight: number;
  autoGrow: boolean;
  resourceRoot: string;
  background: {
    mode: string;
    walkableAssetId?: string;
    blockedAssetId?: string;
  };
  visual: {
    placements: MapPlacementRecord[];
  };
  metadata?: {
    autoBlockFromVisuals?: boolean;
    resolvedTiles?: ResolvedTileRecord[];
    tiles?: unknown;
  };
}

export interface SpriteAssetDefinition {
  assetId: string;
  source: number;
  uri: string;
  widthPx: number;
  heightPx: number;
  category: SpriteCategory;
}

export interface ParsedPlacement {
  id: string;
  assetId: string;
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  tileSpanX: number;
  tileSpanY: number;
  category: SpriteCategory;
  sprite: SpriteAssetDefinition;
}

export interface ParsedResolvedTile {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'blocked' | 'walkable';
  sprite: SpriteAssetDefinition | null;
}

export interface ParsedMapFloor {
  id: string;
  label: string;
  buildingName: string;
  tileSize: number;
  mapWidthTiles: number;
  mapHeightTiles: number;
  worldWidth: number;
  worldHeight: number;
  focusBounds: Bounds;
  background: {
    mode: string;
    blocked: SpriteAssetDefinition | null;
    walkable: SpriteAssetDefinition | null;
  };
  placements: ParsedPlacement[];
  rooms: ParsedPlacement[];
  roads: ParsedPlacement[];
  resolvedTiles: ParsedResolvedTile[];
}

export interface DestinationAnchor {
  id: string;
  label: string;
  subtitle: string;
  floorId: string;
  floorLabel: string;
  buildingName: string;
  roomPlacementId: string;
  roomBounds: Bounds;
  roomCenter: Point;
  entrance: Point;
  accentColor: string;
  categoryLabel?: string;
}

export interface FloorOption {
  id: string;
  label: string;
  availability: 'available' | 'preview';
}

export interface DestinationRoomCategory {
  id: string;
  label: string;
  rooms: DestinationAnchor[];
}

export interface DestinationFloorCatalog {
  id: string;
  label: string;
  buildingName: string;
  availability: 'available' | 'preview';
  categories: DestinationRoomCategory[];
  roomCount: number;
}

export interface NavigationScenario {
  buildingName: string;
  activeFloorId: string;
  floors: FloorOption[];
  destinationFloors: DestinationFloorCatalog[];
  currentLocationLabel: string;
  currentPosition: Point;
  detectedFloorLabel: string;
  destinations: DestinationAnchor[];
}

export interface RouteModel {
  id: string;
  destinationId: string;
  points: Point[];
  distanceMeters: number;
  etaMinutes: number;
  instruction: string;
}

export type NavigationSensorStatus =
  | 'idle'
  | 'preparing'
  | 'active'
  | 'fallback'
  | 'permission-denied'
  | 'unavailable';

export interface NavigationTelemetry {
  status: NavigationSensorStatus;
  modeLabel: string;
  detailLabel: string;
  headingDegrees: number | null;
  stepCount: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface TransformState {
  scale: number;
  translateX: number;
  translateY: number;
}
