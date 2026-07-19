import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/pdr/algorithms/algorithms.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

void main() {
  test('runs PDR summary under the real-time batch latency target', () {
    final result = runPdrPipeline(
      desiredHeadingDegrees: 0,
      nowMs: 1000,
      previousState: _previousState,
      samples: <MotionInputSample>[
        _sample(920, 7, 0.2),
        _sample(940, 8, 0.4),
        _sample(960, 10, 1.9),
        _sample(990, 12, 1.1),
      ],
    );

    expect(result.acceptedSampleCount, 4);
    expect(result.droppedSampleCount, 0);
    expect(result.latencyMs, 10);
    expect(result.latencyMs, lessThanOrEqualTo(100));
    expect(result.estimate.source.wireValue, 'pdr-summary');
    expect(result.estimate.headingDegrees.round(), 9);
    expect(result.estimate.x, 264);
    expect(result.estimate.y, 648);
    expect(result.diagnostics.step.rejectReason, StepRejectReason.accepted);
    expect(result.diagnostics.step.stepCount, 1);
    expect(
      result.diagnostics.movement.direction,
      RouteMovementDirection.forward,
    );
    expect(result.diagnostics.movement.movedStepCount, 1);
    expect(result.nextState.headingDegrees.round(), 9);
    expect(result.nextState.lastStepTimestampMs, 960);
  });

  test(
    'reports facing heading while route-ranked heading controls movement',
    () {
      final result = runPdrPipeline(
        desiredHeadingDegrees: 0,
        nowMs: 1000,
        previousState: _state(headingDegrees: 60),
        samples: <MotionInputSample>[
          _sample(920, 58, 0.2),
          _sample(940, 60, 0.4),
          _sample(960, 62, 1.9),
          _sample(990, 60, 1.1),
        ],
      );

      expect(result.estimate.headingDegrees.round(), 60);
      expect(result.nextState.headingDegrees.round(), 60);
      expect(
        result.headingCandidates.first.label,
        HeadingCandidateLabel.desired,
      );
      expect(result.estimate.x, 264);
      expect(result.estimate.y, 648);
    },
  );

  test('moves backward when facing opposite the route direction', () {
    final result = runPdrPipeline(
      desiredHeadingDegrees: 0,
      nowMs: 1000,
      previousState: _state(backwardConfirmationTimestampMs: 500),
      samples: _stepSamples(nowMs: 1000, headingDegrees: 180, peak: 1.9),
    );

    expect(result.estimate.headingDegrees.round(), 180);
    expect(
      result.diagnostics.movement.direction,
      RouteMovementDirection.backward,
    );
    expect(result.diagnostics.movement.movedStepCount, 1);
    expect(result.estimate.x, 208);
    expect(result.estimate.y, _previousState.y);
    expect(result.nextState.lastStepTimestampMs, 960);
  });

  test('locks movement during startup while de-duplicating the peak', () {
    final result = runPdrPipeline(
      desiredHeadingDegrees: 0,
      nowMs: 2000,
      previousState: _state(startedAtMs: 500),
      samples: _stepSamples(nowMs: 2000, headingDegrees: 0, peak: 2),
    );

    expect(result.diagnostics.step.rejectReason, StepRejectReason.accepted);
    expect(
      result.diagnostics.movement.blockedReason,
      MovementBlockedReason.startupLock,
    );
    expect(result.diagnostics.movement.movedStepCount, 0);
    expect(result.estimate.x, _previousState.x);
    expect(result.nextState.lastStepTimestampMs, 1960);
  });

  test('blocks weak backward steps', () {
    final result = runPdrPipeline(
      desiredHeadingDegrees: 0,
      nowMs: 4000,
      previousState: _state(startedAtMs: 0),
      samples: _stepSamples(nowMs: 4000, headingDegrees: 180, peak: 1.75),
    );

    expect(result.diagnostics.step.rejectReason, StepRejectReason.accepted);
    expect(
      result.diagnostics.movement.blockedReason,
      MovementBlockedReason.backwardWeakStep,
    );
    expect(result.estimate.x, _previousState.x);
    expect(result.nextState.lastStepTimestampMs, 3960);
  });

  test('requires two strong backward steps before movement', () {
    final first = runPdrPipeline(
      desiredHeadingDegrees: 0,
      nowMs: 4000,
      previousState: _state(startedAtMs: 0),
      samples: _stepSamples(nowMs: 4000, headingDegrees: 180, peak: 2.1),
    );
    final second = runPdrPipeline(
      desiredHeadingDegrees: 0,
      nowMs: 4600,
      previousState: first.nextState,
      samples: _stepSamples(nowMs: 4600, headingDegrees: 180, peak: 2.1),
    );

    expect(
      first.diagnostics.movement.blockedReason,
      MovementBlockedReason.backwardConfirming,
    );
    expect(first.diagnostics.movement.movedStepCount, 0);
    expect(second.diagnostics.movement.blockedReason, isNull);
    expect(second.diagnostics.movement.movedStepCount, 1);
    expect(second.estimate.x, 208);
  });

  test('blocks movement during cooldown after repeated shake spikes', () {
    final firstShake = runPdrPipeline(
      desiredHeadingDegrees: 0,
      nowMs: 1000,
      previousState: _state(startedAtMs: 0),
      samples: _shakeSamples(nowMs: 1000, peak: 6.2),
    );
    final secondShake = runPdrPipeline(
      desiredHeadingDegrees: 0,
      nowMs: 1400,
      previousState: firstShake.nextState,
      samples: _shakeSamples(nowMs: 1400, peak: 6.1),
    );
    final blockedStep = runPdrPipeline(
      desiredHeadingDegrees: 0,
      nowMs: 1800,
      previousState: secondShake.nextState,
      samples: _stepSamples(nowMs: 1800, headingDegrees: 0, peak: 2.1),
    );
    final afterCooldown = runPdrPipeline(
      desiredHeadingDegrees: 0,
      nowMs: 2800,
      previousState: blockedStep.nextState,
      samples: _stepSamples(nowMs: 2800, headingDegrees: 0, peak: 2.1),
    );

    expect(
      firstShake.diagnostics.step.rejectReason,
      StepRejectReason.shakeTooHigh,
    );
    expect(
      secondShake.diagnostics.step.rejectReason,
      StepRejectReason.shakeTooHigh,
    );
    expect(secondShake.nextState.shakeCooldownUntilMs, 2560);
    expect(
      blockedStep.diagnostics.movement.blockedReason,
      MovementBlockedReason.shakeCooldown,
    );
    expect(blockedStep.diagnostics.movement.movedStepCount, 0);
    expect(afterCooldown.diagnostics.movement.blockedReason, isNull);
    expect(afterCooldown.diagnostics.movement.movedStepCount, 1);
  });

  test('blocks movement briefly when the phone turns in place', () {
    final result = runPdrPipeline(
      desiredHeadingDegrees: 90,
      nowMs: 4000,
      previousState: _state(headingDegrees: 0, startedAtMs: 0),
      samples: _stepSamples(nowMs: 4000, headingDegrees: 90, peak: 2.1),
    );

    expect(result.diagnostics.step.rejectReason, StepRejectReason.accepted);
    expect(
      result.diagnostics.movement.blockedReason,
      MovementBlockedReason.turningInPlace,
    );
    expect(result.diagnostics.movement.movedStepCount, 0);
    expect(result.estimate.headingDegrees.round(), 90);
    expect(result.nextState.turnInPlaceUntilMs, 4700);
  });

  test('rejects accepted-looking steps caused by phone rotation', () {
    final result = runPdrPipeline(
      desiredHeadingDegrees: 210,
      nowMs: 4000,
      previousState: _state(
        headingDegrees: 204,
        rotationHeadingSnapshots: <PdrHeadingSnapshot>[
          const PdrHeadingSnapshot(headingDegrees: 190, timestampMs: 3400),
          const PdrHeadingSnapshot(headingDegrees: 204, timestampMs: 3700),
        ],
        rotationHeadingTravelDegrees: 14,
        startedAtMs: 0,
      ),
      samples: <MotionInputSample>[
        _sample(3920, 214, 0.5),
        _sample(3960, 214, 2.1),
        _sample(3990, 214, 1.1),
      ],
    );

    expect(
      result.diagnostics.step.rejectReason,
      StepRejectReason.phoneRotation,
    );
    expect(result.diagnostics.step.stepCount, 0);
    expect(result.diagnostics.step.rotationHeadingTravelDegrees, 24);
    expect(result.diagnostics.movement.movedStepCount, 0);
    expect(result.nextState.lastStepTimestampMs, isNull);
  });

  test('keeps walking turns when average acceleration is walking-like', () {
    final result = runPdrPipeline(
      desiredHeadingDegrees: 210,
      nowMs: 4000,
      previousState: _state(
        headingDegrees: 204,
        rotationHeadingSnapshots: <PdrHeadingSnapshot>[
          const PdrHeadingSnapshot(headingDegrees: 190, timestampMs: 3400),
          const PdrHeadingSnapshot(headingDegrees: 204, timestampMs: 3700),
        ],
        startedAtMs: 0,
      ),
      samples: <MotionInputSample>[
        _sample(3920, 214, 0.6),
        _sample(3960, 214, 3.4),
        _sample(3990, 214, 2),
      ],
    );

    expect(result.diagnostics.step.rejectReason, StepRejectReason.accepted);
    expect(result.diagnostics.step.rotationHeadingTravelDegrees, 24);
    expect(result.diagnostics.movement.blockedReason, isNull);
    expect(result.diagnostics.movement.movedStepCount, 1);
  });

  test('does not move with empty, stale, or future-only input', () {
    for (final samples in <List<MotionInputSample>>[
      <MotionInputSample>[],
      <MotionInputSample>[_sample(100, 45, 2)],
      <MotionInputSample>[_sample(1010, 45, 2)],
    ]) {
      final result = runPdrPipeline(
        desiredHeadingDegrees: 0,
        nowMs: 1000,
        previousState: _previousState,
        samples: samples,
      );

      expect(result.acceptedSampleCount, 0);
      expect(result.diagnostics.step.rejectReason, StepRejectReason.noSamples);
      expect(result.estimate.x, _previousState.x);
      expect(result.estimate.y, _previousState.y);
    }
  });

  test('sorts out-of-order input before step analysis', () {
    final result = runPdrPipeline(
      desiredHeadingDegrees: 0,
      nowMs: 1000,
      pixelsPerMeter: 20,
      previousState: _state(headingDegrees: 0),
      samples: <MotionInputSample>[_sample(950, 0, 1.9), _sample(900, 0, 0.2)],
    );

    expect(result.diagnostics.step.rejectReason, StepRejectReason.accepted);
    expect(result.diagnostics.batch.sampleStartTimestampMs, 900);
    expect(result.diagnostics.batch.sampleEndTimestampMs, 950);
    expect(result.diagnostics.movement.distancePixels, 10);
  });
}

