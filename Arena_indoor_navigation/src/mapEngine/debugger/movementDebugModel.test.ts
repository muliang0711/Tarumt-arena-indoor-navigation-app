import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMovementDebugSnapshot,
  findDestinationNode,
} from './movementDebugModel';

test('summarizes live sensor kinds and movement state', () => {
  const snapshot = buildMovementDebugSnapshot({
    samples: [
      {
        id: 'accelerometer-1',
        kind: 'accelerometer',
        timestamp: 100,
        acceleration: { x: 1, y: 2, z: 3 },
      },
      {
        id: 'step-1',
        kind: 'pedometer',
        timestamp: 200,
        steps: 7,
      },
      {
        id: 'motion-1',
        kind: 'deviceMotion',
        timestamp: 300,
        attitude: { alpha: Math.PI / 2, beta: 0, gamma: 0 },
      },
    ],
    state: {
      position: { x: 4.8, y: 5.2 },
      headingRadians: Math.PI / 2,
      confidence: 0.75,
      previousStepCount: 7,
      particleFilter: {
        particles: [],
        generation: 3,
        position: { x: 4.8, y: 5.2 },
        headingRadians: Math.PI / 2,
        confidence: 0.75,
        bestParticle: null,
        totalWeight: 1,
      },
    },
    status: 'processed',
    destinationNodeId: 'node_4',
    destinationAvailable: true,
  });

  assert.equal(snapshot.totalSamples, 3);
  assert.equal(snapshot.counts.accelerometer, 1);
  assert.equal(snapshot.counts.pedometer, 1);
  assert.equal(snapshot.counts.deviceMotion, 1);
  assert.equal(snapshot.latestSampleKind, 'deviceMotion');
  assert.equal(snapshot.latestTimestamp, 300);
  assert.equal(snapshot.pedometerSteps, 7);
  assert.equal(snapshot.headingDegrees, 90);
  assert.equal(snapshot.confidence, 0.75);
  assert.equal(snapshot.particleGeneration, 3);
  assert.equal(snapshot.destinationLabel, 'Node 4');
});

test('reports unavailable data without inventing sensor values', () => {
  const snapshot = buildMovementDebugSnapshot({
    samples: [],
    state: {
      position: { x: 0, y: 0 },
      headingRadians: 0,
      confidence: 0.8,
    },
    status: 'waiting',
    destinationNodeId: 'node_4',
    destinationAvailable: false,
  });

  assert.equal(snapshot.latestSampleKind, null);
  assert.equal(snapshot.latestTimestamp, null);
  assert.equal(snapshot.pedometerSteps, null);
  assert.equal(snapshot.particleGeneration, null);
  assert.equal(snapshot.destinationLabel, 'unavailable');
});

test('finds Node 4 without modifying the route graph', () => {
  const routeGraph = {
    nodes: [
      { node_id: 'node_1', position: { x: 4.8, y: 5.2 } },
      { node_id: 'node_4', position: { x: 10.4, y: 4 } },
    ],
    edges: [{ from_node: 'node_1', to_node: 'node_4' }],
  };
  const before = structuredClone(routeGraph);

  assert.deepEqual(findDestinationNode(routeGraph, 'node_4'), routeGraph.nodes[1]);
  assert.deepEqual(routeGraph, before);
  assert.equal(findDestinationNode(routeGraph, 'missing'), null);
});
