export function drawDisplayOverlay(ctx, mapData, assetBundle, options = {}) {
  if (options.visible === false) {
    return;
  }

  for (const icon of mapData.display.icons) {
    drawIcon(ctx, mapData, icon);
  }
  for (const label of mapData.display.labels) {
    drawLabel(ctx, mapData, label);
  }
}

function drawIcon(ctx, mapData, icon) {
  const position = displayToPixels(mapData, icon.position);
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.fillStyle = "rgba(17, 24, 39, 0.86)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLabel(ctx, mapData, label) {
  if (!label.text) {
    return;
  }

  const position = displayToPixels(mapData, label.position);
  ctx.save();
  ctx.font = "600 11px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(label.text).width;
  const x = Math.round(position.x + 8);
  const y = Math.round(position.y);
  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.fillRect(x - 3, y - 8, textWidth + 6, 16);
  ctx.fillStyle = "rgba(17, 24, 39, 0.92)";
  ctx.fillText(label.text, x, y);
  ctx.restore();
}

function displayToPixels(mapData, position) {
  if (mapData.display.coordinateSpace === "tile") {
    return {
      x: Math.round(position.x * mapData.tileSize),
      y: Math.round(position.y * mapData.tileSize),
    };
  }

  return {
    x: Math.round(position.x),
    y: Math.round(position.y),
  };
}
