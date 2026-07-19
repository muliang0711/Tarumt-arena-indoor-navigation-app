import 'dart:async';

import 'package:indoor_navigation/application/orchestration/bootstrap/map_bootstrap_state.dart';
import 'package:indoor_navigation/application/ports/assets/map_asset_repository.dart';
import 'package:indoor_navigation/domain/edge_editor/logic/route_graph_edge_model.dart';
import 'package:indoor_navigation/domain/edge_editor/logic/route_metric_model.dart';
import 'package:indoor_navigation/domain/tiled/map/png_map_model.dart';
import 'package:indoor_navigation/domain/tiled/parsing/tiled_map_parser.dart';

const defaultTiledMapAssetPath = 'assets/maps/demo_1.tmj.json';
const defaultRouteGraphEdgesAssetPath = 'assets/maps/demo_1.edges.json';

final class MapBootstrapEngine {
  MapBootstrapEngine(
    this._repository, {
    this.tiledMapAssetPath = defaultTiledMapAssetPath,
    this.routeGraphEdgesAssetPath = defaultRouteGraphEdgesAssetPath,
  });

  final MapAssetRepository _repository;
  final String routeGraphEdgesAssetPath;
  final String tiledMapAssetPath;
  final StreamController<MapBootstrapState> _states =
      StreamController<MapBootstrapState>.broadcast(sync: true);

  MapBootstrapState _state = const MapBootstrapState.idle();
  Future<void>? _initializeFuture;
  var _generation = 0;
  var _isDisposed = false;

  MapBootstrapState get state => _state;
  Stream<MapBootstrapState> get states => _states.stream;

  /// Initializes once by default. A forced call supersedes any in-flight load.
  Future<void> initialize({bool force = false}) {
    _throwIfDisposed();
    if (!force) {
      final existing = _initializeFuture;
      if (existing != null) {
        return existing;
      }
      if (_state.status == MapBootstrapStatus.ready) {
        return Future<void>.value();
      }
    }

    _generation += 1;
    final generation = _generation;
    _emit(const MapBootstrapState.loading());
    final future = _runInitialize(generation);
    _initializeFuture = future;
    return future;
  }

  Future<void> _runInitialize(int generation) async {
    try {
      // The sequential reads preserve App.tsx's map-before-edges bootstrap order.
      final tiledMapJson = await _repository.loadTiledMapJson(
        tiledMapAssetPath,
      );
      if (!_isCurrent(generation)) {
        return;
      }
      final edgeDocumentJson = await _repository.loadRouteGraphEdgesJson(
        routeGraphEdgesAssetPath,
      );
      if (!_isCurrent(generation)) {
        return;
      }
      final tiledMap = parseTiledMapJson(tiledMapJson);
      final edgeDocument = parseRouteGraphEdgeDocumentJson(edgeDocumentJson);
      final mapModel = createPngMapModel(tiledMap);
      final routeMetrics = createRouteMetricModel(
        mapModel.routePath,
        edgeDocument.edges,
      );
      if (!_isCurrent(generation)) {
        return;
      }
      _emit(
        MapBootstrapState.ready(
          MapBootstrapData(
            edgeDocumentJson: edgeDocumentJson,
            edges: edgeDocument.edges,
            mapModel: mapModel,
            routeMetrics: routeMetrics,
            sourceMap: edgeDocument.sourceMap,
            tiledMapJson: tiledMapJson,
          ),
        ),
      );
    } catch (error, stackTrace) {
      if (_isCurrent(generation)) {
        _emit(MapBootstrapState.error(error, stackTrace));
      }
      rethrow;
    } finally {
      if (_isCurrent(generation)) {
        _initializeFuture = null;
      }
    }
  }

  bool _isCurrent(int generation) => !_isDisposed && generation == _generation;

  void _emit(MapBootstrapState nextState) {
    if (_isDisposed) {
      return;
    }
    _state = nextState;
    _states.add(nextState);
  }

  void _throwIfDisposed() {
    if (_isDisposed) {
      throw StateError('MapBootstrapEngine has been disposed.');
    }
  }

  Future<void> dispose() async {
    if (_isDisposed) {
      return;
    }
    _isDisposed = true;
    _generation += 1;
    _initializeFuture = null;
    await _states.close();
  }
}
