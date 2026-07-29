import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/ui/app/zoom_controls.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

final class AppHeader extends StatelessWidget {
  const AppHeader({
    required this.distanceRemainingPixels,
    required this.mode,
    required this.onModeChange,
    required this.onZoomIn,
    required this.onZoomOut,
    required this.status,
    required this.zoomPercent,
    super.key,
  });

  static const navigateButtonKey = ValueKey<String>('app-header.navigate');
  static const edgesButtonKey = ValueKey<String>('app-header.edges');
  static const subtitleKey = ValueKey<String>('app-header.subtitle');

  final double distanceRemainingPixels;
  final IndoorNavigationMode mode;
  final ValueChanged<IndoorNavigationMode> onModeChange;
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final SimulationStatus status;
  final int zoomPercent;

  @override
  Widget build(BuildContext context) {
    final titleBlock = _TitleBlock(
      mode: mode,
      distanceRemainingPixels: distanceRemainingPixels,
      status: status,
    );
    final actions = _HeaderActions(
      mode: mode,
      onModeChange: onModeChange,
      onZoomIn: onZoomIn,
      onZoomOut: onZoomOut,
      zoomPercent: zoomPercent,
    );

    return DecoratedBox(
      decoration: const BoxDecoration(
        color: IndoorNavigationColors.panel,
        border: Border(
          bottom: BorderSide(color: IndoorNavigationColors.border, width: 0.5),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: LayoutBuilder(
          builder: (context, constraints) {
            if (constraints.maxWidth < 560) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [titleBlock, const SizedBox(height: 8), actions],
              );
            }
            return Row(
              children: [
                Expanded(child: titleBlock),
                const SizedBox(width: 8),
                actions,
              ],
            );
          },
        ),
      ),
    );
  }
}

final class _TitleBlock extends StatelessWidget {
  const _TitleBlock({
    required this.distanceRemainingPixels,
    required this.mode,
    required this.status,
  });

  final double distanceRemainingPixels;
  final IndoorNavigationMode mode;
  final SimulationStatus status;

  @override
  Widget build(BuildContext context) {
    final subtitle = mode == IndoorNavigationMode.edges
        ? 'Edge JSON editor'
        : '${status.wireValue} - ${distanceRemainingPixels.round()}px left';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Tiled Map Phase 1',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: Color(0xFF17202F),
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          key: AppHeader.subtitleKey,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: IndoorNavigationColors.muted,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

final class _HeaderActions extends StatelessWidget {
  const _HeaderActions({
    required this.mode,
    required this.onModeChange,
    required this.onZoomIn,
    required this.onZoomOut,
    required this.zoomPercent,
  });

  final IndoorNavigationMode mode;
  final ValueChanged<IndoorNavigationMode> onModeChange;
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final int zoomPercent;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      runSpacing: 6,
      spacing: 6,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            color: const Color(0xFFEEF2F7),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Padding(
            padding: const EdgeInsets.all(2),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _ModeButton(
                  active: mode == IndoorNavigationMode.navigate,
                  key: AppHeader.navigateButtonKey,
                  label: 'Navigate',
                  onPressed: () => onModeChange(IndoorNavigationMode.navigate),
                ),
                _ModeButton(
                  active: mode == IndoorNavigationMode.edges,
                  key: AppHeader.edgesButtonKey,
                  label: 'Edges',
                  onPressed: () => onModeChange(IndoorNavigationMode.edges),
                ),
              ],
            ),
          ),
        ),
        ZoomControls(
          onZoomIn: onZoomIn,
          onZoomOut: onZoomOut,
          zoomPercent: zoomPercent,
        ),
      ],
    );
  }
}

final class _ModeButton extends StatelessWidget {
  const _ModeButton({
    required this.active,
    required this.label,
    required this.onPressed,
    super.key,
  });

  final bool active;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      excludeSemantics: true,
      label: label,
      selected: active,
      child: Material(
        color: active ? IndoorNavigationColors.slate : Colors.transparent,
        borderRadius: BorderRadius.circular(4),
        child: InkWell(
          borderRadius: BorderRadius.circular(4),
          onTap: onPressed,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 30, minWidth: 68),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Center(
                child: Text(
                  label,
                  style: TextStyle(
                    color: active ? Colors.white : const Color(0xFF475467),
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
