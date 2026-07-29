import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/common/javascript_number.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

final class DerivedEstimatePanel extends StatelessWidget {
  const DerivedEstimatePanel({
    required this.buffer,
    required this.lastResult,
    required this.onReplayStep,
    required this.onReset,
    required this.onStartRawMotion,
    required this.onStopRawMotion,
    required this.rawMotionStats,
    required this.rawMotionStatus,
    required this.routeTotalMeters,
    required this.snapDriftPixels,
    required this.stepLengthMeters,
    required this.stepLengthPixels,
    required this.wrongWayReroute,
    super.key,
  });

  static const panelKey = ValueKey<String>('derived-estimate.panel');
  static const statusPillKey = ValueKey<String>('derived-estimate.status-pill');
  static const pdrStatusKey = ValueKey<String>('derived-estimate.pdr');
  static const sensorStatusKey = ValueKey<String>('derived-estimate.sensor');
  static const wrongWayStatusKey = ValueKey<String>(
    'derived-estimate.wrong-way',
  );
  static const routeStatusKey = ValueKey<String>('derived-estimate.route');
  static const startButtonKey = ValueKey<String>('derived-estimate.start');
  static const stopButtonKey = ValueKey<String>('derived-estimate.stop');
  static const replayButtonKey = ValueKey<String>('derived-estimate.replay');
  static const resetButtonKey = ValueKey<String>('derived-estimate.reset');

  final DerivedEstimateBuffer buffer;
  final DerivedEstimateIngestResult? lastResult;
  final VoidCallback onReplayStep;
  final VoidCallback onReset;
  final VoidCallback onStartRawMotion;
  final VoidCallback onStopRawMotion;
  final RawMotionBatchStats rawMotionStats;
  final RawMotionConsumerStatus rawMotionStatus;
  final double routeTotalMeters;
  final double? snapDriftPixels;
  final double stepLengthMeters;
  final double stepLengthPixels;
  final WrongWayRerouteResult wrongWayReroute;

  String get estimateStatus {
    final result = lastResult;
    if (result == null) {
      return 'idle';
    }
    return '${result.reason.wireValue} | accepted '
        '${buffer.acceptedEstimates.length} | dropped '
        '${buffer.droppedEstimateCount}';
  }

  String get sensorStatus {
    final heading = rawMotionStats.lastHeadingDegrees;
    return '${rawMotionStatus.wireValue} | raw '
        '${rawMotionStats.rawSamplesInMemory} | batches '
        '${rawMotionStats.totalBatches} | head '
        '${heading == null ? '-' : javascriptRound(heading).toInt()}';
  }

  String get wrongWayStatus {
    return '${wrongWayReroute.shouldSuggestReroute ? 'suggest' : 'hold'} | '
        '${wrongWayReroute.reason.wireValue} | '
        '${wrongWayReroute.currentNode?.nodeId ?? '-'} | '
        '${wrongWayReroute.oppositeHeadingDurationMs}ms';
  }

  String get routeStatus {
    final drift = snapDriftPixels;
    return '${_formatNumber(routeTotalMeters)}m route | '
        '${_formatNumber(stepLengthMeters)}m step -> '
        '${javascriptRound(stepLengthPixels).toInt()}px | drift '
        '${drift == null ? '-' : javascriptRound(drift).toInt()}px';
  }

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      key: panelKey,
      decoration: const BoxDecoration(
        color: IndoorNavigationColors.panel,
        border: Border(
          bottom: BorderSide(color: IndoorNavigationColors.border, width: 0.5),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'ESTIMATE',
                  style: TextStyle(
                    color: Color(0xFF64748B),
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Container(
                  key: statusPillKey,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8EEF6),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    rawMotionStatus.wireValue,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: IndoorNavigationColors.slateSoft,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 7),
            LayoutBuilder(
              builder: (context, constraints) {
                final useSingleColumn = constraints.maxWidth < 260;
                final cellWidth = useSingleColumn
                    ? constraints.maxWidth
                    : (constraints.maxWidth - 6) / 2;
                return Wrap(
                  runSpacing: 6,
                  spacing: 6,
                  children: [
                    SizedBox(
                      width: cellWidth,
                      child: _DetailCell(
                        label: 'PDR',
                        value: estimateStatus,
                        valueKey: pdrStatusKey,
                      ),
                    ),
                    SizedBox(
                      width: cellWidth,
                      child: _DetailCell(
                        label: 'Sensor',
                        value: sensorStatus,
                        valueKey: sensorStatusKey,
                      ),
                    ),
                    SizedBox(
                      width: cellWidth,
                      child: _DetailCell(
                        emphasized: wrongWayReroute.shouldSuggestReroute,
                        label: 'Wrong Way',
                        value: wrongWayStatus,
                        valueKey: wrongWayStatusKey,
                      ),
                    ),
                    SizedBox(
                      width: cellWidth,
                      child: _DetailCell(
                        label: 'Route',
                        value: routeStatus,
                        valueKey: routeStatusKey,
                      ),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _PanelButton(
                    accessibilityLabel: 'Start raw motion PDR',
                    backgroundColor: const Color(0xFF166534),
                    key: startButtonKey,
                    label: 'Start',
                    onPressed: onStartRawMotion,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _PanelButton(
                    accessibilityLabel: 'Stop raw motion PDR',
                    backgroundColor: IndoorNavigationColors.slateSoft,
                    key: stopButtonKey,
                    label: 'Stop',
                    onPressed: onStopRawMotion,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _PanelButton(
                    accessibilityLabel: 'Replay derived estimate',
                    backgroundColor: const Color(0xFF7F1D1D),
                    key: replayButtonKey,
                    label: 'Replay',
                    onPressed: onReplayStep,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _PanelButton(
                    accessibilityLabel: 'Reset derived estimate marker',
                    backgroundColor: const Color(0xFF7F1D1D),
                    key: resetButtonKey,
                    label: 'Reset',
                    onPressed: onReset,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

final class _DetailCell extends StatelessWidget {
  const _DetailCell({
    required this.label,
    required this.value,
    required this.valueKey,
    this.emphasized = false,
  });

  final bool emphasized;
  final String label;
  final String value;
  final Key valueKey;

  @override
  Widget build(BuildContext context) {
    final color = emphasized
        ? const Color(0xFF7F1D1D)
        : IndoorNavigationColors.slate;
    return Container(
      constraints: const BoxConstraints(minHeight: 46),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: emphasized ? const Color(0xFFFEE2E2) : const Color(0xFFF8FAFC),
        border: Border.all(
          color: emphasized ? const Color(0xFFEF4444) : const Color(0xFFE2E8F0),
          width: 0.5,
        ),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: emphasized ? color : const Color(0xFF64748B),
              fontSize: 9,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            key: valueKey,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              height: 14 / 11,
            ),
          ),
        ],
      ),
    );
  }
}

final class _PanelButton extends StatelessWidget {
  const _PanelButton({
    required this.accessibilityLabel,
    required this.backgroundColor,
    required this.label,
    required this.onPressed,
    super.key,
  });

  final String accessibilityLabel;
  final Color backgroundColor;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      excludeSemantics: true,
      label: accessibilityLabel,
      child: Material(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(6),
        child: InkWell(
          borderRadius: BorderRadius.circular(6),
          onTap: onPressed,
          overlayColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.pressed)
                ? const Color(0xFF991B1B)
                : null;
          }),
          child: SizedBox(
            height: 32,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Center(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _formatNumber(double value) {
  if (value.isFinite && value == value.truncateToDouble()) {
    return value.toInt().toString();
  }
  return value.toString();
}
