import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/ui/floor_rooms/floor_rooms_screen.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

void main() {
  testWidgets('renders Floor 3, filters, searches, and forwards navigation', (
    tester,
  ) async {
    final viewModel = FloorRoomsViewModel();
    CampusRoom? navigationTarget;
    var backCount = 0;
    await _pumpFloorRooms(
      tester,
      onBack: () => backCount += 1,
      onNavigate: (room) => navigationTarget = room,
      size: const Size(390, 844),
      viewModel: viewModel,
    );

    expect(find.text('Floor 3'), findsOneWidget);
    expect(find.text('Floor 3 Overview'), findsOneWidget);
    expect(find.text('Computer Lab'), findsOneWidget);

    await tester.tap(
      find.byKey(FloorRoomsScreenKeys.filter(FloorRoomFilter.lab)),
    );
    await tester.pump();
    expect(viewModel.state.visibleRooms, hasLength(2));
    expect(find.byKey(FloorRoomsScreenKeys.room('library-l305')), findsNothing);

    await tester.tap(
      find.byKey(FloorRoomsScreenKeys.filter(FloorRoomFilter.all)),
    );
    await tester.enterText(find.byKey(FloorRoomsScreenKeys.search), 'Library');
    await tester.pump();
    expect(viewModel.state.visibleRooms.single.name, 'Library');
    expect(
      find.byKey(FloorRoomsScreenKeys.room('library-l305')),
      findsOneWidget,
    );

    await tester.ensureVisible(
      find.byKey(FloorRoomsScreenKeys.save('library-l305')),
    );
    await tester.tap(find.byKey(FloorRoomsScreenKeys.save('library-l305')));
    await tester.pump();
    expect(viewModel.state.isRoomSaved('library-l305'), isTrue);
    expect(
      find.descendant(
        of: find.byKey(FloorRoomsScreenKeys.save('library-l305')),
        matching: find.byIcon(Icons.bookmark),
      ),
      findsOneWidget,
    );

    await tester.ensureVisible(
      find.byKey(FloorRoomsScreenKeys.navigate('library-l305')),
    );
    await tester.tap(find.byKey(FloorRoomsScreenKeys.navigate('library-l305')));
    await tester.pump();
    expect(navigationTarget?.id, 'library-l305');
    expect(viewModel.state.selectedRoom?.id, 'library-l305');

    await tester.drag(find.byType(CustomScrollView), const Offset(0, 1000));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(FloorRoomsScreenKeys.back));
    expect(backCount, 1);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    await viewModel.dispose();
  });

  testWidgets('shows an empty result and stays bounded at 320px', (
    tester,
  ) async {
    final viewModel = FloorRoomsViewModel();
    await _pumpFloorRooms(
      tester,
      onBack: () {},
      onNavigate: (_) {},
      size: const Size(320, 568),
      viewModel: viewModel,
    );

    expect(tester.takeException(), isNull);
    await tester.enterText(
      find.byKey(FloorRoomsScreenKeys.search),
      'not-a-room',
    );
    await tester.pump();
    expect(find.text('No rooms match this search'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    await viewModel.dispose();
  });

  testWidgets('explains and disables an unreachable destination', (
    tester,
  ) async {
    const issue = 'This destination is not connected to the route graph.';
    final viewModel = FloorRoomsViewModel(
      initialState: FloorRoomsViewState(
        buildingName: 'Main Campus Building',
        filter: FloorRoomFilter.all,
        floors: defaultFloorRoomsViewState.floors,
        navigationStartNodeId: 'node-21',
        query: '',
        rooms: const [
          CampusRoom(
            category: CampusRoomCategory.restroom,
            floorId: 'floor-3',
            id: 'toilet-1',
            name: 'Restroom 1',
            navigationAvailable: false,
            navigationIssue: issue,
            navigationNodeId: 'node-22',
            roomCode: 'Toilet 1',
            typeLabel: 'Restroom',
            visual: CampusRoomVisual.restroom,
            walkMinutes: 1,
          ),
        ],
        savedRoomIds: const [],
        selectedFloorId: 'floor-3',
        selectedRoomId: null,
      ),
    );
    await _pumpFloorRooms(
      tester,
      onBack: () {},
      onNavigate: (_) => fail('Unavailable room must not navigate.'),
      size: const Size(390, 844),
      viewModel: viewModel,
    );

    expect(find.text(issue), findsOneWidget);
    expect(find.text('Unavailable'), findsOneWidget);
    final button = tester.widget<FilledButton>(
      find.byKey(FloorRoomsScreenKeys.navigate('toilet-1')),
    );
    expect(button.onPressed, isNull);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    await viewModel.dispose();
  });
}

Future<void> _pumpFloorRooms(
  WidgetTester tester, {
  required VoidCallback onBack,
  required ValueChanged<CampusRoom> onNavigate,
  required Size size,
  required FloorRoomsViewModel viewModel,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    MaterialApp(
      theme: createIndoorNavigationTheme(),
      home: Scaffold(
        body: FloorRoomsScreen(
          onBack: onBack,
          onNavigate: onNavigate,
          viewModel: viewModel,
        ),
      ),
    ),
  );
  await tester.pump();
}
