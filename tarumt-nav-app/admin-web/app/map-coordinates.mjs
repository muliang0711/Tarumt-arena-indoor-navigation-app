/** @typedef {{ originX: number, originY: number, width: number, height: number }} Surface */

// Same visible-chunk bounds and worldToScreenPoint conversion as Flutter's
// domain/tiled/map/surface_model.dart. Graph coordinates are world coordinates,
// not pixels relative to the cropped PNG's top-left corner.
export function surfaceFromTiled(map) {
  if (map.orientation !== "orthogonal" || map.infinite !== true) {
    throw new Error("Expected an orthogonal infinite Tiled map");
  }
  const chunks = map.layers.filter(layer => layer.type === "tilelayer" && layer.visible !== false)
    .flatMap(layer => layer.chunks ?? []);
  if (!chunks.length) throw new Error("No visible tile chunks found");
  const minX = Math.min(...chunks.map(chunk => chunk.x));
  const minY = Math.min(...chunks.map(chunk => chunk.y));
  return {
    originX: minX * map.tilewidth,
    originY: minY * map.tileheight,
    width: (Math.max(...chunks.map(chunk => chunk.x + chunk.width)) - minX) * map.tilewidth,
    height: (Math.max(...chunks.map(chunk => chunk.y + chunk.height)) - minY) * map.tileheight,
  };
}

/** @param {{x: number, y: number}} point @param {Surface} surface */
export function worldToImage(point, surface) {
  return { x: point.x - surface.originX, y: point.y - surface.originY };
}

/** @param {{x: number, y: number}} from @param {{x: number, y: number}} to
 * @param {number} progress @param {Surface} surface */
export function positionOnImage(from, to, progress, surface) {
  const p = Math.min(1, Math.max(0, progress));
  return worldToImage({ x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p }, surface);
}
