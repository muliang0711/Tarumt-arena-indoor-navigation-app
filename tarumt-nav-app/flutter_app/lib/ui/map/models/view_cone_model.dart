import 'dart:math' as math;

import 'package:indoor_navigation/ui/map/models/actor_models.dart';

ViewConeGeometry createViewConeGeometry({
  required double fieldOfViewDegrees,
  required double length,
}) {
  final safeLength = math.max(1.0, length);
  final safeFieldOfView = math.min(179.0, math.max(1.0, fieldOfViewDegrees));
  final center = safeLength;
  final halfAngleRadians = safeFieldOfView / 2 * math.pi / 180;
  final startX = center + safeLength * math.cos(-halfAngleRadians);
  final startY = center + safeLength * math.sin(-halfAngleRadians);
  final endX = center + safeLength * math.cos(halfAngleRadians);
  final endY = center + safeLength * math.sin(halfAngleRadians);

  return ViewConeGeometry(
    path: <String>[
      'M ${_formatCoordinate(center)} ${_formatCoordinate(center)}',
      'L ${_formatCoordinate(startX)} ${_formatCoordinate(startY)}',
      'A ${_formatCoordinate(safeLength)} ${_formatCoordinate(safeLength)} 0 0 1',
      '${_formatCoordinate(endX)} ${_formatCoordinate(endY)}',
      'Z',
    ].join(' '),
    size: safeLength * 2,
  );
}

String _formatCoordinate(double value) {
  final rounded = double.parse(value.toStringAsFixed(3));
  if (rounded == rounded.truncateToDouble()) {
    return rounded.toInt().toString();
  }
  return rounded.toString();
}
