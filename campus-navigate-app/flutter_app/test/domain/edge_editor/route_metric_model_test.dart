import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/edge_editor/edge_editor_models.dart';
import 'package:indoor_navigation/domain/edge_editor/logic/route_graph_edge_model.dart';
import 'package:indoor_navigation/domain/edge_editor/logic/route_metric_model.dart';
import 'package:indoor_navigation/domain/tiled/map/png_map_model.dart';
import 'package:indoor_navigation/domain/tiled/parsing/tiled_map_parser.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

void main() {
  late PngMapModel mapModel;
  late List<RouteGraphEdgeExport> demoEdges;
  late RouteMetricModel metrics;

  setUpAll(() {
    final assetsDirectory = Directory.current.parent.uri.resolve(
      'assets/maps/',
    );
    final map = parseTiledMapJson(
      File.fromUri(
        assetsDirectory.resolve('demo_1.tmj.json'),
      ).readAsStringSync(),
    );
    mapModel = createPngMapModel(map);
    demoEdges = parseRouteGraphEdgeDocumentJson(
      File.fromUri(
        assetsDirectory.resolve('demo_1.edges.json'),
      ).readAsStringSync(),
    ).edges;
    metrics = createRouteMetricModel(mapModel.routePath, demoEdges);
  });

  test('creates authoritative route metrics from EDGE meter distances', () {
    expect(metrics.segments, hasLength(11));
    expect(metrics.totalMeters, 46);
    expect(metrics.totalPixels, 2542);
    expect(metrics.averagePixelsPerMeter, 2542 / 46);
    expect(
      metrics.segments
          .map(
            (segment) => <Object>[
              segment.fromNodeId,
              segment.meterLength,
              segment.toNodeId,
            ],
          )
          .toList(growable: false),
      <List<Object>>[
        <Object>['node-21', 3.0, 'node-20'],
        <Object>['node-20', 3.0, 'node-19'],
        <Object>['node-19', 3.0, 'node-18'],
        <Object>['node-18', 3.0, 'node-17'],
        <Object>['node-17', 3.0, 'node-16'],
        <Object>['node-16', 8.0, 'node-12'],
        <Object>['node-12', 6.0, 'node-13'],
        <Object>['node-13', 2.0, 'node-14'],
        <Object>['node-14', 3.0, 'node-15'],
        <Object>['node-15', 4.0, 'node-2'],
        <Object>['node-2', 8.0, 'node-1'],
      ],
    );
  });

  test('uses first bidirectional edge match in document order', () {
    final segment13To14 = metrics.segments.singleWhere(
      (segment) => segment.fromNodeId == 'node-13',
    );
    final segment15To2 = metrics.segments.singleWhere(
      (segment) => segment.fromNodeId == 'node-15',
    );

    expect(segment13To14.meterLength, 2);
    expect(segment15To2.meterLength, 4);
  });

  test('tracks cumulative starts, ends, and per-segment ratios', () {
    final first = metrics.segments.first;
    final second = metrics.segments[1];
    final last = metrics.segments.last;

    expect(first.startDistanceMeters, 0);
    expect(first.endDistanceMeters, 3);
    expect(first.startDistancePixels, 0);
    expect(first.endDistancePixels, 133);
    expect(first.pixelLength, 133);
    expect(first.pixelsPerMeter, 133 / 3);
    expect(second.startDistanceMeters, first.endDistanceMeters);
    expect(second.startDistancePixels, first.endDistancePixels);
    expect(last.endDistanceMeters, 46);
    expect(last.endDistancePixels, 2542);
  });

  test('converts PDR meters using the current route segment', () {
    final position = _position(distanceAlongRoute: 0);

    expect(
      findPixelsPerMeterAtRoutePosition(metrics: metrics, position: position),
      133 / 3,
    );
    expect(
      convertMetersToPixelsAtRoutePosition(
        meters: 0.75,
        metrics: metrics,
        position: position,
      ),
      33.25,
    );
  });

  test('uses the first segment at an inclusive shared boundary', () {
    final atBoundary = _position(distanceAlongRoute: 133);
    final afterBoundary = _position(distanceAlongRoute: 133.000001);

    expect(
      findPixelsPerMeterAtRoutePosition(metrics: metrics, position: atBoundary),
      133 / 3,
    );
    expect(
      findPixelsPerMeterAtRoutePosition(
        metrics: metrics,
        position: afterBoundary,
      ),
      237 / 3,
    );
  });

  test(
    'falls back to average ratio outside the route and for empty metrics',
    () {
      expect(
        findPixelsPerMeterAtRoutePosition(
          metrics: metrics,
          position: _position(distanceAlongRoute: -1),
        ),
        metrics.averagePixelsPerMeter,
      );
      expect(
        findPixelsPerMeterAtRoutePosition(
          metrics: metrics,
          position: _position(distanceAlongRoute: 3000),
        ),
        metrics.averagePixelsPerMeter,
      );

      final empty = createRouteMetricModel(
        const <OverlayRouteNode>[],
        const <RouteGraphEdgeExport>[],
      );
      expect(empty.segments, isEmpty);
      expect(empty.totalMeters, 0);
      expect(empty.totalPixels, 0);
      expect(empty.averagePixelsPerMeter, 1);
      expect(
        findPixelsPerMeterAtRoutePosition(
          metrics: empty,
          position: _position(distanceAlongRoute: 0),
        ),
        1,
      );
    },
  );

  test('fails for missing and non-positive EDGE distances', () {
    final route = mapModel.routePath.take(2).toList(growable: false);
    expect(
      () => createRouteMetricModel(route, const <RouteGraphEdgeExport>[]),
      throwsA(
        isA<StateError>().having(
          (error) => error.message,
          'message',
          'Missing EDGE distance for node-21 -> node-20.',
        ),
      ),
    );

    for (final distance in <double>[0, -1]) {
      final edge = RouteGraphEdgeExport(
        distance: distance,
        from: 'node-20',
        id: 'bad-edge',
        to: 'node-21',
      );
      expect(
        () => createRouteMetricModel(route, <RouteGraphEdgeExport>[edge]),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'EDGE distance must be positive for bad-edge.',
          ),
        ),
      );
    }
  });
}

RoutePosition _position({required double distanceAlongRoute}) {
  return RoutePosition(
    screenX: 0,
    screenY: 0,
    tiledX: 0,
    tiledY: 0,
    distanceAlongRoute: distanceAlongRoute,
    headingDegrees: 0,
    segmentIndex: 0,
  );
}
