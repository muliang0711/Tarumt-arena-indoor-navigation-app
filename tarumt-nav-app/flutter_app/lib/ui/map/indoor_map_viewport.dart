import 'dart:io';

import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';
import 'package:indoor_navigation/application/view_models/navigation_ui_state.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/domain/traffic/route_traffic.dart';
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

abstract final class IndoorMapViewportKeys {
  static const pinchSurface = ValueKey<String>('indoor-map.pinch-surface');
  static const scaledCanvas = ValueKey<String>('indoor-map.scaled-canvas');
}

final class IndoorMapViewport extends StatefulWidget {
  const IndoorMapViewport({
    required this.blueMarkerPosition,
    this.edgeSegments = const <OverlayPathSegment>[],
    this.horizontalScrollController,
    this.mapImage = const MapImageLocation.bundledAsset(
      defaultMapImageAssetPath,
    ),
    this.mapOverlays = const <Widget>[],
    required this.mapModel,
    this.navigation,
    this.navigationOverlayBuilder,
    this.observedHeadingDegrees,
    this.userDisplayName,
    this.onZoomChanged,
    this.onRouteNodePressed,
    required this.redMarker,
    required this.remainingPathSegments,
    this.routeTrafficBySegmentKey = const <String, RouteTrafficLevel>{},
    this.selectedRouteNodeIds = const <String>[],
    this.showDiagnosticMapOverlays = true,
    this.showNavigationOverlay = true,
    this.showRouteEndpointEffects = false,
    this.verticalScrollController,
    this.wrongWayReroute,
    this.wifiCorrection,
    required this.zoom,
    super.key,
  }) : assert(zoom >= indoorNavigationMinZoom),
       assert(zoom <= indoorNavigationMaxZoom);

  final RoutePosition blueMarkerPosition;
  final List<OverlayPathSegment> edgeSegments;
  final ScrollController? horizontalScrollController;
  final MapImageLocation mapImage;
  final List<Widget> mapOverlays;
  final PngMapModel mapModel;
  final NavigationUiState? navigation;
  final IndoorMapNavigationOverlayBuilder? navigationOverlayBuilder;
  final double? observedHeadingDegrees;
  final String? userDisplayName;
  final ValueChanged<double>? onZoomChanged;
  final ValueChanged<OverlayRouteNode>? onRouteNodePressed;
  final RedMarkerState redMarker;
  final List<OverlayPathSegment> remainingPathSegments;
  final Map<String, RouteTrafficLevel> routeTrafficBySegmentKey;
  final List<String> selectedRouteNodeIds;
  final bool showDiagnosticMapOverlays;
  final bool showNavigationOverlay;
  final bool showRouteEndpointEffects;
  final ScrollController? verticalScrollController;
  final WrongWayRerouteResult? wrongWayReroute;
  final WifiCorrectionVisualState? wifiCorrection;
  final double zoom;

  @override
  State<IndoorMapViewport> createState() => _IndoorMapViewportState();
}

final class _IndoorMapViewportState extends State<IndoorMapViewport> {
  final Map<int, Offset> _pointerLocations = <int, Offset>{};
  late final ScrollController _ownedHorizontalScrollController;
  late final ScrollController _ownedVerticalScrollController;
  (int, int)? _pinchPointers;
  Offset? _pinchAnchorMapPoint;
  Offset? _pinchFocalPoint;
  double _pinchStartDistance = 0;
  double _pinchStartZoom = 1;
  bool _isPinching = false;
  bool _scrollCorrectionScheduled = false;

  ScrollController get _horizontalScrollController =>
      widget.horizontalScrollController ?? _ownedHorizontalScrollController;

  ScrollController get _verticalScrollController =>
      widget.verticalScrollController ?? _ownedVerticalScrollController;

  @override
  void initState() {
    super.initState();
    _ownedHorizontalScrollController = ScrollController();
    _ownedVerticalScrollController = ScrollController();
  }

