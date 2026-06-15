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

const shapedBuildingAsset = {
  id: "shaped_building",
  src: "shaped_building.png",
  widthTiles: 4,
  heightTiles: 3,
  blocksMovement: true,
  blockedOffsets: [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
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

const wallAsset = {
  id: "wall_up",
  src: "wall_up.png",
  widthTiles: 1,
  heightTiles: 1,
  blocksMovement: true,
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

  it("auto-blocks only shaped blocked offsets when an asset provides them", () => {
    let state = createInitialEditorState({ assets: [shapedBuildingAsset] });

    state = editorReducer(state, { type: "placeAsset", placementId: "p1", assetId: "shaped_building", x: 6, y: 6 });

    expect(state.document.layers.visual).toEqual([{ id: "p1", assetId: "shaped_building", x: 4, y: 5 }]);
    expect(state.document.layers.collision).toEqual([
      { x: 5, y: 5, state: "blocked" },
      { x: 6, y: 5, state: "blocked" },
      { x: 5, y: 6, state: "blocked" },
      { x: 6, y: 6, state: "blocked" },
    ]);
  });

  it("expands the map and recenters existing content when requested", () => {
    let state = createInitialEditorState({ assets: [roadAsset] });
    state = editorReducer(state, { type: "placeAsset", placementId: "existing", assetId: "walkable_road_clean", x: 5, y: 5 });
    state = editorReducer(state, { type: "paintCollision", x: 6, y: 5, state: "walkable" });
    state = editorReducer(state, {
      type: "createNode",
      node: { id: "a", label: "A", type: "destination", x: 7, y: 5 },
    });

    state = editorReducer(state, { type: "expandMap" });

    expect(state.document.map.width).toBe(50);
    expect(state.document.map.height).toBe(40);
    expect(state.document.layers.visual).toEqual([{ id: "existing", assetId: "walkable_road_clean", x: 15, y: 15 }]);
    expect(state.document.layers.collision).toEqual([{ x: 16, y: 15, state: "walkable" }]);
    expect(state.document.navigation.nodes).toEqual([{ id: "a", label: "A", type: "destination", x: 17, y: 15 }]);
    expect(state.document.spawn).toEqual({ x: 11, y: 11, direction: "down" });
  });

  it("does not expand automatically when a multi-tile placement footprint touches an edge", () => {
    let state = createInitialEditorState({ assets: [largeAsset] });

    state = editorReducer(state, { type: "placeAsset", placementId: "edge_large", assetId: "large_building", x: 28, y: 10 });

    expect(state.document.map.width).toBe(30);
    expect(state.document.map.height).toBe(20);
    expect(state.document.layers.visual).toEqual([{ id: "edge_large", assetId: "large_building", x: 26, y: 9 }]);
  });

  it("does not expand automatically when brush painting on an edge", () => {
    let state = createInitialEditorState({ assets: [roadAsset] });
    state = editorReducer(state, { type: "setBrushAssets", assetIds: ["walkable_road_clean"] });

    state = editorReducer(state, { type: "paintRandomBrush", placementId: "edge_brush", x: 0, y: 0 });

    expect(state.document.map.width).toBe(30);
    expect(state.document.map.height).toBe(20);
    expect(state.document.layers.visual).toEqual([{ id: "edge_brush", assetId: "walkable_road_clean", x: 0, y: 0 }]);
    expect(state.document.layers.collision).toEqual([{ x: 0, y: 0, state: "walkable" }]);
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

  it("paints a selected road tile by replacing existing 1x1 walkable tiles", () => {
    let state = createInitialEditorState({ assets: [roadAsset, roadAssetAlt] });

    state = editorReducer(state, { type: "paintAssetTile", placementId: "road_old", assetId: "walkable_road_dirt", x: 2, y: 2 });
    state = editorReducer(state, { type: "paintAssetTile", placementId: "road_new", assetId: "walkable_road_clean", x: 2, y: 2 });
    state = editorReducer(state, { type: "paintAssetTile", placementId: "road_next", assetId: "walkable_road_clean", x: 3, y: 2 });

    expect(state.document.layers.visual).toEqual([
      { id: "road_new", assetId: "walkable_road_clean", x: 2, y: 2 },
      { id: "road_next", assetId: "walkable_road_clean", x: 3, y: 2 },
    ]);
    expect(state.document.layers.collision).toEqual([
      { x: 2, y: 2, state: "walkable" },
      { x: 3, y: 2, state: "walkable" },
    ]);
  });

  it("allows road painting inside transparent margins of shaped blocking assets", () => {
    let state = createInitialEditorState({ assets: [shapedBuildingAsset, roadAsset] });
    state = editorReducer(state, { type: "placeAsset", placementId: "building", assetId: "shaped_building", x: 6, y: 6 });

    state = editorReducer(state, { type: "paintAssetTile", placementId: "road_margin", assetId: "walkable_road_clean", x: 4, y: 5 });
    state = editorReducer(state, { type: "paintAssetTile", placementId: "road_blocked", assetId: "walkable_road_clean", x: 5, y: 5 });

    expect(state.document.layers.visual).toEqual([
      { id: "building", assetId: "shaped_building", x: 4, y: 5 },
      { id: "road_margin", assetId: "walkable_road_clean", x: 4, y: 5 },
    ]);
    expect(state.document.layers.collision).toEqual([
      { x: 4, y: 5, state: "walkable" },
      { x: 5, y: 5, state: "blocked" },
      { x: 6, y: 5, state: "blocked" },
      { x: 5, y: 6, state: "blocked" },
      { x: 6, y: 6, state: "blocked" },
    ]);
  });

  it("removes road tiles outside the enclosed wall when mapping is done", () => {
    let state = createInitialEditorState({ assets: [roadAsset, wallAsset] });
    for (let x = 2; x <= 6; x += 1) {
      state = editorReducer(state, { type: "placeAsset", placementId: `wall_top_${x}`, assetId: "wall_up", x, y: 2 });
      state = editorReducer(state, { type: "placeAsset", placementId: `wall_bottom_${x}`, assetId: "wall_up", x, y: 6 });
    }
    for (let y = 3; y <= 5; y += 1) {
      state = editorReducer(state, { type: "placeAsset", placementId: `wall_left_${y}`, assetId: "wall_up", x: 2, y });
      state = editorReducer(state, { type: "placeAsset", placementId: `wall_right_${y}`, assetId: "wall_up", x: 6, y });
    }
    state = editorReducer(state, { type: "paintAssetTile", placementId: "road_inside", assetId: "walkable_road_clean", x: 4, y: 4 });
    state = editorReducer(state, { type: "paintAssetTile", placementId: "road_outside", assetId: "walkable_road_clean", x: 8, y: 4 });

    state = editorReducer(state, { type: "doneMapping" });

    expect(state.document.layers.visual.filter((placement) => placement.assetId === "walkable_road_clean")).toEqual([
      { id: "road_inside", assetId: "walkable_road_clean", x: 4, y: 4 },
    ]);
    expect(state.document.layers.collision).toContainEqual({ x: 4, y: 4, state: "walkable" });
    expect(state.document.layers.collision).not.toContainEqual({ x: 8, y: 4, state: "walkable" });
  });

  it("leaves roads unchanged when no enclosed wall exists", () => {
    let state = createInitialEditorState({ assets: [roadAsset, wallAsset] });
    state = editorReducer(state, { type: "paintAssetTile", placementId: "road_one", assetId: "walkable_road_clean", x: 4, y: 4 });
    state = editorReducer(state, { type: "paintAssetTile", placementId: "road_two", assetId: "walkable_road_clean", x: 8, y: 4 });

    state = editorReducer(state, { type: "doneMapping" });

    expect(state.document.layers.visual.filter((placement) => placement.assetId === "walkable_road_clean")).toEqual([
      { id: "road_one", assetId: "walkable_road_clean", x: 4, y: 4 },
      { id: "road_two", assetId: "walkable_road_clean", x: 8, y: 4 },
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
