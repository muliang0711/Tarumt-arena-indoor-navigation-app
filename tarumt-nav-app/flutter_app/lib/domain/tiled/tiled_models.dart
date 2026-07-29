class OverlayPoint {
  const OverlayPoint({
    required this.screenX,
    required this.screenY,
    required this.tiledX,
    required this.tiledY,
  });

  final double screenX;
  final double screenY;
  final double tiledX;
  final double tiledY;
}

final class BlueMarkerState extends OverlayPoint {
  const BlueMarkerState({
    required super.screenX,
    required super.screenY,
    required super.tiledX,
    required super.tiledY,
    required this.routeNodeId,
  });

  static const kind = 'blueMarker';
  final String routeNodeId;
}

final class RedMarkerState extends OverlayPoint {
  const RedMarkerState({
    required super.screenX,
    required super.screenY,
    required super.tiledX,
    required super.tiledY,
    required this.headingDegrees,
  });

  final double headingDegrees;
  static const kind = 'redMarker';
}

final class OverlayPathSegment {
  const OverlayPathSegment({
    required this.fromNodeId,
    required this.key,
    required this.length,
    required this.rotationDegrees,
    required this.toNodeId,
    required this.x,
    required this.y,
  });

  final String fromNodeId;
  final String key;
  final double length;
  final double rotationDegrees;
  final String toNodeId;
  final double x;
  final double y;
}

final class OverlayRoomLabel extends OverlayPoint {
  const OverlayRoomLabel({
    required super.screenX,
    required super.screenY,
    required super.tiledX,
    required super.tiledY,
    required this.height,
    required this.id,
    required this.name,
    required this.width,
  });

  final double height;
  final int id;
  final String name;
  final double width;
}

final class OverlayRouteNode extends OverlayPoint {
  const OverlayRouteNode({
    required super.screenX,
    required super.screenY,
    required super.tiledX,
    required super.tiledY,
    required this.id,
    required this.nodeId,
    required this.type,
  });

  final int id;
  final String nodeId;
  final String type;
}

final class RoutePosition extends OverlayPoint {
  const RoutePosition({
    required super.screenX,
    required super.screenY,
    required super.tiledX,
    required super.tiledY,
    required this.distanceAlongRoute,
    required this.headingDegrees,
    required this.segmentIndex,
  });

  final double distanceAlongRoute;
  final double headingDegrees;
  final int segmentIndex;
}

final class RouteSnapResult {
  const RouteSnapResult({required this.driftPixels, required this.position});

  final double driftPixels;
  final RoutePosition position;
}

final class SurfaceRect {
  const SurfaceRect({
    required this.height,
    required this.originX,
    required this.originY,
    required this.width,
  });

  final double height;
  final double originX;
  final double originY;
  final double width;
}

final class TileBounds {
  const TileBounds({
    required this.height,
    required this.maxX,
    required this.maxY,
    required this.minX,
    required this.minY,
    required this.width,
  });

  final int height;
  final int maxX;
  final int maxY;
  final int minX;
  final int minY;
  final int width;
}

final class TiledChunk {
  TiledChunk({
    required List<int> data,
    required this.height,
    required this.width,
    required this.x,
    required this.y,
  }) : data = List.unmodifiable(data);

  final List<int> data;
  final int height;
  final int width;
  final int x;
  final int y;
}

sealed class TiledLayer {
  const TiledLayer({
    required this.id,
    required this.name,
    required this.opacity,
    required this.visible,
    required this.x,
    required this.y,
  });

  final int id;
  final String name;
  final double? opacity;
  final bool? visible;
  final int? x;
  final int? y;
  String get layerType;
}

final class TiledImageLayer extends TiledLayer {
  const TiledImageLayer({
    required super.id,
    required super.name,
    super.opacity,
    super.visible,
    super.x,
    super.y,
    this.image,
  });

  final String? image;
  @override
  String get layerType => 'imagelayer';
}

final class TiledObjectLayer extends TiledLayer {
  TiledObjectLayer({
    required super.id,
    required super.name,
    super.opacity,
    super.visible,
    super.x,
    super.y,
    List<TiledObject>? objects,
  }) : objects = objects == null ? null : List.unmodifiable(objects);

