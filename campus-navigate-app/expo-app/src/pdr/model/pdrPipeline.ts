import type {
  MotionInputSample,
  PdrPipelineConfig,
  PdrPipelineResult,
  PdrPipelineState,
  StepDetectionDiagnostic,
} from '../type';
import { circularMeanDegrees, shortestAngleDistanceDegrees } from './angleModel';
import { createTransientMotionBatch } from './batchModel';
import { DEFAULT_PDR_PIPELINE_CONFIG } from './pdrConfig';
import { rankHeadingCandidates } from './headingRankModel';
import { getRouteMovementDirection } from './movementGateModel';
import { analyzeStepDetection, getLatestStepTimestamp } from './stepDetectionModel';
import { normalizeDegrees } from './angleModel';

export function runPdrPipeline(input: {
  config?: Partial<PdrPipelineConfig>;
  desiredHeadingDegrees: number;
  nowMs: number;
  pixelsPerMeter?: number;
  previousState: PdrPipelineState;
  samples: readonly MotionInputSample[];
}): PdrPipelineResult {
  const config = {
    ...DEFAULT_PDR_PIPELINE_CONFIG,
    ...input.config,
  };
  const batch = createTransientMotionBatch({
    config,
    nowMs: input.nowMs,
    samples: input.samples,
  });
  const observedHeadingDegrees =
    batch.acceptedSamples.length === 0
      ? input.previousState.headingDegrees
      : circularMeanDegrees(
          batch.acceptedSamples.map((sample) => sample.headingDegrees),
        );
  const headingCandidates = rankHeadingCandidates({
    desiredHeadingDegrees: input.desiredHeadingDegrees,
    observedHeadingDegrees,
    previousHeadingDegrees: input.previousState.headingDegrees,
  });
  const rotationWindowState = createNextRotationWindowState({
    config,
    nowMs: input.nowMs,
    observedHeadingDegrees,
    previousState: input.previousState,
  });
  const rawStepDiagnostic = analyzeStepDetection({
    config,
    previousState: input.previousState,
    samples: batch.acceptedSamples,
  });
  const stepDiagnostic = applyPhoneRotationGate({
    config,
    rotationHeadingTravelDegrees:
      rotationWindowState.rotationHeadingTravelDegrees ?? 0,
    stepDiagnostic: rawStepDiagnostic,
  });
  const stepCount = stepDiagnostic.stepCount;
  const movementDirection = getRouteMovementDirection({
    config,
    desiredHeadingDegrees: input.desiredHeadingDegrees,
    observedHeadingDegrees,
  });
  const movementHeading =
    movementDirection === 'backward'
      ? normalizeDegrees(input.desiredHeadingDegrees + 180)
      : headingCandidates[0]?.headingDegrees ?? observedHeadingDegrees;
  const pixelsPerMeter =
    input.pixelsPerMeter && input.pixelsPerMeter > 0
      ? input.pixelsPerMeter
      : config.fallbackPixelsPerMeter;
  const movementGuardState = createNextMovementGuardState({
    config,
    movementDirection,
    nowMs: input.nowMs,
    observedHeadingDegrees,
    previousState: input.previousState,
    stepDiagnostic,
  });
  const movementBlockedReason = getMovementBlockedReason({
    config,
    guardState: movementGuardState,
    movementDirection,
    nowMs: input.nowMs,
    previousState: input.previousState,
    stepDiagnostic,
  });
  const distancePixels =
    stepCount > 0 && movementBlockedReason === null
      ? stepCount * config.stepLengthMeters * pixelsPerMeter
      : 0;
  const headingRadians = (movementHeading * Math.PI) / 180;
  const latestStepTimestampMs = getLatestStepTimestamp({
    samples: batch.acceptedSamples,
    stepCount,
  });
  const nextState = {
    headingDegrees: observedHeadingDegrees,
    lastStepTimestampMs:
      latestStepTimestampMs ?? input.previousState.lastStepTimestampMs,
    backwardConfirmationTimestampMs:
      shouldStoreBackwardConfirmation({
        config,
        movementDirection,
        stepDiagnostic,
      })
        ? latestStepTimestampMs ?? input.previousState.backwardConfirmationTimestampMs
        : input.previousState.backwardConfirmationTimestampMs,
    ...rotationWindowState,
    ...movementGuardState,
    timestampMs: input.nowMs,
    x: input.previousState.x + Math.cos(headingRadians) * distancePixels,
    y: input.previousState.y + Math.sin(headingRadians) * distancePixels,
  };

  const latencyMs = calculateLatencyMs(batch.acceptedSamples, input.nowMs);

  return {
    acceptedSampleCount: batch.acceptedSamples.length,
    diagnostics: {
      batch: {
        acceptedSampleCount: batch.acceptedSamples.length,
        batchWindowMs: config.batchWindowMs,
        droppedSampleCount: batch.droppedSampleCount,
        maxBatchAgeMs: config.maxBatchAgeMs,
        maxSamplesPerBatch: config.maxSamplesPerBatch,
        rawSampleCount: input.samples.length,
        sampleEndTimestampMs:
          batch.acceptedSamples[batch.acceptedSamples.length - 1]?.timestampMs ??
          null,
        sampleStartTimestampMs: batch.acceptedSamples[0]?.timestampMs ?? null,
      },
      configSnapshot: config,
      heading: {
        desiredHeadingDegrees: input.desiredHeadingDegrees,
        observedHeadingDegrees,
        previousHeadingDegrees: input.previousState.headingDegrees,
        topCandidate: headingCandidates[0] ?? null,
      },
      latencyMs,
      movement: {
        blockedReason: movementBlockedReason,
        direction: movementDirection,
        distancePixels: Number(distancePixels.toFixed(3)),
        headingDegrees: movementHeading,
        movedStepCount: distancePixels > 0 ? stepCount : 0,
        pixelsPerMeter: Number(pixelsPerMeter.toFixed(3)),
        stepLengthMeters: config.stepLengthMeters,
      },
      step: stepDiagnostic,
    },
    droppedSampleCount: batch.droppedSampleCount,
    estimate: {
      confidence: calculateConfidence(batch.acceptedSamples.length, headingCandidates[0]?.score ?? 0),
      headingDegrees: observedHeadingDegrees,
      source: 'pdr-summary',
      timestampMs: input.nowMs,
      x: nextState.x,
      y: nextState.y,
    },
    headingCandidates,
    latencyMs,
    nextState,
  };
}

