import 'package:flutter/material.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class NavigationExitBarKeys {
  static const bar = ValueKey<String>('navigation-exit.bar');
  static const button = ValueKey<String>('navigation-exit.button');
}

final class NavigationExitBar extends StatelessWidget {
  const NavigationExitBar({
    required this.isEnding,
    required this.onExit,
    super.key,
  });

  final bool isEnding;
  final VoidCallback onExit;

  @override
  Widget build(BuildContext context) {
    return Material(
      key: NavigationExitBarKeys.bar,
      color: CampusNavigatorColors.card,
      elevation: 8,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: FilledButton.icon(
          key: NavigationExitBarKeys.button,
          onPressed: isEnding ? null : onExit,
          icon: isEnding
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.close_rounded),
          label: Text(isEnding ? 'Ending navigation…' : 'Exit navigation'),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFB42318),
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(48),
          ),
        ),
      ),
    );
  }
}
