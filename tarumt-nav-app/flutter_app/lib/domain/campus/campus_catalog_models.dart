import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';

enum CampusMapNodeKind { junction, room }

final class CampusMapNode {
  const CampusMapNode({
    required this.floorId,
    required this.id,
    required this.kind,
    required this.sourceObjectId,
    required this.x,
    required this.y,
    this.label,
    this.roomId,
  });

  final String floorId;
  final String id;
  final CampusMapNodeKind kind;
  final String? label;
  final String? roomId;
  final int sourceObjectId;
  final double x;
  final double y;
}

final class CampusFloorMapAssets {
  const CampusFloorMapAssets({
    required this.edgeAsset,
    required this.floorId,
    required this.mapAsset,
    required this.nodeAsset,
  });

  final String edgeAsset;
  final String floorId;
  final String mapAsset;
  final String nodeAsset;
}

final class CampusCatalog {
  CampusCatalog({
    required this.buildingName,
    required this.defaultFloorId,
    required List<CampusFloorMapAssets> floorMapAssets,
    required List<CampusFloor> floors,
    required List<CampusMapNode> nodes,
    required List<CampusRoom> rooms,
    required this.schemaVersion,
    required this.startNodeId,
  }) : floorMapAssets = List.unmodifiable(floorMapAssets),
       floors = List.unmodifiable(floors),
       nodes = List.unmodifiable(nodes),
       rooms = List.unmodifiable(rooms);

  final String buildingName;
  final String defaultFloorId;
  final List<CampusFloorMapAssets> floorMapAssets;
  final List<CampusFloor> floors;
  final List<CampusMapNode> nodes;
  final List<CampusRoom> rooms;
  final int schemaVersion;
  final String startNodeId;
}
