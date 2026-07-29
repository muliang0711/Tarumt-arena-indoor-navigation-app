import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/domain/traffic/route_traffic.dart';

abstract final class RouteTrafficColors {
  static const clear = Color(0xFF2563EB);
  static const moderate = Color(0xFFFACC15);
  static const busy = Color(0xFFF97316);
  static const congested = Color(0xFFDC2626);

  static Color forLevel(RouteTrafficLevel level) => switch (level) {
    RouteTrafficLevel.clear => clear,
    RouteTrafficLevel.moderate => moderate,
    RouteTrafficLevel.busy => busy,
    RouteTrafficLevel.congested => congested,
  };
}

final class MapPathSegment extends StatelessWidget {
  const MapPathSegment({
    this.color = RouteTrafficColors.clear,
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
