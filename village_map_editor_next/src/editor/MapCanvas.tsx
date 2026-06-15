import { useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import type { EditorAction } from "../app/editorReducer";
import type { EditorState } from "../app/editorState";
import { createLinkId, createNodeId } from "../app/editorState";
import { renderMap } from "../rendering/renderMap";

interface MapCanvasProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  images: Map<string, HTMLImageElement>;
}

interface TilePoint {
  x: number;
  y: number;
}

function placementAt(state: EditorState, tile: TilePoint) {
  for (const placement of [...state.document.layers.visual].reverse()) {
    const asset = state.document.assets.items.find((item) => item.id === placement.assetId);
    if (!asset) {
      continue;
    }
    const withinX = tile.x >= placement.x && tile.x < placement.x + asset.widthTiles;
    const withinY = tile.y >= placement.y && tile.y < placement.y + asset.heightTiles;
    if (withinX && withinY) {
      return placement;
    }
  }
  return null;
}

function nodeAt(state: EditorState, tile: TilePoint) {
  return state.document.navigation.nodes.find((node) => node.x === tile.x && node.y === tile.y) ?? null;
}

function collisionAt(state: EditorState, tile: TilePoint) {
  return state.document.layers.collision.find((cell) => cell.x === tile.x && cell.y === tile.y) ?? null;
}

function isPaintableTileAsset(state: EditorState, assetId: string): boolean {
  const asset = state.document.assets.items.find((item) => item.id === assetId);
  return Boolean(asset && !asset.blocksMovement && asset.widthTiles === 1 && asset.heightTiles === 1);
}

