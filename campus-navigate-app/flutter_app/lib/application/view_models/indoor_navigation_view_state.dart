import 'package:indoor_navigation/application/orchestration/bootstrap/map_bootstrap_state.dart';
import 'package:indoor_navigation/application/orchestration/edge_editor/edge_editor_state.dart';
import 'package:indoor_navigation/application/orchestration/navigation/derived_estimate_bridge_engine.dart';
import 'package:indoor_navigation/application/orchestration/navigation/route_simulation_engine.dart';
import 'package:indoor_navigation/application/orchestration/navigation/wrong_way_reroute_monitor.dart';
import 'package:indoor_navigation/application/orchestration/sensors/raw_motion_pdr_engine_state.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator_state.dart';
import 'package:indoor_navigation/application/view_models/navigation_ui_state.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

final class IndoorNavigationViewState {
  IndoorNavigationViewState({
    required List<double> acceptedRouteHeadingDegrees,
    required this.blueMarkerPosition,
    required this.bootstrap,
    required this.derivedEstimate,
    required this.edgeEditor,
    required this.lifecycleStatus,
    required this.loadError,
    required this.loadStatus,
    required this.mode,
    required this.navigation,
    required this.navigationSessionId,
    required this.navigationSessionStatus,
    required this.pixelsPerMeter,
    required this.rawMotion,
    required List<OverlayPathSegment> remainingPathSegments,
    required this.routeSimulation,
    required this.sensorRouteSnap,
    required this.wrongWay,
    required this.wifiCorrectionVisual,
    required this.wifiPositioning,
    required this.zoomIndex,
  }) : acceptedRouteHeadingDegrees = List.unmodifiable(
         acceptedRouteHeadingDegrees,
       ),
       remainingPathSegments = List.unmodifiable(remainingPathSegments);

  factory IndoorNavigationViewState.initial() => IndoorNavigationViewState(
    acceptedRouteHeadingDegrees: const <double>[],
    blueMarkerPosition: null,
    bootstrap: null,
    derivedEstimate: null,
    edgeEditor: null,
    lifecycleStatus: IndoorNavigationLifecycleStatus.active,
    loadError: null,
    loadStatus: IndoorNavigationLoadStatus.idle,
    mode: IndoorNavigationMode.navigate,
    navigation: null,
    navigationSessionId: null,
    navigationSessionStatus: null,
    pixelsPerMeter: null,
    rawMotion: null,
    remainingPathSegments: const <OverlayPathSegment>[],
    routeSimulation: null,
    sensorRouteSnap: null,
    wrongWay: null,
    wifiCorrectionVisual: null,
    wifiPositioning: const WifiPositioningCoordinatorState.idle(),
    zoomIndex: indoorNavigationDefaultZoomIndex,
  );

  final List<double> acceptedRouteHeadingDegrees;
  final RoutePosition? blueMarkerPosition;
  final MapBootstrapData? bootstrap;
  final DerivedEstimateBridgeState? derivedEstimate;
  final EdgeEditorState? edgeEditor;
  final IndoorNavigationLifecycleStatus lifecycleStatus;
  final Object? loadError;
  final IndoorNavigationLoadStatus loadStatus;
  final IndoorNavigationMode mode;
  final NavigationUiState? navigation;
  final int? navigationSessionId;
  final NavigationSessionStatus? navigationSessionStatus;
  final double? pixelsPerMeter;
  final RawMotionPdrEngineState? rawMotion;
  final List<OverlayPathSegment> remainingPathSegments;
  final RouteSimulationState? routeSimulation;
  final RouteSnapResult? sensorRouteSnap;
  final WrongWayRerouteMonitorState? wrongWay;
  final WifiCorrectionVisualState? wifiCorrectionVisual;
  final WifiPositioningCoordinatorState wifiPositioning;
  final int zoomIndex;

  bool get isReady => loadStatus == IndoorNavigationLoadStatus.ready;
  double get zoom => indoorNavigationZoomAt(zoomIndex);
}
