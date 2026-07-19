import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

final class MapRouteNode extends StatelessWidget {
  const MapRouteNode({
    required this.node,
    this.onPressed,
    this.selected = false,
    super.key,
  });

  final OverlayRouteNode node;
  final ValueChanged<OverlayRouteNode>? onPressed;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final dotSize = selected ? 12.0 : 8.0;
    return Positioned(
      left: node.screenX - dotSize / 2 - 10,
      top: node.screenY - dotSize / 2 - 10,
      child: Semantics(
        button: true,
        enabled: onPressed != null,
        excludeSemantics: true,
        label: 'Route node ${node.nodeId}',
        selected: selected,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onPressed == null ? null : () => onPressed!(node),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  height: dotSize,
                  width: dotSize,
                  decoration: BoxDecoration(
                    color: selected
                        ? const Color(0xFF0F766E)
                        : const Color(0xFFEF4444),
                    border: Border.all(
                      color: selected ? const Color(0xFFCCFBF1) : Colors.white,
                      width: selected ? 2 : 1,
                    ),
                    shape: BoxShape.circle,
                  ),
                ),
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0xFF111827).withValues(alpha: 0.72),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 3,
                      vertical: 1,
                    ),
                    child: Text(
                      node.nodeId,
                      maxLines: 1,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
