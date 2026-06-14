import { describe, expect, it } from "vitest";
import { createInitialEditorState } from "./editorState";
import { editorReducer } from "./editorReducer";

const asset = {
  id: "classroom_1",
  src: "classroom_1.png",
  widthTiles: 2,
  heightTiles: 2,
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

  it("undoes and redoes editing operations", () => {
    let state = createInitialEditorState({ assets: [asset] });

    state = editorReducer(state, { type: "placeAsset", placementId: "p1", assetId: "classroom_1", x: 3, y: 4 });
    state = editorReducer(state, { type: "undo" });
    expect(state.document.layers.visual).toEqual([]);

    state = editorReducer(state, { type: "redo" });
    expect(state.document.layers.visual).toEqual([{ id: "p1", assetId: "classroom_1", x: 3, y: 4 }]);
  });
});
