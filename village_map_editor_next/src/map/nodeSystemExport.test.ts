import { describe, expect, it } from "vitest";
import type { MapDocumentV2 } from "./schema";
import { createNodeSystemExport, nodeSystemGraphToJsonFiles } from "./nodeSystemExport";

const mapDocument = (): MapDocumentV2 => ({
  schemaVersion: 2,
  map: { id: "village_demo_01", name: "Village Demo", tileSize: 16, width: 20, height: 20 },
  assets: { resourceRoot: "resources/serious_shit", items: [] },
  layers: { visual: [], collision: [] },
  navigation: {
    nodes: [
      { id: "a", label: "Entrance", type: "destination", x: 1, y: 2 },
      { id: "b", label: "Hall", type: "junction", x: 4, y: 6 },
    ],
    links: [{ id: "a_b", from: "a", to: "b", bidirectional: true }],
  },
  spawn: { x: 1, y: 1, direction: "down" },
});

describe("createNodeSystemExport", () => {
  it("converts editor navigation data into backend node and edge entities", () => {
    const graph = createNodeSystemExport(mapDocument());

    expect(graph.nodes).toEqual([
      { node_id: "a", floor_id: 1, x: 1, y: 2, type: "destination", name: "Entrance", enabled: true },
      { node_id: "b", floor_id: 1, x: 4, y: 6, type: "junction", name: "Hall", enabled: true },
    ]);
    expect(graph.edges).toEqual([
      {
        edge_id: "a_b",
        from_node: "a",
        to_node: "b",
        bidirectional: true,
        weight: 5,
        distance_m: 5,
        time_s: 0,
        accessibility: "standard",
        enabled: true,
      },
    ]);
  });

  it("formats node_system output files", () => {
    const files = nodeSystemGraphToJsonFiles(createNodeSystemExport(mapDocument()));

    expect(files).toEqual([
      { fileName: "nodes.json", content: expect.stringContaining("\"node_id\": \"a\"") },
      { fileName: "edges.json", content: expect.stringContaining("\"edge_id\": \"a_b\"") },
    ]);
    expect(files[0].content.endsWith("\n")).toBe(true);
    expect(files[1].content.endsWith("\n")).toBe(true);
  });
});
