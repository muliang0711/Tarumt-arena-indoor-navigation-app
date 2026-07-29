import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog.dart';
import 'package:indoor_navigation/ui/navigation/navigation_destination_card.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

void main() {
  testWidgets('shows selected destination and forwards Change at 320px', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 568);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    var changeCount = 0;
    final floor = mainCampusFloors.firstWhere(
      (candidate) => candidate.id == 'floor-3',
    );
    final room = mainCampusRooms.firstWhere(
      (candidate) => candidate.id == 'computer-lab-c301',
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: createIndoorNavigationTheme(),
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(12),
            child: Align(
              alignment: Alignment.topCenter,
              child: NavigationDestinationCard(
                floor: floor,
                onChangeDestination: () => changeCount += 1,
                room: room,
                routeDistanceMeters: 46,
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Computer Lab'), findsOneWidget);
    expect(find.text('Third Floor · C301'), findsOneWidget);
    expect(find.text('Preview · 46 m'), findsOneWidget);
    expect(
      find.bySemanticsLabel(
        RegExp('Navigating to Computer Lab, Third Floor, room C301'),
      ),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);

    await tester.tap(find.byKey(NavigationDestinationCardKeys.change));
    expect(changeCount, 1);
    semantics.dispose();
  });

  testWidgets('omits Change when no callback is supplied', (tester) async {
    final floor = mainCampusFloors.first;
    final room = mainCampusRooms.first;
    await tester.pumpWidget(
      MaterialApp(
        home: NavigationDestinationCard(
          floor: floor,
          room: room,
          routeDistanceMeters: 46.25,
        ),
      ),
    );

    expect(find.text('Preview · 46.3 m'), findsOneWidget);
    expect(find.byKey(NavigationDestinationCardKeys.change), findsNothing);
  });
}
