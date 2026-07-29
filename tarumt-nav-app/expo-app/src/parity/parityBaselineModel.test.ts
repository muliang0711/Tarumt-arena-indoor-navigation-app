import assert from 'node:assert/strict';
import { test } from 'node:test';

import golden from '../../../flutter_app/test/fixtures/parity/golden.json';
import input from '../../../flutter_app/test/fixtures/parity/input.json';
import {
  createParityBaseline,
  type ParityInputDocument,
} from './parityBaselineModel';

test('reproduces the checked-in TypeScript migration golden', () => {
  const actual = createParityBaseline(
    input as unknown as ParityInputDocument,
  );

  assert.deepEqual(actual, golden);
});

test('covers every required non-random PDR migration scenario', () => {
  const scenarioIds = new Set(input.pdrCases.map((parityCase) => parityCase.id));

  for (const requiredId of [
    'backward-confirmed-step',
    'empty-batch',
    'extreme-shake',
    'future-sample',
    'high-frequency-excess',
    'infinite-acceleration',
    'low-frequency-sparse',
    'nan-acceleration',
    'normal-forward-step',
    'out-of-order-samples',
    'single-peak',
    'stale-sensor-interruption',
    'startup-lock',
    'too-soon-after-step',
  ]) {
    assert.equal(scenarioIds.has(requiredId), true, requiredId);
  }
});

test('records the approved iOS heading unit correction as a parity exception', () => {
  const headingDecision = input.approvedDivergences.find(
    (decision) => decision.id === 'ios-heading-fallback-unit',
  );

  assert.equal(headingDecision?.parityExempt, true);
});
