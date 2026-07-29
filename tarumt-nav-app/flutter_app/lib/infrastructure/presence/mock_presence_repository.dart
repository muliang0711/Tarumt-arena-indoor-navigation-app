import 'dart:async';

import 'package:indoor_navigation/application/ports/presence/presence_repository.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/application/ports/time/periodic_scheduler.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';

const mockPresenceTickIntervalMs = 1400;
const mockTotalAppUsers = 126;
const mockBuildingUsers = 100;
const mockFloorOccupancy = <String, int>{
  'floor-1': 18,
  'floor-2': 32,
  'floor-3': 41,
  'floor-4': 9,
};

final class MockPresenceRepository implements PresenceRepository {
  MockPresenceRepository({
    required this._clock,
    required this._scheduler,
    this.representativeLimit = maxPresenceRepresentatives,
    this.seed = 20260722,
  }) : assert(representativeLimit > 0),
       assert(representativeLimit <= maxPresenceRepresentatives);

  final Clock _clock;
  final PeriodicScheduler _scheduler;
  final int representativeLimit;
  final int seed;
  final StreamController<PresenceSnapshot> _snapshots =
      StreamController<PresenceSnapshot>.broadcast(sync: true);

  @override
  PresenceConnectionState get connectionState =>
      const PresenceConnectionState.simulated();

  @override
  Stream<PresenceConnectionState> get connectionStates =>
      Stream<PresenceConnectionState>.value(
        const PresenceConnectionState.simulated(),
      );

  @override
  bool get isSimulated => true;

  PeriodicTaskHandle? _tickHandle;
  String _buildingId = '';
  String _floorId = '';
  int _tick = 0;
  bool _disposed = false;

  @override
  Stream<PresenceSnapshot> get snapshots => _snapshots.stream;

  @override
  Future<void> connect() async => _throwIfDisposed();

  @override
  Future<void> start({
    required String buildingId,
    required String floorId,
  }) async {
    _throwIfDisposed();
    _buildingId = buildingId;
    _floorId = floorId;
    _tickHandle ??= _scheduler.schedulePeriodic(
      intervalMs: mockPresenceTickIntervalMs,
      callback: _advance,
    );
    _emitSnapshot();
  }

  @override
  Future<void> selectFloor({
    required String buildingId,
    required String floorId,
  }) async {
    _throwIfDisposed();
    _buildingId = buildingId;
    _floorId = floorId;
    if (_tickHandle != null) {
      _emitSnapshot();
    }
  }

  void _advance() {
    if (_disposed || _tickHandle == null) {
      return;
    }
    _tick += 1;
    _emitSnapshot();
  }

  void _emitSnapshot() {
    final activeUsers = mockFloorOccupancy[_floorId] ?? 0;
    final actorCount = activeUsers.clamp(0, representativeLimit);
    final representatives = <AnonymousPresence>[
      for (var index = 0; index < actorCount; index += 1)
        _createPresence(index, actorCount),
    ];
    _snapshots.add(
      PresenceSnapshot(
        buildingId: _buildingId,
        buildingUsers: mockBuildingUsers,
        floorId: _floorId,
        floors: [
          for (final entry in mockFloorOccupancy.entries)
            FloorOccupancy(floorId: entry.key, activeUsers: entry.value),
        ],
        generatedAt: DateTime.fromMillisecondsSinceEpoch(_clock.nowMs()),
        representatives: representatives,
        totalAppUsers: mockTotalAppUsers,
      ),
    );
  }

  AnonymousPresence _createPresence(int index, int actorCount) {
    final segmentCount = testRouteNodeIds.length - 1;
    final reverse = index.isOdd;
    final speed = 0.035 + index * 0.002;
    final phase = index / actorCount + _tick * speed * (reverse ? -1 : 1);
    final normalizedPhase = ((phase % 1) + 1) % 1;
    final scaled = normalizedPhase * segmentCount;
    final segmentIndex = scaled.floor().clamp(0, segmentCount - 1);
    final rawProgress = scaled - segmentIndex;
    final fromIndex = reverse ? segmentIndex + 1 : segmentIndex;
    final toIndex = reverse ? segmentIndex : segmentIndex + 1;
    return AnonymousPresence(
      activity: (_tick + index) % 5 == 0
          ? PresenceActivity.idle
          : _tick == 0
          ? PresenceActivity.recentlyJoined
          : PresenceActivity.walking,
      buildingId: _buildingId,
      edgeProgress: reverse ? 1 - rawProgress : rawProgress,
      floorId: _floorId,
      fromNodeId: testRouteNodeIds[fromIndex],
      headingDegrees: reverse ? 180 : 0,
      origin: PresenceOrigin.localSimulation,
      presenceId: 'mock-$_floorId-$index',
      sequence: _tick,
      toNodeId: testRouteNodeIds[toIndex],
      updatedAt: DateTime.fromMillisecondsSinceEpoch(_clock.nowMs()),
      visualSeed: seed + index * 31,
    );
  }

  @override
  Future<void> stop() async {
    _throwIfDisposed();
    _tickHandle?.cancel();
    _tickHandle = null;
  }

  @override
  Future<void> disconnect() async => _throwIfDisposed();

  @override
  Future<void> publishLocation(LocalPresencePosition position) async =>
      _throwIfDisposed();

  @override
  Future<void> leave() async => _throwIfDisposed();

  @override
  Future<void> dispose() async {
    if (_disposed) {
      return;
    }
    _tickHandle?.cancel();
    _tickHandle = null;
    _disposed = true;
    await _snapshots.close();
  }

  void _throwIfDisposed() {
    if (_disposed) {
      throw StateError('MockPresenceRepository is disposed.');
    }
  }
}
