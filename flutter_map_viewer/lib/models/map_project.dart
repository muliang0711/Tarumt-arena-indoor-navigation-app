import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui';

class MapProject {
  MapProject({
    required this.schemaVersion,
    required this.mapId,
    required this.tileSize,
    required this.mapWidth,
    required this.mapHeight,
    required this.resourceRoot,
    required this.background,
    required this.placements,
    required this.nodes,
    required this.links,
    required this.resolvedTiles,
    required this.spawn,
  });

  factory MapProject.fromJsonString(String source) {
    final decoded = jsonDecode(source);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Map JSON must be an object.');
    }
    return MapProject.fromJson(decoded);
  }

  factory MapProject.fromJson(Map<String, dynamic> json) {
    final metadata = json['metadata'];
    final metadataMap = metadata is Map<String, dynamic> ? metadata : const <String, dynamic>{};
    final navigation = json['navigation'];
    final navigationMap = navigation is Map<String, dynamic> ? navigation : const <String, dynamic>{};
    final visual = json['visual'];
    final visualMap = visual is Map<String, dynamic> ? visual : const <String, dynamic>{};
    final background = json['background'];
    final backgroundMap = background is Map<String, dynamic> ? background : const <String, dynamic>{};
    final spawn = json['spawn'];
    final spawnMap = spawn is Map<String, dynamic> ? spawn : const <String, dynamic>{};
    final tileSize = _readInt(json['tileSize'], fallback: 16);
    final mapWidth = _readInt(json['mapWidth'], fallback: 12);
    final mapHeight = _readInt(json['mapHeight'], fallback: 8);
    final rawPlacements = visualMap['placements'] is List
        ? visualMap['placements'] as List<dynamic>
        : json['placements'] is List
            ? json['placements'] as List<dynamic>
            : const <dynamic>[];

    final rawNodes = navigationMap['nodes'] is List
        ? navigationMap['nodes'] as List<dynamic>
        : json['nodes'] is List
            ? json['nodes'] as List<dynamic>
            : metadataMap['nodes'] is List
            ? metadataMap['nodes'] as List<dynamic>
            : metadataMap['anchors'] is List
                ? metadataMap['anchors'] as List<dynamic>
                : const <dynamic>[];

    final rawLinks = navigationMap['links'] is List
        ? navigationMap['links'] as List<dynamic>
        : json['links'] is List
            ? json['links'] as List<dynamic>
            : metadataMap['links'] is List
            ? metadataMap['links'] as List<dynamic>
            : const <dynamic>[];

    final rawResolvedTiles = metadataMap['resolvedTiles'] is List
        ? metadataMap['resolvedTiles'] as List<dynamic>
        : metadataMap['tiles'] is List
            ? metadataMap['tiles'] as List<dynamic>
            : const <dynamic>[];

    return MapProject(
      schemaVersion: _readInt(json['schemaVersion'], fallback: 1),
      mapId: (json['mapId'] as Object?)?.toString().trim().isNotEmpty == true
          ? json['mapId'].toString().trim()
          : 'map_project',
      tileSize: tileSize,
      mapWidth: math.max(mapWidth, 1),
      mapHeight: math.max(mapHeight, 1),
      resourceRoot: (json['resourceRoot'] as Object?)?.toString().trim().isNotEmpty == true
          ? json['resourceRoot'].toString().trim()
          : 'resources/serious_shit',
      background: BackgroundConfig.fromJson(backgroundMap),
      placements: rawPlacements
          .whereType<Map<String, dynamic>>()
          .map(MapPlacement.fromJson)
          .where((placement) => placement.assetId.isNotEmpty)
          .toList(growable: false),
      nodes: rawNodes
          .whereType<Map<String, dynamic>>()
          .map(MapNode.fromJson)
          .where((node) => node.id.isNotEmpty)
          .toList(growable: false),
      links: rawLinks
          .whereType<Map<String, dynamic>>()
          .map(MapLink.fromJson)
          .where((link) => link.id.isNotEmpty && link.from.isNotEmpty && link.to.isNotEmpty)
          .toList(growable: false),
      resolvedTiles: rawResolvedTiles
          .whereType<Map<String, dynamic>>()
          .map(MapTile.fromJson)
          .toList(growable: false),
      spawn: PlayerSpawn.fromJson(
        spawnMap['playerStart'] is Map<String, dynamic>
            ? spawnMap['playerStart'] as Map<String, dynamic>
            : const <String, dynamic>{},
      ),
    );
  }

  final int schemaVersion;
  final String mapId;
  final int tileSize;
  final int mapWidth;
  final int mapHeight;
  final String resourceRoot;
  final BackgroundConfig background;
  final List<MapPlacement> placements;
  final List<MapNode> nodes;
  final List<MapLink> links;
  final List<MapTile> resolvedTiles;
  final PlayerSpawn spawn;

  double get pixelWidth => mapWidth * tileSize.toDouble();
  double get pixelHeight => mapHeight * tileSize.toDouble();

  String tileKindAt(int x, int y) {
    for (final tile in resolvedTiles) {
      if (tile.x.round() == x && tile.y.round() == y) {
        return tile.kind;
      }
    }
    return 'walkable';
  }

  bool isBlocked(int x, int y) {
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) {
      return true;
    }
    return tileKindAt(x, y) == 'blocked';
  }

  MapNode? nodeById(String? id) {
    if (id == null) {
      return null;
    }
    for (final node in nodes) {
      if (node.id == id) {
        return node;
      }
    }
    return null;
  }

  Offset nodeCenter(MapNode node) {
    return Offset((node.x + 0.5) * tileSize, (node.y + 0.5) * tileSize);
  }

  Rect routeBounds(List<MapNode> routeNodes) {
    if (routeNodes.isEmpty) {
      return Rect.fromLTWH(0, 0, pixelWidth, pixelHeight);
    }

    var minX = double.infinity;
    var maxX = double.negativeInfinity;
    var minY = double.infinity;
    var maxY = double.negativeInfinity;

    for (final node in routeNodes) {
      final point = nodeCenter(node);
      minX = math.min(minX, point.dx);
      maxX = math.max(maxX, point.dx);
      minY = math.min(minY, point.dy);
      maxY = math.max(maxY, point.dy);
    }

    final margin = tileSize * 2.5;
    return Rect.fromLTRB(
      math.max(0, minX - margin),
      math.max(0, minY - margin),
      math.min(pixelWidth, maxX + margin),
      math.min(pixelHeight, maxY + margin),
    );
  }

  RouteResult buildRoute(String? startId, String? endId) {
    final start = nodeById(startId);
    final end = nodeById(endId);
    if (start == null || end == null) {
      return const RouteResult.empty();
    }
    if (start.id == end.id) {
      return RouteResult(nodes: [start], tileDistance: 0);
    }

    final adjacency = <String, List<_Edge>>{};
    for (final link in links) {
      final from = nodeById(link.from);
      final to = nodeById(link.to);
      if (from == null || to == null) {
        continue;
      }
      final distance = _tileDistance(from, to);
      adjacency.putIfAbsent(from.id, () => []).add(_Edge(nodeId: to.id, weight: distance));
      adjacency.putIfAbsent(to.id, () => []).add(_Edge(nodeId: from.id, weight: distance));
    }

    final distances = <String, double>{for (final node in nodes) node.id: double.infinity};
    final previous = <String, String?>{};
    final unvisited = <String>{for (final node in nodes) node.id};
    distances[start.id] = 0;

    while (unvisited.isNotEmpty) {
      String? currentId;
      var best = double.infinity;
      for (final candidate in unvisited) {
        final value = distances[candidate] ?? double.infinity;
        if (value < best) {
          best = value;
          currentId = candidate;
        }
      }

      if (currentId == null || best == double.infinity) {
        break;
      }

      if (currentId == end.id) {
        break;
      }

      unvisited.remove(currentId);
      for (final edge in adjacency[currentId] ?? const <_Edge>[]) {
        if (!unvisited.contains(edge.nodeId)) {
          continue;
        }
        final candidateDistance = best + edge.weight;
        if (candidateDistance < (distances[edge.nodeId] ?? double.infinity)) {
          distances[edge.nodeId] = candidateDistance;
          previous[edge.nodeId] = currentId;
        }
      }
    }

    if ((distances[end.id] ?? double.infinity) == double.infinity) {
      return const RouteResult.empty();
    }

    final routeIds = <String>[end.id];
    var walkId = end.id;
    while (walkId != start.id) {
      final nextId = previous[walkId];
      if (nextId == null) {
        return const RouteResult.empty();
      }
      routeIds.add(nextId);
      walkId = nextId;
    }

    final routeNodes = routeIds.reversed.map(nodeById).whereType<MapNode>().toList(growable: false);
    return RouteResult(nodes: routeNodes, tileDistance: distances[end.id] ?? 0);
  }

  static double _tileDistance(MapNode left, MapNode right) {
    final dx = (left.x - right.x).abs().toDouble();
    final dy = (left.y - right.y).abs().toDouble();
    return math.sqrt((dx * dx) + (dy * dy));
  }

  static int _readInt(Object? value, {required int fallback}) {
    if (value is int) {
      return value;
    }
    if (value is num) {
      return value.round();
    }
    return fallback;
  }
}

