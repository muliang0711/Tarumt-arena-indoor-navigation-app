import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/journey/journey_lifecycle_coordinator.dart';
import 'package:indoor_navigation/application/ports/journey/journey_lifecycle_gateway.dart';
import 'package:indoor_navigation/application/ports/journey/journey_outbox_store.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/domain/journey/journey.dart';

void main() {
  test(
    'unknown terminal failures are retained rather than discarded',
    () async {
      final store = _MemoryOutboxStore();
      final command = JourneyEndCommand(
        clientEventId: 'event',
        clientJourneyKey: 'key',
        occurredAt: DateTime.utc(2026, 7, 28),
        journeyId: 'journey',
        outcome: JourneyOutcome.cancelled,
      );
      store.snapshot = JourneyOutboxSnapshot(pending: [command], state: null);
      final gateway = _RecordingGateway()
        ..connected = true
        ..rejectNext = const JourneyCommandRejected(
          code: 'invalid_journey',
          retryable: false,
        );
      await _coordinator(store: store, gateway: gateway).resume();
      expect(store.snapshot.pending, [command]);
      expect(store.snapshot.rejected, isEmpty);
    },
  );

  for (final code in ['journey_not_active', 'journey_ended']) {
    test(
      'quarantines stale end ($code) and acknowledges new navigation',
      () async {
        final store = _MemoryOutboxStore();
        final old = JourneyEndCommand(
          clientEventId: 'old-event',
          clientJourneyKey: 'old-key',
          occurredAt: DateTime.utc(2026, 7, 28),
          journeyId: 'old-server-journey',
          outcome: JourneyOutcome.cancelled,
        );
        store.snapshot = JourneyOutboxSnapshot(pending: [old], state: null);
        final gateway = _RecordingGateway()
          ..connected = true
          ..rejectNext = JourneyCommandRejected(code: code, retryable: false);
        final coordinator = _coordinator(store: store, gateway: gateway);
        expect(
          await coordinator.synchronizeNavigation(
            navigationSessionId: 99,
            route: _route('node-1', 'node-2', ['edge-1']),
          ),
          isTrue,
        );
        expect(store.snapshot.pending, isEmpty);
        expect(store.snapshot.rejected, [old]);
        expect(gateway.sent.last, isA<JourneyStartCommand>());
      },
    );
  }

  test('retryable rejection preserves pending start for retry', () async {
    final store = _MemoryOutboxStore();
    final gateway = _RecordingGateway()
      ..connected = true
      ..rejectNext = const JourneyCommandRejected(
        code: 'unavailable',
        retryable: true,
      );
    final coordinator = _coordinator(store: store, gateway: gateway);
    expect(
      await coordinator.synchronizeNavigation(
        navigationSessionId: 1,
        route: _route('node-1', 'node-2', ['edge-1']),
      ),
      isFalse,
    );
    expect(store.snapshot.pending, hasLength(1));
    expect(store.snapshot.rejected, isEmpty);
    await coordinator.resume();
    expect(coordinator.canPublishFor(1), isTrue);
  });

  test('persists before send and retries the same client_event_id', () async {
    final store = _MemoryOutboxStore();
    final gateway = _RecordingGateway()..connected = false;
    final coordinator = _coordinator(store: store, gateway: gateway);
    final route = _route('node-1', 'node-2', ['edge-1']);

    expect(
      await coordinator.synchronizeNavigation(
        navigationSessionId: 1,
        route: route,
      ),
      isFalse,
    );
    expect(store.snapshot.pending, hasLength(1));
    final persistedId = store.snapshot.pending.single.clientEventId;
    expect(gateway.sent, isEmpty);

    gateway
      ..connected = true
      ..failNext = true;
    await coordinator.resume();
    expect(gateway.sent.single.clientEventId, persistedId);
    expect(store.snapshot.pending, hasLength(1));

    await coordinator.resume();
    expect(gateway.sent, hasLength(2));
    expect(gateway.sent.last.clientEventId, persistedId);
    expect(store.snapshot.pending, isEmpty);
    expect(store.snapshot.state?.journeyId, 'server-journey-1');
    expect(coordinator.canPublishFor(1), isTrue);
  });

  test('orders route recalculation and offline end after start ACK', () async {
    final store = _MemoryOutboxStore();
    final gateway = _RecordingGateway()..connected = true;
    final coordinator = _coordinator(store: store, gateway: gateway);
    await coordinator.synchronizeNavigation(
      navigationSessionId: 7,
      route: _route('node-1', 'node-2', ['edge-1']),
    );

    await coordinator.synchronizeNavigation(
      navigationSessionId: 7,
      route: _route('node-3', 'node-2', ['edge-2']),
    );
    expect(gateway.sent, hasLength(2));
    final recalculated = gateway.sent[1] as JourneyRecalculateCommand;
    expect(recalculated.journeyId, 'server-journey-1');
    expect(recalculated.route.destinationNodeId, 'node-2');
    expect(store.snapshot.state?.routeRevision, 2);

    gateway.connected = false;
    await coordinator.end(JourneyOutcome.arrived);
    expect(gateway.sent, hasLength(2));
    expect(store.snapshot.state?.desiredEndOutcome, JourneyOutcome.arrived);

    gateway.connected = true;
    await coordinator.resume();
    expect(gateway.sent, hasLength(3));
    final ended = gateway.sent.last as JourneyEndCommand;
    expect(ended.journeyId, 'server-journey-1');
    expect(ended.outcome, JourneyOutcome.arrived);
    expect(store.snapshot.pending, isEmpty);
    expect(store.snapshot.state, isNull);
    expect(coordinator.canPublishFor(7), isFalse);
  });

  test(
    'destination change becomes a new start instead of recalculation',
    () async {
      final store = _MemoryOutboxStore();
      final gateway = _RecordingGateway()..connected = true;
      final coordinator = _coordinator(store: store, gateway: gateway);
      await coordinator.synchronizeNavigation(
        navigationSessionId: 3,
        route: _route('node-1', 'node-2', ['edge-1']),
      );
      await coordinator.synchronizeNavigation(
        navigationSessionId: 3,
        route: _route('node-1', 'node-4', ['edge-4']),
      );

      expect(gateway.sent, hasLength(2));
      expect(gateway.sent[0], isA<JourneyStartCommand>());
      expect(gateway.sent[1], isA<JourneyStartCommand>());
      expect(
        gateway.sent[0].clientJourneyKey,
        isNot(gateway.sent[1].clientJourneyKey),
      );
    },
  );
}

