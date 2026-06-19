export type CameraFollowMode = 'following' | 'free-look';

export function toggleCameraFollowMode(
  mode: CameraFollowMode,
): CameraFollowMode {
  return mode === 'following' ? 'free-look' : 'following';
}

export function isFollowingBob(mode: CameraFollowMode): boolean {
  return mode === 'following';
}