function calculateConfidence(sampleCount: number, headingScore: number) {
  const sampleConfidence = Math.min(1, sampleCount / 6);
  return Number((sampleConfidence * 0.35 + headingScore * 0.65).toFixed(3));
}

function createNextRotationWindowState(input: {
  config: PdrPipelineConfig;
  nowMs: number;
  observedHeadingDegrees: number;
  previousState: PdrPipelineState;
}) {
  const previousSnapshots = input.previousState.rotationHeadingSnapshots ?? [];
  const snapshots = [
    ...previousSnapshots,
    {
      headingDegrees: input.observedHeadingDegrees,
      timestampMs: input.nowMs,
    },
  ].filter(
    (snapshot) =>
      input.nowMs - snapshot.timestampMs <= input.config.rotationOnlyWindowMs,
  );

  return {
    rotationHeadingSnapshots: snapshots,
    rotationHeadingTravelDegrees: calculateHeadingTravelDegrees(snapshots),
  };
}

function calculateHeadingTravelDegrees(
  snapshots: NonNullable<PdrPipelineState['rotationHeadingSnapshots']>,
) {
  let travelDegrees = 0;

  for (let index = 1; index < snapshots.length; index += 1) {
    const previousSnapshot = snapshots[index - 1];
    const snapshot = snapshots[index];
    if (!previousSnapshot || !snapshot) {
      continue;
    }

    travelDegrees += shortestAngleDistanceDegrees(
      snapshot.headingDegrees,
      previousSnapshot.headingDegrees,
    );
  }

  return Number(travelDegrees.toFixed(3));
}

function applyPhoneRotationGate(input: {
  config: PdrPipelineConfig;
  rotationHeadingTravelDegrees: number;
  stepDiagnostic: StepDetectionDiagnostic;
}): StepDetectionDiagnostic {
  if (
    input.stepDiagnostic.rejectReason !== 'ACCEPTED' ||
    input.rotationHeadingTravelDegrees <
      input.config.rotationOnlyHeadingTravelDegrees ||
    input.stepDiagnostic.averageAcceleration >
      input.config.rotationOnlyMaxAverageAcceleration
  ) {
    return {
      ...input.stepDiagnostic,
      rotationHeadingTravelDegrees: input.rotationHeadingTravelDegrees,
    };
  }

  return {
    ...input.stepDiagnostic,
    rejectReason: 'PHONE_ROTATION',
    rotationHeadingTravelDegrees: input.rotationHeadingTravelDegrees,
    stepCount: 0,
  };
}

function getMovementBlockedReason(input: {
  config: PdrPipelineConfig;
  guardState: {
    shakeCooldownUntilMs?: number;
    turnInPlaceUntilMs?: number;
  };
  movementDirection: ReturnType<typeof getRouteMovementDirection>;
  nowMs: number;
  previousState: PdrPipelineState;
  stepDiagnostic: ReturnType<typeof analyzeStepDetection>;
}):
  | 'backward-confirming'
  | 'backward-weak-step'
  | 'heading'
  | 'shake-cooldown'
  | 'startup-lock'
  | 'turning-in-place'
  | null {
  if (input.stepDiagnostic.stepCount === 0) {
    return null;
  }

  if (
    input.previousState.startedAtMs !== undefined &&
    input.nowMs - input.previousState.startedAtMs <
      input.config.startupMovementLockMs
  ) {
    return 'startup-lock';
  }

  if (
    input.guardState.shakeCooldownUntilMs !== undefined &&
    input.nowMs < input.guardState.shakeCooldownUntilMs
  ) {
    return 'shake-cooldown';
  }

  if (
    input.guardState.turnInPlaceUntilMs !== undefined &&
    input.nowMs < input.guardState.turnInPlaceUntilMs
  ) {
    return 'turning-in-place';
  }

  if (input.movementDirection === 'blocked') {
    return 'heading';
  }

  if (
    input.movementDirection === 'backward' &&
    input.stepDiagnostic.peakAcceleration <
      input.config.backwardMovementPeakThreshold
  ) {
    return 'backward-weak-step';
  }

  if (
    input.movementDirection === 'backward' &&
    !hasRecentBackwardConfirmation({
      config: input.config,
      peakTimestampMs: input.stepDiagnostic.peakTimestampMs,
      previousBackwardConfirmationTimestampMs:
        input.previousState.backwardConfirmationTimestampMs,
    })
  ) {
    return 'backward-confirming';
  }

  return null;
}

