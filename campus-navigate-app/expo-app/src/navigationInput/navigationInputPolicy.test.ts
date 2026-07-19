import assert from 'node:assert/strict';
import { test } from 'node:test';

import packageJson from '../../package.json';
import { RAW_MOTION_CONSUMER_CONFIG } from './rawMotionConsumerConfig';
import {
  assertRawSensorRecordingDisabled,
  assertTransientRawSensorBatchingAllowed,
  NAVIGATION_INPUT_POLICY,
  shouldAcceptDerivedEstimate,
} from './navigationInputPolicy';
import type { DerivedNavigationEstimate } from './type';

const estimate: DerivedNavigationEstimate = {
  confidence: 0.8,
  headingDegrees: 90,
  source: 'pdr-summary',
  timestampMs: 1000,
  x: 236,
  y: 648,
};

test('allows only transient raw sensor batching by policy', () => {
  assert.equal(NAVIGATION_INPUT_POLICY.transientRawSensorBatchingEnabled, true);
  assert.equal(NAVIGATION_INPUT_POLICY.rawSensorRecordingEnabled, false);
  assert.equal(NAVIGATION_INPUT_POLICY.maxDerivedUpdatesPerSecond, 15);
  assert.equal(NAVIGATION_INPUT_POLICY.maxRawSamplesInMemory, 32);
  assert.doesNotThrow(() => assertRawSensorRecordingDisabled());
  assert.doesNotThrow(() => assertTransientRawSensorBatchingAllowed());
});

test('keeps PDR flush cadence faster than the derived UI cap', () => {
  assert.equal(RAW_MOTION_CONSUMER_CONFIG.flushIntervalMs, 60);
  assert.equal(RAW_MOTION_CONSUMER_CONFIG.sensorUpdateIntervalMs, 30);
  assert.ok(
    RAW_MOTION_CONSUMER_CONFIG.flushIntervalMs <=
      1000 / NAVIGATION_INPUT_POLICY.maxDerivedUpdatesPerSecond,
  );
});

test('rejects any policy that tries to enable raw sensor recording', () => {
  assert.throws(
    () =>
      assertRawSensorRecordingDisabled({
        maxDerivedUpdatesPerSecond: 2,
        maxRawSamplesInMemory: 32,
        rawSensorRecordingEnabled: true as false,
        transientRawSensorBatchingEnabled: true,
      }),
    /Raw sensor recording must stay disabled/,
  );
});

test('rejects any policy that disables transient batching', () => {
  assert.throws(
    () =>
      assertTransientRawSensorBatchingAllowed({
        maxDerivedUpdatesPerSecond: 2,
        maxRawSamplesInMemory: 32,
        rawSensorRecordingEnabled: false,
        transientRawSensorBatchingEnabled: false as true,
      }),
    /Transient raw sensor batching must stay enabled/,
  );
});

test('accepts only low-rate derived estimates instead of high-frequency raw streams', () => {
  assert.equal(
    shouldAcceptDerivedEstimate({
      nextEstimate: estimate,
      previousEstimate: null,
    }),
    true,
  );
  assert.equal(
    shouldAcceptDerivedEstimate({
      nextEstimate: { ...estimate, timestampMs: 1050 },
      previousEstimate: estimate,
    }),
    false,
  );
  assert.equal(
    shouldAcceptDerivedEstimate({
      nextEstimate: { ...estimate, timestampMs: 1100 },
      previousEstimate: estimate,
    }),
    true,
  );
});

test('depends on expo sensors only for transient device motion input', () => {
  assert.equal(packageJson.dependencies['expo-sensors'], '~15.0.8');
  assert.equal('expo-sensors' in packageJson.devDependencies, false);
});
