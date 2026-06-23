import assert from 'node:assert/strict';
import test from 'node:test';

import {
  enterManualPan,
  isFollowingActor,
  recenterActor,
  type CameraMode,
} from './cameraFollowMode';

test('user camera interaction pauses actor follow until recenter', () => {
  const initial: CameraMode = 'followActor';
  const manual = enterManualPan(initial);

  assert.equal(manual, 'manualPan');
  assert.equal(isFollowingActor(manual), false);
  assert.equal(recenterActor(manual), 'followActor');
  assert.equal(isFollowingActor('followActor'), true);
});