class MapNode {
  MapNode({
    required this.id,
    required this.label,
    required this.type,
    required this.x,
    required this.y,
  });

  factory MapNode.fromJson(Map<String, dynamic> json) {
    final id = (json['id'] as Object?)?.toString().trim() ?? '';
    final rawLabel = (json['label'] as Object?)?.toString().trim() ?? '';
    return MapNode(
      id: id,
      label: rawLabel.isEmpty ? id : rawLabel,
      type: (json['type'] as Object?)?.toString().trim() ?? 'destination',
      x: (json['x'] as num?)?.toDouble() ?? 0,
      y: (json['y'] as num?)?.toDouble() ?? 0,
    );
  }

  final String id;
  final String label;
  final String type;
  final double x;
  final double y;
}

class MapPlacement {
  MapPlacement({
    required this.id,
    required this.assetId,
    required this.tileX,
    required this.tileY,
  });

  factory MapPlacement.fromJson(Map<String, dynamic> json) {
    return MapPlacement(
      id: (json['id'] as Object?)?.toString().trim() ?? '',
      assetId: (json['assetId'] as Object?)?.toString().trim() ?? '',
      tileX: (json['tileX'] as num?)?.toDouble() ?? (json['x'] as num?)?.toDouble() ?? 0,
      tileY: (json['tileY'] as num?)?.toDouble() ?? (json['y'] as num?)?.toDouble() ?? 0,
    );
  }

