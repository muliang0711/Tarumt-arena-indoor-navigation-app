import type { EditorState } from "../app/editorState";
import { renderGrid } from "./renderGrid";
import { renderOverlays } from "./renderOverlays";

export interface LoadedAssetImage {
  id: string;
  image: HTMLImageElement;
}

export interface RenderMapOptions {
  state: EditorState;
  images: Map<string, HTMLImageElement>;
  hoverTile: { x: number; y: number } | null;
  previewPlacement?: { assetId: string; x: number; y: number } | null;
}

function colorForAsset(assetId: string): string {
  let hash = 0;
  for (const char of assetId) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }
  return `hsl(${hash} 32% 58%)`;
}

export function renderMap(ctx: CanvasRenderingContext2D, options: RenderMapOptions): void {
  const { state, images, hoverTile, previewPlacement } = options;
  const { width, height, tileSize } = state.document.map;
  const zoom = state.viewport.zoom;

  renderGrid(ctx, {
    widthTiles: width,
    heightTiles: height,
    tileSize,
    zoom,
    showGrid: state.viewport.showGrid,
  });

  for (const placement of state.document.layers.visual) {
    const asset = state.document.assets.items.find((item) => item.id === placement.assetId);
    if (!asset) {
      continue;
    }

    const unit = tileSize * zoom;
    const x = placement.x * unit;
    const y = placement.y * unit;
    const drawWidth = asset.widthTiles * unit;
    const drawHeight = asset.heightTiles * unit;
    const image = images.get(asset.id);

    if (image) {
      ctx.drawImage(image, x, y, drawWidth, drawHeight);
    } else {
      ctx.fillStyle = colorForAsset(asset.id);
      ctx.fillRect(x, y, drawWidth, drawHeight);
      ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
      ctx.font = `${Math.max(10, 6 * zoom)}px sans-serif`;
      ctx.fillText(asset.id, x + 6, y + Math.max(14, 10 * zoom));
    }
  }

  if (previewPlacement) {
    const asset = state.document.assets.items.find((item) => item.id === previewPlacement.assetId);
    if (asset) {
      const unit = tileSize * zoom;
      const x = previewPlacement.x * unit;
      const y = previewPlacement.y * unit;
      const drawWidth = asset.widthTiles * unit;
      const drawHeight = asset.heightTiles * unit;
      const image = images.get(asset.id);

      ctx.save();
      ctx.globalAlpha = 0.48;
      if (image) {
        ctx.drawImage(image, x, y, drawWidth, drawHeight);
      } else {
        ctx.fillStyle = colorForAsset(asset.id);
        ctx.fillRect(x, y, drawWidth, drawHeight);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#1d4f91";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x + 1, y + 1, drawWidth - 2, drawHeight - 2);
      ctx.restore();
    }
  }

  renderOverlays(ctx, { state, hoverTile });
}
