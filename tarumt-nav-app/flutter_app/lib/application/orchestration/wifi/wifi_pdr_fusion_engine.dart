import 'dart:math' as math;

import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

enum WifiCorrectionKind { smooth, teleport }

enum WifiCorrectionDisposition { apply, noOpConsistent, deferBackward }

enum WifiCorrectionVisualPhase { recalculating, routeReady }

final class WifiPdrFusionConfig {
  const WifiPdrFusionConfig({this.teleportThresholdMeters = 2})
    : assert(teleportThresholdMeters >= 0);

  final double teleportThresholdMeters;
}

final class WifiCorrectionDecision {
  const WifiCorrectionDecision({
    required this.disposition,
    required this.driftMeters,
    required this.fix,
    required this.kind,
  });

  final WifiCorrectionDisposition disposition;
  final double driftMeters;
  final WifiPositionFix fix;
  final WifiCorrectionKind kind;

  bool get shouldApply => disposition == WifiCorrectionDisposition.apply;
}

/// Classifies an authoritative, mapped Wi-Fi fix before it rebases PDR.
///
/// Mapping validation happens in [WifiPositioningEngine]. Every fix that
/// reaches this engine is therefore accepted immediately. The correction kind
/// controls only the visual transition; it never delays or rejects the fix.
final class WifiPdrFusionEngine {
  WifiPdrFusionEngine({this.config = const WifiPdrFusionConfig()});

  final WifiPdrFusionConfig config;

  WifiCorrectionDecision evaluate({
    required WifiPositionFix fix,
    required RoutePosition currentPosition,
    required double pixelsPerMeter,
    List<OverlayRouteNode> routePath = const <OverlayRouteNode>[],
    required OverlayRouteNode trustedNode,
    bool wrongWayDetected = false,
  }) {
    final driftPixels = _distance(
      currentPosition.screenX,
      currentPosition.screenY,
      trustedNode.screenX,
      trustedNode.screenY,
    );
    final driftMeters = pixelsPerMeter > 0
        ? driftPixels / pixelsPerMeter
        : double.infinity;
    final kind = driftMeters > config.teleportThresholdMeters
        ? WifiCorrectionKind.teleport
        : WifiCorrectionKind.smooth;
    return WifiCorrectionDecision(
      disposition: _resolveDisposition(
        currentPosition: currentPosition,
        routePath: routePath,
        trustedNode: trustedNode,
        wrongWayDetected: wrongWayDetected,
      ),
      driftMeters: driftMeters,
      fix: fix,
      kind: kind,
    );
  }
}

WifiCorrectionDisposition _resolveDisposition({
  required RoutePosition currentPosition,
  required List<OverlayRouteNode> routePath,
  required OverlayRouteNode trustedNode,
  required bool wrongWayDetected,
}) {
  if (wrongWayDetected || routePath.length < 2) {
    return WifiCorrectionDisposition.apply;
  }
  final fixIndex = routePath.indexWhere(
    (node) => node.nodeId == trustedNode.nodeId,
  );
  if (fixIndex < 0) {
    return WifiCorrectionDisposition.apply;
  }
  final currentSegmentIndex = currentPosition.segmentIndex.clamp(
    0,
    routePath.length - 2,
  );
  if (fixIndex < currentSegmentIndex) {
    return WifiCorrectionDisposition.deferBackward;
  }
  if (fixIndex == currentSegmentIndex) {
    return WifiCorrectionDisposition.noOpConsistent;
  }
  return WifiCorrectionDisposition.apply;
}

final class WifiCorrectionVisualState {
  const WifiCorrectionVisualState({
    required this.fromPosition,
    required this.kind,
    required this.phase,
    required this.recalculatesRoute,
    required this.sequence,
    required this.toPosition,
  });

  final RoutePosition fromPosition;
  final WifiCorrectionKind kind;
  final WifiCorrectionVisualPhase phase;
  final bool recalculatesRoute;
  final int sequence;
  final RoutePosition toPosition;
}

double _distance(double fromX, double fromY, double toX, double toY) {
  final deltaX = toX - fromX;
  final deltaY = toY - fromY;
  return math.sqrt(deltaX * deltaX + deltaY * deltaY);
}
