export function createTileGrid(mapData) {
  return {
    width: mapData.width,
    height: mapData.height,
    tileSize: mapData.tileSize,
    worldWidth: mapData.worldWidth,
    worldHeight: mapData.worldHeight,
  };
}

export function drawMapBackground(ctx, grid) {
  ctx.save();
  ctx.fillStyle = "#f5f4ef";
  ctx.fillRect(0, 0, grid.worldWidth, grid.worldHeight);
  ctx.restore();
}
