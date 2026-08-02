import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog.dart';
import 'package:indoor_navigation/infrastructure/presence/mock_presence_repository.dart';
import 'package:indoor_navigation/ui/live_map/live_map_screen.dart';
import 'package:indoor_navigation/ui/live_map/widgets/floor_presence_selector.dart';
import 'package:indoor_navigation/ui/live_map/widgets/live_map_header.dart';
import 'package:indoor_navigation/ui/live_map/widgets/live_presence_map.dart';
import 'package:indoor_navigation/ui/map/indoor_map_viewport.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

import '../../support/fakes/fakes.dart';

void main() {
  testWidgets(
    'renders representative presence and an unavailable floor state',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 568);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final clock = FakeClock(initialNowMs: 1000);
      final mapRepository = FakeMapAssetRepository()
        ..enqueueTiledMapJson(
          assetPath: 'assets/maps/demo_1.tmj.json',
          json: File('assets/maps/demo_1.tmj.json').readAsStringSync(),
        )
        ..enqueueRouteGraphEdgesJson(
          assetPath: 'assets/maps/demo_1.edges.json',
          json: File('assets/maps/demo_1.edges.json').readAsStringSync(),
        );
      final viewModel = LiveMapViewModel(
        buildingId: 'main-campus',
        buildingName: mainCampusBuildingName,
        floors: mainCampusFloors,
        mapAssetRepository: mapRepository,
        presenceRepository: MockPresenceRepository(
          clock: clock,
          scheduler: FakePeriodicScheduler(clock: clock),
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: createIndoorNavigationTheme(),
          home: LiveMapScreen(displayName: 'IShowSpeed', viewModel: viewModel),
        ),
      );
      await tester.pump();
      await tester.pump();

      expect(find.byKey(LiveMapScreenKeys.screen), findsOneWidget);
      expect(find.byKey(LiveMapHeaderKeys.totalUsers), findsOneWidget);
      expect(find.textContaining('126 using the app'), findsOneWidget);
      expect(find.byKey(LiveMapHeaderKeys.simulated), findsOneWidget);
      expect(find.byKey(LivePresenceMapKeys.map), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('zoom-controls.in')),
        findsNothing,
      );
      expect(
        find.byKey(const ValueKey<String>('zoom-controls.out')),
        findsNothing,
      );
      final pinchSurface = find.byKey(IndoorMapViewportKeys.pinchSurface);
      final pinchCenter = tester.getCenter(pinchSurface);
      final firstFinger = await tester.createGesture(pointer: 11);
      final secondFinger = await tester.createGesture(pointer: 12);
      await firstFinger.down(pinchCenter - const Offset(30, 0));
      await secondFinger.down(pinchCenter + const Offset(30, 0));
      await tester.pump();
      await firstFinger.moveTo(pinchCenter - const Offset(60, 0));
      await secondFinger.moveTo(pinchCenter + const Offset(60, 0));
      await tester.pump();
      expect(viewModel.state.zoom, closeTo(2, 0.001));
      await firstFinger.up();
      await secondFinger.up();

      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget.key is ValueKey<String> &&
              (widget.key! as ValueKey<String>).value.startsWith(
                'live-map.actor.',
              ),
        ),
        findsNWidgets(10),
      );

      await tester.tap(find.byKey(FloorPresenceSelectorKeys.floor('floor-1')));
      await tester.pump();

      expect(find.text('F1 · 18 active'), findsOneWidget);
      expect(find.byKey(LivePresenceMapKeys.unavailable), findsOneWidget);
      expect(find.text('F1 floor map coming soon'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      await tester.runAsync(viewModel.dispose);
    },
  );
}
