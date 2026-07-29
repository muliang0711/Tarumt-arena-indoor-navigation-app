import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/tiled/route/route_turn_gate.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

import 'route_test_data.dart';

void main() {
  test('keeps marker at turn until heading faces the next segment', () {
    final result = constrainEstimateToRouteProgress(
      estimateHeadingDegrees: 0,
      estimateScreenX: 100,
      estimateScreenY: 35,
      previousPosition: atTurnBeforeUserTurns,
      routePath: turnRoutePath,
    );

    expect(result.position.segmentIndex, 0);
    expect(result.position.distanceAlongRoute, 100);
    expect(result.position.screenX, 100);
    expect(result.position.screenY, 0);
  });

  test('allows marker onto next segment after user turns heading', () {
    final result = constrainEstimateToRouteProgress(
      estimateHeadingDegrees: 90,
      estimateScreenX: 100,
      estimateScreenY: 35,
      previousPosition: atTurnBeforeUserTurns,
      routePath: turnRoutePath,
    );

    expect(result.position.segmentIndex, 1);
    expect(result.position.distanceAlongRoute, 135);
    expect(result.position.screenX, 100);
    expect(result.position.screenY, 35);
  });

  test('switches desired heading near turn without changing segment', () {
    final facingCurrent = createTurnAwareRoutePosition(
      observedHeadingDegrees: 0,
      routePath: turnRoutePath,
      routePosition: atTurnBeforeUserTurns,
    );
    final facingNext = createTurnAwareRoutePosition(
      observedHeadingDegrees: 90,
      routePath: turnRoutePath,
      routePosition: atTurnBeforeUserTurns,
    );

    expect(facingCurrent.headingDegrees, 0);
    expect(facingCurrent.segmentIndex, 0);
    expect(facingNext.headingDegrees, 90);
    expect(facingNext.segmentIndex, 0);
  });

  test('accepts current and next headings while approaching a turn', () {
    final headings = createAcceptedRouteHeadingDegrees(
      routePath: turnRoutePath,
      routePosition: _positionOnFirstSegment(distance: 40),
    );

    expect(headings, <double>[0, 90]);
  });

  test('does not switch segment before the turn capture zone', () {
    final result = constrainEstimateToRouteProgress(
      estimateHeadingDegrees: 90,
      estimateScreenX: 40,
      estimateScreenY: 35,
      previousPosition: _positionOnFirstSegment(distance: 40),
      routePath: turnRoutePath,
    );

    expect(result.position.segmentIndex, 0);
    expect(result.position.distanceAlongRoute, 40);
    expect(result.position.screenX, 40);
    expect(result.position.screenY, 0);
  });

  test('moves marker backward on the current segment', () {
    final result = constrainEstimateToRouteProgress(
      estimateHeadingDegrees: 180,
      estimateScreenX: 60,
      estimateScreenY: 0,
      previousPosition: _positionOnFirstSegment(distance: 80),
      routePath: turnRoutePath,
    );

    expect(result.position.segmentIndex, 0);
    expect(result.position.distanceAlongRoute, 60);
    expect(result.position.screenX, 60);
    expect(result.position.screenY, 0);
  });

  test('allows marker from next segment back onto previous segment', () {
    final result = constrainEstimateToRouteProgress(
      estimateHeadingDegrees: 180,
      estimateScreenX: 65,
      estimateScreenY: 0,
      previousPosition: const RoutePosition(
        distanceAlongRoute: 100,
        headingDegrees: 90,
        screenX: 100,
        screenY: 0,
        segmentIndex: 1,
        tiledX: 100,
        tiledY: 0,
      ),
      routePath: turnRoutePath,
    );

    expect(result.position.segmentIndex, 0);
    expect(result.position.distanceAlongRoute, 65);
    expect(result.position.screenX, 65);
    expect(result.position.screenY, 0);
  });

  test('uses inclusive heading and capture-radius boundaries', () {
    const boundaryConfig = RouteTurnGateConfig(turnApproachRadiusPixels: 60);
    final previous = _positionOnFirstSegment(distance: 76);
    final result = constrainEstimateToRouteProgress(
      config: boundaryConfig,
      estimateHeadingDegrees: 55,
      estimateScreenX: 100,
      estimateScreenY: 10,
      previousPosition: previous,
      routePath: turnRoutePath,
    );
    final desired = createTurnAwareRoutePosition(
      config: boundaryConfig,
      observedHeadingDegrees: 55,
      routePath: turnRoutePath,
      routePosition: _positionOnFirstSegment(distance: 40),
    );

    expect(result.position.segmentIndex, 1);
    expect(desired.headingDegrees, 90);
    expect(desired.segmentIndex, 0);
  });

  test('removes a duplicate next heading within one degree', () {
    final headings = createAcceptedRouteHeadingDegrees(
      routePath: const <OverlayPoint>[
        OverlayPoint(screenX: 0, screenY: 0, tiledX: 0, tiledY: 0),
        OverlayPoint(screenX: 100, screenY: 0, tiledX: 100, tiledY: 0),
        OverlayPoint(screenX: 200, screenY: 1, tiledX: 200, tiledY: 1),
      ],
      routePosition: _positionOnFirstSegment(distance: 100),
    );

    expect(headings, <double>[0]);
  });

  test('clamps progress noise below 0.5 but not at 0.5', () {
    final previous = _positionOnFirstSegment(distance: 50);
    final tinyNoise = constrainEstimateToRouteProgress(
      estimateHeadingDegrees: 0,
      estimateScreenX: 50.49,
      estimateScreenY: 0,
      previousPosition: previous,
      routePath: turnRoutePath,
    );
    final boundaryNoise = constrainEstimateToRouteProgress(
      estimateHeadingDegrees: 0,
      estimateScreenX: 50.5,
      estimateScreenY: 0,
      previousPosition: previous,
      routePath: turnRoutePath,
    );

    expect(identical(tinyNoise.position, previous), isTrue);
    expect(boundaryNoise.position.distanceAlongRoute, 50.5);
  });

  test('keeps first candidate when current and next drifts tie', () {
    final result = constrainEstimateToRouteProgress(
      estimateHeadingDegrees: 90,
      estimateScreenX: 99,
      estimateScreenY: 1,
      previousPosition: atTurnBeforeUserTurns,
      routePath: turnRoutePath,
    );

    expect(result.position.segmentIndex, 0);
    expect(result.position.screenX, 99);
    expect(result.position.screenY, 0);
  });

  test('falls back to previous position when no valid segment exists', () {
    const previous = RoutePosition(
      distanceAlongRoute: 0,
      headingDegrees: 20,
      screenX: 1,
      screenY: 2,
      segmentIndex: 0,
      tiledX: 3,
      tiledY: 4,
    );
    final result = constrainEstimateToRouteProgress(
      estimateHeadingDegrees: 20,
      estimateScreenX: 4,
      estimateScreenY: 6,
      previousPosition: previous,
      routePath: const <OverlayPoint>[
        OverlayPoint(screenX: 1, screenY: 2, tiledX: 3, tiledY: 4),
      ],
    );

    expect(result.driftPixels, 5);
    expect(identical(result.position, previous), isTrue);
  });
}

RoutePosition _positionOnFirstSegment({required double distance}) {
  return RoutePosition(
    distanceAlongRoute: distance,
    headingDegrees: 0,
    screenX: distance,
    screenY: 0,
    segmentIndex: 0,
    tiledX: distance,
    tiledY: 0,
  );
}
