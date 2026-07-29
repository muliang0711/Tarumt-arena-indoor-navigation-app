import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/journey/journey_lifecycle_coordinator.dart';
import 'package:indoor_navigation/application/ports/journey/journey_lifecycle_gateway.dart';
import 'package:indoor_navigation/application/ports/journey/journey_outbox_store.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/domain/journey/journey.dart';

void main() {
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
  final List<JourneyCommand> sent = [];
  int _routeRevision = 0;

  @override
  bool get isJourneyTransportConnected => connected;

  @override
  Future<JourneyAcknowledgement> sendJourneyCommand(
    JourneyCommand command,
  ) async {
    sent.add(command);
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
