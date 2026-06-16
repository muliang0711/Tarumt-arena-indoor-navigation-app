export function drawRoomZones(ctx, mapData, options = {}) {
  if (!options.visible) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = "rgba(37, 99, 235, 0.45)";
  ctx.lineWidth = 1;
  for (const room of mapData.movement.rooms) {
    if (room.bounds) {
      ctx.strokeRect(room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height);
    }
  }
  ctx.restore();
}
