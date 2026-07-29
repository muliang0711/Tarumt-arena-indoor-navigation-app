import 'dart:async';

import 'package:indoor_navigation/domain/campus/campus_catalog.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';

final class FloorSelectionViewState {
  const FloorSelectionViewState({
    required this.buildingName,
    required this.floors,
    required this.selectedFloorId,
  });

  final String buildingName;
  final List<CampusFloor> floors;
  final String selectedFloorId;

  CampusFloor get selectedFloor =>
      floors.firstWhere((floor) => floor.id == selectedFloorId);
}

const defaultFloorSelectionViewState = FloorSelectionViewState(
  buildingName: mainCampusBuildingName,
  floors: mainCampusFloors,
  selectedFloorId: mainCampusDefaultFloorId,
);

final class FloorSelectionViewModel {
  FloorSelectionViewModel({
    FloorSelectionViewState initialState = defaultFloorSelectionViewState,
  }) : _state = initialState;

  final StreamController<FloorSelectionViewState> _states =
      StreamController<FloorSelectionViewState>.broadcast(sync: true);
  FloorSelectionViewState _state;
  bool _disposed = false;

  FloorSelectionViewState get state => _state;
  Stream<FloorSelectionViewState> get states => _states.stream;

  void selectFloor(String floorId) {
    _throwIfDisposed();
    if (!_state.floors.any((floor) => floor.id == floorId)) {
      throw StateError('Unknown campus floor: $floorId');
    }
    if (_state.selectedFloorId == floorId) {
      return;
    }
    _state = FloorSelectionViewState(
      buildingName: _state.buildingName,
      floors: _state.floors,
      selectedFloorId: floorId,
    );
    _states.add(_state);
  }

  Future<void> dispose() async {
    if (_disposed) {
      return;
    }
    _disposed = true;
    await _states.close();
  }

  void _throwIfDisposed() {
    if (_disposed) {
      throw StateError('FloorSelectionViewModel is disposed.');
    }
  }
}
