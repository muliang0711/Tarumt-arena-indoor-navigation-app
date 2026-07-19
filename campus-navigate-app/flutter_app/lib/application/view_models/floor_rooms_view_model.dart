import 'dart:async';

import 'package:indoor_navigation/domain/campus/campus_catalog.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog_models.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';

enum FloorRoomFilter { all, classroom, lab, facility, restroom }

final class FloorRoomsViewState {
  const FloorRoomsViewState({
    required this.buildingName,
    required this.filter,
    required this.floors,
    required this.navigationStartNodeId,
    required this.query,
    required this.rooms,
    required this.savedRoomIds,
    required this.selectedFloorId,
    required this.selectedRoomId,
  });

  final String buildingName;
  final FloorRoomFilter filter;
  final List<CampusFloor> floors;
  final String navigationStartNodeId;
  final String query;
  final List<CampusRoom> rooms;
  final List<String> savedRoomIds;
  final String selectedFloorId;
  final String? selectedRoomId;

  CampusFloor get selectedFloor =>
      floors.firstWhere((floor) => floor.id == selectedFloorId);

  CampusRoom? get selectedRoom {
    final roomId = selectedRoomId;
    if (roomId == null) {
      return null;
    }
    return rooms.firstWhere((room) => room.id == roomId);
  }

  List<CampusRoom> get savedRooms => savedRoomIds
      .map((roomId) => rooms.firstWhere((room) => room.id == roomId))
      .toList(growable: false);

  bool isRoomSaved(String roomId) => savedRoomIds.contains(roomId);

  List<CampusRoom> get visibleRooms {
    final normalizedQuery = query.trim().toLowerCase();
    return rooms
        .where((room) {
          if (room.floorId != selectedFloorId || !_matchesFilter(room)) {
            return false;
          }
          if (normalizedQuery.isEmpty) {
            return true;
          }
          return room.name.toLowerCase().contains(normalizedQuery) ||
              room.roomCode.toLowerCase().contains(normalizedQuery) ||
              room.typeLabel.toLowerCase().contains(normalizedQuery);
        })
        .toList(growable: false);
  }

  bool _matchesFilter(CampusRoom room) {
    return switch (filter) {
      FloorRoomFilter.all => true,
      FloorRoomFilter.classroom =>
        room.category == CampusRoomCategory.classroom,
      FloorRoomFilter.lab => room.category == CampusRoomCategory.lab,
      FloorRoomFilter.facility => room.category == CampusRoomCategory.facility,
      FloorRoomFilter.restroom => room.category == CampusRoomCategory.restroom,
    };
  }
}

FloorRoomsViewState createFloorRoomsViewState(CampusCatalog catalog) {
  return FloorRoomsViewState(
    buildingName: catalog.buildingName,
    filter: FloorRoomFilter.all,
    floors: catalog.floors,
    navigationStartNodeId: catalog.startNodeId,
    query: '',
    rooms: catalog.rooms,
    savedRoomIds: const [],
    selectedFloorId: catalog.defaultFloorId,
    selectedRoomId: null,
  );
}

const defaultFloorRoomsViewState = FloorRoomsViewState(
  buildingName: mainCampusBuildingName,
  filter: FloorRoomFilter.all,
  floors: mainCampusFloors,
  navigationStartNodeId: defaultNavigationStartNodeId,
  query: '',
  rooms: mainCampusRooms,
  savedRoomIds: [],
  selectedFloorId: mainCampusDefaultFloorId,
  selectedRoomId: null,
);

final class FloorRoomsViewModel {
  FloorRoomsViewModel({
    FloorRoomsViewState initialState = defaultFloorRoomsViewState,
  }) : _state = initialState;

  final StreamController<FloorRoomsViewState> _states =
      StreamController<FloorRoomsViewState>.broadcast(sync: true);
  FloorRoomsViewState _state;
  bool _disposed = false;

  FloorRoomsViewState get state => _state;
  Stream<FloorRoomsViewState> get states => _states.stream;

  void selectFilter(FloorRoomFilter filter) {
    _throwIfDisposed();
    if (_state.filter == filter) {
      return;
    }
    _emit(filter: filter);
  }

  void selectFloor(String floorId) {
    _throwIfDisposed();
    if (!_state.floors.any((floor) => floor.id == floorId)) {
      throw StateError('Unknown campus floor: $floorId');
    }
    if (_state.selectedFloorId == floorId &&
        _state.filter == FloorRoomFilter.all &&
        _state.query.isEmpty &&
        _state.selectedRoomId == null) {
      return;
    }
    _emit(
      filter: FloorRoomFilter.all,
      query: '',
      selectedFloorId: floorId,
      replaceSelectedRoom: true,
    );
  }

  void selectRoom(String roomId) {
    _throwIfDisposed();
    final room = _state.rooms
        .where((candidate) => candidate.id == roomId)
        .firstOrNull;
    if (room == null || room.floorId != _state.selectedFloorId) {
      throw StateError('Unknown room on selected floor: $roomId');
    }
    if (_state.selectedRoomId == roomId) {
      return;
    }
    _emit(selectedRoomId: roomId, replaceSelectedRoom: true);
  }

  void clearSelectedRoom() {
    _throwIfDisposed();
    if (_state.selectedRoomId == null) {
      return;
    }
    _emit(replaceSelectedRoom: true);
  }

  void setSearchQuery(String query) {
    _throwIfDisposed();
    if (_state.query == query) {
      return;
    }
    _emit(query: query);
  }

  void toggleSavedRoom(String roomId) {
    _throwIfDisposed();
    if (!_state.rooms.any((room) => room.id == roomId)) {
      throw StateError('Unknown campus room: $roomId');
    }
    final savedRoomIds = _state.savedRoomIds.contains(roomId)
        ? _state.savedRoomIds.where((savedId) => savedId != roomId).toList()
        : [..._state.savedRoomIds, roomId];
    _emit(savedRoomIds: List.unmodifiable(savedRoomIds));
  }

  Future<void> dispose() async {
    if (_disposed) {
      return;
    }
    _disposed = true;
    await _states.close();
  }

  void _emit({
    FloorRoomFilter? filter,
    String? query,
    List<String>? savedRoomIds,
    String? selectedFloorId,
    String? selectedRoomId,
    bool replaceSelectedRoom = false,
  }) {
    _state = FloorRoomsViewState(
      buildingName: _state.buildingName,
      filter: filter ?? _state.filter,
      floors: _state.floors,
      navigationStartNodeId: _state.navigationStartNodeId,
      query: query ?? _state.query,
      rooms: _state.rooms,
      savedRoomIds: savedRoomIds ?? _state.savedRoomIds,
      selectedFloorId: selectedFloorId ?? _state.selectedFloorId,
      selectedRoomId: replaceSelectedRoom
          ? selectedRoomId
          : _state.selectedRoomId,
    );
    _states.add(_state);
  }

  void _throwIfDisposed() {
    if (_disposed) {
      throw StateError('FloorRoomsViewModel is disposed.');
    }
  }
}
