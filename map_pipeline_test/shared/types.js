export const DEFAULT_PIXELS_PER_METER = 40;
export const DEFAULT_TILE_SIZE = 16;

export const LayerKind = Object.freeze({
  FLOOR: "floor",
  ROOM: "room",
  WALL_OBJECT: "wall-object",
  DOOR: "door",
  DECORATION: "decoration",
  UNKNOWN: "unknown",
});

export const DEFAULT_RENDER_OPTIONS = Object.freeze({
  showCollision: false,
  showRoomZones: false,
  showRoutePath: false,
  showActors: false,
  showDisplayOverlay: true,
});
