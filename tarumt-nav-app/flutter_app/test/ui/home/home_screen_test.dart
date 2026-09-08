import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/home_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/ui/home/home_screen.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

void main() {
  testWidgets(
    'renders the complete reference Home content and forwards actions',
    (tester) async {
      var navigateCount = 0;
      var searchCount = 0;
      var savedCount = 0;
      var settingsCount = 0;
      String? navigatedRoomId;
      await _pumpHome(
        tester,
        onOpenNavigate: () => navigateCount += 1,
        onSearchDestination: () => searchCount += 1,
        onOpenSaved: () => savedCount += 1,
        onOpenSettings: () => settingsCount += 1,
        onNavigateToRoom: (room) => navigatedRoomId = room.id,
        savedRooms: _rooms(
          'library-l305',
          'computer-lab-c301',
          'gym-g201',
          'cafeteria-cf101',
        ),
        size: const Size(390, 844),
      );

      expect(find.text('Campus Navigator'), findsOneWidget);
      expect(find.text('Find your way indoors'), findsOneWidget);
      expect(find.byKey(HomeScreenKeys.mapPreview), findsOneWidget);
      expect(find.text('Quick Access'), findsOneWidget);
      for (final target in <HomeQuickAccessTarget>[
        HomeQuickAccessTarget.selectFloor,
        HomeQuickAccessTarget.selectRoom,
      ]) {
        expect(find.byKey(HomeScreenKeys.quickAccess(target)), findsOneWidget);
      }
      expect(
        find.byKey(
          HomeScreenKeys.quickAccess(HomeQuickAccessTarget.recentPlaces),
        ),
        findsNothing,
      );
      expect(
        find.byKey(HomeScreenKeys.quickAccess(HomeQuickAccessTarget.settings)),
        findsNothing,
      );

      await tester.tap(find.byKey(HomeScreenKeys.search));
      await tester.tap(
        find.byKey(
          HomeScreenKeys.quickAccess(HomeQuickAccessTarget.selectFloor),
        ),
      );
      await tester.pump();

      expect(navigateCount, 1);
      expect(searchCount, 1);
      expect(savedCount, 0);
      expect(settingsCount, 0);

      for (var index = 0; index < 4; index += 1) {
        await tester.drag(find.byType(CustomScrollView), const Offset(0, -300));
        await tester.pump();
      }
      await tester.pumpAndSettle();
      expect(find.text('My Collection'), findsOneWidget);
      expect(find.text('Library'), findsOneWidget);
      expect(find.text('Computer Lab'), findsOneWidget);
      expect(find.text('Gym'), findsOneWidget);
      expect(find.text('Cafeteria'), findsNothing);
      expect(find.text('Third Floor · L305'), findsOneWidget);

      await tester.tap(find.byKey(HomeScreenKeys.collectionPlace('gym-g201')));
      expect(navigatedRoomId, 'gym-g201');
      await tester.tap(find.widgetWithText(TextButton, 'See all'));
      expect(savedCount, 1);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('remains bounded and scrollable at 320px', (tester) async {
    await _pumpHome(
      tester,
      onOpenNavigate: () {},
      onOpenSaved: () {},
      onOpenSettings: () {},
      savedRooms: _rooms('library-l305', 'computer-lab-c301', 'gym-g201'),
      size: const Size(320, 568),
    );

    expect(tester.takeException(), isNull);
    await tester.drag(find.byType(CustomScrollView), const Offset(0, -1000));
    await tester.pumpAndSettle();

    expect(
      find.byKey(HomeScreenKeys.collectionPlace('gym-g201')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('shows a collection prompt when no rooms are saved', (
    tester,
  ) async {
    var browseCount = 0;
    await _pumpHome(
      tester,
      onOpenNavigate: () => browseCount += 1,
      onOpenSaved: () {},
      onOpenSettings: () {},
      size: const Size(390, 844),
    );

    for (var index = 0; index < 4; index += 1) {
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -300));
      await tester.pump();
    }
    expect(find.text('No collected places yet'), findsOneWidget);
    await tester.tap(find.byTooltip('Browse rooms'));
    expect(browseCount, 1);
  });
}

Future<void> _pumpHome(
  WidgetTester tester, {
  required VoidCallback onOpenNavigate,
  VoidCallback? onSearchDestination,
  required VoidCallback onOpenSaved,
  required VoidCallback onOpenSettings,
  ValueChanged<CampusRoom>? onNavigateToRoom,
  List<CampusRoom> savedRooms = const [],
  required Size size,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    MaterialApp(
      theme: createIndoorNavigationTheme(),
      home: Scaffold(
        body: HomeScreen(
          floors: mainCampusFloors,
          onOpenNavigate: onOpenNavigate,
          onSearchDestination: onSearchDestination ?? onOpenNavigate,
          onOpenSaved: onOpenSaved,
          onOpenSettings: onOpenSettings,
          onNavigateToRoom: onNavigateToRoom ?? (_) {},
          savedRooms: savedRooms,
          viewModel: const HomeViewModel(),
        ),
      ),
    ),
  );
  await tester.pump();
}

List<CampusRoom> _rooms(
  String firstId, [
  String? secondId,
  String? thirdId,
  String? fourthId,
]) {
  final ids = <String>[firstId, ?secondId, ?thirdId, ?fourthId];
  return ids
      .map((id) => mainCampusRooms.firstWhere((room) => room.id == id))
      .toList();
}