  final String id;
  final String assetId;
  final double tileX;
  final double tileY;
}

class MapLink {
  MapLink({
    required this.id,
    required this.from,
    required this.to,
  });

  factory MapLink.fromJson(Map<String, dynamic> json) {
    return MapLink(
      id: (json['id'] as Object?)?.toString().trim() ?? '',
      from: (json['from'] as Object?)?.toString().trim() ?? '',
      to: (json['to'] as Object?)?.toString().trim() ?? '',
    );
  }

  final String id;
  final String from;
  final String to;
}

class MapTile {
  MapTile({
    required this.x,
    required this.y,
    required this.kind,
  });

  factory MapTile.fromJson(Map<String, dynamic> json) {
    return MapTile(
      x: (json['x'] as num?)?.toDouble() ?? 0,
      y: (json['y'] as num?)?.toDouble() ?? 0,
      kind: (json['kind'] as Object?)?.toString().trim() ?? 'blocked',
    );
  }

  final double x;
  final double y;
  final String kind;
}

class BackgroundConfig {
  BackgroundConfig({
    required this.mode,
    required this.walkableAssetId,
    required this.blockedAssetId,
  });

  factory BackgroundConfig.fromJson(Map<String, dynamic> json) {
    return BackgroundConfig(
      mode: (json['mode'] as Object?)?.toString().trim() ?? 'auto-tile',
      walkableAssetId: (json['walkableAssetId'] as Object?)?.toString().trim().isNotEmpty == true
          ? json['walkableAssetId'].toString().trim()
          : 'serious_shit__walkable_road_clean',
      blockedAssetId: (json['blockedAssetId'] as Object?)?.toString().trim().isNotEmpty == true
          ? json['blockedAssetId'].toString().trim()
          : 'serious_shit__unwalkable_tile_clean',
    );
  }

  final String mode;
  final String walkableAssetId;
  final String blockedAssetId;
}

class PlayerSpawn {
  PlayerSpawn({
    required this.x,
    required this.y,
    required this.direction,
  });

  factory PlayerSpawn.fromJson(Map<String, dynamic> json) {
    return PlayerSpawn(
      x: (json['x'] as num?)?.toDouble() ?? 1,
      y: (json['y'] as num?)?.toDouble() ?? 1,
      direction: (json['direction'] as Object?)?.toString().trim() ?? 'down',
    );
  }

  final double x;
  final double y;
  final String direction;
}

class RouteResult {
  const RouteResult({
    required this.nodes,
    required this.tileDistance,
  });

  const RouteResult.empty()
      : nodes = const <MapNode>[],
        tileDistance = 0;

  final List<MapNode> nodes;
  final double tileDistance;

  bool get hasRoute => nodes.length >= 2;
  int get segmentCount => nodes.length > 1 ? nodes.length - 1 : 0;
}

class _Edge {
  const _Edge({
    required this.nodeId,
    required this.weight,
  });

  final String nodeId;
  final double weight;
}
