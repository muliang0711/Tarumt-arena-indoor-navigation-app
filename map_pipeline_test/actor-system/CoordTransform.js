import { DEFAULT_PIXELS_PER_METER } from "../shared/types.js";

export function metersToPixels(position, pixelsPerMeter = DEFAULT_PIXELS_PER_METER) {
  return {
    x: Math.round(Number(position.x) * pixelsPerMeter),
    y: Math.round(Number(position.y) * pixelsPerMeter),
  };
}

export function routeNodeToPixels(node, pixelsPerMeter = DEFAULT_PIXELS_PER_METER) {
  const position = node.position || node;
  return metersToPixels(position, pixelsPerMeter);
}

export function verifyNodeACheck(node = { id: "a", x: 0.4, y: 0.4 }, pixelsPerMeter = DEFAULT_PIXELS_PER_METER) {
  const pixels = routeNodeToPixels(node, pixelsPerMeter);
  return {
    nodeId: node.id || node.node_id || "a",
    pixels,
    passed: pixels.x === 16 && pixels.y === 16,
  };
}
