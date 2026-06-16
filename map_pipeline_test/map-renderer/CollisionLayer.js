export function drawCollisionLayer(ctx, mapData, options = {}) {
  if (!options.visible) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(220, 38, 38, 0.26)";
  for (const cell of mapData.collision) {
    ctx.fillRect(cell.x * mapData.tileSize, cell.y * mapData.tileSize, mapData.tileSize, mapData.tileSize);
  }
  ctx.restore();
}
