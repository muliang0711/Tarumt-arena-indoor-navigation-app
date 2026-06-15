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

const validMapV3 = () => ({
  schemaVersion: 3 as const,
  map: { id: "village_demo_01", name: "Village Demo", floor: "1", tileSize: 16, width: 30, height: 20 },
  assets: validMap().assets,
  display: {
    assets: validMap().assets.items,
    visualLayers: validMap().layers.visual,
    labels: [],
    icons: [],
    layerOrder: ["assets", "visualLayers", "labels", "icons"],
  },
  movement: {
    coordinateSystem: {
      unit: "meter" as const,
      origin: "top-left" as const,
      scale: 0.4,
      pixelsPerMeter: 40,
      tilesPerMeter: 2.5,
    },
    bounds: { x: 0, y: 0, width: 12, height: 8 },
    rooms: [],
    corridors: [],
    walkableAreas: [],
    walls: [],
    doors: [],
    entrances: [],
    routeGraph: { nodes: [], edges: [] },
  },
  layers: validMap().layers,
  navigation: validMap().navigation,
  spawn: validMap().spawn,
});

describe("validateMapDocument", () => {
  it("accepts a valid v2 map", () => {
    expect(validateMapDocument(validMap())).toEqual([]);
  });

  it("accepts a valid v3 map", () => {
    expect(validateMapDocument(validMapV3())).toEqual([]);
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
