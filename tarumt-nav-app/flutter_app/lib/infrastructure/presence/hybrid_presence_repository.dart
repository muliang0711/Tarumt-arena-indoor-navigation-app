import 'dart:async';

import 'package:indoor_navigation/application/ports/journey/journey_lifecycle_gateway.dart';
import 'package:indoor_navigation/application/ports/presence/presence_repository.dart';
import 'package:indoor_navigation/domain/journey/journey.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';

/// Test-only composition that keeps one deterministic local sentinel visible
/// alongside a bounded set of actors from the real Presence Gateway.
final class HybridPresenceRepository
    implements PresenceRepository, JourneyLifecycleGateway {
  HybridPresenceRepository({
    required PresenceRepository localRepository,
    int remoteRepresentativeLimit = 1,
    required PresenceRepository remoteRepository,
  }) : _localRepository = localRepository,
       _remoteRepository = remoteRepository,
       remoteRepresentativeLimit = remoteRepresentativeLimit {
    if (!localRepository.isSimulated) {
      throw ArgumentError.value(
        localRepository,
        'localRepository',
        'must provide simulated presence',
      );
    }
    if (remoteRepository.isSimulated) {
      throw ArgumentError.value(
        remoteRepository,
        'remoteRepository',
        'must provide remote presence',
      );
    }
    if (remoteRepresentativeLimit < 1 ||
        remoteRepresentativeLimit >= maxPresenceRepresentatives) {
      throw RangeError.range(
        remoteRepresentativeLimit,
        1,
        maxPresenceRepresentatives - 1,
        'remoteRepresentativeLimit',
      );
    }
    _localSubscription = _localRepository.snapshots.listen(_onLocalSnapshot);
    _remoteSubscription = _remoteRepository.snapshots.listen(_onRemoteSnapshot);
    _remoteConnectionSubscription = _remoteRepository.connectionStates.listen(
      _onRemoteConnection,
      onError: _connectionStates.addError,
    );
  }

  final PresenceRepository _localRepository;
  final PresenceRepository _remoteRepository;
  final int remoteRepresentativeLimit;
  final StreamController<PresenceConnectionState> _connectionStates =
      StreamController<PresenceConnectionState>.broadcast(sync: true);
  final StreamController<PresenceSnapshot> _snapshots =
      StreamController<PresenceSnapshot>.broadcast(sync: true);

  late final StreamSubscription<PresenceSnapshot> _localSubscription;
  late final StreamSubscription<PresenceSnapshot> _remoteSubscription;
  late final StreamSubscription<PresenceConnectionState>
  _remoteConnectionSubscription;

  PresenceSnapshot? _localSnapshot;
  PresenceSnapshot? _remoteSnapshot;
  String? _buildingId;
  String? _floorId;
  bool _active = false;
  bool _disposed = false;

  @override
  PresenceConnectionState get connectionState =>
      _remoteRepository.connectionState;

  @override
  Stream<PresenceConnectionState> get connectionStates =>
      _connectionStates.stream;

  @override
  bool get isJourneyTransportConnected => switch (_remoteRepository) {
    final JourneyLifecycleGateway gateway =>
      gateway.isJourneyTransportConnected,
    _ => false,
  };

  @override
  bool get isSimulated => true;

  @override
  Stream<PresenceSnapshot> get snapshots => _snapshots.stream;

  @override
  Future<void> connect() {
    _throwIfDisposed();
    return Future.wait<void>([
      _localRepository.connect(),
      _remoteRepository.connect(),
    ]);
  }

  @override
  Future<void> start({
    required String buildingId,
    required String floorId,
  }) async {
    _throwIfDisposed();
    _active = true;
    _buildingId = buildingId;
    _floorId = floorId;
    _localSnapshot = null;
    _remoteSnapshot = null;
    await Future.wait<void>([
      _localRepository.start(buildingId: buildingId, floorId: floorId),
      _remoteRepository.start(buildingId: buildingId, floorId: floorId),
    ]);
  }

  @override
  Future<void> selectFloor({
    required String buildingId,
    required String floorId,
  }) async {
    _throwIfDisposed();
    _active = true;
    _buildingId = buildingId;
    _floorId = floorId;
    _localSnapshot = null;
    _remoteSnapshot = null;
    await Future.wait<void>([
      _localRepository.selectFloor(buildingId: buildingId, floorId: floorId),
      _remoteRepository.selectFloor(buildingId: buildingId, floorId: floorId),
    ]);
  }

  @override
  Future<void> stop() async {
    _throwIfDisposed();
    _active = false;
    _localSnapshot = null;
    _remoteSnapshot = null;
    await Future.wait<void>([
      _localRepository.stop(),
      _remoteRepository.stop(),
    ]);
  }

  @override
  Future<void> disconnect() async {
    if (_disposed) return;
    _remoteSnapshot = null;
    _emitMergedSnapshot();
    await Future.wait<void>([
      _localRepository.disconnect(),
      _remoteRepository.disconnect(),
    ]);
  }

  @override
  Future<void> publishLocation(LocalPresencePosition position) =>
      _remoteRepository.publishLocation(position);

  @override
  Future<void> leave() => _remoteRepository.leave();

  @override
  Future<JourneyAcknowledgement> sendJourneyCommand(JourneyCommand command) {
    final remote = _remoteRepository;
    if (remote is! JourneyLifecycleGateway) {
      throw StateError(
        'Hybrid remote repository does not support Journey lifecycle.',
      );
    }
    return (remote as JourneyLifecycleGateway).sendJourneyCommand(command);
  }

  void _onLocalSnapshot(PresenceSnapshot snapshot) {
    if (!_accepts(snapshot)) return;
    _localSnapshot = snapshot;
    _emitMergedSnapshot();
  }

  void _onRemoteSnapshot(PresenceSnapshot snapshot) {
    if (!_accepts(snapshot)) return;
    _remoteSnapshot = snapshot;
    _emitMergedSnapshot();
  }

  void _onRemoteConnection(PresenceConnectionState state) {
    if (state.phase != PresenceConnectionPhase.connected) {
      _remoteSnapshot = null;
      _emitMergedSnapshot();
    }
    if (!_connectionStates.isClosed) {
      _connectionStates.add(state);
    }
  }

  bool _accepts(PresenceSnapshot snapshot) =>
      _active &&
      snapshot.buildingId == _buildingId &&
      snapshot.floorId == _floorId;

  void _emitMergedSnapshot() {
    if (!_active || _snapshots.isClosed) return;
    final local = _localSnapshot;
    if (local == null) return;
    final remote = _remoteSnapshot;
    final localActor = local.representatives
        .where((actor) => actor.origin == PresenceOrigin.localSimulation)
        .firstOrNull;
    if (localActor == null) return;
    final remoteActors =
        remote?.representatives
            .where((actor) => actor.origin == PresenceOrigin.remote)
            .take(remoteRepresentativeLimit)
            .toList(growable: false) ??
        const <AnonymousPresence>[];
    _snapshots.add(
      PresenceSnapshot(
        buildingId: local.buildingId,
        buildingUsers: remote?.buildingUsers ?? 0,
        edgeOccupancies: remote?.edgeOccupancies ?? const <EdgeOccupancy>[],
        floorId: local.floorId,
        floors:
            remote?.floors ??
            <FloorOccupancy>[
              FloorOccupancy(activeUsers: 0, floorId: local.floorId),
            ],
        generatedAt: remote?.generatedAt ?? local.generatedAt,
        representatives: <AnonymousPresence>[localActor, ...remoteActors],
        totalAppUsers: remote?.totalAppUsers ?? 0,
      ),
    );
  }

  @override
  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    await _localSubscription.cancel();
    await _remoteSubscription.cancel();
    await _remoteConnectionSubscription.cancel();
    await Future.wait<void>([
      _localRepository.dispose(),
      _remoteRepository.dispose(),
    ]);
    await Future.wait<void>([_connectionStates.close(), _snapshots.close()]);
  }

  void _throwIfDisposed() {
    if (_disposed) {
      throw StateError('HybridPresenceRepository is disposed.');
    }
  }
}
