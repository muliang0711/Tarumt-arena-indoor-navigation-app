import 'dart:async';

import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class WifiPositioningTestLabKeys {
  static const panel = ValueKey<String>('wifi-test-lab.panel');

  static ValueKey<String> node(String nodeId) =>
      ValueKey<String>('wifi-test-lab.node.$nodeId');
}

final class WifiPositioningTestLab extends StatelessWidget {
  const WifiPositioningTestLab({
    this.onSampleReady,
    required this.viewModel,
    super.key,
  });

  final VoidCallback? onSampleReady;
  final WifiPositioningTestLabViewModel viewModel;

  Future<void> _submitSample(String nodeId) async {
    await viewModel.submitRandomSample(nodeId);
    if (viewModel.state.phase == WifiPositioningTestLabPhase.success) {
      onSampleReady?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<WifiPositioningTestLabState>(
      initialData: viewModel.state,
      stream: viewModel.states,
      builder: (context, snapshot) {
        final state = snapshot.requireData;
        return Container(
          key: WifiPositioningTestLabKeys.panel,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: CampusNavigatorColors.card,
            border: Border.all(color: CampusNavigatorColors.border, width: 1.8),
            borderRadius: BorderRadius.circular(13),
            boxShadow: const [
              BoxShadow(
                color: CampusNavigatorColors.shadow,
                offset: Offset(4, 5),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Row(
                children: [
                  Icon(Icons.wifi_find, color: CampusNavigatorColors.accent),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Wi-Fi Positioning Test Lab',
                      style: TextStyle(
                        color: CampusNavigatorColors.text,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Tap a node to randomly select one recorded validation scan '
                'and send its complete AP list to the real KNN API.',
                style: TextStyle(
                  color: CampusNavigatorColors.textMuted,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final nodeId in viewModel.selectableNodeIds)
                    _NodeButton(
                      isSelected: state.expectedNodeId == nodeId,
                      nodeId: nodeId,
                      onPressed: state.isSending
                          ? null
                          : () => unawaited(_submitSample(nodeId)),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              _RequestResult(state: state),
              if (state.expectedNodeId != null) ...[
                const SizedBox(height: 10),
                Text(
                  onSampleReady == null
                      ? 'This sample is retained for the next map positioning '
                            'cycle.'
                      : 'This sample is retained for this navigation session. '
                            'The map starts a scan now and keeps its 5-second '
                            'cycle.',
                  style: const TextStyle(
                    color: CampusNavigatorColors.textMuted,
                    fontSize: 12,
                    height: 1.3,
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

final class _NodeButton extends StatelessWidget {
  const _NodeButton({
    required this.isSelected,
    required this.nodeId,
    required this.onPressed,
  });

  final bool isSelected;
  final String nodeId;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      key: WifiPositioningTestLabKeys.node(nodeId),
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        backgroundColor: isSelected
            ? CampusNavigatorColors.accent
            : CampusNavigatorColors.background,
        foregroundColor: isSelected ? Colors.white : CampusNavigatorColors.text,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        side: BorderSide(
          color: isSelected
              ? CampusNavigatorColors.accent
              : CampusNavigatorColors.border,
          width: 1.5,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
      ),
      child: Text(nodeId, style: const TextStyle(fontWeight: FontWeight.w800)),
    );
  }
}

final class _RequestResult extends StatelessWidget {
  const _RequestResult({required this.state});

  final WifiPositioningTestLabState state;

  @override
  Widget build(BuildContext context) {
    return switch (state.phase) {
      WifiPositioningTestLabPhase.idle => const _ResultBox(
        color: CampusNavigatorColors.background,
        icon: Icons.touch_app_outlined,
        text: 'Choose a node to run one recorded validation sample.',
      ),
      WifiPositioningTestLabPhase.sending => _ResultBox(
        color: const Color(0xFFF8EEE7),
        icon: Icons.sync,
        showProgress: true,
        text: _sampleSummary(state, suffix: 'Waiting for the server…'),
      ),
      WifiPositioningTestLabPhase.success => _ResultBox(
        color: state.predictionMatches
            ? const Color(0xFFE7F2E6)
            : const Color(0xFFFFF0D9),
        icon: state.predictionMatches
            ? Icons.check_circle_outline
            : Icons.compare_arrows,
        text: _successSummary(state),
      ),
      WifiPositioningTestLabPhase.failure => _ResultBox(
        color: const Color(0xFFFFE8E2),
        icon: Icons.error_outline,
        text: _failureSummary(state),
      ),
    };
  }
}

final class _ResultBox extends StatelessWidget {
  const _ResultBox({
    required this.color,
    required this.icon,
    this.showProgress = false,
    required this.text,
  });

  final Color color;
  final IconData icon;
  final bool showProgress;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(9),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showProgress)
            const SizedBox.square(
              dimension: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            Icon(icon, size: 20),
          const SizedBox(width: 8),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}

String _sampleSummary(
  WifiPositioningTestLabState state, {
  required String suffix,
}) =>
    'Expected: ${state.expectedNodeId}\n'
    'Sample: scan ${state.sampleScanId} · ${state.readingCount} APs\n'
    '$suffix';

String _successSummary(WifiPositioningTestLabState state) =>
    '${state.predictionMatches ? 'MATCH' : 'MISMATCH'}\n'
    'Expected: ${state.expectedNodeId}\n'
    'Predicted: ${state.predictedServerNodeId}\n'
    'Map node: ${state.localNodeId} · ${state.floorId}\n'
    'Sample: scan ${state.sampleScanId} · ${state.readingCount} APs';

String _failureSummary(WifiPositioningTestLabState state) {
  final predicted = state.predictedServerNodeId == null
      ? ''
      : '\nPredicted: ${state.predictedServerNodeId}';
  return 'Expected: ${state.expectedNodeId}$predicted\n'
      'Sample: scan ${state.sampleScanId} · ${state.readingCount} APs\n'
      '${state.errorMessage ?? 'Positioning request failed.'}';
}
