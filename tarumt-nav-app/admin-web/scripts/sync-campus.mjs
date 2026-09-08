import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { surfaceFromTiled } from "../app/map-coordinates.mjs";
const root = new URL("../", import.meta.url);
const rooms = JSON.parse(await readFile(new URL("../flutter_app/assets/campus/main_campus.rooms.json", root), "utf8"));
const graph = JSON.parse(await readFile(new URL("../contracts/maps/main-campus/map-graph-bundle.v1.json", root), "utf8"));
const tiled = JSON.parse(await readFile(new URL("../flutter_app/assets/maps/demo_1.tmj.json", root), "utf8"));
const surface = surfaceFromTiled(tiled);
const imagePath = new URL("../flutter_app/assets/maps/demo_1.png", root);
const png = await readFile(imagePath);
if (png.readUInt32BE(16) !== surface.width || png.readUInt32BE(20) !== surface.height) {
  throw new Error("App PNG dimensions do not match the Tiled surface bounds");
}
await mkdir(new URL("app/data/", root), { recursive: true });
await writeFile(new URL("app/data/campus.json", root), JSON.stringify({ ...rooms, graph, surface }, null, 2) + "\n");
await copyFile(imagePath, new URL("public/floor-2.png", root));
console.log("Synced the App map image, coordinate origin, graph, and place names.");
