import { Bounds, Point } from '../mapGeometry';

export type { Point } from '../mapGeometry';

export type ViewportSize = {
  width: number;
  height: number;
};

export type CameraState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function fitCameraToBounds(bounds: Bounds, viewport: ViewportSize, padding = 0): CameraState {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const scale = Math.min(availableWidth / Math.max(1, bounds.width), availableHeight / Math.max(1, bounds.height));
  return {
    scale,
    offsetX: Math.round((viewport.width - bounds.width * scale) / 2 - bounds.x * scale),
    offsetY: Math.round((viewport.height - bounds.height * scale) / 2 - bounds.y * scale),
  };
}

export function centerCameraOnPoint(camera: CameraState, point: Point, viewport: ViewportSize): CameraState {
  return {
    ...camera,
    offsetX: Math.round(viewport.width / 2 - point.x * camera.scale),
    offsetY: Math.round(viewport.height / 2 - point.y * camera.scale),
  };
}

export function zoomCamera(camera: CameraState, factor: number, minScale = 0.2, maxScale = 6): CameraState {
  return {
    ...camera,
    scale: clamp(camera.scale * factor, minScale, maxScale),
  };
}

export function panCamera(camera: CameraState, delta: Point): CameraState {
  return {
    ...camera,
    offsetX: Math.round(camera.offsetX + delta.x),
    offsetY: Math.round(camera.offsetY + delta.y),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
