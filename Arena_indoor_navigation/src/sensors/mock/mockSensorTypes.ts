import type { RawSensorSample } from '../../mapEngine/shared';

export type MockMovementSensorScenarioId =
  | 'stationary'
  | 'straight-walk'
  | 'turn-and-walk'
  | 'intermittent-pedometer'
  | 'noisy-walk'
  | 'reset-during-run'
  | 'recorded-replay';

export type MockMovementSensorPlaybackState =
  | 'stopped'
  | 'running'
  | 'paused'
  | 'completed';

export type MockSensorBatch = {
  readonly label: string;
  readonly samples: readonly RawSensorSample[];
};

export type MockMovementSensorScenario = {
  readonly id: MockMovementSensorScenarioId;
  readonly label: string;
  readonly description: string;
  readonly initialPedometerSteps: number;
  readonly batches: readonly MockSensorBatch[];
};

export type MockMovementSensorState = {
  readonly scenarioId: MockMovementSensorScenarioId;
  readonly playbackState: MockMovementSensorPlaybackState;
  readonly currentBatchIndex: number;
  readonly totalBatches: number;
  readonly currentPedometerSteps: number | null;
};
