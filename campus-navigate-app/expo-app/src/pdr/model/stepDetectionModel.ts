import type {
  MotionInputSample,
  PdrPipelineConfig,
  PdrPipelineState,
  StepDetectionDiagnostic,
} from '../type';

export function detectStepCount(input: {
  config: PdrPipelineConfig;
  previousState: PdrPipelineState;
  samples: readonly MotionInputSample[];
}) {
  return analyzeStepDetection(input).stepCount;
}

export function analyzeStepDetection(input: {
  config: PdrPipelineConfig;
  previousState: PdrPipelineState;
  samples: readonly MotionInputSample[];
}): StepDetectionDiagnostic {
  const peakSample = findPeakSample(input.samples);
  if (!peakSample) {
    return createDiagnostic({
      rejectReason: 'NO_SAMPLES',
      samples: input.samples,
      stepCount: 0,
    });
  }

  const peakMagnitude = accelerationMagnitude(peakSample);
  if (peakMagnitude < input.config.accelerationStepThreshold) {
    return createDiagnostic({
      peakSample,
      rejectReason: 'LOW_PEAK',
      samples: input.samples,
      stepCount: 0,
    });
  }

  if (peakMagnitude > input.config.maxShakeAccelerationMagnitude) {
    return createDiagnostic({
      peakSample,
      rejectReason: 'SHAKE_TOO_HIGH',
      samples: input.samples,
      stepCount: 0,
    });
  }

  if (!hasStillnessBeforePeak(input.samples, peakSample, input.config)) {
    return createDiagnostic({
      peakSample,
      rejectReason: 'NO_QUIET_SAMPLE',
      samples: input.samples,
      stepCount: 0,
    });
  }

  if (
    input.previousState.lastStepTimestampMs !== undefined &&
    peakSample.timestampMs - input.previousState.lastStepTimestampMs <
      input.config.minStepIntervalMs
  ) {
    return createDiagnostic({
      peakSample,
      previousStepTimestampMs: input.previousState.lastStepTimestampMs,
      rejectReason: 'TOO_SOON_AFTER_LAST_STEP',
      samples: input.samples,
      stepCount: 0,
    });
  }

  return createDiagnostic({
    peakSample,
    previousStepTimestampMs: input.previousState.lastStepTimestampMs,
    rejectReason: 'ACCEPTED',
    samples: input.samples,
    stepCount: 1,
  });
}

export function getLatestStepTimestamp(input: {
  samples: readonly MotionInputSample[];
  stepCount: number;
}) {
  if (input.stepCount === 0) {
    return undefined;
  }

  return findPeakSample(input.samples)?.timestampMs;
}

function findPeakSample(samples: readonly MotionInputSample[]) {
  return samples.reduce<MotionInputSample | null>((peakSample, sample) => {
    if (!peakSample) {
      return sample;
    }

    return accelerationMagnitude(sample) > accelerationMagnitude(peakSample)
      ? sample
      : peakSample;
  }, null);
}

function hasStillnessBeforePeak(
  samples: readonly MotionInputSample[],
  peakSample: MotionInputSample,
  config: PdrPipelineConfig,
) {
  return samples.some(
    (sample) =>
      sample.timestampMs < peakSample.timestampMs &&
      accelerationMagnitude(sample) <= config.stillnessAccelerationMagnitude,
  );
}

function createDiagnostic(input: {
  peakSample?: MotionInputSample;
  previousStepTimestampMs?: number;
  rejectReason: StepDetectionDiagnostic['rejectReason'];
  samples: readonly MotionInputSample[];
  stepCount: number;
}): StepDetectionDiagnostic {
  const magnitudes = input.samples.map(accelerationMagnitude);
  const peakAcceleration =
    input.peakSample === undefined
      ? 0
      : accelerationMagnitude(input.peakSample);
  const minAcceleration =
    magnitudes.length === 0 ? 0 : Math.min(...magnitudes);
  const averageAcceleration =
    magnitudes.length === 0
      ? 0
      : magnitudes.reduce((total, magnitude) => total + magnitude, 0) /
        magnitudes.length;

  return {
    averageAcceleration: roundDiagnosticNumber(averageAcceleration),
    minAcceleration: roundDiagnosticNumber(minAcceleration),
    peakAcceleration: roundDiagnosticNumber(peakAcceleration),
    peakTimestampMs: input.peakSample?.timestampMs ?? null,
    rejectReason: input.rejectReason,
    rotationHeadingTravelDegrees: 0,
    stepCount: input.stepCount,
    timeSinceLastStepMs:
      input.peakSample && input.previousStepTimestampMs !== undefined
        ? input.peakSample.timestampMs - input.previousStepTimestampMs
        : null,
  };
}

function accelerationMagnitude(sample: MotionInputSample) {
  return Math.hypot(
    sample.acceleration.x,
    sample.acceleration.y,
    sample.acceleration.z,
  );
}

function roundDiagnosticNumber(value: number) {
  return Number(value.toFixed(3));
}
