// ignore_for_file: prefer_initializing_formals

import 'dart:async';

import 'package:indoor_navigation/application/ports/journey/journey_lifecycle_gateway.dart';
import 'package:indoor_navigation/application/ports/journey/journey_outbox_store.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/domain/journey/journey.dart';

typedef JourneyIdGenerator = String Function();

final class JourneyLifecycleCoordinator {
  JourneyLifecycleCoordinator({
    required Clock clock,
    required JourneyLifecycleGateway gateway,
    required JourneyIdGenerator idGenerator,
    required String mapId,
    required String mapRevision,
    required JourneyOutboxStore outboxStore,
  }) : _clock = clock,
       _gateway = gateway,
       _idGenerator = idGenerator,
       _mapId = mapId,
       _mapRevision = mapRevision,
       _outboxStore = outboxStore;

  final Clock _clock;
  final JourneyLifecycleGateway _gateway;
  final JourneyIdGenerator _idGenerator;
  final String _mapId;
  final String _mapRevision;
  final JourneyOutboxStore _outboxStore;

  JourneyOutboxSnapshot _snapshot = const JourneyOutboxSnapshot.empty();
  Future<void> _tail = Future<void>.value();
  bool _initialized = false;
  bool _disposed = false;

  bool canPublishFor(int navigationSessionId) {
    final state = _snapshot.state;
    return state?.navigationSessionId == navigationSessionId &&
        state?.journeyId != null &&
        state?.desiredEndOutcome == null;
  }

  Future<bool> synchronizeNavigation({
    required int navigationSessionId,
    required PlannedJourneyRoute route,
    JourneyRerouteReason rerouteReason =
        JourneyRerouteReason.localizationCorrection,
  }) {
    return _enqueue(() async {
      await _initialize();
      final current = _snapshot.state;
      if (current?.navigationSessionId != navigationSessionId ||
          current?.route.destinationNodeId != route.destinationNodeId) {
        await _enqueueStart(navigationSessionId, route);
      } else if (current!.route.signature != route.signature &&
          current.journeyId != null) {
        final alreadyPending = _snapshot.pending.any(
          (command) =>
              command is JourneyRecalculateCommand &&
              command.clientJourneyKey == current.clientJourneyKey &&
              command.route.signature == route.signature,
        );
        if (!alreadyPending) {
          await _append(
            JourneyRecalculateCommand(
              clientEventId: _idGenerator(),
              clientJourneyKey: current.clientJourneyKey,
              occurredAt: _now(),
              journeyId: current.journeyId!,
              mapId: current.mapId,
              mapRevision: current.mapRevision,
              reason: rerouteReason,
              route: route,
            ),
            state: current.copyWith(route: route),
          );
        }
      }
      await _drain();
      return canPublishFor(navigationSessionId);
    });
  }

  Future<void> end(JourneyOutcome outcome) {
    return _enqueue(() async {
      await _initialize();
      final current = _snapshot.state;
      if (current == null) return;
      _snapshot = JourneyOutboxSnapshot(
        pending: _snapshot.pending,
        state: current.copyWith(desiredEndOutcome: outcome),
      );
      await _persist();
      await _drain();
    });
  }

  Future<void> resume() {
    return _enqueue(() async {
      await _initialize();
      await _drain();
    });
  }

  Future<void> _enqueueStart(
    int navigationSessionId,
    PlannedJourneyRoute route,
  ) async {
    final clientJourneyKey = _idGenerator();
    final state = JourneyClientState(
      navigationSessionId: navigationSessionId,
      clientJourneyKey: clientJourneyKey,
      journeyId: null,
      mapId: _mapId,
      mapRevision: _mapRevision,
      route: route,
      routeRevision: 0,
      desiredEndOutcome: null,
    );
    await _append(
      JourneyStartCommand(
        clientEventId: _idGenerator(),
        clientJourneyKey: clientJourneyKey,
        occurredAt: _now(),
        mapId: _mapId,
        mapRevision: _mapRevision,
        route: route,
      ),
      state: state,
    );
  }

  Future<void> _append(
    JourneyCommand command, {
    JourneyClientState? state,
  }) async {
    _snapshot = JourneyOutboxSnapshot(
      pending: <JourneyCommand>[..._snapshot.pending, command],
      state: state ?? _snapshot.state,
    );
    await _persist();
  }

  Future<void> _drain() async {
    if (!_gateway.isJourneyTransportConnected) return;
    while (!_disposed && _gateway.isJourneyTransportConnected) {
      await _materializeDesiredEnd();
      if (_snapshot.pending.isEmpty) return;
      final command = _snapshot.pending.first;
      JourneyAcknowledgement acknowledgement;
      try {
        acknowledgement = await _gateway.sendJourneyCommand(command);
      } on Object {
        return;
      }
      final remaining = _snapshot.pending.skip(1).toList(growable: false);
      var state = _snapshot.state;
      if (state?.clientJourneyKey == command.clientJourneyKey) {
        switch (command) {
          case JourneyStartCommand():
            state = state!.copyWith(
              journeyId: acknowledgement.journeyId,
              routeRevision: acknowledgement.routeRevision,
            );
          case JourneyRecalculateCommand(:final route):
            state = state!.copyWith(
              journeyId: acknowledgement.journeyId,
              route: route,
              routeRevision: acknowledgement.routeRevision,
            );
          case JourneyEndCommand():
            state = null;
        }
      }
      _snapshot = JourneyOutboxSnapshot(pending: remaining, state: state);
      await _persist();
    }
  }

  Future<void> _materializeDesiredEnd() async {
    final state = _snapshot.state;
    final outcome = state?.desiredEndOutcome;
    final journeyId = state?.journeyId;
    if (state == null || outcome == null || journeyId == null) return;
    if (_snapshot.pending.any(
      (command) =>
          command is JourneyEndCommand &&
          command.clientJourneyKey == state.clientJourneyKey,
    )) {
      return;
    }
    final endedState = state.copyWith(clearDesiredEnd: true);
    await _append(
      JourneyEndCommand(
        clientEventId: _idGenerator(),
        clientJourneyKey: state.clientJourneyKey,
        occurredAt: _now(),
        journeyId: journeyId,
        outcome: outcome,
      ),
      state: endedState,
    );
  }

  Future<void> _initialize() async {
    if (_initialized) return;
    _snapshot = await _outboxStore.read();
    _initialized = true;
  }

  Future<void> _persist() => _outboxStore.write(_snapshot);

  DateTime _now() =>
      DateTime.fromMillisecondsSinceEpoch(_clock.nowMs(), isUtc: true);

  Future<T> _enqueue<T>(Future<T> Function() operation) {
    final completion = Completer<T>();
    _tail = _tail.then((_) async {
      if (_disposed) {
        completion.completeError(StateError('Journey coordinator is disposed'));
        return;
      }
      try {
        completion.complete(await operation());
      } on Object catch (error, stackTrace) {
        completion.completeError(error, stackTrace);
      }
    });
    return completion.future;
  }

  Future<void> dispose() async {
    if (_disposed) return;
    await _tail;
    _disposed = true;
  }
}
