import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/navigation_ui_state.dart';
import 'package:indoor_navigation/domain/navigation/navigation_models.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

final class InstructionBar extends StatelessWidget {
  const InstructionBar({required this.navigation, super.key});

  static const barKey = ValueKey<String>('instruction-bar');
  static const glyphKey = ValueKey<String>('instruction-bar.glyph');
  static const primaryTextKey = ValueKey<String>('instruction-bar.primary');
  static const secondaryTextKey = ValueKey<String>('instruction-bar.secondary');

  final NavigationUiState navigation;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      bottom: 14,
      left: 14,
      right: 14,
      child: IgnorePointer(
        child: Semantics(
          container: true,
          excludeSemantics: true,
          label:
              '${formatNavigationInstruction(navigation.instruction)}, '
              '${navigation.currentSegment}',
          child: Container(
            key: barKey,
            constraints: const BoxConstraints(minHeight: 64),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF111827),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Container(
                  height: 42,
                  width: 42,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: IndoorNavigationColors.blue,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    glyphForNavigationInstruction(navigation.instruction),
                    key: glyphKey,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      height: 28 / 24,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        formatNavigationInstruction(navigation.instruction),
                        key: primaryTextKey,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        navigation.currentSegment,
                        key: secondaryTextKey,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFFCBD5E1),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
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

String glyphForNavigationInstruction(NavigationTurn instruction) {
  return switch (instruction) {
    NavigationTurn.left => '<',
    NavigationTurn.right => '>',
    NavigationTurn.arrived => 'OK',
    NavigationTurn.straight => '^',
  };
}
