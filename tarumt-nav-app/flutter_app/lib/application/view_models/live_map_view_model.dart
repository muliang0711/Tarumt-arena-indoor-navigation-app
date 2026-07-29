import 'dart:async';

import 'package:indoor_navigation/application/orchestration/bootstrap/map_bootstrap_engine.dart';
import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';
import 'package:indoor_navigation/application/ports/presence/presence_repository.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_state.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';

final class LiveMapViewModel {
  LiveMapViewModel({
    required String buildingId,
    required String buildingName,
    required List<CampusFloor> floors,
    required MapRuntimeResourceRepository mapAssetRepository,
    required this._presenceRepository,
    this.disposePresenceRepository = true,
    String selectedFloorId = liveMapDemoFloorId,
  }) : _bootstrapEngine = MapBootstrapEngine(mapAssetRepository),
       _state = LiveMapViewState.initial(
         buildingId: buildingId,
         buildingName: buildingName,
         floors: floors,
         isUsingSimulatedPresence: _presenceRepository.isSimulated,
         presenceConnection: _presenceRepository.connectionState,
         selectedFloorId: selectedFloorId,
       ) {
    if (!floors.any((floor) => floor.id == selectedFloorId)) {
      throw ArgumentError.value(
        selectedFloorId,
        'selectedFloorId',
        'must identify one of the supplied floors',
      );
    }
  }

  final MapBootstrapEngine _bootstrapEngine;
  final PresenceRepository _presenceRepository;
  final bool disposePresenceRepository;
  final StreamController<LiveMapViewState> _states =
      StreamController<LiveMapViewState>.broadcast(sync: true);
  late LiveMapViewState _state;
  StreamSubscription<PresenceSnapshot>? _presenceSubscription;
  StreamSubscription<PresenceConnectionState>? _connectionSubscription;
  Future<void>? _initializeFuture;
  bool _active = false;
  bool _disposed = false;

  LiveMapViewState get state => _state;
  Stream<LiveMapViewState> get states => _states.stream;

  Future<void> initialize() {
    _throwIfDisposed();
    final existing = _initializeFuture;
    if (existing != null) {
      return existing;
    }
    if (_state.loadStatus == LiveMapLoadStatus.ready) {
      return resume();
    }
    final future = _runInitialize();
    _initializeFuture = future;
    return future;
  }

  Future<void> _runInitialize() async {
    _emit(
      _state.copyWith(
        clearLoadError: true,
        loadStatus: LiveMapLoadStatus.loading,
        presenceConnection: _presenceRepository.connectionState,
      ),
    );
    _presenceSubscription ??= _presenceRepository.snapshots.listen(
      (snapshot) {
        if (!_disposed &&
            snapshot.buildingId == _state.buildingId &&
            snapshot.floorId == _state.selectedFloorId) {
          _emit(_state.copyWith(snapshot: snapshot));
        }
      },
      onError: (Object error) {
        if (!_disposed) {
          _emit(
            _state.copyWith(
              presenceConnection: PresenceConnectionState(
                phase: PresenceConnectionPhase.offline,
                error: error,
              ),
            ),
          );
        }
      },
    );
    _connectionSubscription ??= _presenceRepository.connectionStates.listen((
      connection,
    ) {
      if (!_disposed) {
        _emit(_state.copyWith(presenceConnection: connection));
      }
    });
    try {
      await _bootstrapEngine.initialize();
      final data = _bootstrapEngine.state.data;
      if (data == null) {
        throw StateError('Live map bootstrap completed without map data.');
      }
      if (_disposed) {
        return;
      }
      _emit(
        _state.copyWith(
          clearLoadError: true,
          loadStatus: LiveMapLoadStatus.ready,
          mapImage: data.mapImage,
          mapModel: data.mapModel,
        ),
      );
      await resume();
    } catch (error) {
      if (!_disposed) {
        _emit(
          _state.copyWith(
            loadError: error,
            loadStatus: LiveMapLoadStatus.error,
          ),
        );
      }
    } finally {
      _initializeFuture = null;
    }
  }

  Future<void> retry() => initialize();

  Future<void> resume() async {
    _throwIfDisposed();
    if (_active || _state.loadStatus != LiveMapLoadStatus.ready) {
      return;
    }
    _active = true;
    try {
      await _presenceRepository.start(
        buildingId: _state.buildingId,
        floorId: _state.selectedFloorId,
      );
    } catch (_) {
      _active = false;
      rethrow;
    }
  }

  Future<void> pause() async {
    if (_disposed || !_active) {
      return;
    }
    _active = false;
    await _presenceRepository.stop();
  }

  Future<void> selectFloor(String floorId) async {
    _throwIfDisposed();
    if (!_state.floors.any((floor) => floor.id == floorId)) {
      throw StateError('Unknown live map floor: $floorId');
    }
    if (_state.selectedFloorId == floorId) {
      return;
    }
    _emit(_state.copyWith(clearSnapshot: true, selectedFloorId: floorId));
    if (_active) {
      await _presenceRepository.selectFloor(
        buildingId: _state.buildingId,
        floorId: floorId,
      );
    }
  }

  void zoomIn() {
    _throwIfDisposed();
    setZoom(nextIndoorNavigationZoomIn(_state.zoom));
  }

  void zoomOut() {
    _throwIfDisposed();
    setZoom(nextIndoorNavigationZoomOut(_state.zoom));
  }

  void setZoom(double zoom) {
    _throwIfDisposed();
    final nextZoom = clampIndoorNavigationZoom(zoom);
    if (nextZoom != _state.zoom) {
      _emit(_state.copyWith(zoom: nextZoom));
    }
  }

  Future<void> dispose() async {
    if (_disposed) {
      return;
    }
    await pause();
    _disposed = true;
    await _presenceSubscription?.cancel();
    await _bootstrapEngine.dispose();
    await _connectionSubscription?.cancel();
    _connectionSubscription = null;
    if (disposePresenceRepository) {
      await _presenceRepository.dispose();
    }
    await _states.close();
  }

  void _emit(LiveMapViewState state) {
    if (_disposed) {
      return;
    }
    _state = state;
    _states.add(state);
  }

  void _throwIfDisposed() {
    if (_disposed) {
      throw StateError('LiveMapViewModel is disposed.');
    }
  }
}
