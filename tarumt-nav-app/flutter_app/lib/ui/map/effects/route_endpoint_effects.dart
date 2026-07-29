import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/map/models/destination_beacon_model.dart';
import 'package:indoor_navigation/ui/map/widgets/animated_map_marker.dart';

abstract final class RouteEndpointEffectKeys {
  static const start = ValueKey<String>('route-endpoint.start');
  static const destination = ValueKey<String>('route-endpoint.destination');
}

final class RouteStartMarker extends StatelessWidget {
  const RouteStartMarker({required this.position, super.key});

  final OverlayRouteNode position;

  @override
  Widget build(BuildContext context) {
    const size = 62.0;
    return AnimatedMapMarker(
      anchorX: size / 2,
      anchorY: size / 2,
      headingDegrees: 0,
      rotateWithHeading: false,
      screenX: position.screenX,
      screenY: position.screenY,
      child: Semantics(
        label: 'Route start point',
        child: const SizedBox(
          key: RouteEndpointEffectKeys.start,
          height: size,
          width: size,
          child: CustomPaint(painter: RouteStartMarkerPainter()),
        ),
      ),
    );
  }
}

final class DestinationBeacon extends StatefulWidget {
  const DestinationBeacon({
    required this.phase,
    required this.position,
    super.key,
  });

  final DestinationBeaconPhase phase;
  final OverlayRouteNode position;

  @override
  State<DestinationBeacon> createState() => _DestinationBeaconState();
}

