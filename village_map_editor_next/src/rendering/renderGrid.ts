export interface GridRenderOptions {
  widthTiles: number;
  heightTiles: number;
  tileSize: number;
  zoom: number;
  showGrid: boolean;
}

export function renderGrid(ctx: CanvasRenderingContext2D, options: GridRenderOptions): void {
  const width = options.widthTiles * options.tileSize * options.zoom;
  const height = options.heightTiles * options.tileSize * options.zoom;

  ctx.fillStyle = "#e8eadf";
  ctx.fillRect(0, 0, width, height);

  if (!options.showGrid) {
    return;
  }

  ctx.strokeStyle = "rgba(32, 43, 35, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();

  const step = options.tileSize * options.zoom;
  for (let x = 0; x <= width; x += step) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
  }

  for (let y = 0; y <= height; y += step) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
  }

  ctx.stroke();
}
