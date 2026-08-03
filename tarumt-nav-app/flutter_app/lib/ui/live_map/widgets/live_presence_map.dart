import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/domain/presence/presence_position_resolver.dart';
import 'package:indoor_navigation/domain/tiled/route/route_progress.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/live_map/widgets/live_presence_actor_marker.dart';
import 'package:indoor_navigation/ui/map/indoor_map_viewport.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class LivePresenceMapKeys {
  static const map = ValueKey<String>('live-map.map');
  static const unavailable = ValueKey<String>('live-map.map-unavailable');

  static ValueKey<String> actor(String presenceId) =>
      ValueKey<String>('live-map.actor.$presenceId');
}

final class LivePresenceMap extends StatelessWidget {
  const LivePresenceMap({
    required this.hasFloorMap,
    required this.mapImage,
    required this.mapModel,
    required this.onZoomChanged,
    required this.presences,
    required this.selectedFloorCode,
    required this.userDisplayName,
    required this.zoom,
    super.key,
  });

  final bool hasFloorMap;
  final MapImageLocation? mapImage;
  final PngMapModel? mapModel;
  final ValueChanged<double> onZoomChanged;
  final List<AnonymousPresence> presences;
  final String selectedFloorCode;
  final String userDisplayName;
  final double zoom;

  @override
  Widget build(BuildContext context) {
    final model = mapModel;
    final image = mapImage;
    if (!hasFloorMap || model == null || image == null) {
      return _UnavailableFloorMap(floorCode: selectedFloorCode);
    }
    final fallbackPosition = interpolateRoutePosition(model.routePath, 0);
    final markers = <Widget>[];
    var assignedUserName = false;
    for (final presence in presences.take(maxPresenceRepresentatives)) {
      final position = resolvePresenceRoutePosition(
        presence: presence,
        routeNodes: model.routeNodes,
      );
      if (position == null) {
        debugPrint(
          'Live presence actor ${presence.presenceId} could not resolve edge '
          '${presence.fromNodeId}->${presence.toNodeId} on $selectedFloorCode.',
        );
      }
      if (position != null) {
        final isDefaultGhostBob =
            !assignedUserName &&
            presence.origin == PresenceOrigin.localSimulation;
        if (isDefaultGhostBob) assignedUserName = true;
        markers.add(
          LivePresenceActorMarker(
            displayNameOverride: isDefaultGhostBob ? userDisplayName : null,
            key: LivePresenceMapKeys.actor(presence.presenceId),
            presence: presence,
            position: position,
          ),
        );
      }
    }
    return DecoratedBox(
      key: LivePresenceMapKeys.map,
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: CampusNavigatorColors.border, width: 1.5),
        ),
      ),
      child: IndoorMapViewport(
        blueMarkerPosition: fallbackPosition,
        mapImage: image,
        mapModel: model,
        mapOverlays: markers,
        onZoomChanged: onZoomChanged,
        redMarker: model.redMarker,
        remainingPathSegments: const <OverlayPathSegment>[],
        showDiagnosticMapOverlays: false,
        showNavigationOverlay: false,
        zoom: zoom,
      ),
    );
  }
}

final class _UnavailableFloorMap extends StatelessWidget {
  const _UnavailableFloorMap({required this.floorCode});

  final String floorCode;

  @override
  Widget build(BuildContext context) {
    return Center(
      key: LivePresenceMapKeys.unavailable,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.layers_outlined,
              color: CampusNavigatorColors.accent,
              size: 44,
            ),
            const SizedBox(height: 12),
            Text(
              '$floorCode floor map coming soon',
              style: const TextStyle(
                color: CampusNavigatorColors.text,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            const Text(
              'Live occupancy is available. Add this floor\'s map assets to '
              'enable representative actors.',
              style: TextStyle(
                color: CampusNavigatorColors.textMuted,
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
