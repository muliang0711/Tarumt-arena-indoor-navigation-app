import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/presence/realtime_presence_coordinator.dart';
import 'package:indoor_navigation/application/ports/presence/presence_repository.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';

import '../../support/fakes/fakes.dart';

void main() {
  test(
    'leaves once and suppresses stale updates from the ended session',
    () async {
      final clock = FakeClock(initialNowMs: 1000);
      final mapRepository = FakeMapAssetRepository()
        ..enqueueTiledMapJson(
          assetPath: 'assets/maps/demo_1.tmj.json',
          json: File('assets/maps/demo_1.tmj.json').readAsStringSync(),
        )
        ..enqueueRouteGraphEdgesJson(
          assetPath: 'assets/maps/demo_1.edges.json',
          json: File('assets/maps/demo_1.edges.json').readAsStringSync(),
        );
      final viewModel = IndoorNavigationViewModel(
        clock: clock,
        edgeDocumentExporter: FakeEdgeDocumentExporter(),
        mapAssetRepository: mapRepository,
        periodicScheduler: FakePeriodicScheduler(clock: clock),
        sensorDebugSink: FakeSensorDebugSink(),
        sensorDeviceManager: FakeSensorDeviceManager(),
      );
      final repository = _RecordingPresenceRepository();
      final coordinator = RealtimePresenceCoordinator(
        buildingId: 'main-campus',
        clock: clock,
        repository: repository,
      );
      final destination = CampusRoom(
        category: CampusRoomCategory.classroom,
        floorId: 'floor-2',
        id: 'TA257',
        name: 'TA257',
        navigationNodeId: 'node-20',
        roomCode: 'TA257',
        typeLabel: 'Classroom',
        visual: CampusRoomVisual.lectureHall,
        walkMinutes: 1,
      );

      await coordinator.start();
      await viewModel.startNavigation(
        destination: destination,
        startNodeId: 'node-21',
      );
      final firstSession = viewModel.state.navigationSessionId;
      await coordinator.updateNavigation(
        floorId: 'floor-2',
        state: viewModel.state,
      );
      expect(repository.startedFloors, <String>['main-campus/floor-2']);
      expect(repository.published, hasLength(1));

      await coordinator.endNavigationPresence(
        navigationSessionId: firstSession,
      );
      await coordinator.updateNavigation(
        floorId: 'floor-2',
        state: viewModel.state,
      );

      expect(repository.leaveCount, 1);
      expect(repository.published, hasLength(1));
      expect(repository.disconnectCount, 0);
      expect(repository.stopCount, 1);

      await viewModel.cancelNavigation();
      await viewModel.startNavigation(
        destination: destination,
        startNodeId: 'node-21',
      );
      clock.advanceByMs(presencePublishIntervalMs);
      await coordinator.updateNavigation(
        floorId: 'floor-2',
        state: viewModel.state,
      );

      expect(viewModel.state.navigationSessionId, isNot(firstSession));
      expect(repository.published, hasLength(2));

      await coordinator.dispose();
      await viewModel.dispose();
    },
  );

  test('republishes the latest navigation position after reconnect', () async {
    final clock = FakeClock(initialNowMs: 1000);
    final mapRepository = FakeMapAssetRepository()
      ..enqueueTiledMapJson(
        assetPath: 'assets/maps/demo_1.tmj.json',
        json: File('assets/maps/demo_1.tmj.json').readAsStringSync(),
      )
      ..enqueueRouteGraphEdgesJson(
        assetPath: 'assets/maps/demo_1.edges.json',
        json: File('assets/maps/demo_1.edges.json').readAsStringSync(),
      );
    final viewModel = IndoorNavigationViewModel(
      clock: clock,
      edgeDocumentExporter: FakeEdgeDocumentExporter(),
      mapAssetRepository: mapRepository,
      periodicScheduler: FakePeriodicScheduler(clock: clock),
      sensorDebugSink: FakeSensorDebugSink(),
      sensorDeviceManager: FakeSensorDeviceManager(),
    );
    final repository = _RecordingPresenceRepository();
    final coordinator = RealtimePresenceCoordinator(
      buildingId: 'main-campus',
      clock: clock,
      repository: repository,
    );
    final destination = CampusRoom(
      category: CampusRoomCategory.classroom,
      floorId: 'floor-2',
      id: 'TA257',
      name: 'TA257',
      navigationNodeId: 'node-20',
      roomCode: 'TA257',
      typeLabel: 'Classroom',
      visual: CampusRoomVisual.lectureHall,
      walkMinutes: 1,
    );

    await coordinator.start();
    await viewModel.startNavigation(
      destination: destination,
      startNodeId: 'node-21',
    );
    await coordinator.updateNavigation(
      floorId: 'floor-2',
      state: viewModel.state,
    );
    expect(repository.published, hasLength(1));

    repository.emitConnection(PresenceConnectionPhase.reconnecting);
    repository.emitConnection(PresenceConnectionPhase.connected);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(repository.published, hasLength(2));
    await coordinator.dispose();
    await viewModel.dispose();
    await repository.close();
  });
}

final class _RecordingPresenceRepository implements PresenceRepository {
  final StreamController<PresenceConnectionState> _connections =
      StreamController<PresenceConnectionState>.broadcast(sync: true);
  final List<LocalPresencePosition> published = [];
  final List<String> startedFloors = [];
  int disconnectCount = 0;
  int leaveCount = 0;
  int stopCount = 0;

  @override
  PresenceConnectionState get connectionState =>
      const PresenceConnectionState(phase: PresenceConnectionPhase.connected);

  @override
  Stream<PresenceConnectionState> get connectionStates => _connections.stream;

  @override
  bool get isSimulated => false;

  @override
  Stream<PresenceSnapshot> get snapshots => const Stream.empty();

  @override
  Future<void> connect() async {}

  @override
  Future<void> disconnect() async => disconnectCount += 1;

  @override
  Future<void> dispose() async {}

  @override
  Future<void> leave() async => leaveCount += 1;

  @override
  Future<void> publishLocation(LocalPresencePosition position) async {
    published.add(position);
  }

  @override
  Future<void> selectFloor({
    required String buildingId,
    required String floorId,
  }) async {}

  @override
  Future<void> start({
    required String buildingId,
    required String floorId,
  }) async => startedFloors.add('$buildingId/$floorId');

  @override
  Future<void> stop() async => stopCount += 1;

  void emitConnection(PresenceConnectionPhase phase) {
    _connections.add(PresenceConnectionState(phase: phase));
  }

  Future<void> close() => _connections.close();
}
