import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/tiled/map/marker_model.dart';
import 'package:indoor_navigation/domain/tiled/map/object_overlay_model.dart';
import 'package:indoor_navigation/domain/tiled/map/path_segment_model.dart';
import 'package:indoor_navigation/domain/tiled/map/png_map_model.dart';
import 'package:indoor_navigation/domain/tiled/map/route_path_model.dart';
import 'package:indoor_navigation/domain/tiled/map/surface_model.dart';
import 'package:indoor_navigation/domain/tiled/map/tiled_map_layers.dart';
import 'package:indoor_navigation/domain/tiled/parsing/tiled_map_parser.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

void main() {
  late TiledMap map;

  setUpAll(() {
    final mapFile = File.fromUri(
      Directory.current.parent.uri.resolve(
        'expo-app/assets/maps/demo_1.tmj.json',
      ),
    );
    expect(mapFile.existsSync(), isTrue, reason: mapFile.path);
    map = parseTiledMapJson(mapFile.readAsStringSync());
  });

  group('typed TMJ parsing', () {
    test('parses supported metadata and preserves layer order', () {
      expect(map.orientation, 'orthogonal');
      expect(map.infinite, isTrue);
      expect(map.tileWidth, 16);
      expect(map.tileHeight, 16);
      expect(map.version, '1.10');
      expect(map.layers.map((layer) => layer.name), <String>[
        '图像图层 1',
        'layer1',
        'route-graph-layer',
        'room-label-layer',
        'layer2',
        'layer3',
        '图块层 4',
      ]);
      expect(map.layers.first, isA<TiledImageLayer>());
      expect(map.layers[1], isA<TiledTileLayer>());
      expect(map.layers[2], isA<TiledObjectLayer>());
      expect(map.tilesets, hasLength(12));
    });

    test('preserves optional geometry and int property values', () {
      final routeLayer = getObjectLayer(map, 'route-graph-layer');
      final firstNode = routeLayer!.objects!.first;
      expect(firstNode.height, 0.0);
      expect(firstNode.width, 0.0);
      expect(firstNode.point, isTrue);
      expect(firstNode.type, '');
      expect(firstNode.properties!.first.value, 2);
      expect(firstNode.properties!.first.value, isA<int>());

      final labelLayer = getObjectLayer(map, 'room-label-layer');
      final firstLabel = labelLayer!.objects!.first;
      expect(firstLabel.height, 18.84375);
      expect(firstLabel.text!.text, '');
      expect(firstLabel.text!.wrap, isTrue);
    });

    test('rejects unsupported document and layer types', () {
      expect(
        () => parseTiledMapJson('{"type":"world"}'),
        throwsA(
          isA<UnsupportedError>().having(
            (error) => error.message,
            'message',
            'Unsupported Tiled document type: world',
          ),
        ),
      );

      expect(
        () => parseTiledMapJson(_mapJsonWithLayerType('group')),
        throwsA(
          isA<UnsupportedError>().having(
            (error) => error.message,
            'message',
            'Unsupported Tiled layer type: group',
          ),
        ),
      );
    });

    test('reports the exact malformed field path', () {
      expect(
        () => parseTiledMapJson(_mapJsonWithLayerType('tilelayer', id: '1')),
        throwsA(
          isA<FormatException>().having(
            (error) => error.message,
            'message',
            r'$.layers[0].id must be an integer.',
          ),
        ),
      );
    });
  });

  group('map metadata and overlays', () {
    test('calculates chunk bounds and translated PNG surface', () {
      final bounds = calculateChunkTileBounds(
        map.layers.whereType<TiledTileLayer>().toList(growable: false),
      );
      final surface = createSurface(bounds, map);

      expect(bounds.minX, -16);
      expect(bounds.minY, 16);
      expect(bounds.maxX, 80);
      expect(bounds.maxY, 144);
      expect(bounds.width, 96);
      expect(bounds.height, 128);
      expect(surface.originX, -256);
      expect(surface.originY, 256);
      expect(surface.width, 1536);
      expect(surface.height, 2048);
    });

    test('uses visible tile layers and first matching object layer', () {
      final hidden = TiledTileLayer(
        id: 100,
        name: 'hidden',
        visible: false,
        chunks: <TiledChunk>[
          TiledChunk(data: const <int>[], height: 1, width: 1, x: 0, y: 0),
        ],
      );
      final visibleWithoutFlag = TiledTileLayer(
        id: 101,
        name: 'visible-by-default',
      );
      final duplicate = TiledObjectLayer(id: 102, name: 'room-label-layer');
      final customMap = _emptyMap(
        layers: <TiledLayer>[
          hidden,
          visibleWithoutFlag,
          ...map.layers,
          duplicate,
        ],
      );

      expect(
        getVisibleTileLayers(customMap).map((layer) => layer.name),
        <String>['visible-by-default', 'layer1', 'layer2', 'layer3', '图块层 4'],
      );
      expect(
        getObjectLayer(customMap, 'room-label-layer'),
        same(map.layers[3]),
      );
      expect(getObjectLayer(customMap, 'missing'), isNull);
    });

    test('throws when no chunk metadata exists', () {
      final layer = TiledTileLayer(id: 1, name: 'empty');
      expect(
        () => calculateChunkTileBounds(<TiledTileLayer>[layer]),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'No tile chunks were found for map bounds metadata.',
          ),
        ),
      );
    });

    test('projects coordinates using the negative chunk-origin offset', () {
      final model = createPngMapModel(map);
      final point = worldToScreenPoint(x: -80, y: 904, surface: model.surface);

      expect(point.tiledX, -80);
      expect(point.tiledY, 904);
      expect(point.screenX, 176);
      expect(point.screenY, 648);
    });

    test('returns room labels from object.name only', () {
      final model = createPngMapModel(map);
      final labels = getRoomLabels(map, model.surface);

      expect(labels, hasLength(13));
      expect(labels.singleWhere((label) => label.id == 77).name, 'TA256');
      expect(labels.any((label) => label.name == '你好，世界'), isFalse);
    });

    test('returns only named point objects as route nodes', () {
      final model = createPngMapModel(map);
      final nodes = getRouteNodes(map, model.surface);
      final first = nodes.first;

      expect(nodes, hasLength(22));
      expect(first.id, 50);
      expect(first.nodeId, 'node-1');
      expect(first.tiledX, -80);
      expect(first.tiledY, 904);
      expect(first.screenX, 176);
      expect(first.screenY, 648);
      expect(first.type, 'route-node');
    });

    test('keeps the route-node type fallback and trimming behavior', () {
      final objectLayer = TiledObjectLayer(
        id: 1,
        name: 'route-graph-layer',
        objects: <TiledObject>[
          TiledObject(
            id: 1,
            name: 'from-property',
            point: true,
            properties: <TiledProperty>[
              TiledProperty(name: 'type', type: 'string', value: ' node '),
            ],
            type: '',
            x: 0,
            y: 0,
          ),
          TiledObject(
            id: 2,
            name: 'from-object',
            point: true,
            properties: <TiledProperty>[
              TiledProperty(name: 'type', type: 'string', value: 'ignored'),
            ],
            type: ' junctions ',
            x: 1,
            y: 1,
          ),
          TiledObject(id: 3, name: '', point: true, x: 2, y: 2),
          TiledObject(id: 4, name: 'not-point', x: 3, y: 3),
        ],
      );
      final nodes = getRouteNodes(
        _emptyMap(layers: <TiledLayer>[objectLayer]),
        const SurfaceRect(height: 10, originX: 0, originY: 0, width: 10),
      );

      expect(nodes.map((node) => node.nodeId), <String>[
        'from-property',
        'from-object',
      ]);
      expect(nodes.map((node) => node.type), <String>['node', 'junctions']);
    });
  });

  group('fixed route, markers, and PNG composition', () {
    test('creates a PNG model matching the TMJ surface', () {
      final model = createPngMapModel(map);

      expect(model.png.width, 1536);
      expect(model.png.height, 2048);
      expect(DemoPngMetadata.name, 'demo_1.png');
      expect(model.surface.width, model.png.width);
      expect(model.surface.height, model.png.height);
      expect(model.map, same(map));
    });

    test('creates the configured EDGE-backed walk route', () {
      final model = createPngMapModel(map);
      final segments = createRoutePathSegments(model.routeNodes);

      expect(testRouteNodeIds, <String>[
        'node-21',
        'node-20',
        'node-19',
        'node-18',
        'node-17',
        'node-16',
        'node-12',
        'node-13',
        'node-14',
        'node-15',
        'node-2',
        'node-1',
      ]);
      expect(
        segments.map((segment) => '${segment.fromNodeId}->${segment.toNodeId}'),
        <String>[
          'node-21->node-20',
          'node-20->node-19',
          'node-19->node-18',
          'node-18->node-17',
          'node-17->node-16',
          'node-16->node-12',
          'node-12->node-13',
          'node-13->node-14',
          'node-14->node-15',
          'node-15->node-2',
          'node-2->node-1',
        ],
      );
      expect(
        segments.map((segment) => <double>[segment.x, segment.y]),
        <List<double>>[
          <double>[236, 648],
          <double>[369, 648],
          <double>[606, 648],
          <double>[829, 648],
          <double>[1048, 648],
          <double>[1248, 648],
          <double>[1248, 877],
          <double>[829, 877],
          <double>[606, 877],
          <double>[369, 877],
          <double>[176, 877],
        ],
      );
      expect(
        segments.fold<double>(0, (total, segment) => total + segment.length),
        2542,
      );
    });

    test('skips degenerate segments and preserves fallback point IDs', () {
      const points = <OverlayPoint>[
        OverlayPoint(screenX: 0, screenY: 0, tiledX: 0, tiledY: 0),
        OverlayPoint(screenX: 0.001, screenY: 0, tiledX: 0.001, tiledY: 0),
        OverlayPoint(screenX: 3, screenY: 4, tiledX: 3, tiledY: 4),
      ];
      final segments = createPathSegmentsFromPoints(points);

      expect(segments, hasLength(1));
      expect(segments.single.key, 'point-1->point-2');
      expect(segments.single.length, closeTo(4.9994, 0.001));
      expect(segments.single.rotationDegrees, closeTo(53.14, 0.01));
    });

    test('keeps blue and red marker state separate', () {
      final model = createPngMapModel(map);
      final blueMarker = createBlueMarkerState(model.routeNodes);
      final redMarker = createRedMarkerState(blueMarker);

      expect(BlueMarkerState.kind, 'blueMarker');
      expect(blueMarker.routeNodeId, 'node-21');
      expect(blueMarker.tiledX, -20);
      expect(blueMarker.tiledY, 904);
      expect(blueMarker.screenX, 236);
      expect(blueMarker.screenY, 648);
      expect(RedMarkerState.kind, 'redMarker');
      expect(redMarker.headingDegrees, 0);
      expect(redMarker.tiledX, 14);
      expect(redMarker.tiledY, 932);
      expect(redMarker.screenX, 270);
      expect(redMarker.screenY, 676);
    });

    test('fails when configured route nodes are absent', () {
      expect(
        () => createRoutePath(const <OverlayRouteNode>[], nodeIds: const ['x']),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'Missing test route node: x',
          ),
        ),
      );
      expect(
        () => createBlueMarkerState(const <OverlayRouteNode>[]),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'Missing blue marker route start node: node-21',
          ),
        ),
      );
    });

    test('rejects unsupported map metadata and mismatched PNG bounds', () {
      expect(
        () => assertSupportedMap(_emptyMap(orientation: 'isometric')),
        throwsA(
          isA<UnsupportedError>().having(
            (error) => error.message,
            'message',
            'Unsupported Tiled orientation: isometric',
          ),
        ),
      );
      expect(
        () => assertSupportedMap(_emptyMap(infinite: false)),
        throwsA(
          isA<UnsupportedError>().having(
            (error) => error.message,
            'message',
            'This app expects the demo infinite map export.',
          ),
        ),
      );

      final smallLayer = TiledTileLayer(
        id: 1,
        name: 'small',
        chunks: <TiledChunk>[
          TiledChunk(data: const <int>[], height: 1, width: 1, x: 0, y: 0),
        ],
      );
      expect(
        () => createPngMapModel(_emptyMap(layers: <TiledLayer>[smallLayer])),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'demo_1.png is 1536x2048, but the TMJ bounds are 16x16.',
          ),
        ),
      );
    });
  });
}

TiledMap _emptyMap({
  String orientation = 'orthogonal',
  bool infinite = true,
  List<TiledLayer> layers = const <TiledLayer>[],
}) {
  return TiledMap(
    height: 0,
    layers: layers,
    orientation: orientation,
    tileHeight: 16,
    tilesets: const <TiledTileset>[],
    tileWidth: 16,
    version: '1.10',
    width: 0,
    infinite: infinite,
  );
}

String _mapJsonWithLayerType(String type, {Object id = 1}) {
  return '''
  {
    "height": 0,
    "infinite": true,
    "layers": [{"id": ${id is String ? '"$id"' : id}, "name": "x", "type": "$type"}],
    "orientation": "orthogonal",
    "tileheight": 16,
    "tilesets": [],
    "tilewidth": 16,
    "type": "map",
    "version": "1.10",
    "width": 0
  }
  ''';
}
