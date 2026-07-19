import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/ui/saved_places/saved_places_screen.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

void main() {
  testWidgets('shows an empty state and forwards Browse at 320px', (
    tester,
  ) async {
    final viewModel = FloorRoomsViewModel();
    var browseCount = 0;
    await _pumpSavedPlaces(
      tester,
      onBrowseRooms: () => browseCount += 1,
      onNavigate: (_) {},
      size: const Size(320, 568),
      viewModel: viewModel,
    );

    expect(find.text('Saved Places'), findsOneWidget);
    expect(find.text('0 bookmarked destinations'), findsOneWidget);
    expect(find.byKey(SavedPlacesScreenKeys.empty), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.byKey(SavedPlacesScreenKeys.browseRooms));
    expect(browseCount, 1);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    await viewModel.dispose();
  });

  testWidgets('lists, navigates, and removes saved rooms', (tester) async {
    final viewModel = FloorRoomsViewModel();
    viewModel.toggleSavedRoom('computer-lab-c301');
    viewModel.toggleSavedRoom('library-l305');
    CampusRoom? navigationTarget;
    await _pumpSavedPlaces(
      tester,
      onBrowseRooms: () {},
      onNavigate: (room) => navigationTarget = room,
      size: const Size(320, 568),
      viewModel: viewModel,
    );

    expect(find.text('2 bookmarked destinations'), findsOneWidget);
    expect(
      find.byKey(SavedPlacesScreenKeys.room('computer-lab-c301')),
      findsOneWidget,
    );
    expect(find.text('Floor 3 · C301'), findsOneWidget);
    await tester.tap(
      find.byKey(SavedPlacesScreenKeys.navigate('computer-lab-c301')),
    );
    expect(navigationTarget?.id, 'computer-lab-c301');

    await tester.tap(
      find.byKey(SavedPlacesScreenKeys.remove('computer-lab-c301')),
    );
    await tester.pump();
    expect(viewModel.state.savedRoomIds, ['library-l305']);
    expect(
      find.byKey(SavedPlacesScreenKeys.room('computer-lab-c301')),
      findsNothing,
    );
    expect(find.text('1 bookmarked destination'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    await viewModel.dispose();
  });
}

Future<void> _pumpSavedPlaces(
  WidgetTester tester, {
  required VoidCallback onBrowseRooms,
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
        body: SavedPlacesScreen(
          onBrowseRooms: onBrowseRooms,
          onNavigate: onNavigate,
          viewModel: viewModel,
        ),
      ),
    ),
  );
  await tester.pump();
}
