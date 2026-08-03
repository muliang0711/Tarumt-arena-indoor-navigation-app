import 'dart:math' as math;

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
    final resolvedPositions = <String, RoutePosition>{};
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
      } else {
        resolvedPositions[presence.presenceId] = position;
      }
    }
    final displayPositions = spreadOverlappingActorPositions(resolvedPositions);
    final markers = <Widget>[];
    var assignedUserName = false;
    for (final presence in presences.take(maxPresenceRepresentatives)) {
      final position = displayPositions[presence.presenceId];
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

/// Spreads actors that resolve to the same map point into a small, stable fan.
///
/// Presence IDs determine the order so a snapshot refresh does not make actors
/// randomly swap sides. The offset is visual only; route and occupancy data
/// keep their authoritative coordinates.
Map<String, RoutePosition> spreadOverlappingActorPositions(
  Map<String, RoutePosition> positions, {
  double collisionRadiusPixels = 8,
  double spreadRadiusPixels = 22,
}) {
  if (positions.length < 2) return Map.unmodifiable(positions);
  final entries = positions.entries.toList()
    ..sort((left, right) => left.key.compareTo(right.key));
  final groups = <List<MapEntry<String, RoutePosition>>>[];
  for (final entry in entries) {
    final group = groups.where((candidate) {
      final anchor = candidate.first.value;
      return math.sqrt(
            math.pow(anchor.screenX - entry.value.screenX, 2) +
                math.pow(anchor.screenY - entry.value.screenY, 2),
          ) <=
          collisionRadiusPixels;
    }).firstOrNull;
    if (group == null) {
      groups.add([entry]);
    } else {
      group.add(entry);
    }
  }

  final spread = <String, RoutePosition>{};
  for (final group in groups) {
    if (group.length == 1) {
      spread[group.single.key] = group.single.value;
      continue;
    }
    for (var index = 0; index < group.length; index += 1) {
      final entry = group[index];
      final angle = -math.pi / 2 + (2 * math.pi * index / group.length);
      final source = entry.value;
      spread[entry.key] = RoutePosition(
        distanceAlongRoute: source.distanceAlongRoute,
        headingDegrees: source.headingDegrees,
        screenX: source.screenX + math.cos(angle) * spreadRadiusPixels,
        screenY: source.screenY + math.sin(angle) * spreadRadiusPixels,
        segmentIndex: source.segmentIndex,
        tiledX: source.tiledX,
        tiledY: source.tiledY,
      );
    }
  }
  return Map.unmodifiable(spread);
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
