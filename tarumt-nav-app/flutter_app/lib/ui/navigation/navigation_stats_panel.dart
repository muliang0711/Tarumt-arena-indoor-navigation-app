import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/navigation_ui_state.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

final class NavigationStatsPanel extends StatelessWidget {
  const NavigationStatsPanel({required this.navigation, super.key});

  static const panelKey = ValueKey<String>('navigation-stats.panel');
  static const segmentValueKey = ValueKey<String>('navigation-stats.segment');
  static const progressValueKey = ValueKey<String>('navigation-stats.progress');
  static const remainingValueKey = ValueKey<String>(
    'navigation-stats.remaining',
  );
  static const statusValueKey = ValueKey<String>('navigation-stats.status');

  final NavigationUiState navigation;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      key: panelKey,
      decoration: const BoxDecoration(
        color: IndoorNavigationColors.panel,
        border: Border(
          bottom: BorderSide(color: IndoorNavigationColors.border, width: 0.5),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 3,
              child: _StatCell(
                label: 'Segment',
                maxLines: 2,
                value: navigation.currentSegment,
                valueKey: segmentValueKey,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 2,
              child: _StatCell(
                label: 'Progress',
                value: '${navigation.progressPercent.round()}%',
                valueKey: progressValueKey,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 2,
              child: _StatCell(
                label: 'Remaining',
                value: '${navigation.distanceRemainingPixels.round()}px',
                valueKey: remainingValueKey,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 2,
              child: _StatCell(
                label: 'Status',
                value: navigation.status.wireValue,
                valueKey: statusValueKey,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _StatCell extends StatelessWidget {
  const _StatCell({
    required this.label,
    required this.value,
    required this.valueKey,
    this.maxLines = 1,
  });

  final String label;
  final int maxLines;
  final String value;
  final Key valueKey;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label.toUpperCase(),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Color(0xFF64748B),
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          key: valueKey,
          maxLines: maxLines,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: IndoorNavigationColors.slate,
            fontSize: 12,
            fontWeight: FontWeight.w800,
            height: 15 / 12,
          ),
        ),
      ],
    );
  }
}
