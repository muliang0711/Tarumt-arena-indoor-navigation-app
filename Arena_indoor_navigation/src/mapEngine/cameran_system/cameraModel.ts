import type { Bounds, Point } from '../shared';

export type { Point } from '../shared';

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
export const DEFAULT_ACTOR_ZOOM = 1;

export function minimumCoverScale(bounds: Bounds, viewport: ViewportSize): number {
  return Math.max(
    viewport.width / Math.max(1, bounds.width),
    viewport.height / Math.max(1, bounds.height),
  );
}

export function constrainCameraToBounds(
  camera: CameraState,
  bounds: Bounds,
  viewport: ViewportSize,
): CameraState {
  const coverScale = minimumCoverScale(bounds, viewport);
  const scaleWasRaised = camera.scale < coverScale;
  const scale = clamp(camera.scale, coverScale, CAMERA_MAX_ZOOM);
  const scaledWidth = bounds.width * scale;
  const scaledHeight = bounds.height * scale;

  if (scaleWasRaised) {
    return {
      scale,
      offsetX: Math.round((viewport.width - scaledWidth) / 2),
      offsetY: Math.round((viewport.height - scaledHeight) / 2),
    };
  }

  return {
    scale,
    offsetX: Math.round(clamp(camera.offsetX, viewport.width - scaledWidth, 0)),
    offsetY: Math.round(clamp(camera.offsetY, viewport.height - scaledHeight, 0)),
  };
}

export function createActorCameraState(
  bounds: Bounds,
  viewport: ViewportSize,
  actorPoint: Point,
  preferredScale = DEFAULT_ACTOR_ZOOM,
): CameraState {
  return constrainCameraToBounds(
    centerCameraOnPoint(
      {
        scale: Math.max(preferredScale, minimumCoverScale(bounds, viewport)),
        offsetX: 0,
        offsetY: 0,
      },
      actorPoint,
      viewport,
    ),
    bounds,
    viewport,
  );
}

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