final class _DestinationBeaconState extends State<DestinationBeacon>
    with TickerProviderStateMixin {
  late final AnimationController _arrivalController;
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: destinationBeaconPulseDuration(widget.phase),
      vsync: this,
    )..repeat();
    _arrivalController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    if (widget.phase == DestinationBeaconPhase.arrived) {
      _arrivalController.forward(from: 0);
    }
  }

  @override
  void didUpdateWidget(covariant DestinationBeacon oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.phase != widget.phase) {
      _pulseController
        ..duration = destinationBeaconPulseDuration(widget.phase)
        ..repeat();
    }
    if (oldWidget.phase != DestinationBeaconPhase.arrived &&
        widget.phase == DestinationBeaconPhase.arrived) {
      _arrivalController.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _arrivalController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const width = 138.0;
    const height = 164.0;
    const floorCenterY = 126.0;
    return AnimatedMapMarker(
      anchorX: width / 2,
      anchorY: floorCenterY,
      headingDegrees: 0,
      rotateWithHeading: false,
      screenX: widget.position.screenX,
      screenY: widget.position.screenY,
      child: Semantics(
        label: widget.phase == DestinationBeaconPhase.arrived
            ? 'Destination reached'
            : 'Destination beacon',
        child: SizedBox(
          key: RouteEndpointEffectKeys.destination,
          height: height,
          width: width,
          child: AnimatedBuilder(
            animation: Listenable.merge([_pulseController, _arrivalController]),
            builder: (context, child) {
              return CustomPaint(
                painter: DestinationBeaconPainter(
                  arrivalProgress: _arrivalController.value,
                  phase: widget.phase,
                  pulseProgress: _pulseController.value,
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

final class RouteStartMarkerPainter extends CustomPainter {
  const RouteStartMarkerPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    canvas
      ..drawOval(
        Rect.fromCenter(center: center, width: 48, height: 24),
        Paint()
          ..color = const Color(0xFF2563EB).withValues(alpha: 0.14)
          ..style = PaintingStyle.fill,
      )
      ..drawOval(
        Rect.fromCenter(center: center, width: 48, height: 24),
        Paint()
          ..color = const Color(0xFF2563EB)
          ..strokeWidth = 3
          ..style = PaintingStyle.stroke,
      )
      ..drawCircle(center, 6, Paint()..color = const Color(0xFFF8FAFC))
      ..drawCircle(center, 3.5, Paint()..color = const Color(0xFF2563EB));
  }

  @override
  bool shouldRepaint(covariant RouteStartMarkerPainter oldDelegate) => false;
}

final class DestinationBeaconPainter extends CustomPainter {
  const DestinationBeaconPainter({
    required this.arrivalProgress,
    required this.phase,
    required this.pulseProgress,
  });

  final double arrivalProgress;
  final DestinationBeaconPhase phase;
  final double pulseProgress;

  @override
  void paint(Canvas canvas, Size size) {
    const accent = Color(0xFFEE8B35);
    const bright = Color(0xFFFFC15C);
    final nearBoost = phase == DestinationBeaconPhase.near ? 1.18 : 1.0;
    final pulse = (0.5 - 0.5 * math.cos(pulseProgress * math.pi * 2));
    final center = Offset(size.width / 2, 126);
    final beamTop = 26.0 + 5 * pulse;
    final beamRect = Rect.fromLTRB(
      center.dx - 24 * nearBoost,
      beamTop,
      center.dx + 24 * nearBoost,
      center.dy,
    );
    canvas.drawRect(
      beamRect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            bright.withValues(alpha: 0),
            bright.withValues(alpha: 0.08 + 0.08 * pulse),
            accent.withValues(alpha: 0.26 + 0.12 * pulse),
          ],
        ).createShader(beamRect),
    );

    final outerWidth = 68.0 + 12 * pulse * nearBoost;
    final outerHeight = 30.0 + 5 * pulse * nearBoost;
    canvas
      ..drawOval(
        Rect.fromCenter(center: center, width: outerWidth, height: outerHeight),
        Paint()
          ..color = accent.withValues(alpha: 0.12 + 0.08 * pulse)
          ..style = PaintingStyle.fill,
      )
      ..drawOval(
        Rect.fromCenter(center: center, width: 58, height: 25),
        Paint()
          ..color = accent.withValues(alpha: 0.95)
          ..strokeWidth = phase == DestinationBeaconPhase.near ? 4 : 3
          ..style = PaintingStyle.stroke,
      )
      ..drawOval(
        Rect.fromCenter(center: center, width: 34, height: 14),
        Paint()
          ..color = bright.withValues(alpha: 0.72)
          ..strokeWidth = 2
          ..style = PaintingStyle.stroke,
      );

    final diamondCenter = Offset(center.dx, 40 - 6 * pulse);
    final diamondSize = phase == DestinationBeaconPhase.near ? 15.0 : 13.0;
    final diamond = Path()
      ..moveTo(diamondCenter.dx, diamondCenter.dy - diamondSize)
      ..lineTo(diamondCenter.dx + diamondSize, diamondCenter.dy)
      ..lineTo(diamondCenter.dx, diamondCenter.dy + diamondSize)
      ..lineTo(diamondCenter.dx - diamondSize, diamondCenter.dy)
      ..close();
    canvas
      ..drawShadow(diamond, const Color(0xFF5A2D0C), 6, false)
      ..drawPath(diamond, Paint()..color = bright)
      ..drawPath(
        diamond,
        Paint()
          ..color = accent
          ..strokeWidth = 3
          ..style = PaintingStyle.stroke,
      );

    for (var index = 0; index < 6; index++) {
      final progress = (pulseProgress + index / 6) % 1;
      final angle = index * math.pi * 2 / 6;
      final particle = Offset(
        center.dx + math.cos(angle) * (25 + 6 * progress),
        center.dy - 12 - progress * 78,
      );
      canvas.drawRect(
        Rect.fromCenter(center: particle, width: 4, height: 4),
        Paint()..color = bright.withValues(alpha: 1 - progress),
      );
    }

    if (arrivalProgress > 0 && arrivalProgress < 1) {
      final burstRadius = 18 + 62 * Curves.easeOut.transform(arrivalProgress);
      final fade = 1 - arrivalProgress;
      canvas.drawOval(
        Rect.fromCenter(
          center: center,
          width: burstRadius * 2,
          height: burstRadius,
        ),
        Paint()
          ..color = bright.withValues(alpha: fade)
          ..strokeWidth = 4 * fade + 1
          ..style = PaintingStyle.stroke,
      );
      for (var index = 0; index < 10; index++) {
        final angle = index * math.pi * 2 / 10;
        final particle =
            center +
            Offset(math.cos(angle), math.sin(angle) * 0.55) * burstRadius;
        canvas.drawCircle(
          particle,
          4 * fade + 1,
          Paint()..color = bright.withValues(alpha: fade),
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant DestinationBeaconPainter oldDelegate) {
    return oldDelegate.arrivalProgress != arrivalProgress ||
        oldDelegate.phase != phase ||
        oldDelegate.pulseProgress != pulseProgress;
  }
}
