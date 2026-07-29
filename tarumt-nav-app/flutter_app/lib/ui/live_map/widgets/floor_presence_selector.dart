import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class FloorPresenceSelectorKeys {
  static ValueKey<String> floor(String floorId) =>
      ValueKey<String>('live-map.floor.$floorId');
}

final class FloorPresenceSelector extends StatelessWidget {
  const FloorPresenceSelector({
    required this.floors,
    required this.occupancy,
    required this.onSelected,
    required this.selectedFloorId,
    super.key,
  });

  final List<CampusFloor> floors;
  final List<FloorOccupancy> occupancy;
  final ValueChanged<String> onSelected;
  final String selectedFloorId;

  @override
  Widget build(BuildContext context) {
    final usersByFloor = <String, int>{
      for (final floor in occupancy) floor.floorId: floor.activeUsers,
    };
    return SizedBox(
      height: 52,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final floor = floors[index];
          final selected = floor.id == selectedFloorId;
          return Material(
            color: selected
                ? CampusNavigatorColors.accent
                : CampusNavigatorColors.card,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: BorderSide(
                color: selected
                    ? CampusNavigatorColors.accent
                    : CampusNavigatorColors.border,
                width: 1.5,
              ),
            ),
            child: InkWell(
              key: FloorPresenceSelectorKeys.floor(floor.id),
              borderRadius: BorderRadius.circular(10),
              onTap: () => onSelected(floor.id),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Center(
                  child: Text(
                    '${floor.code} · ${usersByFloor[floor.id] ?? 0}',
                    style: TextStyle(
                      color: selected
                          ? Colors.white
                          : CampusNavigatorColors.text,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ),
          );
        },
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemCount: floors.length,
      ),
    );
  }
}
