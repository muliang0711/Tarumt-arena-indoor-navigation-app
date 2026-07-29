import 'package:flutter_test/flutter_test.dart';

import '../../../support/fakes/fake_map_asset_repository.dart';

void main() {
  test('returns TMJ and EDGE source text byte-for-byte', () async {
    const tmjPath = 'maps/demo.tmj.json';
    const edgePath = 'maps/demo.edges.json';
    const tmj = '{\n  "type": "map",\n  "unicode": "地图"\n}\n';
    const edges = '{"edges":[]}\n\n';
    final repository = FakeMapAssetRepository()
      ..enqueueTiledMapJson(assetPath: tmjPath, json: tmj)
      ..enqueueRouteGraphEdgesJson(assetPath: edgePath, json: edges);

    expect(await repository.loadTiledMapJson(tmjPath), same(tmj));
    expect(await repository.loadRouteGraphEdgesJson(edgePath), same(edges));
    expect(
      repository.invocations.map((invocation) => invocation.kind),
      <FakeMapAssetKind>[
        FakeMapAssetKind.tiledMap,
        FakeMapAssetKind.routeGraphEdges,
      ],
    );
    expect(
      repository.invocations.map((invocation) => invocation.assetPath),
      <String>[tmjPath, edgePath],
    );
  });

  test('consumes successes and failures in stable per-request order', () async {
    const path = 'maps/floor.tmj.json';
    const edgePath = 'maps/floor.edges.json';
    final failure = StateError('asset unavailable');
    final edgeFailure = FormatException('invalid edge asset');
    final repository = FakeMapAssetRepository()
      ..enqueueTiledMapFailure(assetPath: path, error: failure)
      ..enqueueTiledMapJson(assetPath: path, json: 'first retry')
      ..enqueueTiledMapJson(assetPath: path, json: 'second retry')
      ..enqueueRouteGraphEdgesFailure(assetPath: edgePath, error: edgeFailure);

    await expectLater(
      repository.loadTiledMapJson(path),
      throwsA(same(failure)),
    );
    expect(await repository.loadTiledMapJson(path), 'first retry');
    await expectLater(
      repository.loadRouteGraphEdgesJson(edgePath),
      throwsA(same(edgeFailure)),
    );
    expect(await repository.loadTiledMapJson(path), 'second retry');
    expect(
      repository.invocations.map((invocation) => invocation.kind),
      <FakeMapAssetKind>[
        FakeMapAssetKind.tiledMap,
        FakeMapAssetKind.tiledMap,
        FakeMapAssetKind.routeGraphEdges,
        FakeMapAssetKind.tiledMap,
      ],
    );
  });

  test('fails an unscripted call and exposes immutable snapshots', () async {
    final repository = FakeMapAssetRepository();

    await expectLater(
      repository.loadRouteGraphEdgesJson('missing.edges.json'),
      throwsA(isA<StateError>()),
    );
    final snapshot = repository.invocations;
    expect(
      () => snapshot.add(
        const FakeMapAssetInvocation(
          assetPath: 'injected',
          kind: FakeMapAssetKind.tiledMap,
        ),
      ),
      throwsUnsupportedError,
    );

    repository.clearInvocations();
    expect(repository.invocations, isEmpty);
    expect(snapshot, hasLength(1));
  });
}
