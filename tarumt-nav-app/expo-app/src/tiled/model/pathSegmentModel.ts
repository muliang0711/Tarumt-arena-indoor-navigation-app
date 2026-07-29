import type { OverlayPathSegment, OverlayPoint } from '../type';
import { distanceBetweenPoints } from './geometryMath';

export function createPathSegmentsFromPoints(
  points: ReadonlyArray<OverlayPoint & { nodeId?: string }>,
) {
  const segments: OverlayPathSegment[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to || distanceBetweenPoints(from, to) <= 0.001) {
      continue;
    }

    const fromId = from.nodeId ?? `point-${index}`;
    const toId = to.nodeId ?? `point-${index + 1}`;
    segments.push(createPathSegment(`${fromId}->${toId}`, from, to, fromId, toId));
  }

  return segments;
}

function createPathSegment(
  key: string,
  from: OverlayPoint,
  to: OverlayPoint,
  fromNodeId = key.split('->')[0] ?? 'from',
  toNodeId = key.split('->')[1] ?? 'to',
): OverlayPathSegment {
  const deltaX = to.screenX - from.screenX;
  const deltaY = to.screenY - from.screenY;

  return {
    fromNodeId,
    key,
    length: Math.hypot(deltaX, deltaY),
    rotationDegrees: (Math.atan2(deltaY, deltaX) * 180) / Math.PI,
    toNodeId,
    x: from.screenX,
    y: from.screenY,
  };
}
