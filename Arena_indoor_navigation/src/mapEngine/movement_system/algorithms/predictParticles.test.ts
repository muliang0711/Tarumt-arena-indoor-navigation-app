import assert from 'node:assert/strict';
import test from 'node:test';

import { createDisplacementEstimate } from '../estimate/displacementEstimate';
import { createHeadingEstimateFromRadians } from '../estimate/headingEstimate';
import type { MotionEstimate } from '../estimate/motionEstimate';
import { predictParticles } from './predictParticles';
import type { Particle } from './particleTypes';

const stationaryMotion: MotionEstimate = {
  kind: 'motion',
  timestamp: 100,
  step: {
    kind: 'step',
    timestamp: 100,
    steps: 5,
    stepDelta: 0,
    confidence: 1,
    cadence: undefined,
    source: 'pedometer',
  },
  heading: createHeadingEstimateFromRadians(100, Math.PI / 2, 0.8, 'deviceMotion'),
  displacement: createDisplacementEstimate(
    100,
    0,
    0.8,
    createHeadingEstimateFromRadians(100, Math.PI / 2, 0.8, 'deviceMotion'),
    0.7,
  ),
  confidence: 0.8,
};

test('does not add positional noise when motion distance is zero', () => {
  const particle: Particle = {
    id: 'particle-1',
    position: { x: 4.8, y: 5.2 },
    headingRadians: 0,
    weight: 1,
    confidence: 0.9,
    age: 2,
  };

  const [predicted] = predictParticles([particle], stationaryMotion, {
    headingNoiseRadians: Math.PI / 4,
    positionNoiseMeters: 0.5,
    randomSource: () => 1,
  });

  assert.deepEqual(predicted.position, particle.position);
  assert.deepEqual(predicted.motion?.predictedPosition, particle.position);
  assert.deepEqual(predicted.motion?.previousPosition, particle.position);
  assert.notEqual(predicted.headingRadians, particle.headingRadians);
});
