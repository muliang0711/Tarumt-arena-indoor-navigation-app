import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/map/widgets/animated_map_marker.dart';

final class RedMarker extends StatelessWidget {
  const RedMarker({required this.marker, super.key});

  final RedMarkerState marker;

  @override
  Widget build(BuildContext context) {
    const size = 22.0;
    return AnimatedMapMarker(
      anchorX: size / 2,
      anchorY: size / 2,
      headingDegrees: marker.headingDegrees,
      screenX: marker.screenX,
      screenY: marker.screenY,
      child: Semantics(
        label: 'Estimated position',
        child: const SizedBox(
          height: size,
          width: size,
          child: CustomPaint(
            painter: _TriangleMarkerPainter(color: Color(0xFFDC2626)),
          ),
        ),
      ),
    );
  }
}

final class BlueMarker extends StatelessWidget {
  const BlueMarker({required this.position, super.key});

  final RoutePosition position;

  @override
  Widget build(BuildContext context) {
    const size = 24.0;
    return AnimatedMapMarker(
      anchorX: size / 2,
      anchorY: size / 2,
      headingDegrees: position.headingDegrees,
      screenX: position.screenX,
      screenY: position.screenY,
      child: Semantics(
        label: 'Current route position',
        child: const SizedBox(
          height: size,
          width: size,
          child: CustomPaint(
            painter: _TriangleMarkerPainter(color: Color(0xFF2563EB)),
          ),
        ),
      ),
    );
  }
}

final class _TriangleMarkerPainter extends CustomPainter {
  const _TriangleMarkerPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width, size.height / 2)
      ..lineTo(1, 1)
      ..lineTo(1, size.height - 1)
      ..close();
    canvas.drawShadow(path, const Color(0xFF111827), 4, false);
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _TriangleMarkerPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}
