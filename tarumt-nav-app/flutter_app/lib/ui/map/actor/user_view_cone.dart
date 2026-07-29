import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:indoor_navigation/ui/map/models/view_cone_model.dart';
import 'package:indoor_navigation/ui/map/models/view_heading_model.dart';

final class UserViewCone extends StatefulWidget {
  const UserViewCone({
    this.color = const Color(0xFF2563EB),
    this.fieldOfViewDegrees = 60,
    required this.headingDegrees,
    this.length = 96,
    super.key,
  });

  final Color color;
  final double fieldOfViewDegrees;
  final double headingDegrees;
  final double length;

  @override
  State<UserViewCone> createState() => _UserViewConeState();
}

final class _UserViewConeState extends State<UserViewCone>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late Animation<double> _heading;
  late double _headingTarget;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this);
    _heading = AlwaysStoppedAnimation(widget.headingDegrees);
    _headingTarget = widget.headingDegrees;
  }

  @override
  void didUpdateWidget(covariant UserViewCone oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextTarget = closestViewHeadingTarget(
      _headingTarget,
      widget.headingDegrees,
    );
    _headingTarget = nextTarget;
    _heading = Tween<double>(
      begin: _heading.value,
      end: nextTarget,
    ).animate(_controller);
    _controller
      ..duration = const Duration(milliseconds: 180)
      ..forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final geometry = createViewConeGeometry(
      fieldOfViewDegrees: widget.fieldOfViewDegrees,
      length: widget.length,
    );
    return SizedBox(
      height: geometry.size,
      width: geometry.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Transform.rotate(
            angle: _heading.value * math.pi / 180,
            child: child,
          );
        },
        child: CustomPaint(
          key: const ValueKey('user-view-cone-paint'),
          painter: ViewConePainter(
            color: widget.color,
            fieldOfViewDegrees: widget.fieldOfViewDegrees,
            length: widget.length,
          ),
        ),
      ),
    );
  }
}

final class ViewConePainter extends CustomPainter {
  const ViewConePainter({
    required this.color,
    required this.fieldOfViewDegrees,
    required this.length,
  });

  final Color color;
  final double fieldOfViewDegrees;
  final double length;

  @override
  void paint(Canvas canvas, Size size) {
    final safeLength = math.max(1.0, length);
    final safeFieldOfView = math.min(179.0, math.max(1.0, fieldOfViewDegrees));
    final center = Offset(safeLength, safeLength);
    final halfAngle = safeFieldOfView / 2 * math.pi / 180;
    final path = Path()
      ..moveTo(center.dx, center.dy)
      ..lineTo(
        center.dx + safeLength * math.cos(-halfAngle),
        center.dy + safeLength * math.sin(-halfAngle),
      )
      ..arcTo(
        Rect.fromCircle(center: center, radius: safeLength),
        -halfAngle,
        halfAngle * 2,
        false,
      )
      ..close();
    canvas
      ..drawPath(
        path,
        Paint()
          ..color = color.withValues(alpha: 0.16)
          ..style = PaintingStyle.fill,
      )
      ..drawPath(
        path,
        Paint()
          ..color = color.withValues(alpha: 0.42)
          ..strokeWidth = 2
          ..style = PaintingStyle.stroke,
      );
  }

  @override
  bool shouldRepaint(covariant ViewConePainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.fieldOfViewDegrees != fieldOfViewDegrees ||
        oldDelegate.length != length;
  }
}
