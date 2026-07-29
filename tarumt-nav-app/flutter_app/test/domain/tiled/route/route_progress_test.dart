import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/tiled/route/route_progress.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

import 'route_test_data.dart';

void main() {
  group('calculateRouteDistance', () {
    test('sums the complete fixed route', () {
      expect(calculateRouteDistance(demoRoutePath), 2542);
    });

    test('returns zero for empty and single-point routes', () {
      expect(calculateRouteDistance(const <OverlayPoint>[]), 0);
      expect(
        calculateRouteDistance(const <OverlayPoint>[
          OverlayPoint(screenX: 1, screenY: 2, tiledX: 3, tiledY: 4),
        ]),
        0,
      );
    });
  });

  group('interpolateRoutePosition', () {
    test('interpolates progress only along the fixed route', () {
      final start = interpolateRoutePosition(demoRoutePath, 0);
      final end = interpolateRoutePosition(demoRoutePath, 2542);

      _expectPosition(
        start,
        distance: 0,
        heading: 0,
        segment: 0,
        screenX: 236,
        screenY: 648,
        tiledX: -20,
        tiledY: 904,
      );
      _expectPosition(
        end,
        distance: 2542,
        heading: -90,
        segment: 10,
        screenX: 176,
        screenY: 648,
        tiledX: -80,
        tiledY: 904,
      );
    });

    test('interpolates coordinates and clamps progress to route bounds', () {
      final middle = interpolateRoutePosition(turnRoutePath, 150);
      final beforeStart = interpolateRoutePosition(turnRoutePath, -50);
      final pastEnd = interpolateRoutePosition(turnRoutePath, 250);

      _expectPosition(
        middle,
        distance: 150,
        heading: 90,
        segment: 1,
        screenX: 100,
        screenY: 50,
        tiledX: 100,
        tiledY: 50,
      );
      expect(beforeStart.distanceAlongRoute, 0);
      expect(beforeStart.screenX, 0);
      expect(pastEnd.distanceAlongRoute, 200);
      expect(pastEnd.screenY, 100);
    });

    test('returns the single point with fallback route metadata', () {
      final position = interpolateRoutePosition(const <OverlayPoint>[
        OverlayPoint(screenX: 1, screenY: 2, tiledX: 3, tiledY: 4),
      ], 10);

      _expectPosition(
        position,
        distance: 0,
        heading: 0,
        segment: 0,
        screenX: 1,
        screenY: 2,
        tiledX: 3,
        tiledY: 4,
      );
    });

    test('uses zero progress for a degenerate segment', () {
      final position = interpolateRoutePosition(const <OverlayPoint>[
        OverlayPoint(screenX: 1, screenY: 2, tiledX: 3, tiledY: 4),
        OverlayPoint(screenX: 1, screenY: 2, tiledX: 3, tiledY: 4),
      ], 8);

      expect(position.distanceAlongRoute, 0);
      expect(position.segmentIndex, 0);
      expect(position.screenX, 1);
      expect(position.headingDegrees, 0);
    });

    test('rejects an empty route', () {
      expect(
        () => interpolateRoutePosition(const <OverlayPoint>[], 0),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'Cannot interpolate an empty route path.',
          ),
        ),
      );
    });
  });

  group('createRemainingRouteSegments', () {
    test('trims segments from the interpolated progress point', () {
      final remainingAtStart = createRemainingRouteSegments(demoRoutePath, 0);
      final remainingAtTurn = createRemainingRouteSegments(turnRoutePath, 150);

      expect(remainingAtStart, hasLength(11));
      expect(remainingAtStart.first.fromNodeId, 'point-0');
      expect(remainingAtStart.first.toNodeId, 'node-20');
      expect(remainingAtTurn, hasLength(1));
      expect(remainingAtTurn.single.fromNodeId, 'point-0');
      expect(remainingAtTurn.single.toNodeId, 'C');
      expect(remainingAtTurn.single.length, 50);
      expect(remainingAtTurn.single.rotationDegrees, 90);
    });

    test('returns no segments at the end or without two points', () {
      expect(
        createRemainingRouteSegments(
          demoRoutePath,
          calculateRouteDistance(demoRoutePath),
        ),
        isEmpty,
      );
      expect(createRemainingRouteSegments(const <OverlayPoint>[], 0), isEmpty);
      expect(
        createRemainingRouteSegments(const <OverlayPoint>[
          OverlayPoint(screenX: 0, screenY: 0, tiledX: 0, tiledY: 0),
        ], 0),
        isEmpty,
      );
    });

    test('filters remaining segments at or below the 0.001 gate', () {
      final segments = createRemainingRouteSegments(const <OverlayPoint>[
        OverlayPoint(screenX: 0, screenY: 0, tiledX: 0, tiledY: 0),
        OverlayPoint(screenX: 0.001, screenY: 0, tiledX: 0.001, tiledY: 0),
      ], 0);

      expect(segments, isEmpty);
    });
  });
}

void _expectPosition(
  RoutePosition position, {
  required double distance,
  required double heading,
  required int segment,
  required double screenX,
  required double screenY,
  required double tiledX,
  required double tiledY,
}) {
  expect(position.distanceAlongRoute, distance);
  expect(position.headingDegrees, heading);
  expect(position.segmentIndex, segment);
  expect(position.screenX, screenX);
  expect(position.screenY, screenY);
  expect(position.tiledX, tiledX);
  expect(position.tiledY, tiledY);
}
