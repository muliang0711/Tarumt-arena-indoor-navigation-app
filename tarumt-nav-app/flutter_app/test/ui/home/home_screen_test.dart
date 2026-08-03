import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/home_view_model.dart';
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
      await _pumpHome(
        tester,
        onOpenNavigate: () => navigateCount += 1,
        onSearchDestination: () => searchCount += 1,
        onOpenSaved: () => savedCount += 1,
        onOpenSettings: () => settingsCount += 1,
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
      expect(find.text('Popular Places'), findsOneWidget);
      expect(find.text('Library'), findsOneWidget);
      expect(find.text('Computer Lab'), findsOneWidget);
      expect(find.text('Gym'), findsOneWidget);
      expect(find.text('Cafeteria'), findsOneWidget);
      expect(find.text('Floor 3 · L305'), findsOneWidget);

      await tester.tap(
        find.byKey(HomeScreenKeys.popularPlace('cafeteria-cf101')),
      );
      expect(navigateCount, 2);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('remains bounded and scrollable at 320px', (tester) async {
    await _pumpHome(
      tester,
      onOpenNavigate: () {},
      onOpenSaved: () {},
      onOpenSettings: () {},
      size: const Size(320, 568),
    );

    expect(tester.takeException(), isNull);
    await tester.drag(find.byType(CustomScrollView), const Offset(0, -1000));
    await tester.pumpAndSettle();

    expect(
      find.byKey(HomeScreenKeys.popularPlace('cafeteria-cf101')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}

Future<void> _pumpHome(
  WidgetTester tester, {
  required VoidCallback onOpenNavigate,
  VoidCallback? onSearchDestination,
  required VoidCallback onOpenSaved,
  required VoidCallback onOpenSettings,
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
          onOpenNavigate: onOpenNavigate,
          onSearchDestination: onSearchDestination ?? onOpenNavigate,
          onOpenSaved: onOpenSaved,
          onOpenSettings: onOpenSettings,
          viewModel: const HomeViewModel(),
        ),
      ),
    ),
  );
  await tester.pump();
}
