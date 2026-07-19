import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

const debugReplaySource = DerivedEstimateSource(
  kind: DerivedEstimateSourceKind.debugReplay,
  name: 'Debug replay derived estimate',
);

const _replayOffsets = <({double x, double y})>[
  (x: 28, y: 26),
  (x: 48, y: 22),
  (x: 68, y: 18),
  (x: 90, y: 14),
  (x: 112, y: 10),
];

DerivedNavigationEstimate createDebugReplayEstimate({
  required int nowMs,
  required RoutePosition routePosition,
  required int sequenceIndex,
}) {
  final remainder = sequenceIndex.remainder(_replayOffsets.length);
  final offset = remainder >= 0 && remainder < _replayOffsets.length
      ? _replayOffsets[remainder]
      : _replayOffsets.first;

  return DerivedNavigationEstimate(
    confidence: 0.76,
    headingDegrees: routePosition.headingDegrees,
    source: DerivedNavigationEstimateSource.debugReplay,
    timestampMs: nowMs,
    x: routePosition.screenX + offset.x,
    y: routePosition.screenY + offset.y,
  );
}
