import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/bootstrap/map_bootstrap_engine.dart';
import 'package:indoor_navigation/application/orchestration/bootstrap/map_bootstrap_state.dart';
import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';

void main() {
  late String tiledMapJson;
  late String edgeDocumentJson;

  setUpAll(() async {
    tiledMapJson = await File(
      '../expo-app/assets/maps/demo_1.tmj.json',
    ).readAsString();
    edgeDocumentJson = await File(
      '../expo-app/assets/maps/demo_1.edges.json',
    ).readAsString();
  });

  test('loads in exact order and builds the authoritative 46m model', () async {
    final repository = _ControlledMapRuntimeResourceRepository();
    final resources = repository.enqueue();
    final engine = MapBootstrapEngine(repository);
    final states = <MapBootstrapState>[];
    final subscription = engine.states.listen(states.add);

    expect(engine.state.status, MapBootstrapStatus.idle);
    final first = engine.initialize();
    final duplicate = engine.initialize();
    expect(identical(first, duplicate), isTrue);
    expect(repository.invocations, ['main-campus/floor-2']);
    expect(engine.state.status, MapBootstrapStatus.loading);

    resources.complete(
      MapRuntimeResources(
        bundleRevision: 'sha256:bundle',
        edgeDocumentJson: edgeDocumentJson,
        floorId: 'floor-2',
        graphRevision: 'sha256:graph',
        image: const MapImageLocation.localFile('/cache/floor-2.png'),
        mapId: 'main-campus',
        tiledMapJson: tiledMapJson,
      ),
    );
    await first;

    expect(states.map((state) => state.status), [
      MapBootstrapStatus.loading,
      MapBootstrapStatus.ready,
    ]);
    expect(engine.state.sourceMap, 'demo_1.tmj');
    expect(engine.state.edges, hasLength(24));
    expect(engine.state.mapModel?.routeNodes, hasLength(22));
    expect(engine.state.routeMetrics?.totalMeters, 46);
    expect(engine.state.routeMetrics?.totalPixels.round(), 2542);
    expect(engine.state.data?.tiledMapJson, same(tiledMapJson));
    expect(engine.state.data?.edgeDocumentJson, same(edgeDocumentJson));
    expect(engine.state.data?.bundleRevision, 'sha256:bundle');
    expect(engine.state.data?.graphRevision, 'sha256:graph');
    expect(engine.state.data?.mapImage.path, '/cache/floor-2.png');
    expect(
      () => engine.state.edges.add(engine.state.edges.first),
      throwsUnsupportedError,
    );

    await engine.initialize();
    expect(repository.invocations, hasLength(1));
    await engine.dispose();
    await subscription.cancel();
  });

  test(
    'reports repository and strict parsing failures then permits retry',
    () async {
      final repository = _ControlledMapRuntimeResourceRepository();
      final failedResources = repository.enqueue();
      final retryResources = repository.enqueue();
      final engine = MapBootstrapEngine(repository);
      final failure = StateError('asset failed');

      final failed = engine.initialize();
      failedResources.completeError(failure);
      await expectLater(failed, throwsA(same(failure)));
      expect(engine.state.status, MapBootstrapStatus.error);
      expect(engine.state.error, same(failure));

      final retry = engine.initialize();
      retryResources.complete(
        MapRuntimeResources(
          bundleRevision: null,
          edgeDocumentJson:
              '{"kind":"wrong","version":1,"sourceMap":"x","edges":[]}',
          floorId: 'floor-2',
          graphRevision: null,
          image: const MapImageLocation.bundledAsset('assets/maps/demo_1.png'),
          mapId: 'main-campus',
          tiledMapJson: tiledMapJson,
        ),
      );
      await expectLater(retry, throwsA(isA<UnsupportedError>()));
      expect(engine.state.status, MapBootstrapStatus.error);
      await engine.dispose();
    },
  );

  test(
    'forced initialize suppresses stale completion and stale work',
    () async {
      final repository = _ControlledMapRuntimeResourceRepository();
      final staleResources = repository.enqueue();
      final freshResources = repository.enqueue();
      final engine = MapBootstrapEngine(repository);
      final statuses = <MapBootstrapStatus>[];
      final subscription = engine.states.listen(
        (state) => statuses.add(state.status),
      );

      final stale = engine.initialize();
      final fresh = engine.initialize(force: true);
      expect(repository.invocations, [
        'main-campus/floor-2',
        'main-campus/floor-2',
      ]);

      freshResources.complete(
        MapRuntimeResources(
          bundleRevision: null,
          edgeDocumentJson: edgeDocumentJson.replaceFirst(
            '"sourceMap": "demo_1.tmj"',
            '"sourceMap": "fresh.tmj"',
          ),
          floorId: 'floor-2',
          graphRevision: null,
          image: const MapImageLocation.bundledAsset('assets/maps/demo_1.png'),
          mapId: 'main-campus',
          tiledMapJson: tiledMapJson,
        ),
      );
      await fresh;
      expect(engine.state.sourceMap, 'fresh.tmj');

      staleResources.complete(
        MapRuntimeResources(
          bundleRevision: null,
          edgeDocumentJson: edgeDocumentJson,
          floorId: 'floor-2',
          graphRevision: null,
          image: const MapImageLocation.bundledAsset('assets/maps/demo_1.png'),
          mapId: 'main-campus',
          tiledMapJson: tiledMapJson,
        ),
      );
      await stale;
      expect(engine.state.sourceMap, 'fresh.tmj');
      expect(statuses, [
        MapBootstrapStatus.loading,
        MapBootstrapStatus.loading,
        MapBootstrapStatus.ready,
      ]);
      await engine.dispose();
      await subscription.cancel();
    },
  );

  test(
    'dispose suppresses pending work and every post-dispose emission',
    () async {
      final repository = _ControlledMapRuntimeResourceRepository();
      final resources = repository.enqueue();
      final engine = MapBootstrapEngine(repository);
      final states = <MapBootstrapState>[];
      final subscription = engine.states.listen(states.add);

      final pending = engine.initialize();
      expect(states, hasLength(1));
      await engine.dispose();
      resources.complete(
        MapRuntimeResources(
          bundleRevision: null,
          edgeDocumentJson: edgeDocumentJson,
          floorId: 'floor-2',
          graphRevision: null,
          image: const MapImageLocation.bundledAsset('assets/maps/demo_1.png'),
          mapId: 'main-campus',
          tiledMapJson: tiledMapJson,
        ),
      );
      await pending;

      expect(states, hasLength(1));
      expect(repository.invocations, ['main-campus/floor-2']);
      expect(engine.initialize, throwsStateError);
      await engine.dispose();
      await subscription.cancel();
    },
  );
}

final class _ControlledMapRuntimeResourceRepository
    implements MapRuntimeResourceRepository {
  final _resources = <Completer<MapRuntimeResources>>[];
  final invocations = <String>[];
  var _index = 0;

  Completer<MapRuntimeResources> enqueue() {
    final completer = Completer<MapRuntimeResources>();
    _resources.add(completer);
    return completer;
  }

  @override
  Future<MapRuntimeResources> loadCurrent({
    required String floorId,
    required String mapId,
  }) {
    invocations.add('$mapId/$floorId');
    return _resources[_index++].future;
  }
}
