// ignore_for_file: prefer_initializing_formals

import 'dart:async';
import 'dart:io';

import 'package:indoor_navigation/application/orchestration/presence/presence_reconnect_policy.dart';
import 'package:indoor_navigation/application/orchestration/presence/presence_snapshot_reducer.dart';
import 'package:indoor_navigation/application/ports/journey/journey_lifecycle_gateway.dart';
import 'package:indoor_navigation/application/ports/presence/installation_identity_store.dart';
import 'package:indoor_navigation/application/ports/presence/presence_repository.dart';
import 'package:indoor_navigation/application/ports/presence/user_profile_store.dart';
import 'package:indoor_navigation/domain/journey/journey.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_events.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/infrastructure/presence/http/anonymous_session_api.dart';
import 'package:indoor_navigation/infrastructure/presence/identity/secure_random_installation_id_generator.dart';
import 'package:indoor_navigation/infrastructure/presence/websocket/presence_protocol_codec.dart';
import 'package:web_socket_channel/io.dart';

final class RealtimePresenceRepository
    implements PresenceRepository, JourneyLifecycleGateway {
  RealtimePresenceRepository({
    required AnonymousSessionApi sessionApi,
    required Uri baseUrl,
    required InstallationIdentityStore identityStore,
    PresenceProtocolCodec codec = const PresenceProtocolCodec(),
    PresenceReconnectPolicy? reconnectPolicy,
    SecureRandomInstallationIdGenerator? identityGenerator,
    UserProfileStore? userProfileStore,
  }) : _baseUrl = baseUrl,
       _codec = codec,
       _identityGenerator =
           identityGenerator ?? SecureRandomInstallationIdGenerator(),
       _identityStore = identityStore,
       _reconnectPolicy = reconnectPolicy ?? PresenceReconnectPolicy(),
       _sessionApi = sessionApi,
       _userProfileStore = userProfileStore;

  final Uri _baseUrl;
  final PresenceProtocolCodec _codec;
  final SecureRandomInstallationIdGenerator _identityGenerator;
  final InstallationIdentityStore _identityStore;
  final PresenceReconnectPolicy _reconnectPolicy;
  final AnonymousSessionApi _sessionApi;
  final UserProfileStore? _userProfileStore;
  final PresenceSnapshotReducer _reducer = PresenceSnapshotReducer();
  final StreamController<PresenceConnectionState> _connectionStates =
      StreamController<PresenceConnectionState>.broadcast(sync: true);
  final StreamController<PresenceSnapshot> _snapshots =
      StreamController<PresenceSnapshot>.broadcast(sync: true);
  final Map<String, Completer<JourneyAcknowledgement>> _journeyRequests = {};

  IOWebSocketChannel? _channel;
  StreamSubscription<dynamic>? _channelSubscription;
  Timer? _heartbeatTimer;
  Timer? _reconnectTimer;
  AnonymousSession? _cachedSession;
  Completer<void>? _sessionReadyCompleter;
  Future<void>? _connectFuture;
  LocalPresencePosition? _latestPosition;
  String? _observedBuildingId;
  String? _observedFloorId;
  int _connectionEpoch = 0;
  int _locationSequence = 0;
  int _reconnectAttempt = 0;
  int _requestSequence = 0;
  bool _connected = false;
  bool _desiredConnection = false;
  bool _disposed = false;
  bool _observing = false;
  PresenceConnectionState _connectionState =
      const PresenceConnectionState.disconnected();

  @override
  PresenceConnectionState get connectionState => _connectionState;

  @override
  Stream<PresenceConnectionState> get connectionStates =>
      _connectionStates.stream;

  @override
  bool get isSimulated => false;

  @override
  bool get isJourneyTransportConnected => _connected;

  @override
  Stream<PresenceSnapshot> get snapshots => _snapshots.stream;

  @override
  Future<void> connect() async {
    _throwIfDisposed();
    _desiredConnection = true;
    if (_connected || _reconnectTimer != null) return;
    final existing = _connectFuture;
    if (existing != null) return existing;
    final future = _open(_connectionEpoch);
    _connectFuture = future;
    try {
      await future;
    } finally {
      if (identical(_connectFuture, future)) _connectFuture = null;
    }
  }

  Future<void> _open(int epoch) async {
    if (!_desiredConnection || _disposed || epoch != _connectionEpoch) return;
    _emitConnection(
      PresenceConnectionState(
        phase: _reconnectAttempt == 0
            ? PresenceConnectionPhase.connecting
            : PresenceConnectionPhase.reconnecting,
        attempt: _reconnectAttempt,
      ),
    );
    try {
      final session = await _activeSession();
      if (!_desiredConnection || _disposed || epoch != _connectionEpoch) return;
      _locationSequence = 0;
      final endpoint = _webSocketUri(session.webSocketPath);
      final channel = IOWebSocketChannel.connect(
        endpoint,
        connectTimeout: const Duration(seconds: 8),
        headers: <String, String>{
          HttpHeaders.authorizationHeader: 'Bearer ${session.accessToken}',
        },
      );
      await channel.ready.timeout(const Duration(seconds: 8));
      if (!_desiredConnection || _disposed || epoch != _connectionEpoch) {
        await channel.sink.close();
        return;
      }
      _channel = channel;
      final sessionReady = Completer<void>();
      _sessionReadyCompleter = sessionReady;
      _channelSubscription = channel.stream.listen(
        (data) => _onMessage(channel, epoch, data),
        onError: (Object error) => _onSocketClosed(channel, epoch, error),
        onDone: () => _onSocketClosed(channel, epoch, null),
        cancelOnError: true,
      );
      await sessionReady.future.timeout(const Duration(seconds: 8));
    } on Object catch (error) {
      final ready = _sessionReadyCompleter;
      if (ready != null && !ready.isCompleted) ready.completeError(error);
      if (_desiredConnection && !_disposed && epoch == _connectionEpoch) {
        _scheduleReconnect(error);
      }
    } finally {
      _sessionReadyCompleter = null;
    }
  }

  Future<AnonymousSession> _activeSession() async {
    final now = DateTime.now().toUtc().add(const Duration(seconds: 5));
    final cached = _cachedSession;
    if (cached != null &&
        cached.tokenExpiresAt.isAfter(now) &&
        cached.sessionExpiresAt.isAfter(now)) {
      return cached;
    }
    final created = await _sessionApi.create(
      await _installationId(),
      displayName: await _userProfileStore?.readDisplayName(),
    );
    _cachedSession = created;
    return created;
  }

  Future<String> _installationId() async {
    final stored = (await _identityStore.read())?.trim();
    if (stored != null && stored.isNotEmpty) return stored;
    final generated = _identityGenerator.generate();
    await _identityStore.write(generated);
    return generated;
  }

  Uri _webSocketUri(String path) {
    final resolved = _baseUrl.resolve(path);
    return resolved.replace(
      scheme: switch (resolved.scheme) {
        'https' => 'wss',
        'http' => 'ws',
        final scheme => scheme,
      },
    );
  }

  void _onMessage(IOWebSocketChannel channel, int epoch, Object? data) {
    if (channel != _channel || epoch != _connectionEpoch || _disposed) return;
    try {
      final event = _codec.decode(data);
      switch (event) {
        case PresenceSessionReady(:final heartbeatSeconds):
          _connected = true;
          _reconnectAttempt = 0;
          _emitConnection(
            const PresenceConnectionState(
              phase: PresenceConnectionPhase.connected,
            ),
          );
          _startHeartbeat(heartbeatSeconds);
          final ready = _sessionReadyCompleter;
          if (ready != null && !ready.isCompleted) ready.complete();
          if (_observing) _sendSubscription();
          final latest = _latestPosition;
          if (latest != null &&
              DateTime.now().difference(latest.observedAt).inSeconds < 3) {
            _sendLocation(latest);
          }
        case PresenceSnapshotReceived(:final snapshot):
          if (!_observing ||
              snapshot.buildingId != _observedBuildingId ||
              snapshot.floorId != _observedFloorId) {
            return;
          }
          final reduced = _reducer.apply(event);
          if (reduced != null) _snapshots.add(reduced);
        case PresenceActorChanged(:final actor):
          if (!_observing ||
              actor.buildingId != _observedBuildingId ||
              actor.floorId != _observedFloorId) {
            return;
          }
          final before = _reducer.snapshot;
          final reduced = _reducer.apply(event);
          if (reduced != null && !identical(before, reduced)) {
            _snapshots.add(reduced);
          }
        case PresenceActorLeft():
          if (!_observing) return;
          final before = _reducer.snapshot;
          final reduced = _reducer.apply(event);
          if (reduced != null && !identical(before, reduced)) {
            _snapshots.add(reduced);
          }
        case PresenceEdgeOccupancyChanged(:final buildingId, :final floorId):
          if (!_observing ||
              buildingId != _observedBuildingId ||
              floorId != _observedFloorId) {
            return;
          }
          final reduced = _reducer.apply(event);
          if (reduced != null) _snapshots.add(reduced);
        case PresenceProtocolFailure(
          :final retryable,
          :final message,
          :final requestId,
        ):
          final request = _journeyRequests.remove(requestId);
          if (request != null && !request.isCompleted) {
            request.completeError(StateError(message));
          }
          if (retryable) {
            _onSocketClosed(channel, epoch, StateError(message));
          }
        case PresenceAcknowledged(:final requestId, :final journey):
          final request = _journeyRequests.remove(requestId);
          if (request != null && !request.isCompleted) {
            if (journey == null) {
              request.completeError(
                StateError('Journey ACK is missing lifecycle fields.'),
              );
            } else {
              request.complete(journey);
            }
          }
      }
    } on Object catch (error) {
      _onSocketClosed(channel, epoch, error);
    }
  }

  void _startHeartbeat(int seconds) {
    _heartbeatTimer?.cancel();
    final interval = Duration(seconds: seconds.clamp(5, 60));
    _heartbeatTimer = Timer.periodic(interval, (_) {
      if (_connected) _send(_codec.heartbeat(_nextRequestId('heartbeat')));
    });
  }

  void _onSocketClosed(IOWebSocketChannel channel, int epoch, Object? error) {
    if (channel != _channel || epoch != _connectionEpoch) return;
    _channel = null;
    _connected = false;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    unawaited(_channelSubscription?.cancel());
    _channelSubscription = null;
    unawaited(channel.sink.close());
    _failJourneyRequests(error ?? StateError('WebSocket disconnected.'));
    final ready = _sessionReadyCompleter;
    if (ready != null && !ready.isCompleted) {
      ready.completeError(
        error ?? StateError('WebSocket closed before ready.'),
      );
    }
    if (_desiredConnection && !_disposed) _scheduleReconnect(error);
  }

  void _scheduleReconnect(Object? error) {
    if (_reconnectTimer != null || !_desiredConnection || _disposed) return;
    final attempt = _reconnectAttempt++;
    _emitConnection(
      PresenceConnectionState(
        phase: PresenceConnectionPhase.reconnecting,
        attempt: attempt + 1,
        error: error,
      ),
    );
    _reconnectTimer = Timer(_reconnectPolicy.delayForAttempt(attempt), () {
      _reconnectTimer = null;
      unawaited(connect());
    });
  }

  @override
  Future<void> start({
    required String buildingId,
    required String floorId,
  }) async {
    _throwIfDisposed();
    _observedBuildingId = buildingId;
    _observedFloorId = floorId;
    _observing = true;
    _reducer.reset();
    await connect();
    if (_connected) _sendSubscription();
  }

  @override
  Future<void> selectFloor({
    required String buildingId,
    required String floorId,
  }) => start(buildingId: buildingId, floorId: floorId);

  void _sendSubscription() {
    final buildingId = _observedBuildingId;
    final floorId = _observedFloorId;
    if (!_connected || !_observing || buildingId == null || floorId == null) {
      return;
    }
    _send(
      _codec.subscribeFloor(
        buildingId: buildingId,
        floorId: floorId,
        requestId: _nextRequestId('subscribe'),
      ),
    );
  }

  @override
  Future<void> stop() async {
    _throwIfDisposed();
    _observing = false;
    _reducer.reset();
  }

  @override
  Future<void> publishLocation(LocalPresencePosition position) async {
    _throwIfDisposed();
    _latestPosition = position;
    if (_connected) _sendLocation(position);
  }

  void _sendLocation(LocalPresencePosition position) {
    _locationSequence += 1;
    _send(
      _codec.locationUpdate(
        position: position,
        requestId: _nextRequestId('location'),
        sequence: _locationSequence,
      ),
    );
  }

  @override
  Future<void> leave() async {
    _latestPosition = null;
    if (_connected) _send(_codec.leave(_nextRequestId('leave')));
  }

  @override
  Future<JourneyAcknowledgement> sendJourneyCommand(
    JourneyCommand command,
  ) async {
    _throwIfDisposed();
    if (!_connected) {
      throw StateError('Journey transport is disconnected.');
    }
    final requestId = 'journey-${command.clientEventId}';
    final existing = _journeyRequests[requestId];
    if (existing != null) return existing.future;
    final completion = Completer<JourneyAcknowledgement>();
    _journeyRequests[requestId] = completion;
    _send(_codec.journeyCommand(command: command, requestId: requestId));
    try {
      return await completion.future.timeout(const Duration(seconds: 8));
    } finally {
      if (identical(_journeyRequests[requestId], completion)) {
        _journeyRequests.remove(requestId);
      }
    }
  }

  void _send(String message) => _channel?.sink.add(message);

  String _nextRequestId(String prefix) => '$prefix-${++_requestSequence}';

  @override
  Future<void> disconnect() async {
    if (_disposed) return;
    _desiredConnection = false;
    _connectionEpoch += 1;
    _connected = false;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _connectFuture = null;
    _sessionReadyCompleter = null;
    _failJourneyRequests(StateError('WebSocket disconnected.'));
    await _channelSubscription?.cancel();
    _channelSubscription = null;
    final channel = _channel;
    _channel = null;
    await channel?.sink.close();
    _emitConnection(const PresenceConnectionState.disconnected());
  }

  void _emitConnection(PresenceConnectionState state) {
    _connectionState = state;
    if (!_connectionStates.isClosed) _connectionStates.add(state);
  }

  void _failJourneyRequests(Object error) {
    final pending = _journeyRequests.values.toList(growable: false);
    _journeyRequests.clear();
    for (final request in pending) {
      if (!request.isCompleted) request.completeError(error);
    }
  }

  @override
  Future<void> dispose() async {
    if (_disposed) return;
    await disconnect();
    _disposed = true;
    _sessionApi.close();
    await Future.wait<void>([_connectionStates.close(), _snapshots.close()]);
  }

  void _throwIfDisposed() {
    if (_disposed) throw StateError('RealtimePresenceRepository is disposed.');
  }
}
