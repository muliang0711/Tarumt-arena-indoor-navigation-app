import type { OverlayPoint } from '../type';

export function distanceBetweenPoints(from: OverlayPoint, to: OverlayPoint) {
  return Math.hypot(to.screenX - from.screenX, to.screenY - from.screenY);
}

export function headingBetweenPoints(from: OverlayPoint, to: OverlayPoint) {
  return (
    (Math.atan2(to.screenY - from.screenY, to.screenX - from.screenX) * 180) /
    Math.PI
  );
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}
