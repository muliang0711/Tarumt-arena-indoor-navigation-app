import type {
  MovementConstraintMapInput,
  RawSensorSample,
  WorldPosition,
} from '../shared';
import {
  updateMovementSystem,
  type MovementSystemResult,
  type MovementSystemState,
} from './indoorposition_engine';

export type MovementUpdateFunction = (
  samples: readonly RawSensorSample[],
  constraintMapInput: MovementConstraintMapInput,
  currentState: MovementSystemState,
) => MovementSystemResult;

export type MovementRuntimeResetOptions = {
  samplesToIgnore?: readonly RawSensorSample[];
  previousStepCount?: number;
};

type ProcessingCursor = {
  latestTimestamp: number;
  keysAtLatestTimestamp: Set<string>;
};

function latestPedometerCount(
  samples: readonly RawSensorSample[],
): number | undefined {
  return samples
    .filter(
      (
        sample,
      ): sample is Extract<RawSensorSample, { kind: 'pedometer' }> =>
        sample.kind === 'pedometer' && Number.isFinite(sample.steps),
    )
    .sort((left, right) => left.timestamp - right.timestamp)
    .at(-1)?.steps;
}

function sampleKey(sample: RawSensorSample): string {
  return sample.id ?? `${sample.kind}:${sample.timestamp}`;
}

function selectNewSamples(
  samples: readonly RawSensorSample[],
  cursor: ProcessingCursor,
): RawSensorSample[] {
  const uniqueSamples = new Map<string, RawSensorSample>();
  for (const sample of samples) {
    if (Number.isFinite(sample.timestamp)) {
      uniqueSamples.set(sampleKey(sample), sample);
    }
  }

  return [...uniqueSamples.values()]
    .sort((left, right) => left.timestamp - right.timestamp)
    .filter((sample) => {
      if (sample.timestamp < cursor.latestTimestamp) {
        return false;
      }
      return !(
        sample.timestamp === cursor.latestTimestamp &&
        cursor.keysAtLatestTimestamp.has(sampleKey(sample))
      );
    });
}

function advanceCursor(cursor: ProcessingCursor, samples: readonly RawSensorSample[]): void {
  for (const sample of samples) {
    const key = sampleKey(sample);
    if (sample.timestamp > cursor.latestTimestamp) {
      cursor.latestTimestamp = sample.timestamp;
      cursor.keysAtLatestTimestamp = new Set([key]);
    } else if (sample.timestamp === cursor.latestTimestamp) {
      cursor.keysAtLatestTimestamp.add(key);
    }
  }
}

export class MovementRuntime {
  private state: MovementSystemState;
  private cursor: ProcessingCursor = {
    latestTimestamp: Number.NEGATIVE_INFINITY,
    keysAtLatestTimestamp: new Set(),
  };

  constructor(
    initialPosition: WorldPosition,
    private readonly update: MovementUpdateFunction = updateMovementSystem,
  ) {
    this.state = this.createInitialState(initialPosition);
  }

  process(
    samples: readonly RawSensorSample[],
    constraintMapInput: MovementConstraintMapInput,
  ): MovementSystemResult | null {
    if (samples.length === 0) {
      return null;
    }

    const newSamples = selectNewSamples(samples, this.cursor);
    if (newSamples.length === 0) {
      return null;
    }

    const result = this.update(newSamples, constraintMapInput, this.state);
    this.state = result.state;
    advanceCursor(this.cursor, newSamples);
    return result;
  }

  reset(
    initialPosition: WorldPosition,
    options: MovementRuntimeResetOptions | readonly RawSensorSample[] = [],
  ): void {
    let samplesToIgnore: readonly RawSensorSample[];
    let previousStepCount: number | undefined;

    if (Array.isArray(options)) {
      samplesToIgnore = options;
      previousStepCount = latestPedometerCount(options);
    } else {
      const resetOptions = options as MovementRuntimeResetOptions;
      samplesToIgnore = resetOptions.samplesToIgnore ?? [];
      previousStepCount =
        resetOptions.previousStepCount ?? latestPedometerCount(samplesToIgnore);
    }

    this.state = this.createInitialState(
      initialPosition,
      previousStepCount,
    );
    this.cursor = {
      latestTimestamp: Number.NEGATIVE_INFINITY,
      keysAtLatestTimestamp: new Set(),
    };
    advanceCursor(this.cursor, selectNewSamples(samplesToIgnore, this.cursor));
  }

  getState(): MovementSystemState {
    return this.state;
  }

  private createInitialState(
    position: WorldPosition,
    previousStepCount?: number,
  ): MovementSystemState {
    return {
      position: { ...position },
      headingRadians: 0,
      confidence: 0.8,
      previousStepCount,
      lastStepDelta: 0,
    };
  }
}
