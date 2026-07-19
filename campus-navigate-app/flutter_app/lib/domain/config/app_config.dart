import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';
import 'package:indoor_navigation/domain/sensor_debug/sensor_debug_models.dart';

final class AppUiConfig {
  const AppUiConfig({
    required this.enableEdgeEditor,
    required this.showDerivedEstimatePanel,
    required this.showDeveloperHeader,
    required this.showDiagnosticMapOverlays,
    required this.showNavigationStatsPanel,
    required this.showSimulationControls,
  });

  final bool enableEdgeEditor;
  final bool showDerivedEstimatePanel;
  final bool showDeveloperHeader;
  final bool showDiagnosticMapOverlays;
  final bool showNavigationStatsPanel;
  final bool showSimulationControls;

  bool get hasNavigationDebugPanels =>
      showDerivedEstimatePanel ||
      showNavigationStatsPanel ||
      showSimulationControls;
}

const productionAppUiConfig = AppUiConfig(
  enableEdgeEditor: false,
  showDerivedEstimatePanel: false,
  showDeveloperHeader: false,
  showDiagnosticMapOverlays: false,
  showNavigationStatsPanel: false,
  showSimulationControls: false,
);

const developerAppUiConfig = AppUiConfig(
  enableEdgeEditor: true,
  showDerivedEstimatePanel: true,
  showDeveloperHeader: true,
  showDiagnosticMapOverlays: true,
  showNavigationStatsPanel: true,
  showSimulationControls: true,
);

const defaultPdrPipelineConfig = PdrPipelineConfig(
  accelerationStepThreshold: 1.7,
  backwardConfirmationWindowMs: 1200,
  backwardMovementPeakThreshold: 1.8,
  batchWindowMs: 180,
  maxShakeAccelerationMagnitude: 5.5,
  maxBatchAgeMs: 200,
  maxSamplesPerBatch: 32,
  minStepIntervalMs: 300,
  movementHeadingToleranceDegrees: 80,
  fallbackPixelsPerMeter: 56,
  rotationOnlyHeadingTravelDegrees: 15,
  rotationOnlyMaxAverageAcceleration: 1.45,
  rotationOnlyWindowMs: 1000,
  shakeCooldownMs: 1200,
  shakeCooldownTriggerCount: 2,
  shakeCooldownWindowMs: 1000,
  stillnessAccelerationMagnitude: 1,
  startupMovementLockMs: 2000,
  stepLengthMeters: 0.5,
  turnInPlaceCooldownMs: 700,
  turnInPlaceHeadingDeltaDegrees: 35,
);

const navigationInputPolicy = NavigationInputPolicy(
  maxDerivedUpdatesPerSecond: 15,
  maxRawSamplesInMemory: 32,
);

const rawMotionConsumerConfig = RawMotionConsumerConfig(
  flushIntervalMs: 60,
  headingUpdateIntervalMs: 50,
  sensorUpdateIntervalMs: 30,
);

const wifiPositioningIntervalMs = 5000;
const wifiPositioningMaxReadingAgeMs = 8000;

const wrongWayCheckIntervalMs = 1000;
const wrongWayOppositeHeadingDurationMs = 1000;

const defaultWrongWayRerouteConfig = WrongWayRerouteConfig(
  allowedHeadingDeviationDegrees: 90,
  confidenceThreshold: 0.65,
  expectedHeadingRoundDegrees: 90,
  junctionCaptureRadiusPixels: 36,
  junctionNodeType: 'junctions',
  minimumOppositeHeadingDurationMs: wrongWayOppositeHeadingDurationMs,
  wrongWayCheckIntervalMs: wrongWayCheckIntervalMs,
);

final class RouteTurnGateConfig {
  const RouteTurnGateConfig({
    this.headingToleranceDegrees = 35,
    this.turnApproachRadiusPixels = 112,
    this.turnCaptureRadiusPixels = 24,
  });

  final double headingToleranceDegrees;
  final double turnApproachRadiusPixels;
  final double turnCaptureRadiusPixels;
}

const defaultRouteTurnGateConfig = RouteTurnGateConfig();

final class DemoPngSize {
  const DemoPngSize({required this.height, required this.width});

  static const name = 'demo_1.png';
  final int height;
  final int width;
}

const demoPngSize = DemoPngSize(height: 2048, width: 1536);

const defaultNavigationStartNodeId = 'node-21';

const testRouteNodeIds = <String>[
  defaultNavigationStartNodeId,
  'node-20',
  'node-19',
  'node-18',
  'node-17',
  'node-16',
  'node-12',
  'node-13',
  'node-14',
  'node-15',
  'node-2',
  'node-1',
];
