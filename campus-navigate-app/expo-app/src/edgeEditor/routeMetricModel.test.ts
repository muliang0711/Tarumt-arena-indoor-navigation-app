import assert from 'node:assert/strict';
import { test } from 'node:test';

import demoEdges from '../../assets/maps/demo_1.edges.json';
import demoMap from '../../assets/maps/demo_1.tmj.json';
import { createPngMapModel } from '../tiled/model';
import type { TiledMap } from '../tiled/type';
import {
  convertMetersToPixelsAtRoutePosition,
  createRouteMetricModel,
  findPixelsPerMeterAtRoutePosition,
} from './routeMetricModel';
import type { RouteGraphEdgeDocument } from './routeGraphEdgeModel';

test('creates route metrics from EDGE distances in meters', () => {
  const mapModel = createPngMapModel(demoMap as TiledMap);
  const metrics = createRouteMetricModel(
    mapModel.routePath,
    (demoEdges as RouteGraphEdgeDocument).edges,
  );

  assert.equal(metrics.segments.length, 11);
  assert.equal(metrics.totalMeters, 46);
  assert.equal(Math.round(metrics.totalPixels), 2542);
  assert.deepEqual(
    metrics.segments.map((segment) => ({
      from: segment.fromNodeId,
      meters: segment.meterLength,
      to: segment.toNodeId,
    })),
    [
      { from: 'node-21', meters: 3, to: 'node-20' },
      { from: 'node-20', meters: 3, to: 'node-19' },
      { from: 'node-19', meters: 3, to: 'node-18' },
      { from: 'node-18', meters: 3, to: 'node-17' },
      { from: 'node-17', meters: 3, to: 'node-16' },
      { from: 'node-16', meters: 8, to: 'node-12' },
      { from: 'node-12', meters: 6, to: 'node-13' },
      { from: 'node-13', meters: 2, to: 'node-14' },
      { from: 'node-14', meters: 3, to: 'node-15' },
      { from: 'node-15', meters: 4, to: 'node-2' },
      { from: 'node-2', meters: 8, to: 'node-1' },
    ],
  );
});

test('converts PDR meters into pixels for the current route segment', () => {
  const mapModel = createPngMapModel(demoMap as TiledMap);
  const metrics = createRouteMetricModel(
    mapModel.routePath,
    (demoEdges as RouteGraphEdgeDocument).edges,
  );
  const position = {
    ...mapModel.routePath[0]!,
    distanceAlongRoute: 0,
    headingDegrees: 0,
    segmentIndex: 0,
  };

  assert.equal(Math.round(findPixelsPerMeterAtRoutePosition({ metrics, position })), 44);
  assert.equal(
    Math.round(
      convertMetersToPixelsAtRoutePosition({
        meters: 0.75,
        metrics,
        position,
      }),
    ),
    33,
  );
});
