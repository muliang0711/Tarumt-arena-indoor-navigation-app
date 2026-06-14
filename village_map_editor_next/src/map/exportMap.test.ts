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
  it("exports stable v2 JSON without legacy node aliases", () => {
    let state = createInitialEditorState({ assets: [asset] });
    state = editorReducer(state, { type: "placeAsset", placementId: "p1", assetId: "walkable_road_clean", x: 3, y: 4 });
    state = editorReducer(state, { type: "paintCollision", x: 3, y: 4, state: "blocked" });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "a", label: "A", type: "destination", x: 1, y: 1 },
    });

    const result = exportMapDocument(state);

    expect(result.errors).toEqual([]);
    expect(result.document.schemaVersion).toBe(2);
    expect(result.document.map).toEqual(expect.objectContaining({ id: "village_demo_01", tileSize: 16 }));
    expect(result.document.assets.items).toEqual([asset]);
    expect(result.document.layers.visual).toEqual([{ id: "p1", assetId: "walkable_road_clean", x: 3, y: 4 }]);
    expect(result.document.layers.collision).toEqual([{ x: 3, y: 4, state: "blocked" }]);
    expect(result.document.navigation.nodes).toEqual([{ id: "a", label: "A", type: "destination", x: 1, y: 1 }]);
    expect(result.document).not.toHaveProperty("nodes");
    expect(result.document).not.toHaveProperty("links");
  });
});
