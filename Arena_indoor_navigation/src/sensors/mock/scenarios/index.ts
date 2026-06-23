import type { RawSensorSample } from '../../../mapEngine/shared';
import type {
  MockMovementSensorScenario,
  MockMovementSensorScenarioId,
  MockSensorBatch,
} from '../mockSensorTypes';

const recordedReplaySamples = require('./recordedReplay.samples.json') as readonly MockSensorBatch[];

function sampleTimestamp(batchIndex: number, offsetMs: number): number {
  return batchIndex * 250 + offsetMs;
}

function createVectorNoise(seed: number, scale: number): number {
  return Number((Math.sin(seed) * scale).toFixed(4));
}

function createBatch(
  batchIndex: number,
  {
    headingRadians,
    pedometerSteps,
    accelScale = 0.08,
    gyroScale = 0.03,
    magnetometerScale = 34,
    label,
  }: {
    headingRadians: number;
    pedometerSteps?: number;
    accelScale?: number;
    gyroScale?: number;
    magnetometerScale?: number;
    label: string;
  },
): MockSensorBatch {
  const samples: RawSensorSample[] = [
    {
      id: `${label}-accel`,
      kind: 'accelerometer',
      timestamp: sampleTimestamp(batchIndex, 1),
      acceleration: {
        x: createVectorNoise(batchIndex + 1, accelScale),
        y: createVectorNoise(batchIndex + 2, accelScale / 2),
        z: Number((9.7 + createVectorNoise(batchIndex + 3, accelScale)).toFixed(4)),
      },
      intervalMs: 100,
    },
    {
      id: `${label}-gyro`,
      kind: 'gyroscope',
      timestamp: sampleTimestamp(batchIndex, 8),
      rotationRate: {
        x: createVectorNoise(batchIndex + 4, gyroScale),
        y: createVectorNoise(batchIndex + 5, gyroScale),
        z: createVectorNoise(batchIndex + 6, gyroScale),
      },
      intervalMs: 100,
    },
    {
      id: `${label}-mag`,
      kind: 'magnetometer',
      timestamp: sampleTimestamp(batchIndex, 14),
      magneticField: {
        x: Number((Math.cos(headingRadians) * magnetometerScale).toFixed(4)),
        y: Number((Math.sin(headingRadians) * magnetometerScale).toFixed(4)),
        z: 3.2,
      },
      accuracy: 3,
      intervalMs: 100,
    },
    {
      id: `${label}-motion`,
      kind: 'deviceMotion',
      timestamp: sampleTimestamp(batchIndex, 20),
      attitude: { alpha: headingRadians, beta: 0, gamma: 0 },
      acceleration: {
        x: createVectorNoise(batchIndex + 7, accelScale),
        y: createVectorNoise(batchIndex + 8, accelScale / 2),
        z: Number((9.7 + createVectorNoise(batchIndex + 9, accelScale)).toFixed(4)),
      },
      rotationRate: {
        x: createVectorNoise(batchIndex + 10, gyroScale),
        y: createVectorNoise(batchIndex + 11, gyroScale),
        z: createVectorNoise(batchIndex + 12, gyroScale),
      },
      intervalMs: 100,
    },
  ];

  if (pedometerSteps !== undefined) {
    samples.push({
      id: `${label}-step`,
      kind: 'pedometer',
      timestamp: sampleTimestamp(batchIndex, 30),
      steps: pedometerSteps,
    });
  }

  return {
    label,
    samples,
  };
}

