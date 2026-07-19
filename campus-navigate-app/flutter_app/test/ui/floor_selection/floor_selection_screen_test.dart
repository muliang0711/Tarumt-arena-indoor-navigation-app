import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/floor_selection_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/ui/floor_selection/floor_selection_screen.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

void main() {
  testWidgets('renders the four-floor reference UI and forwards selection', (
    tester,
  ) async {
    final viewModel = FloorSelectionViewModel();
    CampusFloor? selectedFloor;
    var backCount = 0;
    await _pumpFloorSelection(
      tester,
      onBack: () => backCount += 1,
      onFloorSelected: (floor) => selectedFloor = floor,
      size: const Size(390, 844),
      viewModel: viewModel,
    );

    expect(find.text('Select Floor'), findsOneWidget);
    expect(find.text('Main Campus Building'), findsOneWidget);
    expect(find.text('Suggested'), findsOneWidget);
    final selectedMaterial = tester.widget<Material>(
      find
          .descendant(
            of: find.byKey(FloorSelectionScreenKeys.floor('floor-3')),
            matching: find.byType(Material),
          )
          .first,
    );
    final selectedShape = selectedMaterial.shape! as RoundedRectangleBorder;
    expect(selectedShape.side.color, CampusNavigatorColors.accentBright);

    for (var floorNumber = 1; floorNumber <= 4; floorNumber++) {
      final floor = find.byKey(
        FloorSelectionScreenKeys.floor('floor-$floorNumber'),
      );
      await tester.scrollUntilVisible(
        floor,
        180,
        scrollable: find.byType(Scrollable).first,
      );
      expect(floor, findsOneWidget);
    }

    await tester.drag(find.byType(CustomScrollView), const Offset(0, 1200));
    await tester.pumpAndSettle();
    final firstFloor = find.byKey(FloorSelectionScreenKeys.floor('floor-1'));
    await tester.tap(firstFloor);
    await tester.pump();

    expect(viewModel.state.selectedFloor.id, 'floor-1');
    expect(selectedFloor?.id, 'floor-1');

    await tester.ensureVisible(find.byKey(FloorSelectionScreenKeys.back));
    await tester.tap(find.byKey(FloorSelectionScreenKeys.back));
    expect(backCount, 1);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    await viewModel.dispose();
  });

  testWidgets('stays bounded and scrollable at 320px', (tester) async {
    final viewModel = FloorSelectionViewModel();
    await _pumpFloorSelection(
      tester,
      onBack: () {},
      size: const Size(320, 568),
      viewModel: viewModel,
    );

    expect(tester.takeException(), isNull);
    await tester.drag(find.byType(CustomScrollView), const Offset(0, -900));
    await tester.pumpAndSettle();

    expect(
      find.byKey(FloorSelectionScreenKeys.floor('floor-4')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    await viewModel.dispose();
  });
}

Future<void> _pumpFloorSelection(
  WidgetTester tester, {
  required VoidCallback onBack,
  ValueChanged<CampusFloor>? onFloorSelected,
  required Size size,
  required FloorSelectionViewModel viewModel,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    MaterialApp(
      theme: createIndoorNavigationTheme(),
      home: Scaffold(
        body: FloorSelectionScreen(
          onBack: onBack,
          onFloorSelected: onFloorSelected,
          viewModel: viewModel,
        ),
      ),
    ),
  );
  await tester.pump();
}
