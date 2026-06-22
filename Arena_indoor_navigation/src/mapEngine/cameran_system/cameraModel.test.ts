import assert from 'node:assert/strict';
import test from 'node:test';

import {
  constrainCameraToBounds,
  createActorCameraState,
  minimumCoverScale,
} from './cameraModel';

const bounds = { x: 0, y: 0, width: 1000, height: 800 };
const viewport = { width: 400, height: 300 };

test('actor camera opens as a window centered on the actor instead of fitting the whole map', () => {
  const camera = createActorCameraState(bounds, viewport, { x: 700, y: 500 }, 1);

  assert.equal(camera.scale, 1);
  assert.equal(camera.offsetX, -500);
  assert.equal(camera.offsetY, -350);
});

test('minimum cover scale keeps the map covering the complete viewport', () => {
  assert.equal(minimumCoverScale(bounds, viewport), 0.4);
});

test('camera constraints prevent manual pan from exposing space beyond the map world', () => {
  assert.deepEqual(
    constrainCameraToBounds(
      { scale: 1, offsetX: 900, offsetY: -1200 },
      bounds,
      viewport,
    ),
    { scale: 1, offsetX: 0, offsetY: -500 },
  );
});

test('camera constraints raise zoom to the cover scale before clamping offsets', () => {
  assert.deepEqual(
    constrainCameraToBounds(
      { scale: 0.1, offsetX: 0, offsetY: 0 },
      bounds,
      viewport,
    ),
    { scale: 0.4, offsetX: 0, offsetY: -10 },
  );
});
