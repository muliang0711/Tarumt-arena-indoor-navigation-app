import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_state.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/ui/app/app.dart';
import 'package:indoor_navigation/ui/edge_editor/edge_editor.dart';
import 'package:indoor_navigation/ui/map/indoor_map.dart';
import 'package:indoor_navigation/ui/navigation/navigation.dart';
import 'package:indoor_navigation/ui/navigation_input/navigation_input.dart';

abstract final class IndoorNavigationReadyViewKeys {
  static const map = ValueKey<String>('indoor-navigation-ready.map');
  static const navigationControls = ValueKey<String>(
    'indoor-navigation-ready.navigation-controls',
  );
  static const shortLayoutSidebar = ValueKey<String>(
    'indoor-navigation-ready.short-layout-sidebar',
  );
}

/// The production MVVM binding for the fully initialized application.
///
/// This widget only renders immutable ViewModel state and forwards user intent
/// to the ViewModel. Map parsing, simulation, sensors, rerouting, and edge
/// editing remain outside the Flutter widget layer.
final class IndoorNavigationReadyView extends StatelessWidget {
  const IndoorNavigationReadyView({
    required this.state,
    this.destinationFloor,
    this.destinationRoom,
    this.onChangeDestination,
    this.uiConfig = productionAppUiConfig,
    required this.viewModel,
    super.key,
  }) : assert(
         (destinationFloor == null) == (destinationRoom == null),
         'Destination floor and room must be supplied together.',
       );

  final CampusFloor? destinationFloor;
  final CampusRoom? destinationRoom;
  final VoidCallback? onChangeDestination;
  final IndoorNavigationViewState state;
  final AppUiConfig uiConfig;
  final IndoorNavigationViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final navigation = state.navigation!;
    final isEdgeEditing =
        uiConfig.enableEdgeEditor && state.mode == IndoorNavigationMode.edges;
    final hasVisibleControls = isEdgeEditing
        ? true
        : uiConfig.hasNavigationDebugPanels;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            if (uiConfig.showDeveloperHeader)
              AppHeader(
                distanceRemainingPixels: navigation.distanceRemainingPixels,
                mode: state.mode,
                onModeChange: viewModel.changeMode,
                onZoomIn: viewModel.zoomIn,
                onZoomOut: viewModel.zoomOut,
                status: navigation.status,
                zoomPercent: (state.zoom * 100).round(),
              ),
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final useShortLayout =
                      hasVisibleControls &&
                      constraints.maxWidth >= 560 &&
                      constraints.maxWidth > constraints.maxHeight;
                  if (useShortLayout) {
                    final sidebarWidth = math.min(
                      390.0,
                      constraints.maxWidth * 0.45,
                    );
                    return Row(
                      children: [
                        SizedBox(
                          key: IndoorNavigationReadyViewKeys.shortLayoutSidebar,
                          width: sidebarWidth,
                          child: !isEdgeEditing
                              ? SingleChildScrollView(
                                  child: _NavigationControls(
                                    config: uiConfig,
                                    state: state,
                                    viewModel: viewModel,
                                  ),
                                )
                              : _EdgeControls(
                                  maxHeight: constraints.maxHeight,
                                  state: state,
                                  viewModel: viewModel,
                                ),
                        ),
                        const VerticalDivider(width: 1),
                        Expanded(
                          child: _Map(
                            config: uiConfig,
                            destinationFloor: destinationFloor,
                            destinationRoom: destinationRoom,
                            isEdgeEditing: isEdgeEditing,
                            onChangeDestination: onChangeDestination,
                            state: state,
                            viewModel: viewModel,
                          ),
                        ),
                      ],
                    );
                  }

