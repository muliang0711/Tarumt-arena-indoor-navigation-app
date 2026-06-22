export type CameraMode = 'followActor' | 'manualPan';

export function enterManualPan(_mode: CameraMode): CameraMode {
  return 'manualPan';
}

export function recenterActor(_mode: CameraMode): CameraMode {
  return 'followActor';
}

export function isFollowingActor(mode: CameraMode): boolean {
  return mode === 'followActor';
}
