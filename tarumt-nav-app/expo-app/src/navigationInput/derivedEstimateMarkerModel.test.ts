import assert from 'node:assert/strict';
import { test } from 'node:test';

import { redMarkerFromDerivedEstimate } from './derivedEstimateMarkerModel';
import type { DerivedNavigationEstimate } from './type';

const estimate: DerivedNavigationEstimate = {
  confidence: 0.82,
  headingDegrees: 0,
  source: 'pdr-summary',
  timestampMs: 1200,
  x: 300,
  y: 700,
};

test('moves the red marker from a derived estimate while preserving Tiled offset correction', () => {
  assert.deepEqual(
    redMarkerFromDerivedEstimate(estimate, {
      height: 2048,
      originX: -256,
      originY: 256,
      width: 1536,
    }),
    {
      headingDegrees: 0,
      kind: 'redMarker',
      screenX: 300,
      screenY: 700,
      tiledX: 44,
      tiledY: 956,
    },
  );
});
