import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_state.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/ui/ready_indoor_navigation_view.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

final class IndoorNavigationScreen extends StatefulWidget {
  const IndoorNavigationScreen({
    required this.viewModel,
    this.destinationFloor,
    this.destinationRoom,
    this.disposeViewModel = true,
    this.navigationStartNodeId = defaultNavigationStartNodeId,
    this.onChangeDestination,
    this.uiConfig = productionAppUiConfig,
    super.key,
  }) : assert(
         (destinationFloor == null) == (destinationRoom == null),
         'Destination floor and room must be supplied together.',
       );

  final CampusFloor? destinationFloor;
  final CampusRoom? destinationRoom;
  final bool disposeViewModel;
  final String navigationStartNodeId;
  final VoidCallback? onChangeDestination;
  final AppUiConfig uiConfig;
  final IndoorNavigationViewModel viewModel;

  @override
  State<IndoorNavigationScreen> createState() => _IndoorNavigationScreenState();
}

final class _IndoorNavigationScreenState extends State<IndoorNavigationScreen>
    with WidgetsBindingObserver {
  late AppLifecycleState _desiredLifecycleState;
  late IndoorNavigationViewState _state;
  late final StreamSubscription<IndoorNavigationViewState> _subscription;
  var _isDisposing = false;

  @override
  void initState() {
    super.initState();
    _desiredLifecycleState =
        WidgetsBinding.instance.lifecycleState ?? AppLifecycleState.resumed;
    _state = widget.viewModel.state;
    WidgetsBinding.instance.addObserver(this);
    _subscription = widget.viewModel.states.listen(_handleState);
    unawaited(_initialize());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _desiredLifecycleState = state;
    unawaited(_applyDesiredLifecycle());
  }

  @override
  void didUpdateWidget(covariant IndoorNavigationScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.destinationRoom?.id != widget.destinationRoom?.id ||
        oldWidget.navigationStartNodeId != widget.navigationStartNodeId) {
      unawaited(_initialize());
    }
  }

  void _handleState(IndoorNavigationViewState state) {
    if (_isDisposing || !mounted) {
      return;
    }
    final becameReady = !_state.isReady && state.isReady;
    setState(() {
      _state = state;
    });
    if (becameReady) {
      unawaited(_applyDesiredLifecycle());
    }
  }

  Future<void> _initialize() async {
    try {
      final destination = widget.destinationRoom;
      if (destination?.navigationNodeId != null) {
        await widget.viewModel.startNavigation(
          destination: destination!,
          startNodeId: widget.navigationStartNodeId,
        );
      } else {
        await widget.viewModel.initialize();
      }
    } catch (_) {
      // The ViewModel emits the typed loading error rendered below.
    }
    await _applyDesiredLifecycle();
  }

  Future<void> _retry() => _initialize();

  Future<void> _applyDesiredLifecycle() async {
    if (_isDisposing || !widget.viewModel.state.isReady) {
      return;
    }
    try {
      if (_desiredLifecycleState == AppLifecycleState.resumed) {
        await widget.viewModel.resume();
      } else {
        await widget.viewModel.pause();
      }
    } catch (error, stackTrace) {
      if (!_isDisposing) {
        debugPrint('Indoor navigation lifecycle transition failed: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
    }
  }

  @override
  void dispose() {
    _isDisposing = true;
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_disposeResources());
    super.dispose();
  }

  Future<void> _disposeResources() async {
    final viewModelDisposal = widget.disposeViewModel
        ? widget.viewModel.dispose()
        : null;
    await _subscription.cancel();
    if (viewModelDisposal != null) {
      await viewModelDisposal;
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: switch (_state.loadStatus) {
        IndoorNavigationLoadStatus.ready => IndoorNavigationReadyView(
          destinationFloor: widget.destinationFloor,
          destinationRoom: widget.destinationRoom,
          onChangeDestination: widget.onChangeDestination,
          state: _state,
          uiConfig: widget.uiConfig,
          viewModel: widget.viewModel,
        ),
        IndoorNavigationLoadStatus.error => _LoadFailureView(
          error: _state.loadError,
          onRetry: _retry,
        ),
        IndoorNavigationLoadStatus.idle ||
        IndoorNavigationLoadStatus.loading => const _LoadingView(),
      },
    );
  }
}

final class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: Center(
          child: Column(
            key: ValueKey<String>('indoor-navigation-loading'),
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              CircularProgressIndicator(),
              SizedBox(height: 12),
              Text('Loading indoor map…'),
            ],
          ),
        ),
      ),
    );
  }
}

final class _LoadFailureView extends StatelessWidget {
  const _LoadFailureView({required this.error, required this.onRetry});

  final Object? error;
  final AsyncCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              key: const ValueKey<String>('indoor-navigation-load-error'),
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                const Icon(
                  Icons.error_outline,
                  color: Color(0xFFB42318),
                  size: 36,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Unable to load the indoor map',
                  style: TextStyle(
                    color: IndoorNavigationColors.slate,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 6),
                Text(
                  error?.toString() ?? 'Unknown map loading error.',
                  key: const ValueKey<String>('indoor-navigation-error-detail'),
                  style: const TextStyle(color: IndoorNavigationColors.muted),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  key: const ValueKey<String>('retry-map-load'),
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