function createNextMovementGuardState(input: {
  config: PdrPipelineConfig;
  movementDirection: ReturnType<typeof getRouteMovementDirection>;
  nowMs: number;
  observedHeadingDegrees: number;
  previousState: PdrPipelineState;
  stepDiagnostic: ReturnType<typeof analyzeStepDetection>;
}) {
  const activeCooldownUntilMs =
    input.previousState.shakeCooldownUntilMs !== undefined &&
    input.nowMs < input.previousState.shakeCooldownUntilMs
      ? input.previousState.shakeCooldownUntilMs
      : undefined;
  let shakeCooldownUntilMs = activeCooldownUntilMs;
  let shakeSpikeCount = input.previousState.shakeSpikeCount ?? 0;
  let shakeWindowStartedAtMs = input.previousState.shakeWindowStartedAtMs;
  let turnInPlaceUntilMs =
    input.previousState.turnInPlaceUntilMs !== undefined &&
    input.nowMs < input.previousState.turnInPlaceUntilMs
      ? input.previousState.turnInPlaceUntilMs
      : undefined;

  if (
    shakeWindowStartedAtMs !== undefined &&
    input.nowMs - shakeWindowStartedAtMs > input.config.shakeCooldownWindowMs
  ) {
    shakeSpikeCount = 0;
    shakeWindowStartedAtMs = undefined;
  }

  if (
    input.stepDiagnostic.rejectReason === 'SHAKE_TOO_HIGH' &&
    input.stepDiagnostic.peakTimestampMs !== null
  ) {
    if (
      shakeWindowStartedAtMs === undefined ||
      input.stepDiagnostic.peakTimestampMs - shakeWindowStartedAtMs >
        input.config.shakeCooldownWindowMs
    ) {
      shakeWindowStartedAtMs = input.stepDiagnostic.peakTimestampMs;
      shakeSpikeCount = 1;
    } else {
      shakeSpikeCount += 1;
    }

    if (shakeSpikeCount >= input.config.shakeCooldownTriggerCount) {
      shakeCooldownUntilMs = Math.max(
        shakeCooldownUntilMs ?? 0,
        input.stepDiagnostic.peakTimestampMs + input.config.shakeCooldownMs,
      );
      shakeWindowStartedAtMs = input.stepDiagnostic.peakTimestampMs;
      shakeSpikeCount = 0;
    }
  }

  if (
    input.movementDirection !== 'backward' &&
    input.stepDiagnostic.stepCount > 0 &&
    shortestAngleDistanceDegrees(
      input.observedHeadingDegrees,
      input.previousState.headingDegrees,
    ) >= input.config.turnInPlaceHeadingDeltaDegrees
  ) {
    turnInPlaceUntilMs = Math.max(
      turnInPlaceUntilMs ?? 0,
      input.nowMs + input.config.turnInPlaceCooldownMs,
    );
  }

  return {
    shakeCooldownUntilMs,
    shakeSpikeCount,
    shakeWindowStartedAtMs,
    turnInPlaceUntilMs,
  };
}

function shouldStoreBackwardConfirmation(input: {
  config: PdrPipelineConfig;
  movementDirection: ReturnType<typeof getRouteMovementDirection>;
  stepDiagnostic: ReturnType<typeof analyzeStepDetection>;
}) {
  return (
    input.stepDiagnostic.stepCount > 0 &&
    input.movementDirection === 'backward' &&
    input.stepDiagnostic.peakAcceleration >=
      input.config.backwardMovementPeakThreshold
  );
}

function hasRecentBackwardConfirmation(input: {
  config: PdrPipelineConfig;
  peakTimestampMs: number | null;
  previousBackwardConfirmationTimestampMs?: number;
}) {
  if (
    input.peakTimestampMs === null ||
    input.previousBackwardConfirmationTimestampMs === undefined
  ) {
    return false;
  }

  return (
    input.peakTimestampMs - input.previousBackwardConfirmationTimestampMs <=
    input.config.backwardConfirmationWindowMs
  );
}

function calculateLatencyMs(
  samples: readonly MotionInputSample[],
  nowMs: number,
) {
  const newestSample = samples[samples.length - 1];
  return newestSample ? nowMs - newestSample.timestampMs : 0;
}
