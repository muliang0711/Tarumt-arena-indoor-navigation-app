import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';
import 'package:indoor_navigation/ui/navigation_input/navigation_input.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

void main() {
  testWidgets('shows exact App.tsx statuses and route details at 320px', (
    tester,
  ) async {
    await _pumpPanel(tester);

    expect(find.text('ESTIMATE'), findsOneWidget);
    expect(find.text('running'), findsOneWidget);
    expect(find.text('accepted | accepted 2 | dropped 3'), findsOneWidget);
    expect(find.text('running | raw 5 | batches 7 | head 46'), findsOneWidget);
    expect(
      find.text('suggest | opposite-heading | node-9 | 2100ms'),
      findsOneWidget,
    );
    expect(
      find.text('46m route | 0.5m step -> 28px | drift 4px'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('forwards all actions and exposes exact accessibility labels', (
    tester,
  ) async {
    final calls = <String>[];
    await _pumpPanel(
      tester,
      onReplayStep: () => calls.add('replay'),
      onReset: () => calls.add('reset'),
      onStartRawMotion: () => calls.add('start'),
      onStopRawMotion: () => calls.add('stop'),
    );

    expect(find.bySemanticsLabel('Start raw motion PDR'), findsOneWidget);
    expect(find.bySemanticsLabel('Stop raw motion PDR'), findsOneWidget);
    expect(find.bySemanticsLabel('Replay derived estimate'), findsOneWidget);
    expect(
      find.bySemanticsLabel('Reset derived estimate marker'),
      findsOneWidget,
    );

    await tester.tap(find.byKey(DerivedEstimatePanel.startButtonKey));
    await tester.tap(find.byKey(DerivedEstimatePanel.stopButtonKey));
    await tester.tap(find.byKey(DerivedEstimatePanel.replayButtonKey));
    await tester.tap(find.byKey(DerivedEstimatePanel.resetButtonKey));
    expect(calls, ['start', 'stop', 'replay', 'reset']);
  });

  testWidgets(
    'shows idle, missing heading, route node, and drift placeholders',
    (tester) async {
      await _pumpPanel(
        tester,
        idle: true,
        rawMotionStats: const RawMotionBatchStats(
          lastAcceptedSampleCount: 0,
          lastDroppedSampleCount: 0,
          lastHeadingDegrees: null,
          lastLatencyMs: 0,
          rawSamplesInMemory: 0,
          totalBatches: 0,
          totalRawSamplesSeen: 0,
        ),
        snapDriftPixels: null,
        wrongWayReroute: _wrongWay(suggest: false, currentNode: null),
      );

      expect(find.text('idle'), findsOneWidget);
      expect(find.text('running | raw 0 | batches 0 | head -'), findsOneWidget);
      expect(find.text('hold | opposite-heading | - | 2100ms'), findsOneWidget);
      expect(
        find.text('46m route | 0.5m step -> 28px | drift -px'),
        findsOneWidget,
      );
    },
  );
}

Future<void> _pumpPanel(
  WidgetTester tester, {
  bool idle = false,
  DerivedEstimateIngestResult? lastResult,
  VoidCallback? onReplayStep,
  VoidCallback? onReset,
  VoidCallback? onStartRawMotion,
  VoidCallback? onStopRawMotion,
  RawMotionBatchStats rawMotionStats = _stats,
  double? snapDriftPixels = 4.4,
  WrongWayRerouteResult? wrongWayReroute,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(320, 640);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    MaterialApp(
      theme: createIndoorNavigationTheme(),
      home: Scaffold(
        body: SingleChildScrollView(
          child: DerivedEstimatePanel(
            buffer: _buffer,
            lastResult: idle ? null : lastResult ?? _defaultResult,
            onReplayStep: onReplayStep ?? () {},
            onReset: onReset ?? () {},
            onStartRawMotion: onStartRawMotion ?? () {},
            onStopRawMotion: onStopRawMotion ?? () {},
            rawMotionStats: rawMotionStats,
            rawMotionStatus: RawMotionConsumerStatus.running,
            routeTotalMeters: 46,
            snapDriftPixels: snapDriftPixels,
            stepLengthMeters: 0.5,
            stepLengthPixels: 27.6,
            wrongWayReroute: wrongWayReroute ?? _wrongWay(),
          ),
        ),
      ),
    ),
  );
}

const _estimate1 = DerivedNavigationEstimate(
  confidence: 1,
  headingDegrees: 45,
  source: DerivedNavigationEstimateSource.debugReplay,
  timestampMs: 1000,
  x: 10,
  y: 20,
);
const _estimate2 = DerivedNavigationEstimate(
  confidence: 1,
  headingDegrees: 46,
  source: DerivedNavigationEstimateSource.debugReplay,
  timestampMs: 1100,
  x: 11,
  y: 21,
);
final _buffer = DerivedEstimateBuffer(
  acceptedEstimates: const [_estimate1, _estimate2],
  droppedEstimateCount: 3,
  maxSize: 6,
);
final _defaultResult = DerivedEstimateIngestResult(
  accepted: true,
  acceptedEstimate: _estimate2,
  buffer: _buffer,
  reason: DerivedEstimateIngestReason.accepted,
);
const _stats = RawMotionBatchStats(
  lastAcceptedSampleCount: 2,
  lastDroppedSampleCount: 1,
  lastHeadingDegrees: 45.5,
  lastLatencyMs: 12,
  rawSamplesInMemory: 5,
  totalBatches: 7,
  totalRawSamplesSeen: 20,
);

WrongWayRerouteResult _wrongWay({
  CurrentRouteNode? currentNode = const CurrentRouteNode(
    nodeId: 'node-9',
    type: 'junction',
  ),
  bool suggest = true,
}) {
  return WrongWayRerouteResult(
    candidateNode: null,
    currentNode: currentNode,
    isConfidenceOffRoute: false,
    isAtJunction: true,
    isHeadingOpposite: true,
    isLegalGraphMovement: false,
    oppositeHeadingDurationMs: 2100,
    reason: WrongWayRerouteReason.oppositeHeading,
    shouldSuggestReroute: suggest,
    state: const WrongWayRerouteState(oppositeHeadingStartedAtMs: 0),
  );
}