function isInsideMap(state: EditorState, tile: TilePoint): boolean {
  return tile.x >= 0 && tile.y >= 0 && tile.x < state.document.map.width && tile.y < state.document.map.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function placementPreviewForHover(state: EditorState, hoverTile: TilePoint | null) {
  if (!hoverTile) {
    return null;
  }

  const assetId =
    state.activeTool === "place"
      ? state.selectedAssetId
      : state.activeTool === "random-brush"
        ? state.selectedBrushAssetIds[Math.abs(hoverTile.x + hoverTile.y) % state.selectedBrushAssetIds.length] ?? state.selectedAssetId
        : null;

  const asset = state.document.assets.items.find((item) => item.id === assetId);
  if (!asset || !assetId) {
    return null;
  }

  return {
    assetId,
    x: clamp(hoverTile.x - Math.floor(asset.widthTiles / 2), 0, Math.max(0, state.document.map.width - asset.widthTiles)),
    y: clamp(hoverTile.y - Math.floor(asset.heightTiles / 2), 0, Math.max(0, state.document.map.height - asset.heightTiles)),
  };
}

export function MapCanvas({ state, dispatch, images }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverTile, setHoverTile] = useState<TilePoint | null>(null);
  const [dragPlacementId, setDragPlacementId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<TilePoint>({ x: 0, y: 0 });
  const [brushActive, setBrushActive] = useState(false);
  const [paintDragAssetId, setPaintDragAssetId] = useState<string | null>(null);
  const lastPaintTileKeyRef = useRef<string | null>(null);

  const canvasWidth = state.document.map.width * state.document.map.tileSize * state.viewport.zoom;
  const canvasHeight = state.document.map.height * state.document.map.tileSize * state.viewport.zoom;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    renderMap(ctx, { state, images, hoverTile, previewPlacement: placementPreviewForHover(state, hoverTile) });
  }, [canvasHeight, canvasWidth, hoverTile, images, state]);

  function eventToTile(event: React.PointerEvent<HTMLCanvasElement>): TilePoint | null {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const unit = state.document.map.tileSize * state.viewport.zoom;
    const tile = {
      x: Math.floor((event.clientX - rect.left) / unit),
      y: Math.floor((event.clientY - rect.top) / unit),
    };
    return isInsideMap(state, tile) ? tile : null;
  }

  function eraseAt(tile: TilePoint): void {
    const placement = placementAt(state, tile);
    if (placement) {
      dispatch({ type: "deletePlacement", placementId: placement.id });
      return;
    }
    const node = nodeAt(state, tile);
    if (node) {
      dispatch({ type: "deleteNode", nodeId: node.id });
      return;
    }
    if (collisionAt(state, tile)) {
      dispatch({ type: "eraseCollision", x: tile.x, y: tile.y });
    }
  }

  function createNode(tile: TilePoint): void {
    const label = `Node ${state.document.navigation.nodes.length + 1}`;
    dispatch({
      type: "createNode",
      node: {
        id: createNodeId(label, state.document.navigation.nodes),
        label,
        type: "destination",
        x: tile.x,
        y: tile.y,
      },
    });
  }

  function tileKey(tile: TilePoint): string {
    return `${tile.x},${tile.y}`;
  }

  function paintSelectedTile(assetId: string, tile: TilePoint): void {
    dispatch({
      type: "paintAssetTile",
      placementId: `${assetId}_${tile.x}_${tile.y}_${Date.now().toString(36)}`,
      assetId,
      x: tile.x,
      y: tile.y,
    });
  }

  function handleLink(tile: TilePoint): void {
    const node = nodeAt(state, tile);
    if (!node) {
      return;
    }

    if (!state.linkStartNodeId || state.linkStartNodeId === node.id) {
      dispatch({ type: "setLinkStart", nodeId: node.id });
      dispatch({ type: "select", selection: { kind: "node", id: node.id } });
      return;
    }

    dispatch({
      type: "createLink",
      link: {
        id: createLinkId(state.linkStartNodeId, node.id, state.document.navigation.links),
        from: state.linkStartNodeId,
        to: node.id,
        bidirectional: true,
      },
    });
    dispatch({ type: "setLinkStart", nodeId: null });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>): void {
    const tile = eventToTile(event);
    if (!tile) {
      return;
    }

    if (state.activeTool === "place" && state.selectedAssetId) {
      if (isPaintableTileAsset(state, state.selectedAssetId)) {
        setPaintDragAssetId(state.selectedAssetId);
        lastPaintTileKeyRef.current = tileKey(tile);
        paintSelectedTile(state.selectedAssetId, tile);
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }

      dispatch({
        type: "placeAsset",
        placementId: `${state.selectedAssetId}_${Date.now().toString(36)}`,
        assetId: state.selectedAssetId,
        x: tile.x,
        y: tile.y,
      });
      return;
    }

    if (state.activeTool === "random-brush") {
      setBrushActive(true);
      dispatch({ type: "paintRandomBrush", placementId: `brush_${tile.x}_${tile.y}_${Date.now().toString(36)}`, x: tile.x, y: tile.y });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (state.activeTool === "select") {
      const placement = placementAt(state, tile);
      if (placement) {
        dispatch({ type: "select", selection: { kind: "placement", id: placement.id } });
        setDragPlacementId(placement.id);
        setDragOffset({ x: tile.x - placement.x, y: tile.y - placement.y });
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      const node = nodeAt(state, tile);
      dispatch({ type: "select", selection: node ? { kind: "node", id: node.id } : { kind: null, id: null } });
      return;
    }

    if (state.activeTool === "erase") {
      eraseAt(tile);
      return;
    }

    if (state.activeTool === "collision-walkable" || state.activeTool === "collision-blocked") {
      dispatch({
        type: "paintCollision",
        x: tile.x,
        y: tile.y,
        state: state.activeTool === "collision-walkable" ? "walkable" : "blocked",
      });
      return;
    }

    if (state.activeTool === "node") {
      createNode(tile);
      return;
    }

    if (state.activeTool === "link") {
      handleLink(tile);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>): void {
    const tile = eventToTile(event);
    setHoverTile(tile);

    if (dragPlacementId && tile) {
      dispatch({ type: "movePlacement", placementId: dragPlacementId, x: tile.x - dragOffset.x, y: tile.y - dragOffset.y });
    }

    if (brushActive && tile) {
      dispatch({ type: "paintRandomBrush", placementId: `brush_${tile.x}_${tile.y}_${Date.now().toString(36)}`, x: tile.x, y: tile.y });
    }

    if (paintDragAssetId && tile) {
      const key = tileKey(tile);
      if (lastPaintTileKeyRef.current !== key) {
        lastPaintTileKeyRef.current = key;
        paintSelectedTile(paintDragAssetId, tile);
      }
    }
  }

  function stopDragging(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (dragPlacementId || brushActive || paintDragAssetId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragPlacementId(null);
    setBrushActive(false);
    setPaintDragAssetId(null);
    lastPaintTileKeyRef.current = null;
  }

  return (
    <section className="map-workspace">
      <div className="canvas-toolbar">
        <div className="canvas-toolbar-group">
          <span>
            {state.document.map.width} x {state.document.map.height}
          </span>
          <button title="Expand map" type="button" onClick={() => dispatch({ type: "expandMap" })}>
            <Maximize2 size={15} />
            Expand Map
          </button>
        </div>
        <div className="canvas-toolbar-group">
          <span>{hoverTile ? `Tile ${hoverTile.x}, ${hoverTile.y}` : "No tile"}</span>
          {state.linkStartNodeId ? <span>Link from {state.linkStartNodeId}</span> : null}
        </div>
      </div>
      <div className="canvas-scroll">
        <canvas
          ref={canvasRef}
          className="map-canvas"
          style={{ width: canvasWidth, height: canvasHeight }}
          onPointerDown={handlePointerDown}
          onPointerLeave={() => setHoverTile(null)}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
        />
      </div>
    </section>
  );
}
