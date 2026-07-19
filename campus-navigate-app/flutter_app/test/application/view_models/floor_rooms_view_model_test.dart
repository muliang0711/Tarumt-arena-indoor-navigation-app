import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';

void main() {
  test('filters and searches the selected floor room catalog', () async {
    final viewModel = FloorRoomsViewModel();

    expect(viewModel.state.selectedFloor.id, 'floor-3');
    expect(viewModel.state.visibleRooms.map((room) => room.name), [
      'Computer Lab',
      'Library',
      'Lecture Hall A',
      'Research Lab',
      'Restroom',
    ]);

    viewModel.selectFilter(FloorRoomFilter.lab);
    expect(viewModel.state.visibleRooms.map((room) => room.name), [
      'Computer Lab',
      'Research Lab',
    ]);

    viewModel.selectFilter(FloorRoomFilter.all);
    viewModel.setSearchQuery('l305');
    expect(viewModel.state.visibleRooms.single.name, 'Library');

    viewModel.setSearchQuery('classroom');
    expect(viewModel.state.visibleRooms.single.name, 'Lecture Hall A');

    await viewModel.dispose();
  });

  test(
    'selects a navigation target and resets state for a new floor',
    () async {
      final viewModel = FloorRoomsViewModel();
      final states = <FloorRoomsViewState>[];
      final subscription = viewModel.states.listen(states.add);

      viewModel.selectRoom('computer-lab-c301');
      expect(viewModel.state.selectedRoom?.roomCode, 'C301');
      expect(() => viewModel.selectRoom('cafeteria-cf101'), throwsStateError);
      viewModel.clearSelectedRoom();
      expect(viewModel.state.selectedRoom, isNull);
      viewModel.clearSelectedRoom();
      viewModel.selectRoom('computer-lab-c301');

      viewModel.selectFilter(FloorRoomFilter.lab);
      viewModel.setSearchQuery('computer');
      viewModel.selectFloor('floor-1');

      expect(viewModel.state.selectedFloor.id, 'floor-1');
      expect(viewModel.state.filter, FloorRoomFilter.all);
      expect(viewModel.state.query, isEmpty);
      expect(viewModel.state.selectedRoom, isNull);
      expect(viewModel.state.visibleRooms, hasLength(4));
      expect(() => viewModel.selectFloor('missing-floor'), throwsStateError);
      expect(states, isNotEmpty);

      await subscription.cancel();
      await viewModel.dispose();
      expect(() => viewModel.setSearchQuery('x'), throwsStateError);
    },
  );

  test('toggles validated saved rooms in user order', () async {
    final viewModel = FloorRoomsViewModel();
    final states = <FloorRoomsViewState>[];
    final subscription = viewModel.states.listen(states.add);

    viewModel.toggleSavedRoom('computer-lab-c301');
    viewModel.toggleSavedRoom('cafeteria-cf101');
    expect(viewModel.state.savedRoomIds, [
      'computer-lab-c301',
      'cafeteria-cf101',
    ]);
    expect(viewModel.state.savedRooms.map((room) => room.name), [
      'Computer Lab',
      'Cafeteria',
    ]);
    expect(viewModel.state.isRoomSaved('computer-lab-c301'), isTrue);

    viewModel.selectFloor('floor-1');
    expect(viewModel.state.savedRoomIds, hasLength(2));
    viewModel.toggleSavedRoom('computer-lab-c301');
    expect(viewModel.state.savedRoomIds, ['cafeteria-cf101']);
    expect(() => viewModel.toggleSavedRoom('missing-room'), throwsStateError);
    expect(states, hasLength(4));

    await subscription.cancel();
    await viewModel.dispose();
    expect(
      () => viewModel.toggleSavedRoom('cafeteria-cf101'),
      throwsStateError,
    );
  });
}
