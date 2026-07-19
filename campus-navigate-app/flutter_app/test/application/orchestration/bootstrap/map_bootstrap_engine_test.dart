import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/bootstrap/map_bootstrap_engine.dart';
import 'package:indoor_navigation/application/orchestration/bootstrap/map_bootstrap_state.dart';
import 'package:indoor_navigation/application/ports/assets/map_asset_repository.dart';

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
    final repository = _ControlledMapAssetRepository();
    final map = repository.enqueueMap();
    final edges = repository.enqueueEdges();
    final engine = MapBootstrapEngine(repository);
    final states = <MapBootstrapState>[];
    final subscription = engine.states.listen(states.add);

    expect(engine.state.status, MapBootstrapStatus.idle);
    final first = engine.initialize();
    final duplicate = engine.initialize();
    expect(identical(first, duplicate), isTrue);
    expect(repository.invocations, ['map:$defaultTiledMapAssetPath']);
    expect(engine.state.status, MapBootstrapStatus.loading);

    map.complete(tiledMapJson);
    await _pumpEventQueue();
    expect(repository.invocations, [
      'map:$defaultTiledMapAssetPath',
      'edges:$defaultRouteGraphEdgesAssetPath',
    ]);
    edges.complete(edgeDocumentJson);
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
    expect(
      () => engine.state.edges.add(engine.state.edges.first),
      throwsUnsupportedError,
    );

    await engine.initialize();
    expect(repository.invocations, hasLength(2));
    await engine.dispose();
    await subscription.cancel();
  });

  test(
    'reports repository and strict parsing failures then permits retry',
    () async {
      final repository = _ControlledMapAssetRepository();
      final failedMap = repository.enqueueMap();
      final retryMap = repository.enqueueMap();
      final retryEdges = repository.enqueueEdges();
      final engine = MapBootstrapEngine(repository);
      final failure = StateError('asset failed');

      final failed = engine.initialize();
      failedMap.completeError(failure);
      await expectLater(failed, throwsA(same(failure)));
      expect(engine.state.status, MapBootstrapStatus.error);
      expect(engine.state.error, same(failure));

      final retry = engine.initialize();
      retryMap.complete(tiledMapJson);
      await _pumpEventQueue();
      retryEdges.complete(
        '{"kind":"wrong","version":1,"sourceMap":"x","edges":[]}',
      );
      await expectLater(retry, throwsA(isA<UnsupportedError>()));
      expect(engine.state.status, MapBootstrapStatus.error);
      await engine.dispose();
    },
  );

  test(
    'forced initialize suppresses stale completion and stale work',
    () async {
      final repository = _ControlledMapAssetRepository();
      final staleMap = repository.enqueueMap();
      final freshMap = repository.enqueueMap();
      final freshEdges = repository.enqueueEdges();
      final engine = MapBootstrapEngine(repository);
      final statuses = <MapBootstrapStatus>[];
      final subscription = engine.states.listen(
        (state) => statuses.add(state.status),
      );

      final stale = engine.initialize();
      final fresh = engine.initialize(force: true);
      expect(repository.invocations, [
        'map:$defaultTiledMapAssetPath',
        'map:$defaultTiledMapAssetPath',
      ]);

      freshMap.complete(tiledMapJson);
      await _pumpEventQueue();
      freshEdges.complete(
        edgeDocumentJson.replaceFirst(
          '"sourceMap": "demo_1.tmj"',
          '"sourceMap": "fresh.tmj"',
        ),
      );
      await fresh;
      expect(engine.state.sourceMap, 'fresh.tmj');

      staleMap.complete(tiledMapJson);
      await stale;
      expect(engine.state.sourceMap, 'fresh.tmj');
      expect(
        repository.invocations.where((call) => call.startsWith('edges:')),
        hasLength(1),
      );
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
      final repository = _ControlledMapAssetRepository();
      final map = repository.enqueueMap();
      final engine = MapBootstrapEngine(repository);
      final states = <MapBootstrapState>[];
      final subscription = engine.states.listen(states.add);

      final pending = engine.initialize();
      expect(states, hasLength(1));
      await engine.dispose();
      map.complete(tiledMapJson);
      await pending;

      expect(states, hasLength(1));
      expect(repository.invocations, ['map:$defaultTiledMapAssetPath']);
      expect(engine.initialize, throwsStateError);
      await engine.dispose();
      await subscription.cancel();
    },
  );
}

Future<void> _pumpEventQueue() => Future<void>.delayed(Duration.zero);

final class _ControlledMapAssetRepository implements MapAssetRepository {
  final _maps = <Completer<String>>[];
  final _edges = <Completer<String>>[];
  final invocations = <String>[];
  var _mapIndex = 0;
  var _edgeIndex = 0;

  Completer<String> enqueueMap() {
    final completer = Completer<String>();
    _maps.add(completer);
    return completer;
  }

  Completer<String> enqueueEdges() {
    final completer = Completer<String>();
    _edges.add(completer);
    return completer;
  }

  @override
  Future<String> loadTiledMapJson(String assetPath) {
    invocations.add('map:$assetPath');
    return _maps[_mapIndex++].future;
  }

  @override
  Future<String> loadRouteGraphEdgesJson(String assetPath) {
    invocations.add('edges:$assetPath');
    return _edges[_edgeIndex++].future;
  }
}
