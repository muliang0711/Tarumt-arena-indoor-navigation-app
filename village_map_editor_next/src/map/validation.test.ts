import { describe, expect, it } from "vitest";
import type { MapDocumentV2 } from "./schema";
import { validateMapDocument } from "./validation";

const validMap = (): MapDocumentV2 => ({
  schemaVersion: 2,
  map: { id: "village_demo_01", name: "Village Demo", tileSize: 16, width: 30, height: 20 },
  assets: {
    resourceRoot: "resources/serious_shit",
    items: [
      {
        id: "classroom_1",
        src: "classroom_1.png",
        widthTiles: 2,
        heightTiles: 2,
        blocksMovement: true,
      },
    ],
  },
  layers: {
    visual: [{ id: "p1", assetId: "classroom_1", x: 1, y: 1 }],
    collision: [{ x: 0, y: 0, state: "walkable" }],
  },
  navigation: {
    nodes: [{ id: "a", label: "A", type: "destination", x: 1, y: 1 }],
    links: [],
  },
  spawn: { x: 1, y: 1, direction: "down" },
});

describe("validateMapDocument", () => {
  it("accepts a valid v2 map", () => {
    expect(validateMapDocument(validMap())).toEqual([]);
  });

  it("rejects duplicate node ids", () => {
    const map = validMap();
    map.navigation.nodes.push({ ...map.navigation.nodes[0], label: "Duplicate" });

    expect(validateMapDocument(map)).toContain("Duplicate node id: a.");
  });

  it("rejects links to missing nodes", () => {
    const map = validMap();
    map.navigation.links.push({ id: "bad", from: "a", to: "missing", bidirectional: true });

    expect(validateMapDocument(map)).toContain("Link bad points to missing node missing.");
  });

  it("rejects placements outside map bounds", () => {
    const map = validMap();
    map.layers.visual[0].x = 29;

    expect(validateMapDocument(map)).toContain("Placement p1 is outside map bounds.");
  });

  it("rejects collision cells outside map bounds", () => {
    const map = validMap();
    map.layers.collision[0].x = 30;

    expect(validateMapDocument(map)).toContain("Collision cell 30,0 is outside map bounds.");
  });
});
