import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { surfaceFromTiled, worldToImage, positionOnImage } from "../app/map-coordinates.mjs";

const campus = JSON.parse(readFileSync(new URL("../app/data/campus.json", import.meta.url)));
const surface = campus.surface;
test("App PNG and generated surface use the same dimensions and world origin", () => {
  assert.deepEqual(surface, { originX: -256, originY: 256, width: 1536, height: 2048 });
  const png = readFileSync(new URL("../public/floor-2.png", import.meta.url));
  assert.equal(png.readUInt32BE(16), surface.width);
  assert.equal(png.readUInt32BE(20), surface.height);
});
test("visible chunk bounds ignore hidden and non-tile layers, as in Flutter", () => {
  assert.deepEqual(surfaceFromTiled({ orientation: "orthogonal", infinite: true, tilewidth: 16, tileheight: 16, layers: [
    { type: "tilelayer", chunks: [{ x: -16, y: 16, width: 96, height: 128 }] },
    { type: "tilelayer", visible: false, chunks: [{ x: -100, y: -100, width: 300, height: 300 }] },
    { type: "imagelayer" },
  ] }), surface);
});
test("corridor and toilet anchors match the App's world-to-screen conversion", () => {
  const nodes = new Map(campus.graph.floors[0].nodes.map(node => [node.node_id, node]));
  for (const [id, expected] of [
    ["node-1", { x: 176, y: 648 }],
    ["node-3", { x: 176, y: 1604 }],
    ["node-8", { x: 1384, y: 1604 }],
    ["node-11", { x: 1248, y: 1064 }],
  ]) assert.deepEqual(worldToImage(nodes.get(id), surface), expected);
  for (const node of nodes.values()) {
    const point = worldToImage(node, surface);
    assert.ok(point.x >= 0 && point.x <= surface.width && point.y >= 0 && point.y <= surface.height);
  }
  assert.deepEqual(positionOnImage(nodes.get("node-3"), nodes.get("node-8"), .5, surface), { x: 780, y: 1604 });
  assert.deepEqual(positionOnImage(nodes.get("node-1"), nodes.get("node-3"), .5, surface), { x: 176, y: 1126 });
  assert.deepEqual(positionOnImage(nodes.get("node-1"), nodes.get("node-3"), -1, surface), { x: 176, y: 648 });
  assert.deepEqual(positionOnImage(nodes.get("node-1"), nodes.get("node-3"), 2, surface), { x: 176, y: 1604 });
});
