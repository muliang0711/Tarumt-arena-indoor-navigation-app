import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isFollowingBob,
  toggleCameraFollowMode,
  type CameraFollowMode,
} from './cameraFollowMode';

test('camera follow mode changes only through an explicit toggle', () => {
  const initial: CameraFollowMode = 'following';
  const freeLook = toggleCameraFollowMode(initial);

  assert.equal(freeLook, 'free-look');
  assert.equal(isFollowingBob(freeLook), false);
  assert.equal(toggleCameraFollowMode(freeLook), 'following');
  assert.equal(isFollowingBob('following'), true);
});