  final List<TiledObject>? objects;
  @override
  String get layerType => 'objectgroup';
}

final class TiledTileLayer extends TiledLayer {
  TiledTileLayer({
    required super.id,
    required super.name,
    super.opacity,
    super.visible,
    super.x,
    super.y,
    List<TiledChunk>? chunks,
    List<int>? data,
    this.height,
    this.startX,
    this.startY,
    this.width,
  }) : chunks = chunks == null ? null : List.unmodifiable(chunks),
       data = data == null ? null : List.unmodifiable(data);

  final List<TiledChunk>? chunks;
  final List<int>? data;
  final int? height;
  final int? startX;
  final int? startY;
  final int? width;
  @override
  String get layerType => 'tilelayer';
}

final class TiledProperty {
  TiledProperty({required this.name, required this.type, required this.value})
    : assert(value is bool || value is num || value is String);

  final String name;
  final String type;
  final Object value;
}

final class TiledObjectText {
  const TiledObjectText({this.text, this.wrap});

  final String? text;
  final bool? wrap;
}

final class TiledObject {
  TiledObject({
    required this.id,
    required this.name,
    required this.x,
    required this.y,
    this.height,
    this.point,
    List<TiledProperty>? properties,
    this.text,
    this.type,
    this.width,
  }) : properties = properties == null ? null : List.unmodifiable(properties);

  final double? height;
  final int id;
  final String name;
  final bool? point;
  final List<TiledProperty>? properties;
  final TiledObjectText? text;
  final String? type;
  final double? width;
  final double x;
  final double y;
}

final class TiledTileset {
  const TiledTileset({
    required this.columns,
    required this.firstGid,
    required this.image,
    required this.imageHeight,
    required this.imageWidth,
    required this.name,
    required this.tileCount,
    required this.tileHeight,
    required this.tileWidth,
    this.margin,
    this.spacing,
  });

  final int columns;
  final int firstGid;
  final String image;
  final int imageHeight;
  final int imageWidth;
  final int? margin;
  final String name;
  final int? spacing;
  final int tileCount;
  final int tileHeight;
  final int tileWidth;
}

final class TiledMap {
  TiledMap({
    required this.height,
    required List<TiledLayer> layers,
    required this.orientation,
    required this.tileHeight,
    required List<TiledTileset> tilesets,
    required this.tileWidth,
    required this.version,
    required this.width,
    this.infinite,
    this.renderOrder,
  }) : layers = List.unmodifiable(layers),
       tilesets = List.unmodifiable(tilesets);

  final int height;
  final bool? infinite;
  final List<TiledLayer> layers;
  final String orientation;
  final String? renderOrder;
  final int tileHeight;
  final List<TiledTileset> tilesets;
  final int tileWidth;
  static const type = 'map';
  final String version;
  final int width;
}

final class DemoPngMetadata {
  const DemoPngMetadata({required this.height, required this.width});

  final int height;
  static const name = 'demo_1.png';
  final int width;
}

final class PngMapModel {
  PngMapModel({
    required this.blueMarker,
    required this.bounds,
    required this.map,
    required List<OverlayRouteNode> routePath,
    required List<OverlayPathSegment> pathSegments,
    required this.png,
    required this.redMarker,
    required List<OverlayRoomLabel> roomLabels,
    required List<OverlayRouteNode> routeNodes,
    required this.surface,
  }) : routePath = List.unmodifiable(routePath),
       pathSegments = List.unmodifiable(pathSegments),
       roomLabels = List.unmodifiable(roomLabels),
       routeNodes = List.unmodifiable(routeNodes);

  final BlueMarkerState blueMarker;
  final TileBounds bounds;
  final TiledMap map;
  final List<OverlayRouteNode> routePath;
  final List<OverlayPathSegment> pathSegments;
  final DemoPngMetadata png;
  final RedMarkerState redMarker;
  final List<OverlayRoomLabel> roomLabels;
  final List<OverlayRouteNode> routeNodes;
  final SurfaceRect surface;
}
