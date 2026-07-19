import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

final class MapRoomLabel extends StatelessWidget {
  const MapRoomLabel({required this.label, super.key});

  final OverlayRoomLabel label;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: label.screenX,
      top: label.screenY,
      child: Container(
        constraints: BoxConstraints(minWidth: math.max(label.width, 48)),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.82),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          label.name,
          maxLines: 1,
          overflow: TextOverflow.clip,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFF111827),
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}
