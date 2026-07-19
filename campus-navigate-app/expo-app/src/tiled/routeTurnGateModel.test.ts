import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  constrainEstimateToRouteProgress,
  createAcceptedRouteHeadingDegrees,
  createTurnAwareRoutePosition,
} from './model';
import type { OverlayRouteNode, RoutePosition } from './type';

const routePath: OverlayRouteNode[] = [
  {
    id: 1,
    nodeId: 'A',
    screenX: 0,
    screenY: 0,
    tiledX: 0,
    tiledY: 0,
    type: 'route-node',
  },
  {
    id: 2,
    nodeId: 'B',
    screenX: 100,
    screenY: 0,
    tiledX: 100,
    tiledY: 0,
    type: 'junctions',
  },
  {
    id: 3,
    nodeId: 'C',
    screenX: 100,
    screenY: 100,
    tiledX: 100,
    tiledY: 100,
    type: 'route-node',
  },
];

const atTurnBeforeUserTurns: RoutePosition = {
  distanceAlongRoute: 100,
  headingDegrees: 0,
  screenX: 100,
  screenY: 0,
  segmentIndex: 0,
  tiledX: 100,
  tiledY: 0,
};

test('keeps blue marker at the turn until user heading faces the next segment', () => {
  const result = constrainEstimateToRouteProgress({
    estimate: {
      headingDegrees: 0,
      screenX: 100,
      screenY: 35,
    },
    previousPosition: atTurnBeforeUserTurns,
    routePath,
  });

  assert.equal(result.position.segmentIndex, 0);
  assert.equal(result.position.distanceAlongRoute, 100);
  assert.equal(result.position.screenX, 100);
  assert.equal(result.position.screenY, 0);
});

test('allows blue marker onto the next segment after user turns heading', () => {
  const result = constrainEstimateToRouteProgress({
    estimate: {
      headingDegrees: 90,
      screenX: 100,
      screenY: 35,
    },
    previousPosition: atTurnBeforeUserTurns,
    routePath,
  });

  assert.equal(result.position.segmentIndex, 1);
  assert.equal(result.position.distanceAlongRoute, 135);
  assert.equal(result.position.screenX, 100);
  assert.equal(result.position.screenY, 35);
});

test('switches PDR desired heading near the turn without changing route segment', () => {
  const stillFacingCurrentSegment = createTurnAwareRoutePosition({
    observedHeadingDegrees: 0,
    routePath,
    routePosition: atTurnBeforeUserTurns,
  });
  const facingNextSegment = createTurnAwareRoutePosition({
    observedHeadingDegrees: 90,
    routePath,
    routePosition: atTurnBeforeUserTurns,
  });

  assert.equal(stillFacingCurrentSegment.headingDegrees, 0);
  assert.equal(stillFacingCurrentSegment.segmentIndex, 0);
  assert.equal(facingNextSegment.headingDegrees, 90);
  assert.equal(facingNextSegment.segmentIndex, 0);
});

test('accepts current and next headings while approaching a turn', () => {
  const headings = createAcceptedRouteHeadingDegrees({
    routePath,
    routePosition: {
      ...atTurnBeforeUserTurns,
      distanceAlongRoute: 40,
      screenX: 40,
      tiledX: 40,
    },
  });

  assert.deepEqual(headings, [0, 90]);
});

test('does not switch the blue marker to next segment before the turn capture zone', () => {
  const result = constrainEstimateToRouteProgress({
    estimate: {
      headingDegrees: 90,
      screenX: 40,
      screenY: 35,
    },
    previousPosition: {
      ...atTurnBeforeUserTurns,
      distanceAlongRoute: 40,
      screenX: 40,
      tiledX: 40,
    },
    routePath,
  });

  assert.equal(result.position.segmentIndex, 0);
  assert.equal(result.position.distanceAlongRoute, 40);
  assert.equal(result.position.screenX, 40);
  assert.equal(result.position.screenY, 0);
});

test('moves blue marker backward on the current segment when user walks opposite', () => {
  const result = constrainEstimateToRouteProgress({
    estimate: {
      headingDegrees: 180,
      screenX: 60,
      screenY: 0,
    },
    previousPosition: {
      distanceAlongRoute: 80,
      headingDegrees: 0,
      screenX: 80,
      screenY: 0,
      segmentIndex: 0,
      tiledX: 80,
      tiledY: 0,
    },
    routePath,
  });

  assert.equal(result.position.segmentIndex, 0);
  assert.equal(result.position.distanceAlongRoute, 60);
  assert.equal(result.position.screenX, 60);
  assert.equal(result.position.screenY, 0);
});

test('allows blue marker to move from next segment back onto previous segment', () => {
  const result = constrainEstimateToRouteProgress({
    estimate: {
      headingDegrees: 180,
      screenX: 65,
      screenY: 0,
    },
    previousPosition: {
      distanceAlongRoute: 100,
      headingDegrees: 90,
      screenX: 100,
      screenY: 0,
      segmentIndex: 1,
      tiledX: 100,
      tiledY: 0,
    },
    routePath,
  });

  assert.equal(result.position.segmentIndex, 0);
  assert.equal(result.position.distanceAlongRoute, 65);
  assert.equal(result.position.screenX, 65);
  assert.equal(result.position.screenY, 0);
});
