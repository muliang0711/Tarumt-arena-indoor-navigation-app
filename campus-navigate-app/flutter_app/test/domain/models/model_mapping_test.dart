import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/navigation/navigation_models.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

void main() {
  test('preserves TypeScript string union wire values', () {
    expect(StepRejectReason.noSamples.wireValue, 'NO_SAMPLES');
    expect(RouteMovementDirection.backward.wireValue, 'backward');
    expect(
      RawMotionConsumerStatus.permissionDenied.wireValue,
      'permission-denied',
    );
    expect(
      WrongWayRerouteReason.legalOffRouteMovement.wireValue,
      'legal-off-route-movement',
    );
    expect(NavigationTurn.arrived.wireValue, 'arrived');
    expect(SimulationStatus.moving.wireValue, 'moving');
  });

  test('preserves authoritative configuration values', () {
    expect(defaultPdrPipelineConfig.accelerationStepThreshold, 1.7);
    expect(defaultPdrPipelineConfig.maxSamplesPerBatch, 32);
    expect(defaultPdrPipelineConfig.stepLengthMeters, 0.5);
    expect(navigationInputPolicy.maxDerivedUpdatesPerSecond, 15);
    expect(navigationInputPolicy.rawSensorRecordingEnabled, isFalse);
    expect(navigationInputPolicy.transientRawSensorBatchingEnabled, isTrue);
    expect(rawMotionConsumerConfig.sensorUpdateIntervalMs, 30);
    expect(wifiPositioningIntervalMs, 5000);
    expect(wifiPositioningMaxReadingAgeMs, 8000);
    expect(defaultWrongWayRerouteConfig.confidenceThreshold, 0.65);
    expect(defaultRouteTurnGateConfig.turnCaptureRadiusPixels, 24);
    expect(demoPngSize.width, 1536);
    expect(testRouteNodeIds.length, 12);
  });

  test('defensively freezes list-backed models', () {
    final samples = <PdrHeadingSnapshot>[
      const PdrHeadingSnapshot(headingDegrees: 90, timestampMs: 1),
    ];
    final state = PdrPipelineState(
      headingDegrees: 90,
      timestampMs: 1,
      x: 0,
      y: 0,
      rotationHeadingSnapshots: samples,
    );
    samples.clear();

    expect(state.rotationHeadingSnapshots, hasLength(1));
    expect(
      () => state.rotationHeadingSnapshots!.add(
        const PdrHeadingSnapshot(headingDegrees: 180, timestampMs: 2),
      ),
      throwsUnsupportedError,
    );
  });

  test('represents Tiled layer unions without dynamic', () {
    final TiledLayer layer = TiledTileLayer(
      id: 1,
      name: 'ground',
      data: const [1, 2],
    );

    expect(layer.layerType, 'tilelayer');
    expect((layer as TiledTileLayer).data, [1, 2]);
  });
}