const scenarios: readonly MockMovementSensorScenario[] = [
  {
    id: 'stationary',
    label: 'Stationary',
    description: 'No steps. Heading changes only.',
    initialPedometerSteps: 0,
    batches: [
      createBatch(0, { label: 'stationary-1', headingRadians: 0 }),
      createBatch(1, { label: 'stationary-2', headingRadians: Math.PI / 2 }),
      createBatch(2, { label: 'stationary-3', headingRadians: Math.PI }),
      createBatch(3, { label: 'stationary-4', headingRadians: (Math.PI * 3) / 2 }),
    ],
  },
  {
    id: 'straight-walk',
    label: 'Straight walk',
    description: 'Fixed heading with cumulative pedometer steps every batch.',
    initialPedometerSteps: 0,
    batches: [
      createBatch(0, { label: 'straight-1', headingRadians: 0, pedometerSteps: 1 }),
      createBatch(1, { label: 'straight-2', headingRadians: 0, pedometerSteps: 2 }),
      createBatch(2, { label: 'straight-3', headingRadians: 0, pedometerSteps: 3 }),
      createBatch(3, { label: 'straight-4', headingRadians: 0, pedometerSteps: 4 }),
    ],
  },
  {
    id: 'turn-and-walk',
    label: 'Turn and walk',
    description: 'Walk east, stop, turn north, then continue.',
    initialPedometerSteps: 0,
    batches: [
      createBatch(0, { label: 'turn-1', headingRadians: 0, pedometerSteps: 1 }),
      createBatch(1, { label: 'turn-2', headingRadians: 0, pedometerSteps: 2 }),
      createBatch(2, { label: 'turn-3', headingRadians: 0 }),
      createBatch(3, { label: 'turn-4', headingRadians: Math.PI / 2 }),
      createBatch(4, { label: 'turn-5', headingRadians: Math.PI / 2, pedometerSteps: 3 }),
      createBatch(5, { label: 'turn-6', headingRadians: Math.PI / 2, pedometerSteps: 4 }),
    ],
  },
  {
    id: 'intermittent-pedometer',
    label: 'Intermittent pedometer',
    description: 'Motion batches continue while pedometer events skip several batches.',
    initialPedometerSteps: 0,
    batches: [
      createBatch(0, { label: 'intermittent-1', headingRadians: 0, pedometerSteps: 1 }),
      createBatch(1, { label: 'intermittent-2', headingRadians: 0 }),
      createBatch(2, { label: 'intermittent-3', headingRadians: 0 }),
      createBatch(3, { label: 'intermittent-4', headingRadians: 0, pedometerSteps: 2 }),
      createBatch(4, { label: 'intermittent-5', headingRadians: Math.PI / 2 }),
      createBatch(5, { label: 'intermittent-6', headingRadians: Math.PI / 2, pedometerSteps: 3 }),
    ],
  },
  {
    id: 'noisy-walk',
    label: 'Noisy walk',
    description: 'Controlled step progress with higher motion noise.',
    initialPedometerSteps: 0,
    batches: [
      createBatch(0, { label: 'noisy-1', headingRadians: 0, pedometerSteps: 1, accelScale: 0.14, gyroScale: 0.05 }),
      createBatch(1, { label: 'noisy-2', headingRadians: 0, pedometerSteps: 2, accelScale: 0.13, gyroScale: 0.05 }),
      createBatch(2, { label: 'noisy-3', headingRadians: 0, pedometerSteps: 3, accelScale: 0.16, gyroScale: 0.06 }),
      createBatch(3, { label: 'noisy-4', headingRadians: Math.PI / 8, pedometerSteps: 4, accelScale: 0.15, gyroScale: 0.06 }),
    ],
  },
  {
    id: 'reset-during-run',
    label: 'Reset during run',
    description: 'Use the reset control mid-scenario to re-baseline and return to Node 1.',
    initialPedometerSteps: 0,
    batches: [
      createBatch(0, { label: 'reset-1', headingRadians: 0, pedometerSteps: 1 }),
      createBatch(1, { label: 'reset-2', headingRadians: 0, pedometerSteps: 2 }),
      createBatch(2, { label: 'reset-3', headingRadians: 0, pedometerSteps: 3 }),
      createBatch(3, { label: 'reset-4', headingRadians: Math.PI / 2, pedometerSteps: 4 }),
      createBatch(4, { label: 'reset-5', headingRadians: Math.PI / 2, pedometerSteps: 5 }),
    ],
  },
  {
    id: 'recorded-replay',
    label: 'Recorded replay',
    description: 'Replays timestamped samples loaded from JSON.',
    initialPedometerSteps: 0,
    batches: recordedReplaySamples,
  },
];

export function getMockMovementSensorScenarios(): readonly MockMovementSensorScenario[] {
  return scenarios;
}

export function getMockMovementSensorScenario(
  scenarioId: MockMovementSensorScenarioId,
): MockMovementSensorScenario {
  return (
    scenarios.find((scenario) => scenario.id === scenarioId) ??
    scenarios[0]
  );
}