final _previousState = PdrPipelineState(
  headingDegrees: 350,
  timestampMs: 900,
  x: 236,
  y: 648,
);

MotionInputSample _sample(
  int timestampMs,
  double headingDegrees,
  double magnitude,
) {
  return MotionInputSample(
    acceleration: MotionVector(x: magnitude, y: 0, z: 0),
    headingDegrees: headingDegrees,
    timestampMs: timestampMs,
  );
}

List<MotionInputSample> _stepSamples({
  required int nowMs,
  required double headingDegrees,
  required double peak,
}) {
  return <MotionInputSample>[
    _sample(nowMs - 80, headingDegrees, 0.2),
    _sample(nowMs - 60, headingDegrees, 0.4),
    _sample(nowMs - 40, headingDegrees, peak),
    _sample(nowMs - 10, headingDegrees, 0.8),
  ];
}

List<MotionInputSample> _shakeSamples({
  required int nowMs,
  required double peak,
}) {
  return <MotionInputSample>[
    _sample(nowMs - 80, 0, 0.3),
    _sample(nowMs - 40, 0, peak),
    _sample(nowMs - 10, 0, 0.5),
  ];
}

PdrPipelineState _state({
  int? backwardConfirmationTimestampMs,
  double? headingDegrees,
  List<PdrHeadingSnapshot>? rotationHeadingSnapshots,
  double? rotationHeadingTravelDegrees,
  int? startedAtMs,
}) {
  return PdrPipelineState(
    backwardConfirmationTimestampMs: backwardConfirmationTimestampMs,
    headingDegrees: headingDegrees ?? _previousState.headingDegrees,
    rotationHeadingSnapshots: rotationHeadingSnapshots,
    rotationHeadingTravelDegrees: rotationHeadingTravelDegrees,
    startedAtMs: startedAtMs,
    timestampMs: _previousState.timestampMs,
    x: _previousState.x,
    y: _previousState.y,
  );
}
