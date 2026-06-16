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

export const CAMERA_MIN_ZOOM = 0.5;
export const CAMERA_MAX_ZOOM = 4;

export function createInitialCameraState(bounds: Bounds, viewport: ViewportSize, padding = 0): CameraState {
  return fitCameraToBounds(bounds, viewport, padding);
}

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

export function zoomCamera(
  camera: CameraState,
  factor: number,
  minScale = CAMERA_MIN_ZOOM,
  maxScale = CAMERA_MAX_ZOOM,
  focalPoint?: Point,
): CameraState {
  return setCameraZoom(camera, camera.scale * factor, minScale, maxScale, focalPoint);
}

export function setCameraZoom(
  camera: CameraState,
  scale: number,
  minScale = CAMERA_MIN_ZOOM,
  maxScale = CAMERA_MAX_ZOOM,
  focalPoint?: Point,
): CameraState {
  const nextScale = clamp(scale, minScale, maxScale);
  if (!focalPoint || camera.scale === 0) {
    return {
      ...camera,
      scale: nextScale,
    };
  }

  const worldX = (focalPoint.x - camera.offsetX) / camera.scale;
  const worldY = (focalPoint.y - camera.offsetY) / camera.scale;
  return {
    scale: nextScale,
    offsetX: Math.round(focalPoint.x - worldX * nextScale),
    offsetY: Math.round(focalPoint.y - worldY * nextScale),
  };
}

export function panCamera(camera: CameraState, delta: Point): CameraState {
  return {
    ...camera,
    offsetX: camera.offsetX + delta.x,
    offsetY: camera.offsetY + delta.y,
  };
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
