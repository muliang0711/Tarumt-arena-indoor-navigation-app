import 'dart:collection';

import 'package:indoor_navigation/application/ports/assets/map_asset_repository.dart';

enum FakeMapAssetKind { tiledMap, routeGraphEdges }

final class FakeMapAssetInvocation {
  const FakeMapAssetInvocation({required this.assetPath, required this.kind});

  final String assetPath;
  final FakeMapAssetKind kind;
}

/// A deterministic repository whose per-request outcomes are consumed FIFO.
final class FakeMapAssetRepository implements MapAssetRepository {
  final Map<_RequestKey, Queue<_TextOutcome>> _scripts = {};
  final List<FakeMapAssetInvocation> _invocations = [];

  List<FakeMapAssetInvocation> get invocations =>
      List<FakeMapAssetInvocation>.unmodifiable(_invocations);

  void enqueueTiledMapJson({required String assetPath, required String json}) {
    _enqueue(
      _RequestKey(kind: FakeMapAssetKind.tiledMap, assetPath: assetPath),
      _TextSuccess(json),
    );
  }

  void enqueueTiledMapFailure({
    required String assetPath,
    required Object error,
  }) {
    _enqueue(
      _RequestKey(kind: FakeMapAssetKind.tiledMap, assetPath: assetPath),
      _TextFailure(error),
    );
  }

  void enqueueRouteGraphEdgesJson({
    required String assetPath,
    required String json,
  }) {
    _enqueue(
      _RequestKey(kind: FakeMapAssetKind.routeGraphEdges, assetPath: assetPath),
      _TextSuccess(json),
    );
  }

  void enqueueRouteGraphEdgesFailure({
    required String assetPath,
    required Object error,
  }) {
    _enqueue(
      _RequestKey(kind: FakeMapAssetKind.routeGraphEdges, assetPath: assetPath),
      _TextFailure(error),
    );
  }

  void clearInvocations() {
    _invocations.clear();
  }

  @override
  Future<String> loadTiledMapJson(String assetPath) {
    return _load(FakeMapAssetKind.tiledMap, assetPath);
  }

  @override
  Future<String> loadRouteGraphEdgesJson(String assetPath) {
    return _load(FakeMapAssetKind.routeGraphEdges, assetPath);
  }

  void _enqueue(_RequestKey key, _TextOutcome outcome) {
    (_scripts[key] ??= Queue<_TextOutcome>()).add(outcome);
  }

  Future<String> _load(FakeMapAssetKind kind, String assetPath) async {
    _invocations.add(FakeMapAssetInvocation(assetPath: assetPath, kind: kind));
    final key = _RequestKey(kind: kind, assetPath: assetPath);
    final script = _scripts[key];
    if (script == null || script.isEmpty) {
      throw StateError(
        'No fake map asset outcome for ${kind.name}: $assetPath',
      );
    }

    final outcome = script.removeFirst();
    return switch (outcome) {
      _TextSuccess(:final text) => text,
      _TextFailure(:final error) => throw error,
    };
  }
}

final class _RequestKey {
  const _RequestKey({required this.assetPath, required this.kind});

  final String assetPath;
  final FakeMapAssetKind kind;

  @override
  bool operator ==(Object other) {
    return other is _RequestKey &&
        other.assetPath == assetPath &&
        other.kind == kind;
  }

  @override
  int get hashCode => Object.hash(kind, assetPath);
}

sealed class _TextOutcome {
  const _TextOutcome();
}

final class _TextSuccess extends _TextOutcome {
  const _TextSuccess(this.text);

  final String text;
}

final class _TextFailure extends _TextOutcome {
  const _TextFailure(this.error);

  final Object error;
}
