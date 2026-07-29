import 'dart:async';

import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_model.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_state.dart';
import 'package:indoor_navigation/ui/live_map/widgets/floor_presence_selector.dart';
import 'package:indoor_navigation/ui/live_map/widgets/live_map_header.dart';
import 'package:indoor_navigation/ui/live_map/widgets/live_presence_connection_banner.dart';
import 'package:indoor_navigation/ui/live_map/widgets/live_presence_map.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class LiveMapScreenKeys {
  static const screen = ValueKey<String>('app-section.live-map');
  static const loading = ValueKey<String>('live-map.loading');
  static const error = ValueKey<String>('live-map.error');
  static const retry = ValueKey<String>('live-map.retry');
}

final class LiveMapScreen extends StatefulWidget {
  const LiveMapScreen({required this.viewModel, super.key});

  final LiveMapViewModel viewModel;

  @override
  State<LiveMapScreen> createState() => _LiveMapScreenState();
}

final class _LiveMapScreenState extends State<LiveMapScreen>
    with WidgetsBindingObserver {
  late LiveMapViewState _state;
  late final StreamSubscription<LiveMapViewState> _subscription;
  bool _disposing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _state = widget.viewModel.state;
    _subscription = widget.viewModel.states.listen((state) {
      if (!_disposing && mounted) {
        setState(() => _state = state);
      }
    });
    unawaited(widget.viewModel.initialize());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(widget.viewModel.resume());
    } else {
      unawaited(widget.viewModel.pause());
    }
  }

  @override
  void dispose() {
    _disposing = true;
    WidgetsBinding.instance.removeObserver(this);
    unawaited(widget.viewModel.pause());
    unawaited(_subscription.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: CampusNavigatorColors.background,
      child: SafeArea(
        bottom: false,
        child: switch (_state.loadStatus) {
          LiveMapLoadStatus.idle || LiveMapLoadStatus.loading => const Center(
            key: LiveMapScreenKeys.loading,
            child: CircularProgressIndicator(),
          ),
          LiveMapLoadStatus.error => _LiveMapError(
            error: _state.loadError,
            onRetry: () => unawaited(widget.viewModel.retry()),
          ),
          LiveMapLoadStatus.ready => Column(
            key: LiveMapScreenKeys.screen,
            children: [
              LiveMapHeader(state: _state),
              LivePresenceConnectionBanner(
                connection: _state.presenceConnection,
              ),
              FloorPresenceSelector(
                floors: _state.floors,
                occupancy: _state.snapshot?.floors ?? const [],
                onSelected: (floorId) {
                  unawaited(widget.viewModel.selectFloor(floorId));
                },
                selectedFloorId: _state.selectedFloorId,
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 2, 16, 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    _state.hasMapForSelectedFloor
                        ? 'Representative activity · up to 10 people'
                        : 'Occupancy summary',
                    style: const TextStyle(
                      color: CampusNavigatorColors.textMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              Expanded(
                child: LivePresenceMap(
                  hasFloorMap: _state.hasMapForSelectedFloor,
                  mapImage: _state.mapImage,
                  mapModel: _state.mapModel,
                  onZoomChanged: widget.viewModel.setZoom,
                  presences: _state.snapshot?.representatives ?? const [],
                  selectedFloorCode: _state.selectedFloor.code,
                  zoom: _state.zoom,
                ),
              ),
            ],
          ),
        },
      ),
    );
  }
}

final class _LiveMapError extends StatelessWidget {
  const _LiveMapError({required this.error, required this.onRetry});

  final Object? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      key: LiveMapScreenKeys.error,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.map_outlined, size: 42),
            const SizedBox(height: 12),
            const Text(
              'Unable to load the live map',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Text(
              error?.toString() ?? 'Unknown live map error.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              key: LiveMapScreenKeys.retry,
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
