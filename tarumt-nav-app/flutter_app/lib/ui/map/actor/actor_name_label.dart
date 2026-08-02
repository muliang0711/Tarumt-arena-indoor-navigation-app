import 'package:flutter/material.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

final class ActorNameLabel extends StatelessWidget {
  const ActorNameLabel({required this.displayName, super.key});

  final String displayName;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 112),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: CampusNavigatorColors.card.withValues(alpha: 0.94),
            border: Border.all(
              color: CampusNavigatorColors.border.withValues(alpha: 0.92),
            ),
            borderRadius: BorderRadius.circular(8),
            boxShadow: const [
              BoxShadow(
                color: Color(0x330F172A),
                blurRadius: 4,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            child: Text(
              displayName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: CampusNavigatorColors.text,
                fontSize: 10,
                fontWeight: FontWeight.w800,
                height: 1.1,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
