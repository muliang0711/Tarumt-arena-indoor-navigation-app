import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/presence/presence_repository.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_model.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_state.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/infrastructure/presence/mock_presence_repository.dart';

import '../../support/fakes/fakes.dart';

void main() {
  late String edgesJson;
  late String mapJson;

  setUpAll(() {
    edgesJson = File('assets/maps/demo_1.edges.json').readAsStringSync();
    mapJson = File('assets/maps/demo_1.tmj.json').readAsStringSync();
  });

  test('loads the map, streams presence, and switches floors', () async {
    final clock = FakeClock(initialNowMs: 1000);
    final scheduler = FakePeriodicScheduler(clock: clock);
    final viewModel = _createViewModel(
      clock: clock,
      edgesJson: edgesJson,
      mapJson: mapJson,
      scheduler: scheduler,
    );

    await viewModel.initialize();
    expect(viewModel.state.loadStatus, LiveMapLoadStatus.ready);
    expect(viewModel.state.snapshot?.totalAppUsers, 126);
    expect(viewModel.state.snapshot?.representatives, hasLength(10));
    expect(viewModel.state.hasMapForSelectedFloor, isTrue);

    final firstSequence =
        viewModel.state.snapshot!.representatives.first.sequence;
    scheduler.advanceByMs(mockPresenceTickIntervalMs);
    expect(
      viewModel.state.snapshot!.representatives.first.sequence,
      greaterThan(firstSequence),
    );

    await viewModel.selectFloor('floor-4');
    expect(viewModel.state.selectedFloorId, 'floor-4');
    expect(viewModel.state.snapshot?.representatives, hasLength(9));
    expect(viewModel.state.hasMapForSelectedFloor, isFalse);

    await viewModel.dispose();
  });

  test('accepts continuous zoom and clamps it to map limits', () async {
    final clock = FakeClock();
    final viewModel = _createViewModel(
      clock: clock,
      edgesJson: edgesJson,
      mapJson: mapJson,
      scheduler: FakePeriodicScheduler(clock: clock),
    );

    await viewModel.initialize();
    viewModel.setZoom(1.37);
    expect(viewModel.state.zoom, 1.37);
    viewModel.setZoom(20);
    expect(viewModel.state.zoom, 2);
    viewModel.setZoom(-20);
    expect(viewModel.state.zoom, 0.5);

    await viewModel.dispose();
  });

  test('emits a typed error when map bootstrap fails', () async {
    final clock = FakeClock();
    final repository = FakeMapAssetRepository()
      ..enqueueTiledMapFailure(
        assetPath: 'assets/maps/demo_1.tmj.json',
        error: StateError('map unavailable'),
      );
    final viewModel = LiveMapViewModel(
      buildingId: 'main-campus',
      buildingName: mainCampusBuildingName,
      floors: mainCampusFloors,
      mapAssetRepository: repository,
      presenceRepository: MockPresenceRepository(
        clock: clock,
        scheduler: FakePeriodicScheduler(clock: clock),
      ),
    );

    await viewModel.initialize();
    expect(viewModel.state.loadStatus, LiveMapLoadStatus.error);
    expect(viewModel.state.loadError, isA<StateError>());

    await viewModel.dispose();
  });

  test(
    'reads the current connection when its earlier event was missed',
    () async {
      final repository = _SilentPresenceRepository();
      final mapRepository = FakeMapAssetRepository()
        ..enqueueTiledMapJson(
          assetPath: 'assets/maps/demo_1.tmj.json',
          json: mapJson,
        )
        ..enqueueRouteGraphEdgesJson(
          assetPath: 'assets/maps/demo_1.edges.json',
          json: edgesJson,
        );
      final viewModel = LiveMapViewModel(
        buildingId: 'main-campus',
        buildingName: mainCampusBuildingName,
        floors: mainCampusFloors,
        mapAssetRepository: mapRepository,
        presenceRepository: repository,
      );
      repository.connectionState = const PresenceConnectionState(
        phase: PresenceConnectionPhase.connected,
      );

      await viewModel.initialize();

      expect(
        viewModel.state.presenceConnection.phase,
        PresenceConnectionPhase.connected,
      );
      await viewModel.dispose();
    },
  );
}

LiveMapViewModel _createViewModel({
  required FakeClock clock,
  required String edgesJson,
  required String mapJson,
  required FakePeriodicScheduler scheduler,
}) {
  final mapRepository = FakeMapAssetRepository()
    ..enqueueTiledMapJson(
      assetPath: 'assets/maps/demo_1.tmj.json',
      json: mapJson,
    )
    ..enqueueRouteGraphEdgesJson(
      assetPath: 'assets/maps/demo_1.edges.json',
      json: edgesJson,
    );
  return LiveMapViewModel(
    buildingId: 'main-campus',
    buildingName: mainCampusBuildingName,
    floors: mainCampusFloors,
    mapAssetRepository: mapRepository,
    presenceRepository: MockPresenceRepository(
      clock: clock,
      scheduler: scheduler,
    ),
  );
}

final class _SilentPresenceRepository implements PresenceRepository {
  @override
  PresenceConnectionState connectionState =
      const PresenceConnectionState.disconnected();

  @override
  Stream<PresenceConnectionState> get connectionStates =>
      const Stream<PresenceConnectionState>.empty();

  @override
  bool get isSimulated => false;

  @override
  Stream<PresenceSnapshot> get snapshots =>
      const Stream<PresenceSnapshot>.empty();

  @override
  Future<void> connect() async {}

  @override
  Future<void> disconnect() async {}

  @override
  Future<void> dispose() async {}

  @override
  Future<void> leave() async {}

  @override
  Future<void> publishLocation(LocalPresencePosition position) async {}

  @override
  Future<void> selectFloor({
    required String buildingId,
    required String floorId,
  }) async {}

  @override
  Future<void> start({
    required String buildingId,
    required String floorId,
  }) async {}

  @override
  Future<void> stop() async {}
}
