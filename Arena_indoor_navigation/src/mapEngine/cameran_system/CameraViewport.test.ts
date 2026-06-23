import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldSyncCameraFromProps,
  type CameraInteractionState,
} from './cameraViewportInteraction';

test('does not sync parent camera props while a gesture is active', () => {
  const active: CameraInteractionState = { isGestureActive: true };
  const idle: CameraInteractionState = { isGestureActive: false };

  assert.equal(shouldSyncCameraFromProps(active), false);
  assert.equal(shouldSyncCameraFromProps(idle), true);
});
