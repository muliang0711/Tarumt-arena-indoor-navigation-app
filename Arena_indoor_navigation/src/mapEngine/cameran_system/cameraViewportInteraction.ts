export type CameraInteractionState = {
  isGestureActive: boolean;
};

export function shouldSyncCameraFromProps(
  interactionState: CameraInteractionState,
): boolean {
  return !interactionState.isGestureActive;
}
