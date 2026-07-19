import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/ui/settings/wifi_positioning_test_lab.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class WifiPositioningMapTestOverlayKeys {
  static const close = ValueKey<String>('wifi-map-test.close');
  static const expanded = ValueKey<String>('wifi-map-test.expanded');
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

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (!_expanded)
          Positioned(
            bottom: 172,
            right: 12,
            child: SafeArea(
              top: false,
              child: FloatingActionButton.small(
                key: WifiPositioningMapTestOverlayKeys.open,
                heroTag: 'wifi-positioning-map-test',
                onPressed: () => setState(() => _expanded = true),
                tooltip: 'Open Wi-Fi test controls',
                backgroundColor: CampusNavigatorColors.text,
                foregroundColor: CampusNavigatorColors.card,
                child: const Icon(Icons.wifi_find),
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
                  final maxHeight = MediaQuery.sizeOf(context).height * 0.58;
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
                                    'Map test controls',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                                IconButton(
                                  key: WifiPositioningMapTestOverlayKeys.close,
                                  onPressed: () =>
                                      setState(() => _expanded = false),
                                  tooltip: 'Close Wi-Fi test controls',
                                  icon: const Icon(Icons.close),
                                ),
                              ],
                            ),
                          ),
                          Flexible(
                            child: SingleChildScrollView(
                              padding: const EdgeInsets.fromLTRB(10, 0, 10, 12),
                              child: WifiPositioningTestLab(
                                onSampleReady: widget.onSampleReady,
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
