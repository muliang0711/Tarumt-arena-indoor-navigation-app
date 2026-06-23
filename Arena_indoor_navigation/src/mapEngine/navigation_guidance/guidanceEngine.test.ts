import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNavigationGuidance,
  buildRoutePolyline,
  classifyNavigationAction,
  measureRoutePolyline,
  pointAtDistanceAlongRoute,
  projectPointOntoRoute,
  shortestAngleDeltaRadians,
} from './index';
import type { MovementRouteGraph } from '../shared';
import type { HighlightedRoute } from '../debugger';

test('buildRoutePolyline converts highlighted node ids into route points', () => {
  const routeGraph: MovementRouteGraph = {
    nodes: [
      { node_id: 'node_1', position: { x: 0, y: 0 } },
      { node_id: 'node_2', position: { x: 0, y: 6 } },
      { node_id: 'node_4', position: { x: 6, y: 6 } },
    ],
    edges: [],
  };
  const route: HighlightedRoute = {
    nodeIds: ['node_1', 'node_2', 'node_4'],
    edges: [],
    totalWeight: 12,
  };

  assert.deepEqual(buildRoutePolyline(route, routeGraph), [
    { x: 0, y: 0 },
    { x: 0, y: 6 },
    { x: 6, y: 6 },
  ]);
});

test('projectPointOntoRoute finds the nearest point and traveled distance along a polyline', () => {
  const projection = projectPointOntoRoute(
    { x: 1, y: 3 },
    [
      { x: 0, y: 0 },
      { x: 0, y: 6 },
      { x: 6, y: 6 },
    ],
  );

  assert.ok(projection);
  assert.deepEqual(projection.projectedPoint, { x: 0, y: 3 });
  assert.equal(projection.segmentIndex, 0);
  assert.equal(projection.distanceAlongRoute, 3);
  assert.equal(projection.distanceToRoute, 1);
});

test('pointAtDistanceAlongRoute interpolates across segments', () => {
  assert.deepEqual(
    pointAtDistanceAlongRoute(
      [
        { x: 0, y: 0 },
        { x: 0, y: 6 },
        { x: 6, y: 6 },
      ],
      8,
    ),
    { x: 2, y: 6 },
  );
});

test('buildNavigationGuidance produces a straight cue and next turn cue from route geometry', () => {
  const guidance = buildNavigationGuidance(
    {
      positionMeters: { x: 0, y: 0.5 },
      headingRadians: Math.PI / 2,
      headingConfidence: 0.9,
    },
    [
      { x: 0, y: 0 },
      { x: 0, y: 6 },
      { x: 6, y: 6 },
    ],
  );

  assert.ok(guidance);
  assert.equal(guidance.cue.action, 'straight');
  assert.match(guidance.cue.message, /Go straight/);
  assert.equal(guidance.nextCue?.action, 'left');
  assert.equal(Math.round(guidance.remainingDistanceMeters), 12);
});

test('buildNavigationGuidance produces a turn cue when user heading conflicts with route heading', () => {
  const guidance = buildNavigationGuidance(
    {
      positionMeters: { x: 0, y: 2 },
      headingRadians: 0,
      headingConfidence: 0.9,
    },
    [
      { x: 0, y: 0 },
      { x: 0, y: 6 },
      { x: 6, y: 6 },
    ],
    {
      maxLookaheadMeters: 2,
    },
  );

  assert.ok(guidance);
  assert.equal(guidance.cue.action, 'right');
  assert.equal(guidance.cue.confidence, 'high');
});

test('buildNavigationGuidance reports arrival near the route destination', () => {
  const guidance = buildNavigationGuidance(
    {
      positionMeters: { x: 5.7, y: 6 },
    },
    [
      { x: 0, y: 0 },
      { x: 0, y: 6 },
      { x: 6, y: 6 },
    ],
  );

  assert.ok(guidance);
  assert.equal(guidance.cue.action, 'arrived');
  assert.equal(guidance.nextCue, null);
});

test('angle helpers classify navigation turn directions consistently', () => {
  assert.equal(classifyNavigationAction(shortestAngleDeltaRadians(Math.PI / 2, 0)), 'right');
  assert.equal(classifyNavigationAction(shortestAngleDeltaRadians(-Math.PI / 2, 0)), 'left');
  assert.equal(classifyNavigationAction(shortestAngleDeltaRadians(Math.PI, 0)), 'u_turn');
});

test('measureRoutePolyline returns the total route distance', () => {
  assert.equal(
    measureRoutePolyline([
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 6, y: 4 },
    ]),
    8,
  );
});
