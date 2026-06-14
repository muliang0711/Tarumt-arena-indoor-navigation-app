import type { EditorState } from "../app/editorState";

export interface OverlayRenderOptions {
  state: EditorState;
  hoverTile: { x: number; y: number } | null;
}

function tileRect(tileSize: number, zoom: number, x: number, y: number, width = 1, height = 1) {
  const unit = tileSize * zoom;
  return {
    x: x * unit,
    y: y * unit,
    width: width * unit,
    height: height * unit,
  };
}

export function renderOverlays(ctx: CanvasRenderingContext2D, options: OverlayRenderOptions): void {
  const { state, hoverTile } = options;
  const tileSize = state.document.map.tileSize;
  const zoom = state.viewport.zoom;

  for (const cell of state.document.layers.collision) {
    const rect = tileRect(tileSize, zoom, cell.x, cell.y);
    ctx.strokeStyle = cell.state === "blocked" ? "rgba(203, 77, 68, 0.9)" : "rgba(69, 152, 92, 0.82)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);
  }

  ctx.lineWidth = Math.max(2, zoom);
  ctx.strokeStyle = "#d18b24";
  for (const link of state.document.navigation.links) {
    const from = state.document.navigation.nodes.find((node) => node.id === link.from);
    const to = state.document.navigation.nodes.find((node) => node.id === link.to);
    if (!from || !to) {
      continue;
    }
    const unit = tileSize * zoom;
    ctx.beginPath();
    ctx.moveTo((from.x + 0.5) * unit, (from.y + 0.5) * unit);
    ctx.lineTo((to.x + 0.5) * unit, (to.y + 0.5) * unit);
    ctx.stroke();
  }

  for (const node of state.document.navigation.nodes) {
    const unit = tileSize * zoom;
    const cx = (node.x + 0.5) * unit;
    const cy = (node.y + 0.5) * unit;
    ctx.fillStyle = node.type === "junction" ? "#2f6f7a" : "#2d5a3f";
    ctx.strokeStyle = "#fffaf1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(5, unit * 0.28), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (state.selected.kind && state.selected.id) {
    ctx.strokeStyle = "#1d4f91";
    ctx.lineWidth = 2;
    if (state.selected.kind === "placement") {
      const placement = state.document.layers.visual.find((item) => item.id === state.selected.id);
      const asset = state.document.assets.items.find((item) => item.id === placement?.assetId);
      if (placement && asset) {
        const rect = tileRect(tileSize, zoom, placement.x, placement.y, asset.widthTiles, asset.heightTiles);
        ctx.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
      }
    }
    if (state.selected.kind === "node") {
      const node = state.document.navigation.nodes.find((item) => item.id === state.selected.id);
      if (node) {
        const rect = tileRect(tileSize, zoom, node.x, node.y);
        ctx.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
      }
    }
  }

  if (hoverTile) {
    const rect = tileRect(tileSize, zoom, hoverTile.x, hoverTile.y);
    ctx.strokeStyle = "rgba(29, 79, 145, 0.75)";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
  }
}
