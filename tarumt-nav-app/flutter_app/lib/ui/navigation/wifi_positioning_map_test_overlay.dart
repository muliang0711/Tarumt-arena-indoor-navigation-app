import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/ui/settings/wifi_positioning_test_lab.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class WifiPositioningMapTestOverlayKeys {
  static const close = ValueKey<String>('wifi-map-test.close');
  static const compact = ValueKey<String>('wifi-map-test.compact');
  static const expanded = ValueKey<String>('wifi-map-test.expanded');
  static const minimize = ValueKey<String>('wifi-map-test.minimize');
  static const open = ValueKey<String>('wifi-map-test.open');
}

/// Optional test-only decorator around the navigation map.
///
/// The wrapped map has no dependency on this overlay. Removing this widget or
/// omitting its ViewModel leaves the production navigation stack unchanged.
final class WifiPositioningMapTestOverlay extends StatefulWidget {
  const WifiPositioningMapTestOverlay({
    required this.child,
    this.onSampleReady,
    required this.viewModel,
    super.key,
  });

  final Widget child;
  final VoidCallback? onSampleReady;
  final WifiPositioningTestLabViewModel viewModel;

  @override
  State<WifiPositioningMapTestOverlay> createState() =>
      _WifiPositioningMapTestOverlayState();
}

final class _WifiPositioningMapTestOverlayState
    extends State<WifiPositioningMapTestOverlay> {
  bool _expanded = false;
  bool _showCompactResult = false;

  void _open() => setState(() {
    _expanded = true;
    _showCompactResult = false;
  });

  void _collapse() => setState(() {
    _expanded = false;
    _showCompactResult =
        widget.viewModel.state.phase == WifiPositioningTestLabPhase.success;
  });

  void _minimize() => setState(() {
    _expanded = false;
    _showCompactResult = false;
  });

  void _handleSampleReady() {
    if (mounted) {
      setState(() {
        _expanded = false;
        _showCompactResult = true;
      });
    }
    widget.onSampleReady?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (!_expanded && !_showCompactResult)
          Positioned(
            bottom: 172,
            right: 12,
            child: SafeArea(
              top: false,
              child: FloatingActionButton.small(
                key: WifiPositioningMapTestOverlayKeys.open,
                heroTag: 'wifi-positioning-map-test',
                onPressed: _open,
                tooltip: 'Open Wi-Fi test controls',
                backgroundColor: CampusNavigatorColors.text,
                foregroundColor: CampusNavigatorColors.card,
                child: const Icon(Icons.wifi_find),
              ),
            ),
          ),
        if (!_expanded && _showCompactResult)
          Positioned(
            bottom: 172,
            right: 12,
            child: SafeArea(
              top: false,
              child: _CompactResult(
                onMinimize: _minimize,
                onOpen: _open,
                viewModel: widget.viewModel,
              ),
            ),
          ),
        if (_expanded)
          Positioned(
            bottom: 10,
            left: 10,
            right: 10,
            child: SafeArea(
              top: false,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final maxHeight = MediaQuery.sizeOf(context).height * 0.34;
                  return Material(
                    key: WifiPositioningMapTestOverlayKeys.expanded,
                    color: CampusNavigatorColors.background,
                    elevation: 12,
                    clipBehavior: Clip.antiAlias,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: const BorderSide(
                        color: CampusNavigatorColors.border,
                      ),
                    ),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxHeight: maxHeight),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(14, 8, 6, 4),
                            child: Row(
                              children: [
                                const Expanded(
                                  child: Text(
                                    'Wi-Fi fingerprint test',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                                IconButton(
                                  key: WifiPositioningMapTestOverlayKeys.close,
                                  onPressed: _collapse,
                                  tooltip: 'Collapse Wi-Fi test controls',
                                  icon: const Icon(Icons.keyboard_arrow_down),
                                ),
                              ],
                            ),
                          ),
                          Flexible(
                            child: SingleChildScrollView(
                              padding: const EdgeInsets.fromLTRB(10, 0, 10, 12),
                              child: WifiPositioningTestLab(
                                compact: true,
                                onSampleReady: _handleSampleReady,
                                viewModel: widget.viewModel,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
      ],
    );
  }
}

final class _CompactResult extends StatelessWidget {
  const _CompactResult({
    required this.onMinimize,
    required this.onOpen,
    required this.viewModel,
  });

  final VoidCallback onMinimize;
  final VoidCallback onOpen;
  final WifiPositioningTestLabViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<WifiPositioningTestLabState>(
      initialData: viewModel.state,
      stream: viewModel.states,
      builder: (context, snapshot) {
        final state = snapshot.requireData;
        final expected = state.expectedNodeId ?? '—';
        final mapped = state.localNodeId ?? '—';
        return ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 310),
          child: Material(
            key: WifiPositioningMapTestOverlayKeys.compact,
            color: CampusNavigatorColors.card,
            elevation: 8,
            clipBehavior: Clip.antiAlias,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: CampusNavigatorColors.border),
            ),
            child: InkWell(
              onTap: onOpen,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 7, 4, 7),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      state.predictionMatches
                          ? Icons.wifi_tethering
                          : Icons.compare_arrows,
                      color: CampusNavigatorColors.accent,
                      size: 22,
                    ),
                    const SizedBox(width: 9),
                    Flexible(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'Wi-Fi result',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: CampusNavigatorColors.textMuted,
                            ),
                          ),
                          Text(
                            '$expected → $mapped',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      key: WifiPositioningMapTestOverlayKeys.minimize,
                      onPressed: onMinimize,
                      tooltip: 'Minimize Wi-Fi result',
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.close, size: 18),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
