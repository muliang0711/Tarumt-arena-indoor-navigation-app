import 'dart:math' as math;

import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

enum WifiCorrectionKind { smooth, teleport }

enum WifiCorrectionDecisionStatus { accepted, pendingConfirmation }

final class WifiPdrFusionConfig {
  const WifiPdrFusionConfig({
    this.confirmationWindowMs = 15000,
    this.teleportThresholdMeters = 2,
  }) : assert(confirmationWindowMs > 0),
       assert(teleportThresholdMeters >= 0);

  final int confirmationWindowMs;
  final double teleportThresholdMeters;
}

final class WifiCorrectionDecision {
  const WifiCorrectionDecision({
    required this.driftMeters,
    required this.fix,
    required this.kind,
    required this.status,
  });

  final double driftMeters;
  final WifiPositionFix fix;
  final WifiCorrectionKind kind;
  final WifiCorrectionDecisionStatus status;

  bool get isAccepted => status == WifiCorrectionDecisionStatus.accepted;
}

/// Applies confidence policy before an authoritative Wi-Fi fix can rebase PDR.
///
/// A nearby fix is accepted immediately. A teleport-sized fix, or any fix that
/// would finish navigation, must be repeated for the same node inside the
/// confirmation window. This prevents one noisy KNN result from moving the user
/// across the floor or ending an active session.
final class WifiPdrFusionEngine {
  WifiPdrFusionEngine({this.config = const WifiPdrFusionConfig()});

  final WifiPdrFusionConfig config;
  _PendingFix? _pending;

  bool get isAwaitingConfirmation => _pending != null;

  void reset() => _pending = null;

  WifiCorrectionDecision evaluate({
    required String destinationNodeId,
    required WifiPositionFix fix,
    required RoutePosition currentPosition,
    required double pixelsPerMeter,
    required OverlayRouteNode trustedNode,
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
    final requiresConfirmation =
        kind == WifiCorrectionKind.teleport ||
        fix.localNodeId == destinationNodeId;

    if (!requiresConfirmation) {
      _pending = null;
      return WifiCorrectionDecision(
        driftMeters: driftMeters,
        fix: fix,
        kind: kind,
        status: WifiCorrectionDecisionStatus.accepted,
      );
    }

    final pending = _pending;
    final repeatedInTime =
        pending != null &&
        pending.localNodeId == fix.localNodeId &&
        fix.observedAtMs >= pending.observedAtMs &&
        fix.observedAtMs - pending.observedAtMs <= config.confirmationWindowMs;
    if (repeatedInTime) {
      _pending = null;
      return WifiCorrectionDecision(
        driftMeters: driftMeters,
        fix: fix,
        kind: kind,
        status: WifiCorrectionDecisionStatus.accepted,
      );
    }

    _pending = _PendingFix(
      localNodeId: fix.localNodeId,
      observedAtMs: fix.observedAtMs,
    );
    return WifiCorrectionDecision(
      driftMeters: driftMeters,
      fix: fix,
      kind: kind,
      status: WifiCorrectionDecisionStatus.pendingConfirmation,
    );
  }
}

final class WifiCorrectionVisualState {
  const WifiCorrectionVisualState({
    required this.fromPosition,
    required this.kind,
    required this.sequence,
    required this.toPosition,
  });

  final RoutePosition fromPosition;
  final WifiCorrectionKind kind;
  final int sequence;
  final RoutePosition toPosition;
}

final class _PendingFix {
  const _PendingFix({required this.localNodeId, required this.observedAtMs});

  final String localNodeId;
  final int observedAtMs;
}

double _distance(double fromX, double fromY, double toX, double toY) {
  final deltaX = toX - fromX;
  final deltaY = toY - fromY;
  return math.sqrt(deltaX * deltaX + deltaY * deltaY);
}
