import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:indoor_navigation/ui/map/models/animated_marker_model.dart';

final class AnimatedMapMarker extends StatefulWidget {
  const AnimatedMapMarker({
    required this.anchorX,
    required this.anchorY,
    required this.child,
    required this.headingDegrees,
    this.rotateWithHeading = true,
    required this.screenX,
    required this.screenY,
    super.key,
  });

  final double anchorX;
  final double anchorY;
  final Widget child;
  final double headingDegrees;
  final bool rotateWithHeading;
  final double screenX;
  final double screenY;

  @override
  State<AnimatedMapMarker> createState() => _AnimatedMapMarkerState();
}

final class _AnimatedMapMarkerState extends State<AnimatedMapMarker>
    with TickerProviderStateMixin {
  late final AnimationController _headingController;
  late final AnimationController _positionController;
  late Animation<double> _animatedHeading;
  late Animation<double> _animatedLeft;
  late Animation<double> _animatedTop;
  late double _headingTarget;

  @override
  void initState() {
    super.initState();
    _positionController = AnimationController(vsync: this);
    _headingController = AnimationController(vsync: this);
    _animatedLeft = AlwaysStoppedAnimation(widget.screenX - widget.anchorX);
    _animatedTop = AlwaysStoppedAnimation(widget.screenY - widget.anchorY);
    _animatedHeading = AlwaysStoppedAnimation(widget.headingDegrees);
    _headingTarget = widget.headingDegrees;
  }

  @override
  void didUpdateWidget(covariant AnimatedMapMarker oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextLeft = widget.screenX - widget.anchorX;
    final nextTop = widget.screenY - widget.anchorY;
    final durationMs = calculateLinearCompensationDurationMs(
      currentLeft: _animatedLeft.value,
      currentTop: _animatedTop.value,
      nextLeft: nextLeft,
      nextTop: nextTop,
    );
    _animatedLeft = Tween<double>(
      begin: _animatedLeft.value,
      end: nextLeft,
    ).animate(_positionController);
    _animatedTop = Tween<double>(
      begin: _animatedTop.value,
      end: nextTop,
    ).animate(_positionController);
    _positionController
      ..duration = Duration(milliseconds: durationMs)
      ..forward(from: 0);

    final nextHeading = closestMarkerHeadingTarget(
      _headingTarget,
      widget.headingDegrees,
    );
    _headingTarget = nextHeading;
    _animatedHeading = Tween<double>(
      begin: _animatedHeading.value,
      end: nextHeading,
    ).animate(_headingController);
    _headingController
      ..duration = Duration(milliseconds: math.min(durationMs, 240))
      ..forward(from: 0);
  }

  @override
  void dispose() {
    _headingController.dispose();
    _positionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: IgnorePointer(
        child: AnimatedBuilder(
          animation: Listenable.merge([
            _positionController,
            _headingController,
          ]),
          child: widget.child,
          builder: (context, child) {
            return Align(
              alignment: Alignment.topLeft,
              child: Transform.translate(
                offset: Offset(_animatedLeft.value, _animatedTop.value),
                child: Transform.rotate(
                  angle: widget.rotateWithHeading
                      ? _animatedHeading.value * math.pi / 180
                      : 0,
                  child: child,
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