JourneyLifecycleCoordinator _coordinator({
  required _MemoryOutboxStore store,
  required _RecordingGateway gateway,
}) {
  var id = 0;
  return JourneyLifecycleCoordinator(
    clock: _FixedClock(),
    gateway: gateway,
    idGenerator: () => 'generated-${++id}',
    mapId: 'main-campus',
    mapRevision: 'revision-1',
    outboxStore: store,
  );
}

PlannedJourneyRoute _route(
  String origin,
  String destination,
  List<String> edges,
) {
  return PlannedJourneyRoute(
    originNodeId: origin,
    destinationNodeId: destination,
    plannedEdgeIds: edges,
  );
}

final class _FixedClock implements Clock {
  @override
  int nowMs() => DateTime.utc(2026, 7, 26, 2).millisecondsSinceEpoch;
}

final class _MemoryOutboxStore implements JourneyOutboxStore {
  JourneyOutboxSnapshot snapshot = const JourneyOutboxSnapshot.empty();

  @override
  Future<JourneyOutboxSnapshot> read() async => snapshot;

  @override
  Future<void> write(JourneyOutboxSnapshot value) async {
    snapshot = value;
  }
}

final class _RecordingGateway implements JourneyLifecycleGateway {
  bool connected = false;
  bool failNext = false;
  JourneyCommandRejected? rejectNext;
  final List<JourneyCommand> sent = [];
  int _routeRevision = 0;

  @override
  bool get isJourneyTransportConnected => connected;

  @override
  Future<JourneyAcknowledgement> sendJourneyCommand(
    JourneyCommand command,
  ) async {
    sent.add(command);
    final rejection = rejectNext;
    if (rejection != null) {
      rejectNext = null;
      throw rejection;
    }
    if (failNext) {
      failNext = false;
      throw StateError('connection lost');
    }
    _routeRevision = switch (command) {
      JourneyStartCommand() => 1,
      JourneyRecalculateCommand() => _routeRevision + 1,
      JourneyEndCommand() => _routeRevision,
    };
    return JourneyAcknowledgement(
      journeyId: 'server-journey-1',
      lifecycleSequence: sent.length,
      routeRevision: _routeRevision,
      deduplicated: false,
    );
  }
}