                  final controls = !isEdgeEditing
                      ? _NavigationControls(
                          config: uiConfig,
                          state: state,
                          viewModel: viewModel,
                        )
                      : _EdgeControls(
                          maxHeight: math.min(
                            520,
                            math.max(160, constraints.maxHeight * 0.52),
                          ),
                          state: state,
                          viewModel: viewModel,
                        );
                  return Column(
                    children: [
                      if (hasVisibleControls) controls,
                      Expanded(
                        child: _Map(
                          config: uiConfig,
                          destinationFloor: destinationFloor,
                          destinationRoom: destinationRoom,
                          isEdgeEditing: isEdgeEditing,
                          onChangeDestination: onChangeDestination,
                          state: state,
                          viewModel: viewModel,
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _NavigationControls extends StatelessWidget {
  const _NavigationControls({
    required this.config,
    required this.state,
    required this.viewModel,
  });

  final AppUiConfig config;
  final IndoorNavigationViewState state;
  final IndoorNavigationViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final bootstrap = state.bootstrap!;
    final derivedEstimate = state.derivedEstimate!;
    final navigation = state.navigation!;
    final rawMotion = state.rawMotion!;
    final wrongWay = state.wrongWay!;
    return Column(
      key: IndoorNavigationReadyViewKeys.navigationControls,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (config.showSimulationControls)
          SimulationControls(
            onPause: viewModel.pauseSimulation,
            onReset: viewModel.resetSimulation,
            onStart: viewModel.startSimulation,
            onStepForward: viewModel.stepSimulationForward,
          ),
        if (config.showNavigationStatsPanel)
          NavigationStatsPanel(navigation: navigation),
        if (config.showDerivedEstimatePanel)
          DerivedEstimatePanel(
            buffer: derivedEstimate.buffer,
            lastResult: derivedEstimate.lastResult,
            onReplayStep: viewModel.runReplayStep,
            onReset: viewModel.resetNavigationInput,
            onStartRawMotion: () => unawaited(viewModel.startRawMotion()),
            onStopRawMotion: () => unawaited(viewModel.stopRawMotion()),
            rawMotionStats: rawMotion.stats,
            rawMotionStatus: rawMotion.status,
            routeTotalMeters: bootstrap.routeMetrics.totalMeters,
            snapDriftPixels: state.sensorRouteSnap?.driftPixels,
            stepLengthMeters: defaultPdrPipelineConfig.stepLengthMeters,
            stepLengthPixels:
                defaultPdrPipelineConfig.stepLengthMeters *
                state.pixelsPerMeter!,
            wrongWayReroute: wrongWay.result,
          ),
      ],
    );
  }
}

final class _EdgeControls extends StatelessWidget {
  const _EdgeControls({
    required this.maxHeight,
    required this.state,
    required this.viewModel,
  });

  final double maxHeight;
  final IndoorNavigationViewState state;
  final IndoorNavigationViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return EdgeEditorPanel(
      maxHeight: maxHeight,
      onAddEdgeField: viewModel.addEdgeField,
      onExportEdges: viewModel.exportEdges,
      onRemoveEdge: viewModel.removeEdge,
      onRemoveEdgeField: viewModel.removeEdgeField,
      onSaveEdge: viewModel.saveEdge,
      onSetEdgeDistance: viewModel.setEdgeDistance,
      onSetEdgeId: viewModel.setEdgeId,
      onUpdateEdgeField: viewModel.updateEdgeField,
      state: state.edgeEditor!,
    );
  }
}

final class _Map extends StatelessWidget {
  const _Map({
    required this.config,
    required this.destinationFloor,
    required this.destinationRoom,
    required this.isEdgeEditing,
    required this.onChangeDestination,
    required this.state,
    required this.viewModel,
  });

  final AppUiConfig config;
  final CampusFloor? destinationFloor;
  final CampusRoom? destinationRoom;
  final bool isEdgeEditing;
  final VoidCallback? onChangeDestination;
  final IndoorNavigationViewState state;
  final IndoorNavigationViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final edgeEditor = state.edgeEditor!;
    final navigation = state.navigation!;
    final wrongWay = state.wrongWay!.result;
    final room = destinationRoom;
    final floor = destinationFloor;
    return Stack(
      fit: StackFit.expand,
      children: [
        IndoorMapViewport(
          key: IndoorNavigationReadyViewKeys.map,
          blueMarkerPosition: state.blueMarkerPosition!,
          edgeSegments: isEdgeEditing ? edgeEditor.edgeSegments : const [],
          mapModel: state.bootstrap!.mapModel,
          navigation: navigation,
          navigationOverlayBuilder:
              (context, currentNavigation, currentWrongWay) {
                return SizedBox(
                  height: 160,
                  child: Stack(
                    children: [
                      WrongWayWarningBanner(
                        result: currentWrongWay ?? wrongWay,
                      ),
                      InstructionBar(
                        navigation: currentNavigation ?? navigation,
                      ),
                    ],
                  ),
                );
              },
          observedHeadingDegrees: state.derivedEstimate!.observedHeadingDegrees,
          onRouteNodePressed: isEdgeEditing ? viewModel.selectRouteNode : null,
          redMarker: state.derivedEstimate!.redMarker,
          remainingPathSegments: state.remainingPathSegments,
          selectedRouteNodeIds: isEdgeEditing
              ? edgeEditor.selectedNodeIds
              : const [],
          showDiagnosticMapOverlays:
              isEdgeEditing || config.showDiagnosticMapOverlays,
          showNavigationOverlay: !isEdgeEditing,
          showRouteEndpointEffects: !isEdgeEditing && room != null,
          wrongWayReroute: wrongWay,
          wifiCorrection: state.wifiCorrectionVisual,
          zoom: state.zoom,
        ),
        if (!isEdgeEditing && room != null && floor != null)
          Positioned(
            left: 12,
            right: 12,
            top: 12,
            child: NavigationDestinationCard(
              floor: floor,
              onChangeDestination: onChangeDestination,
              room: room,
              routeDistanceMeters: state.bootstrap!.routeMetrics.totalMeters,
            ),
          ),
        if (!isEdgeEditing && state.wifiPositioning.isActionableFailure)
          Positioned(
            left: 12,
            right: 12,
            top: room != null ? 108 : 12,
            child: WifiPositioningStatusBanner(
              onRetry: viewModel.retryWifiPositioning,
              state: state.wifiPositioning,
            ),
          ),
      ],
    );
  }
}
