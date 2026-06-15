import { describe, expect, it } from "vitest";
import { editorReducer } from "../app/editorReducer";
import { createInitialEditorState } from "../app/editorState";
import { exportMapDocument } from "./exportMap";

const asset = {
  id: "walkable_road_clean",
  src: "walkable_road_clean.png",
  widthTiles: 1,
  heightTiles: 1,
  blocksMovement: false,
};

describe("exportMapDocument", () => {
  it("exports stable v3 JSON with display and movement sections", () => {
    let state = createInitialEditorState({ assets: [asset] });
    state = editorReducer(state, { type: "placeAsset", placementId: "p1", assetId: "walkable_road_clean", x: 3, y: 4 });
    state = editorReducer(state, { type: "paintCollision", x: 3, y: 4, state: "blocked" });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "a", label: "A", type: "destination", x: 1, y: 1 },
    });

    const result = exportMapDocument(state);

    expect(result.errors).toEqual([]);
    expect(result.document.schemaVersion).toBe(3);
    expect(result.document.map).toEqual(expect.objectContaining({ id: "village_demo_01", tileSize: 16, floor: "1" }));
    expect(result.document.display.assets).toEqual([asset]);
    expect(result.document.display.visualLayers).toEqual([{ id: "p1", assetId: "walkable_road_clean", x: 3, y: 4 }]);
    expect(result.document.display.labels).toEqual([
      { id: "label_a", text: "A", position: { x: 1, y: 1 }, sourceId: "a" },
    ]);
    expect(result.document.movement.coordinateSystem).toEqual({
      unit: "meter",
      origin: "top-left",
      scale: 0.4,
      pixelsPerMeter: 40,
      tilesPerMeter: 2.5,
    });
    expect(result.document.movement.bounds).toEqual({ x: 0, y: 0, width: 12, height: 8 });
    expect(result.document.movement.rooms).toEqual([]);
    expect(result.document.movement.corridors).toEqual([]);
    expect(result.document.movement.walkableAreas).toEqual([]);
    expect(result.document.movement.routeGraph.nodes).toEqual([
      {
        node_id: "a",
        floor_id: 1,
        position: { x: 0.4, y: 0.4 },
        type: "destination",
        name: "A",
        enabled: true,
      },
    ]);
    expect(result.document.layers.visual).toEqual([{ id: "p1", assetId: "walkable_road_clean", x: 3, y: 4 }]);
    expect(result.document.layers.collision).toEqual([{ x: 3, y: 4, state: "blocked" }]);
    expect(result.document.navigation.nodes).toEqual([{ id: "a", label: "A", type: "destination", x: 1, y: 1 }]);
    expect(result.document).not.toHaveProperty("nodes");
    expect(result.document).not.toHaveProperty("links");
  });
});
