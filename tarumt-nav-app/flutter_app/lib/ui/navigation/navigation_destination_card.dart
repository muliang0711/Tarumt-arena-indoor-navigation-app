import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class NavigationDestinationCardKeys {
  static const card = ValueKey<String>('navigation-destination.card');
  static const change = ValueKey<String>('navigation-destination.change');
}

final class NavigationDestinationCard extends StatelessWidget {
  const NavigationDestinationCard({
    required this.floor,
    required this.room,
    required this.routeDistanceMeters,
    this.onChangeDestination,
    super.key,
  });

  final CampusFloor floor;
  final VoidCallback? onChangeDestination;
  final CampusRoom room;
  final double routeDistanceMeters;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Navigating to ${room.name}, ${floor.name}, room ${room.roomCode}',
      child: Container(
        key: NavigationDestinationCardKeys.card,
        padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
        decoration: BoxDecoration(
          color: CampusNavigatorColors.card,
          border: Border.all(color: CampusNavigatorColors.border, width: 1.5),
          borderRadius: BorderRadius.circular(12),
          boxShadow: const [
            BoxShadow(
              color: CampusNavigatorColors.shadow,
              offset: Offset(3, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              height: 44,
              width: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0xFFF8EEE7),
                border: Border.all(color: CampusNavigatorColors.border),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.location_on_outlined,
                color: CampusNavigatorColors.accent,
                size: 27,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'NAVIGATING TO',
                    style: TextStyle(
                      color: CampusNavigatorColors.accent,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    room.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: CampusNavigatorColors.text,
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    '${floor.name} · ${room.roomCode}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: CampusNavigatorColors.textMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8EEE7),
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Text(
                    'Preview · ${_formatMeters(routeDistanceMeters)} m',
                    style: const TextStyle(
                      color: CampusNavigatorColors.accent,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                if (onChangeDestination != null) ...[
                  const SizedBox(height: 2),
                  TextButton(
                    key: NavigationDestinationCardKeys.change,
                    onPressed: onChangeDestination,
                    style: TextButton.styleFrom(
                      minimumSize: const Size(44, 28),
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      visualDensity: VisualDensity.compact,
                    ),
                    child: const Text(
                      'Change',
                      style: TextStyle(
                        color: CampusNavigatorColors.accent,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

String _formatMeters(double meters) {
  if (meters == meters.roundToDouble()) {
    return meters.toStringAsFixed(0);
  }
  return meters.toStringAsFixed(1);
}
