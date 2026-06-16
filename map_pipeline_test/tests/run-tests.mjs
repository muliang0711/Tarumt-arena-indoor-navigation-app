import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeMapSchema } from "../shared/SchemaParser.js";
import { buildAssetManifest } from "../shared/AssetLoader.js";
import { getVisualBounds, orderVisualLayers } from "../map-renderer/LayerComposer.js";
import { ActorRenderer, metersToPixels, routeNodeToPixels, verifyNodeACheck } from "../actor-system/index.js";
import { createBobSpriteManifest, selectBobSprite } from "../actor-system/BobSprites.js";
import { buildNodePath, createBobAtNode, createNodeRouteRunner } from "../tmp-system/BobRouteRunner.js";
import { CameraController, Transform } from "../camera-system/index.js";

const rawMap = JSON.parse(await readFile(new URL("../assets/map.json", import.meta.url), "utf8"));
const parsed = normalizeMapSchema(rawMap);

assert.equal(parsed.metadata.id, "village_demo_01");
assert.equal(parsed.tileSize, 16);
assert.equal(parsed.width, 70);
assert.equal(parsed.height, 60);
assert.equal(parsed.worldWidth, 1120);
assert.equal(parsed.worldHeight, 960);
assert.equal(parsed.visualLayers.length, 449);
assert.equal(parsed.collision.length, 509);
assert.ok(parsed.assets.some((asset) => asset.id === "classroom_1" && asset.src === "classroom_1.png"));

const manifest = buildAssetManifest(parsed, "assets/");
assert.equal(manifest.get("classroom_1").url, "assets/resources/serious_shit/classroom_1.png");
assert.equal(manifest.get("road_2").widthPixels, 16);
assert.equal(manifest.get("road_1").widthPixels, 32);

const ordered = orderVisualLayers([
  { id: "wall", assetId: "wall_up", x: 1, y: 1 },
  { id: "floor", assetId: "walkable_road_clean", x: 1, y: 1 },
  { id: "door", assetId: "elevator", x: 1, y: 1 },
]);
assert.deepEqual(ordered.map((item) => item.id), ["floor", "wall", "door"]);

assert.deepEqual(getVisualBounds(parsed, manifest), {
  x: 7 * 16,
  y: 2 * 16,
  width: 27 * 16,
  height: 19 * 16,
});

assert.deepEqual(metersToPixels({ x: 0.4, y: 0.4 }), { x: 16, y: 16 });
assert.equal(verifyNodeACheck({ id: "a", x: 0.4, y: 0.4 }).passed, true);

const bob = createBobAtNode(parsed, "node_1");
assert.equal(bob.id, "bob");
assert.deepEqual(routeNodeToPixels(bob, parsed.movement.coordinateSystem.pixelsPerMeter), { x: 192, y: 208 });

assert.deepEqual(buildNodePath(parsed, "node_1", "node_4"), ["node_1", "node_2", "node_4"]);

const runner = createNodeRouteRunner(parsed, bob, ["node_1", "node_2", "node_4"], {
  speedMetersPerSecond: 1.2,
});
runner.update(500);
assert.equal(bob.action, "run");
assert.equal(bob.direction, "up");
assert.equal(bob.animationMs, 500);
assert.equal(Number(bob.position.y.toFixed(1)), 4.6);

runner.update(1000);
assert.equal(bob.direction, "right");
assert.equal(Number(bob.position.x.toFixed(1)), 5.4);
assert.equal(Number(bob.position.y.toFixed(1)), 4.0);

runner.update(10000);
assert.equal(bob.action, "idle");
assert.deepEqual(bob.position, { x: 10.4, y: 4 });

const drawCalls = [];
const renderer = new ActorRenderer(parsed);
renderer.render({
  save() {},
  restore() {},
  drawImage(...args) {
    drawCalls.push(args);
  },
}, [{
  id: "bob",
  position: { x: 4.8, y: 5.2 },
  sprite: {
    image: { width: 32, height: 32 },
    width: 32,
    height: 32,
    anchorX: 0.5,
    anchorY: 1,
  },
}], { visible: true });
assert.equal(drawCalls.length, 1);
assert.equal(drawCalls[0][1], 176);
assert.equal(drawCalls[0][2], 176);
assert.equal(drawCalls[0][3], 32);
assert.equal(drawCalls[0][4], 32);

const spriteManifest = createBobSpriteManifest("assets/actors/bob");
assert.equal(spriteManifest.idle.down, "assets/actors/bob/bob_stand/idle_down.png");
assert.equal(spriteManifest.run.right.length, 6);
assert.equal(spriteManifest.run.right[0], "assets/actors/bob/bob_run/run_right_1.png");

const selectedIdleSprite = selectBobSprite({
  idle: {
    down: { image: { id: "idle_down" }, width: 32, height: 32 },
  },
}, { action: "idle", direction: "down", animationMs: 0 });
assert.equal(selectedIdleSprite.image.id, "idle_down");

const selectedRunSprite = selectBobSprite({
  run: {
    right: [
      { image: { id: "run_right_1" }, width: 32, height: 32 },
      { image: { id: "run_right_2" }, width: 32, height: 32 },
    ],
  },
}, { action: "run", direction: "right", animationMs: 120 }, { frameDurationMs: 100 });
assert.equal(selectedRunSprite.image.id, "run_right_2");

const followViewport = createTestViewport({ scale: 2 });
const followCamera = new CameraController(followViewport, { followSmoothing: 1 });
followCamera.follow(() => ({ x: 100, y: 80 }));
followCamera.update(16);
assert.equal(followViewport.transform.offsetX, 200);
assert.equal(followViewport.transform.offsetY, 140);

const zoomViewport = createTestViewport({ scale: 1 });
const zoomCamera = new CameraController(zoomViewport, { zoomFactor: 2 });
zoomCamera.zoomIn({ x: 400, y: 300 });
assert.equal(zoomViewport.transform.scale, 2);
assert.equal(zoomViewport.transform.offsetX, -400);
assert.equal(zoomViewport.transform.offsetY, -300);
zoomCamera.zoomOut({ x: 400, y: 300 });
assert.equal(zoomViewport.transform.scale, 1);
assert.equal(zoomViewport.transform.offsetX, 0);
assert.equal(zoomViewport.transform.offsetY, 0);

const panViewport = createTestViewport({ scale: 1 });
const panCamera = new CameraController(panViewport, { panSpeedPixelsPerSecond: 100 });
panCamera.panByDirection({ x: 1, y: 0 }, 1000);
assert.equal(panViewport.transform.offsetX, -100);
panCamera.panByDirection({ x: -1, y: 0 }, 1000);
assert.equal(panViewport.transform.offsetX, 0);
panCamera.panByDirection({ x: 0, y: -1 }, 1000);
assert.equal(panViewport.transform.offsetY, 100);
panCamera.panByDirection({ x: 0, y: 1 }, 1000);
assert.equal(panViewport.transform.offsetY, 0);

const manualViewport = createTestViewport({ scale: 1 });
const manualCamera = new CameraController(manualViewport, { panSpeedPixelsPerSecond: 100 });
manualCamera.follow(() => ({ x: 100, y: 100 }));
manualCamera.panByDirection({ x: 1, y: 0 }, 1000);
assert.equal(manualCamera.followEnabled, false);

console.log("map_pipeline_test tests passed");

function createTestViewport({ scale = 1, offsetX = 0, offsetY = 0 } = {}) {
  return {
    canvas: {
      width: 800,
      height: 600,
    },
    minScale: 0.5,
    maxScale: 4,
    transform: new Transform({ scale, offsetX, offsetY }),
  };
}
