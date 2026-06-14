import { useEffect, useRef, useState } from "react";
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

function isInsideMap(state: EditorState, tile: TilePoint): boolean {
  return tile.x >= 0 && tile.y >= 0 && tile.x < state.document.map.width && tile.y < state.document.map.height;
}

export function MapCanvas({ state, dispatch, images }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverTile, setHoverTile] = useState<TilePoint | null>(null);
  const [dragPlacementId, setDragPlacementId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<TilePoint>({ x: 0, y: 0 });
  const [brushActive, setBrushActive] = useState(false);

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
    renderMap(ctx, { state, images, hoverTile });
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
  }

  function stopDragging(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (dragPlacementId || brushActive) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragPlacementId(null);
    setBrushActive(false);
  }

  return (
    <section className="map-workspace">
      <div className="canvas-toolbar">
        <span>
          {state.document.map.width} x {state.document.map.height}
        </span>
        <span>{hoverTile ? `Tile ${hoverTile.x}, ${hoverTile.y}` : "No tile"}</span>
        {state.linkStartNodeId ? <span>Link from {state.linkStartNodeId}</span> : null}
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
