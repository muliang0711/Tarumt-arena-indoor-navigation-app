import { LayerKind, DEFAULT_RENDER_OPTIONS } from "../shared/types.js";
import { drawMapBackground } from "./TileGrid.js";
import { TilesetRenderer } from "./TilesetRenderer.js";
import { drawCollisionLayer } from "./CollisionLayer.js";
import { drawDisplayOverlay } from "./DisplayOverlay.js";
import { drawRoomZones } from "./RoomZones.js";
import { ActorRenderer } from "../actor-system/index.js";

const KIND_ORDER = new Map([
  [LayerKind.FLOOR, 0],
  [LayerKind.ROOM, 1],
  [LayerKind.WALL_OBJECT, 2],
  [LayerKind.DOOR, 3],
  [LayerKind.DECORATION, 4],
  [LayerKind.UNKNOWN, 5],
]);

export function orderVisualLayers(visualLayers) {
  return [...visualLayers]
    .map((placement, index) => ({ placement, index, kind: classifyAsset(placement.assetId) }))
    .sort((a, b) => {
      const orderDiff = KIND_ORDER.get(a.kind) - KIND_ORDER.get(b.kind);
      return orderDiff || a.index - b.index;
    })
    .map((item) => item.placement);
}

export function getVisualBounds(mapData, manifest) {
  if (!mapData.visualLayers.length) {
    return {
      x: 0,
      y: 0,
      width: mapData.worldWidth,
      height: mapData.worldHeight,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const placement of mapData.visualLayers) {
    const asset = manifest.get(placement.assetId);
    const x = placement.x * mapData.tileSize;
    const y = placement.y * mapData.tileSize;
    const width = asset?.widthPixels || mapData.tileSize;
    const height = asset?.heightPixels || mapData.tileSize;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
  };
}

export function classifyAsset(assetId = "") {
  if (/^(road_|walkable_|unwalkable_|white_?|white_|.*tile)/.test(assetId)) {
    return LayerKind.FLOOR;
  }
  if (/^(classroom|examroom|meetingroom|toilet|staris)/.test(assetId)) {
    return LayerKind.ROOM;
  }
  if (/^wall_/.test(assetId)) {
    return LayerKind.WALL_OBJECT;
  }
  if (/^(door|elevator)/.test(assetId)) {
    return LayerKind.DOOR;
  }
  if (/(tree|bush|flower|stump|sign|fence)/.test(assetId)) {
    return LayerKind.DECORATION;
  }
  return LayerKind.UNKNOWN;
}

export class LayerComposer {
  constructor(mapData, assetBundle, grid) {
    this.mapData = mapData;
    this.assetBundle = assetBundle;
    this.grid = grid;
    this.tilesetRenderer = new TilesetRenderer(mapData, assetBundle);
    this.actorRenderer = new ActorRenderer(mapData);
    this.orderedVisualLayers = orderVisualLayers(mapData.visualLayers);
    this.visualBounds = getVisualBounds(mapData, assetBundle.manifest);
  }

  render(ctx, options = {}) {
    const renderOptions = { ...DEFAULT_RENDER_OPTIONS, ...options };
    drawMapBackground(ctx, this.grid);
    this.tilesetRenderer.drawVisualLayers(ctx, this.orderedVisualLayers);
    drawRoomZones(ctx, this.mapData, { visible: renderOptions.showRoomZones });
    drawCollisionLayer(ctx, this.mapData, { visible: renderOptions.showCollision });
    this.actorRenderer.render(ctx, renderOptions.actors || [], { visible: renderOptions.showActors });

    if (renderOptions.showDisplayOverlay) {
      drawDisplayOverlay(ctx, this.mapData, this.assetBundle, { visible: true });
    }
  }
}
