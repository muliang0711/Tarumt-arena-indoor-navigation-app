import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/application/view_models/navigation_ui_state.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/map/actor/user_presence_marker.dart';
import 'package:indoor_navigation/ui/map/effects/route_endpoint_effects.dart';
import 'package:indoor_navigation/ui/map/models/destination_beacon_model.dart';
import 'package:indoor_navigation/ui/map/widgets/map_path_segment.dart';
import 'package:indoor_navigation/ui/map/widgets/map_room_label.dart';
import 'package:indoor_navigation/ui/map/widgets/map_route_node.dart';
import 'package:indoor_navigation/ui/map/widgets/marker_primitives.dart';

typedef IndoorMapNavigationOverlayBuilder =
    Widget Function(
      BuildContext context,
      NavigationUiState? navigation,
      WrongWayRerouteResult? wrongWayReroute,
    );

final class IndoorMapViewport extends StatelessWidget {
  const IndoorMapViewport({
    required this.blueMarkerPosition,
    this.edgeSegments = const <OverlayPathSegment>[],
    this.horizontalScrollController,
    this.mapImageAsset = 'assets/maps/demo_1.png',
    required this.mapModel,
    this.navigation,
    this.navigationOverlayBuilder,
    this.observedHeadingDegrees,
    this.onRouteNodePressed,
    required this.redMarker,
    required this.remainingPathSegments,
    this.selectedRouteNodeIds = const <String>[],
    this.showDiagnosticMapOverlays = true,
    this.showNavigationOverlay = true,
    this.showRouteEndpointEffects = false,
    this.verticalScrollController,
    this.wrongWayReroute,
    this.wifiCorrection,
    required this.zoom,
    super.key,
  }) : assert(zoom > 0);

  final RoutePosition blueMarkerPosition;
  final List<OverlayPathSegment> edgeSegments;
  final ScrollController? horizontalScrollController;
  final String mapImageAsset;
  final PngMapModel mapModel;
  final NavigationUiState? navigation;
  final IndoorMapNavigationOverlayBuilder? navigationOverlayBuilder;
  final double? observedHeadingDegrees;
  final ValueChanged<OverlayRouteNode>? onRouteNodePressed;
  final RedMarkerState redMarker;
  final List<OverlayPathSegment> remainingPathSegments;
  final List<String> selectedRouteNodeIds;
  final bool showDiagnosticMapOverlays;
  final bool showNavigationOverlay;
  final bool showRouteEndpointEffects;
  final ScrollController? verticalScrollController;
  final WrongWayRerouteResult? wrongWayReroute;
  final WifiCorrectionVisualState? wifiCorrection;
  final double zoom;

  @override
  Widget build(BuildContext context) {
    final selectedNodeIds = selectedRouteNodeIds.toSet();
    final surface = mapModel.surface;
    return Stack(
      fit: StackFit.expand,
      children: [
        SingleChildScrollView(
          controller: verticalScrollController,
          physics: const ClampingScrollPhysics(),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 92),
            child: SingleChildScrollView(
              controller: horizontalScrollController,
              physics: const ClampingScrollPhysics(),
              scrollDirection: Axis.horizontal,
              child: SizedBox(
                height: surface.height * zoom,
                width: surface.width * zoom,
                child: Transform.scale(
                  alignment: Alignment.topLeft,
                  scale: zoom,
                  child: SizedBox(
                    height: surface.height,
                    width: surface.width,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Positioned.fill(
                          child: Image.asset(
                            mapImageAsset,
                            fit: BoxFit.fill,
                            semanticLabel: 'Indoor map',
                          ),
                        ),
                        for (final segment in remainingPathSegments)
                          MapPathSegment(
                            key: ValueKey(segment.key),
                            segment: segment,
                          ),
                        for (final segment in edgeSegments)
                          MapPathSegment(
                            color: const Color.fromRGBO(15, 118, 110, 0.7),
                            key: ValueKey('edge-${segment.key}'),
                            segment: segment,
                          ),
                        if (showRouteEndpointEffects &&
                            mapModel.routePath.isNotEmpty) ...[
                          RouteStartMarker(position: mapModel.routePath.first),
                          DestinationBeacon(
                            phase: resolveDestinationBeaconPhase(
                              distanceRemainingPixels:
                                  navigation?.distanceRemainingPixels ??
                                  double.infinity,
                              status:
                                  navigation?.status ?? SimulationStatus.ready,
                            ),
                            position: mapModel.routePath.last,
                          ),
                        ],
                        for (final label in mapModel.roomLabels)
                          MapRoomLabel(
                            key: ValueKey('room-${label.id}'),
                            label: label,
                          ),
                        if (showDiagnosticMapOverlays)
                          for (final node in mapModel.routeNodes)
                            MapRouteNode(
                              key: ValueKey('route-node-${node.id}'),
                              node: node,
                              onPressed: onRouteNodePressed,
                              selected: selectedNodeIds.contains(node.nodeId),
                            ),
                        if (showNavigationOverlay) ...[
                          UserPresenceMarker(
                            observedHeadingDegrees: observedHeadingDegrees,
                            position: blueMarkerPosition,
                            wifiCorrection: wifiCorrection,
                          ),
                          if (showDiagnosticMapOverlays)
                            RedMarker(marker: redMarker),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        if (showNavigationOverlay && navigationOverlayBuilder != null)
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: navigationOverlayBuilder!(
              context,
              navigation,
              wrongWayReroute,
            ),
          ),
      ],
    );
  }
}
