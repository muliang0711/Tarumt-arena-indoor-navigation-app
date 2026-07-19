import assert from 'node:assert/strict';
import test from 'node:test';

import {
  actorDirectionFromHeading,
  actorDirectionWithHysteresis,
} from './actorDirectionModel';

test('maps the map heading convention to four upright actor directions', () => {
  assert.equal(actorDirectionFromHeading(0), 'right');
  assert.equal(actorDirectionFromHeading(44), 'right');
  assert.equal(actorDirectionFromHeading(45), 'down');
  assert.equal(actorDirectionFromHeading(90), 'down');
  assert.equal(actorDirectionFromHeading(135), 'left');
  assert.equal(actorDirectionFromHeading(180), 'left');
  assert.equal(actorDirectionFromHeading(225), 'up');
  assert.equal(actorDirectionFromHeading(270), 'up');
  assert.equal(actorDirectionFromHeading(315), 'right');
});

test('normalizes negative and wrapped headings', () => {
  assert.equal(actorDirectionFromHeading(-90), 'up');
  assert.equal(actorDirectionFromHeading(-180), 'left');
  assert.equal(actorDirectionFromHeading(450), 'down');
});

test('holds the current actor direction inside a ten-degree boundary buffer', () => {
  assert.equal(
    actorDirectionWithHysteresis({
      currentDirection: 'right',
      headingDegrees: 54,
    }),
    'right',
  );
  assert.equal(
    actorDirectionWithHysteresis({
      currentDirection: 'right',
      headingDegrees: 56,
    }),
    'down',
  );
  assert.equal(
    actorDirectionWithHysteresis({
      currentDirection: 'down',
      headingDegrees: 36,
    }),
    'down',
  );
  assert.equal(
    actorDirectionWithHysteresis({
      currentDirection: 'down',
      headingDegrees: 34,
    }),
    'right',
  );
});
