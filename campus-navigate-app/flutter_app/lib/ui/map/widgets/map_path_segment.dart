import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

final class MapPathSegment extends StatelessWidget {
  const MapPathSegment({
    this.color = const Color.fromRGBO(37, 99, 235, 0.62),
    required this.segment,
    super.key,
  });

  static const thickness = 4.0;

  final Color color;
  final OverlayPathSegment segment;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: segment.x,
      top: segment.y - thickness / 2,
      child: Transform.rotate(
        alignment: Alignment.centerLeft,
        angle: segment.rotationDegrees * math.pi / 180,
        child: SizedBox(
          height: thickness,
          width: segment.length,
          child: ColoredBox(color: color),
        ),
      ),
    );
  }
}