  @override
  void didUpdateWidget(covariant IndoorMapViewport oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_isPinching && oldWidget.zoom != widget.zoom) {
      _scheduleScrollCorrection();
    }
  }

  @override
  void dispose() {
    _ownedHorizontalScrollController.dispose();
    _ownedVerticalScrollController.dispose();
    super.dispose();
  }

  void _handlePointerDown(PointerDownEvent event) {
    _pointerLocations[event.pointer] = event.localPosition;
    if (!_isPinching &&
        widget.onZoomChanged != null &&
        _pointerLocations.length == 2) {
      _beginPinch();
    }
  }

  void _handlePointerMove(PointerMoveEvent event) {
    if (!_pointerLocations.containsKey(event.pointer)) {
      return;
    }
    _pointerLocations[event.pointer] = event.localPosition;
    final pinchPointers = _pinchPointers;
    if (!_isPinching || pinchPointers == null) {
      return;
    }
    final first = _pointerLocations[pinchPointers.$1];
    final second = _pointerLocations[pinchPointers.$2];
    if (first == null || second == null || _pinchStartDistance <= 0) {
      return;
    }
    final focalPoint = Offset(
      (first.dx + second.dx) / 2,
      (first.dy + second.dy) / 2,
    );
    final distance = (second - first).distance;
    final nextZoom = clampIndoorNavigationZoom(
      _pinchStartZoom * distance / _pinchStartDistance,
    );
    _pinchFocalPoint = focalPoint;
    if ((nextZoom - widget.zoom).abs() > 0.0001) {
      widget.onZoomChanged?.call(nextZoom);
    }
    _scheduleScrollCorrection();
  }

  void _handlePointerEnd(PointerEvent event) {
    final pinchPointers = _pinchPointers;
    final endedPinch =
        pinchPointers != null &&
        (pinchPointers.$1 == event.pointer ||
            pinchPointers.$2 == event.pointer);
    _pointerLocations.remove(event.pointer);
    if (endedPinch) {
      _endPinch();
    }
  }

  void _beginPinch() {
    final pointers = _pointerLocations.entries.take(2).toList(growable: false);
    final first = pointers[0];
    final second = pointers[1];
    final distance = (second.value - first.value).distance;
    if (distance <= 0) {
      return;
    }
    final focalPoint = Offset(
      (first.value.dx + second.value.dx) / 2,
      (first.value.dy + second.value.dy) / 2,
    );
    final horizontalOffset = _horizontalScrollController.hasClients
        ? _horizontalScrollController.offset
        : 0.0;
    final verticalOffset = _verticalScrollController.hasClients
        ? _verticalScrollController.offset
        : 0.0;
    _pinchPointers = (first.key, second.key);
    _pinchStartDistance = distance;
    _pinchStartZoom = widget.zoom;
    _pinchFocalPoint = focalPoint;
    _pinchAnchorMapPoint = Offset(
      (horizontalOffset + focalPoint.dx) / widget.zoom,
      (verticalOffset + focalPoint.dy) / widget.zoom,
    );
    if (_horizontalScrollController.hasClients) {
      _horizontalScrollController.jumpTo(horizontalOffset);
    }
    if (_verticalScrollController.hasClients) {
      _verticalScrollController.jumpTo(verticalOffset);
    }
    setState(() => _isPinching = true);
  }

  void _endPinch() {
    if (!_isPinching) {
      return;
    }
    setState(() {
      _isPinching = false;
      _pinchPointers = null;
      _pinchAnchorMapPoint = null;
      _pinchFocalPoint = null;
    });
  }

  void _scheduleScrollCorrection() {
    if (_scrollCorrectionScheduled) {
      return;
    }
    _scrollCorrectionScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollCorrectionScheduled = false;
      if (!mounted) {
        return;
      }
      final anchor = _pinchAnchorMapPoint;
      final focalPoint = _pinchFocalPoint;
      if (anchor == null || focalPoint == null) {
        return;
      }
      _jumpToClampedOffset(
        _horizontalScrollController,
        anchor.dx * widget.zoom - focalPoint.dx,
      );
      _jumpToClampedOffset(
        _verticalScrollController,
        anchor.dy * widget.zoom - focalPoint.dy,
      );
    });
  }

  void _jumpToClampedOffset(ScrollController controller, double target) {
    if (!controller.hasClients) {
      return;
    }
    final position = controller.position;
    final clampedTarget = target
        .clamp(position.minScrollExtent, position.maxScrollExtent)
        .toDouble();
    if ((position.pixels - clampedTarget).abs() > 0.01) {
      controller.jumpTo(clampedTarget);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedNodeIds = widget.selectedRouteNodeIds.toSet();
    final surface = widget.mapModel.surface;
    final scrollPhysics = _isPinching
        ? const NeverScrollableScrollPhysics()
        : const ClampingScrollPhysics();
    return Stack(
      fit: StackFit.expand,
      children: [
        Listener(
          key: IndoorMapViewportKeys.pinchSurface,
          behavior: HitTestBehavior.opaque,
          onPointerCancel: _handlePointerEnd,
          onPointerDown: _handlePointerDown,
          onPointerMove: _handlePointerMove,
          onPointerUp: _handlePointerEnd,
          child: SingleChildScrollView(
            controller: _verticalScrollController,
            physics: scrollPhysics,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 92),
              child: SingleChildScrollView(
                controller: _horizontalScrollController,
                physics: scrollPhysics,
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  height: surface.height * widget.zoom,
                  width: surface.width * widget.zoom,
                  child: FittedBox(
                    key: IndoorMapViewportKeys.scaledCanvas,
                    alignment: Alignment.topLeft,
                    fit: BoxFit.fill,
                    child: SizedBox(
                      height: surface.height,
                      width: surface.width,
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Positioned.fill(
                            child: switch (widget.mapImage.kind) {
                              MapImageLocationKind.bundledAsset => Image.asset(
                                widget.mapImage.path,
                                fit: BoxFit.fill,
                                semanticLabel: 'Indoor map',
                              ),
                              MapImageLocationKind.localFile => Image.file(
                                File(widget.mapImage.path),
                                fit: BoxFit.fill,
                                semanticLabel: 'Indoor map',
                              ),
                            },
                          ),
                          for (final segment in widget.remainingPathSegments)
                            MapPathSegment(
                              color: RouteTrafficColors.forLevel(
                                widget.routeTrafficBySegmentKey[segment.key] ??
                                    RouteTrafficLevel.clear,
                              ),
                              key: ValueKey(segment.key),
                              segment: segment,
                            ),
                          for (final segment in widget.edgeSegments)
                            MapPathSegment(
                              color: const Color.fromRGBO(15, 118, 110, 0.7),
                              key: ValueKey('edge-${segment.key}'),
                              segment: segment,
                            ),
                          if (widget.showRouteEndpointEffects &&
                              widget.mapModel.routePath.isNotEmpty) ...[
                            RouteStartMarker(
                              position: widget.mapModel.routePath.first,
                            ),
                            DestinationBeacon(
                              phase: resolveDestinationBeaconPhase(
                                distanceRemainingPixels:
                                    widget
                                        .navigation
                                        ?.distanceRemainingPixels ??
                                    double.infinity,
                                status:
                                    widget.navigation?.status ??
                                    SimulationStatus.ready,
                              ),
                              position: widget.mapModel.routePath.last,
                            ),
                          ],
                          for (final label in widget.mapModel.roomLabels)
                            MapRoomLabel(
                              key: ValueKey('room-${label.id}'),
                              label: label,
                            ),
                          if (widget.showDiagnosticMapOverlays)
                            for (final node in widget.mapModel.routeNodes)
                              MapRouteNode(
                                key: ValueKey('route-node-${node.id}'),
                                node: node,
                                onPressed: widget.onRouteNodePressed,
                                selected: selectedNodeIds.contains(node.nodeId),
                              ),
                          ...widget.mapOverlays,
                          if (widget.showNavigationOverlay) ...[
                            UserPresenceMarker(
                              displayName: widget.userDisplayName,
                              observedHeadingDegrees:
                                  widget.observedHeadingDegrees,
                              position: widget.blueMarkerPosition,
                              wifiCorrection: widget.wifiCorrection,
                            ),
                            if (widget.showDiagnosticMapOverlays)
                              RedMarker(marker: widget.redMarker),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        if (widget.showNavigationOverlay &&
            widget.navigationOverlayBuilder != null)
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: widget.navigationOverlayBuilder!(
              context,
              widget.navigation,
              widget.wrongWayReroute,
            ),
          ),
      ],
    );
  }
}
