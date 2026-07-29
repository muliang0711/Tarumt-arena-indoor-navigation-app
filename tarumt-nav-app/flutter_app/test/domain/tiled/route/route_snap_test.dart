import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/tiled/route/route_snap.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

import 'route_test_data.dart';

void main() {
  test('snaps free estimates to the nearest fixed route segment', () {
    final firstSnap = snapPointToRoute(
      routePath: demoRoutePath,
      screenX: 500,
      screenY: 700,
    );
    final pastEndSnap = snapPointToRoute(
      routePath: demoRoutePath,
      screenX: 1400,
      screenY: 760,
    );

    expect(firstSnap.position.segmentIndex, 1);
    expect(firstSnap.position.screenX, 500);
    expect(firstSnap.position.screenY, 648);
    expect(firstSnap.driftPixels.round(), 52);
    expect(pastEndSnap.position.segmentIndex, 5);
    expect(pastEndSnap.position.screenX, 1248);
    expect(pastEndSnap.position.screenY, 760);
    expect(pastEndSnap.driftPixels.round(), 152);
  });

  test('clamps projection to segment endpoints', () {
    final snap = snapPointToRoute(
      routePath: const <OverlayPoint>[
        OverlayPoint(screenX: 0, screenY: 0, tiledX: 10, tiledY: 20),
        OverlayPoint(screenX: 10, screenY: 0, tiledX: 20, tiledY: 20),
      ],
      screenX: 20,
      screenY: 3,
    );

    expect(snap.position.distanceAlongRoute, 10);
    expect(snap.position.screenX, 10);
    expect(snap.position.screenY, 0);
    expect(snap.position.tiledX, 20);
    expect(snap.driftPixels, closeTo(10.4403065089, 1e-9));
  });

  test('preserves the earliest segment when candidates have equal drift', () {
    final snap = snapPointToRoute(
      routePath: turnRoutePath,
      screenX: 99,
      screenY: 1,
    );

    expect(snap.position.segmentIndex, 0);
    expect(snap.position.screenX, 99);
    expect(snap.position.screenY, 0);
  });

  test('skips segments at the 0.001 validity gate', () {
    final snap = snapPointToRoute(
      routePath: const <OverlayPoint>[
        OverlayPoint(screenX: 0, screenY: 0, tiledX: 0, tiledY: 0),
        OverlayPoint(screenX: 0.001, screenY: 0, tiledX: 0.001, tiledY: 0),
        OverlayPoint(screenX: 10, screenY: 0, tiledX: 10, tiledY: 0),
      ],
      screenX: 5,
      screenY: 0,
    );

    expect(snap.position.segmentIndex, 1);
    expect(snap.position.distanceAlongRoute, closeTo(4.999, 1e-12));
  });

  test('snaps to a single route point', () {
    final snap = snapPointToRoute(
      routePath: const <OverlayPoint>[
        OverlayPoint(screenX: 1, screenY: 2, tiledX: 3, tiledY: 4),
      ],
      screenX: 4,
      screenY: 6,
    );

    expect(snap.driftPixels, 5);
    expect(snap.position.distanceAlongRoute, 0);
    expect(snap.position.headingDegrees, 0);
    expect(snap.position.segmentIndex, 0);
    expect(snap.position.screenX, 1);
    expect(snap.position.screenY, 2);
  });

  test('rejects empty and all-degenerate routes', () {
    expect(
      () => snapPointToRoute(
        routePath: const <OverlayPoint>[],
        screenX: 0,
        screenY: 0,
      ),
      throwsA(
        isA<StateError>().having(
          (error) => error.message,
          'message',
          'Cannot snap to an empty route path.',
        ),
      ),
    );
    expect(
      () => snapPointToRoute(
        routePath: const <OverlayPoint>[
          OverlayPoint(screenX: 1, screenY: 1, tiledX: 1, tiledY: 1),
          OverlayPoint(screenX: 1, screenY: 1, tiledX: 1, tiledY: 1),
        ],
        screenX: 0,
        screenY: 0,
      ),
      throwsA(
        isA<StateError>().having(
          (error) => error.message,
          'message',
          'Cannot snap to a route path without valid segments.',
        ),
      ),
    );
  });
}
