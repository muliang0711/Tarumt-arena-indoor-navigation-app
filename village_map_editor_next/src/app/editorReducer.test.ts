import { describe, expect, it } from "vitest";
import { createInitialEditorState } from "./editorState";
import { editorReducer } from "./editorReducer";

const asset = {
  id: "classroom_1",
  src: "classroom_1.png",
  widthTiles: 1,
  heightTiles: 1,
  blocksMovement: true,
};

const largeAsset = {
  id: "large_building",
  src: "large_building.png",
  widthTiles: 4,
  heightTiles: 3,
  blocksMovement: true,
};

const roadAsset = {
  id: "walkable_road_clean",
  src: "walkable_road_clean.png",
  widthTiles: 1,
  heightTiles: 1,
  blocksMovement: false,
};

const roadAssetAlt = {
  id: "walkable_road_dirt",
  src: "walkable_road_dirt.png",
  widthTiles: 1,
  heightTiles: 1,
  blocksMovement: false,
};

describe("editorReducer", () => {
  it("places, moves, and deletes a visual asset", () => {
    let state = createInitialEditorState({ assets: [asset] });

    state = editorReducer(state, { type: "placeAsset", placementId: "p1", assetId: "classroom_1", x: 3, y: 4 });
    expect(state.document.layers.visual).toEqual([{ id: "p1", assetId: "classroom_1", x: 3, y: 4 }]);

    state = editorReducer(state, { type: "movePlacement", placementId: "p1", x: 5, y: 6 });
    expect(state.document.layers.visual[0]).toEqual({ id: "p1", assetId: "classroom_1", x: 5, y: 6 });

    state = editorReducer(state, { type: "deletePlacement", placementId: "p1" });
    expect(state.document.layers.visual).toEqual([]);
  });

  it("centers multi-tile assets on the clicked tile", () => {
    let state = createInitialEditorState({ assets: [largeAsset] });

    state = editorReducer(state, { type: "placeAsset", placementId: "p1", assetId: "large_building", x: 10, y: 10 });

    expect(state.document.layers.visual).toEqual([{ id: "p1", assetId: "large_building", x: 8, y: 9 }]);
  });

  it("auto-blocks the footprint of blocking assets when placed", () => {
    let state = createInitialEditorState({ assets: [largeAsset] });

    state = editorReducer(state, { type: "placeAsset", placementId: "p1", assetId: "large_building", x: 2, y: 2 });

    expect(state.document.layers.collision).toEqual([
      { x: 0, y: 1, state: "blocked" },
      { x: 1, y: 1, state: "blocked" },
      { x: 2, y: 1, state: "blocked" },
      { x: 3, y: 1, state: "blocked" },
      { x: 0, y: 2, state: "blocked" },
      { x: 1, y: 2, state: "blocked" },
      { x: 2, y: 2, state: "blocked" },
      { x: 3, y: 2, state: "blocked" },
      { x: 0, y: 3, state: "blocked" },
      { x: 1, y: 3, state: "blocked" },
      { x: 2, y: 3, state: "blocked" },
      { x: 3, y: 3, state: "blocked" },
    ]);
  });

  it("does not auto-block non-blocking road assets", () => {
    let state = createInitialEditorState({ assets: [roadAsset] });

    state = editorReducer(state, { type: "placeAsset", placementId: "p1", assetId: "walkable_road_clean", x: 2, y: 2 });

    expect(state.document.layers.collision).toEqual([]);
  });

  it("paints random brush tiles from the selected brush set", () => {
    let state = createInitialEditorState({ assets: [roadAsset, roadAssetAlt] });
    state = editorReducer(state, { type: "setBrushAssets", assetIds: ["walkable_road_clean", "walkable_road_dirt"] });

    state = editorReducer(state, { type: "paintRandomBrush", placementId: "road_1", x: 1, y: 1 });
    state = editorReducer(state, { type: "paintRandomBrush", placementId: "road_2", x: 2, y: 1 });
    state = editorReducer(state, { type: "paintRandomBrush", placementId: "road_3", x: 3, y: 1 });

    expect(state.document.layers.visual).toEqual([
      { id: "road_1", assetId: "walkable_road_clean", x: 1, y: 1 },
      { id: "road_2", assetId: "walkable_road_dirt", x: 2, y: 1 },
      { id: "road_3", assetId: "walkable_road_clean", x: 3, y: 1 },
    ]);
    expect(state.document.layers.collision).toEqual([
      { x: 1, y: 1, state: "walkable" },
      { x: 2, y: 1, state: "walkable" },
      { x: 3, y: 1, state: "walkable" },
    ]);
  });

  it("paints collision cells by replacing previous cell state", () => {
    let state = createInitialEditorState({ assets: [asset] });

    state = editorReducer(state, { type: "paintCollision", x: 2, y: 3, state: "blocked" });
    state = editorReducer(state, { type: "paintCollision", x: 2, y: 3, state: "walkable" });

    expect(state.document.layers.collision).toEqual([{ x: 2, y: 3, state: "walkable" }]);
  });

  it("creates nodes and links", () => {
    let state = createInitialEditorState({ assets: [asset] });

    state = editorReducer(state, {
      type: "createNode",
      node: { id: "a", label: "A", type: "destination", x: 1, y: 1 },
    });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "b", label: "B", type: "junction", x: 3, y: 1 },
    });
    state = editorReducer(state, { type: "createLink", link: { id: "a_b", from: "a", to: "b", bidirectional: true } });

    expect(state.document.navigation.nodes).toHaveLength(2);
    expect(state.document.navigation.links).toEqual([{ id: "a_b", from: "a", to: "b", bidirectional: true }]);
  });

  it("auto-links straight-line nodes when no blocked collision cell is between them", () => {
    let state = createInitialEditorState({ assets: [asset] });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "a", label: "A", type: "destination", x: 1, y: 1 },
    });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "b", label: "B", type: "destination", x: 4, y: 1 },
    });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "c", label: "C", type: "destination", x: 4, y: 4 },
    });

    state = editorReducer(state, { type: "autoLinkStraightNodes" });

    expect(state.document.navigation.links).toEqual([
      { id: "a_to_b", from: "a", to: "b", bidirectional: true },
      { id: "b_to_c", from: "b", to: "c", bidirectional: true },
    ]);
  });

  it("does not auto-link straight-line nodes through blocked collision cells", () => {
    let state = createInitialEditorState({ assets: [asset] });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "a", label: "A", type: "destination", x: 1, y: 1 },
    });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "b", label: "B", type: "destination", x: 4, y: 1 },
    });
    state = editorReducer(state, { type: "paintCollision", x: 2, y: 1, state: "blocked" });

    state = editorReducer(state, { type: "autoLinkStraightNodes" });

    expect(state.document.navigation.links).toEqual([]);
  });

  it("fills every straight linked node path with selected brush tiles", () => {
    let state = createInitialEditorState({ assets: [roadAsset, roadAssetAlt] });
    state = editorReducer(state, { type: "setBrushAssets", assetIds: ["walkable_road_clean", "walkable_road_dirt"] });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "a", label: "A", type: "destination", x: 1, y: 1 },
    });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "b", label: "B", type: "junction", x: 4, y: 1 },
    });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "c", label: "C", type: "destination", x: 4, y: 4 },
    });
    state = editorReducer(state, { type: "createLink", link: { id: "a_b", from: "a", to: "b", bidirectional: true } });
    state = editorReducer(state, { type: "createLink", link: { id: "b_c", from: "b", to: "c", bidirectional: true } });

    state = editorReducer(state, { type: "fillLinkedNodePaths" });

    expect(state.document.layers.visual.map((placement) => `${placement.x},${placement.y}`)).toEqual([
      "1,1",
      "2,1",
      "3,1",
      "4,1",
      "4,2",
      "4,3",
      "4,4",
    ]);
    expect(state.document.layers.collision).toEqual([
      { x: 1, y: 1, state: "walkable" },
      { x: 2, y: 1, state: "walkable" },
      { x: 3, y: 1, state: "walkable" },
      { x: 4, y: 1, state: "walkable" },
      { x: 4, y: 2, state: "walkable" },
      { x: 4, y: 3, state: "walkable" },
      { x: 4, y: 4, state: "walkable" },
    ]);
  });

  it("does not fill node paths through blocking building placements", () => {
    let state = createInitialEditorState({ assets: [roadAsset, largeAsset] });
    state = editorReducer(state, { type: "setBrushAssets", assetIds: ["walkable_road_clean"] });
    state = editorReducer(state, { type: "placeAsset", placementId: "building", assetId: "large_building", x: 3, y: 1 });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "a", label: "A", type: "destination", x: 1, y: 1 },
    });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "b", label: "B", type: "destination", x: 6, y: 1 },
    });
    state = editorReducer(state, { type: "createLink", link: { id: "a_b", from: "a", to: "b", bidirectional: true } });

    state = editorReducer(state, { type: "fillLinkedNodePaths" });

    expect(state.document.layers.visual.filter((placement) => placement.assetId === "walkable_road_clean")).toEqual([]);
    expect(state.document.layers.collision.some((cell) => cell.x === 3 && cell.y === 1 && cell.state === "walkable")).toBe(false);
  });

  it("undoes and redoes editing operations", () => {
    let state = createInitialEditorState({ assets: [asset] });

    state = editorReducer(state, { type: "placeAsset", placementId: "p1", assetId: "classroom_1", x: 3, y: 4 });
    state = editorReducer(state, { type: "undo" });
    expect(state.document.layers.visual).toEqual([]);

    state = editorReducer(state, { type: "redo" });
    expect(state.document.layers.visual).toEqual([{ id: "p1", assetId: "classroom_1", x: 3, y: 4 }]);
  });
});
