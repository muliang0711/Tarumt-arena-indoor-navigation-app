import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/navigation_ui_state.dart';
import 'package:indoor_navigation/domain/navigation/navigation_models.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/ui/navigation/navigation.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

void main() {
  testWidgets(
    'NavigationStatsPanel preserves labels, values, and narrow layout',
    (tester) async {
      await _pumpAtSize(
        tester,
        const Size(320, 640),
        NavigationStatsPanel(navigation: _navigation(NavigationTurn.right)),
      );

      expect(find.text('SEGMENT'), findsOneWidget);
      expect(find.text('PROGRESS'), findsOneWidget);
      expect(find.text('REMAINING'), findsOneWidget);
      expect(find.text('STATUS'), findsOneWidget);
      expect(find.text('node-21 -> node-20'), findsOneWidget);
      expect(find.text('43%'), findsOneWidget);
      expect(find.text('124px'), findsOneWidget);
      expect(find.text('moving'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('InstructionBar uses exact glyphs and labels', (tester) async {
    final expectations = <NavigationTurn, (String, String)>{
      NavigationTurn.left: ('<', 'Turn left'),
      NavigationTurn.right: ('>', 'Turn right'),
      NavigationTurn.arrived: ('OK', 'Arrived'),
      NavigationTurn.straight: ('^', 'Continue straight'),
    };

    for (final entry in expectations.entries) {
      await _pumpAtSize(
        tester,
        const Size(320, 640),
        Stack(
          fit: StackFit.expand,
          children: [InstructionBar(navigation: _navigation(entry.key))],
        ),
      );
      expect(find.text(entry.value.$1), findsOneWidget);
      expect(find.text(entry.value.$2), findsOneWidget);
      expect(find.text('node-21 -> node-20'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('WrongWayWarningBanner hides, checks, and warns exactly', (
    tester,
  ) async {
    await _pumpBanner(tester, _wrongWay());
    expect(find.byKey(WrongWayWarningBanner.bannerKey), findsNothing);

    await _pumpBanner(
      tester,
      _wrongWay(
        headingOpposite: true,
        durationMs: 700,
        reason: WrongWayRerouteReason.insufficientOppositeDuration,
      ),
    );
    expect(find.text('Checking direction'), findsOneWidget);
    expect(
      find.text('insufficient-opposite-duration | opposite 700ms'),
      findsOneWidget,
    );

    await _pumpBanner(
      tester,
      _wrongWay(
        currentNode: const CurrentRouteNode(nodeId: 'node-7', type: 'junction'),
        durationMs: 2200,
        headingOpposite: true,
        reason: WrongWayRerouteReason.junctionOppositeHeading,
        suggest: true,
      ),
    );
    expect(find.text('Wrong way detected'), findsOneWidget);
    expect(
      find.text('junction-opposite-heading at node-7 for 2200ms'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}

NavigationUiState _navigation(NavigationTurn instruction) {
  return NavigationUiState(
    currentSegment: 'node-21 -> node-20',
    distanceRemainingPixels: 123.6,
    instruction: instruction,
    progressPercent: 42.6,
    status: SimulationStatus.moving,
  );
}

WrongWayRerouteResult _wrongWay({
  CurrentRouteNode? currentNode,
  int durationMs = 0,
  bool headingOpposite = false,
  WrongWayRerouteReason reason = WrongWayRerouteReason.headingNotOpposite,
  bool suggest = false,
}) {
  return WrongWayRerouteResult(
    candidateNode: null,
    currentNode: currentNode,
    isConfidenceOffRoute: false,
    isAtJunction: currentNode != null,
    isHeadingOpposite: headingOpposite,
    isLegalGraphMovement: false,
    oppositeHeadingDurationMs: durationMs,
    reason: reason,
    shouldSuggestReroute: suggest,
    state: const WrongWayRerouteState(oppositeHeadingStartedAtMs: null),
  );
}

Future<void> _pumpBanner(WidgetTester tester, WrongWayRerouteResult result) {
  return _pumpAtSize(
    tester,
    const Size(320, 640),
    Stack(
      fit: StackFit.expand,
      children: [WrongWayWarningBanner(result: result)],
    ),
  );
}

Future<void> _pumpAtSize(WidgetTester tester, Size size, Widget child) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    MaterialApp(
      theme: createIndoorNavigationTheme(),
      home: Scaffold(body: child),
    ),
  );
}
