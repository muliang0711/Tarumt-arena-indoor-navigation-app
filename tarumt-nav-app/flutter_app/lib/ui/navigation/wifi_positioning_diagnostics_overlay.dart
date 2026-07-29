import 'dart:async';

import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator_state.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/application/view_models/wifi_diagnostics_view_model.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

typedef WifiDiagnosticsNowMs = int Function();

abstract final class WifiPositioningDiagnosticsKeys {
  static const close = ValueKey<String>('wifi-diagnostics.close');
  static const clear = ValueKey<String>('wifi-diagnostics.clear');
  static const export = ValueKey<String>('wifi-diagnostics.export');
  static const open = ValueKey<String>('wifi-diagnostics.open');
  static const panel = ValueKey<String>('wifi-diagnostics.panel');
  static const retry = ValueKey<String>('wifi-diagnostics.retry');
}

/// Optional Android-native diagnostics around an otherwise independent map.
///
/// Omitting this decorator removes the complete debug surface without changing
/// Wi-Fi positioning, PDR, or map behavior.
final class WifiPositioningDiagnosticsOverlay extends StatefulWidget {
  const WifiPositioningDiagnosticsOverlay({
    required this.child,
    required this.diagnosticsViewModel,
    this.nowMs,
    required this.onRetry,
    required this.state,
    super.key,
  });

  final Widget child;
  final WifiDiagnosticsViewModel diagnosticsViewModel;
  final WifiDiagnosticsNowMs? nowMs;
  final VoidCallback onRetry;
  final WifiPositioningCoordinatorState state;

  @override
  State<WifiPositioningDiagnosticsOverlay> createState() =>
      _WifiPositioningDiagnosticsOverlayState();
}

final class _WifiPositioningDiagnosticsOverlayState
    extends State<WifiPositioningDiagnosticsOverlay> {
  bool _expanded = false;
  late WifiDiagnosticsViewState _logState;
  late final StreamSubscription<WifiDiagnosticsViewState> _logSubscription;
  Timer? _ticker;

  int get _nowMs =>
      widget.nowMs?.call() ?? DateTime.now().millisecondsSinceEpoch;

  @override
  void initState() {
    super.initState();
    _logState = widget.diagnosticsViewModel.state;
    _logSubscription = widget.diagnosticsViewModel.states.listen((state) {
      if (mounted) setState(() => _logState = state);
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    unawaited(_logSubscription.cancel());
    super.dispose();
  }

  void _open() {
    _ticker ??= Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
    setState(() => _expanded = true);
  }

  void _close() {
    _ticker?.cancel();
    _ticker = null;
    setState(() => _expanded = false);
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (!_expanded)
          Positioned(
            bottom: 172,
            right: 12,
            child: SafeArea(
              top: false,
              child: FloatingActionButton.small(
                key: WifiPositioningDiagnosticsKeys.open,
                heroTag: 'wifi-native-diagnostics',
                onPressed: _open,
                tooltip: 'Open Android Wi-Fi diagnostics',
                backgroundColor: const Color(0xFF1F2937),
                foregroundColor: Colors.white,
                child: const Icon(Icons.wifi_tethering),
              ),
            ),
          ),
        if (_expanded)
          Positioned(
            bottom: 10,
            left: 10,
            right: 10,
            child: SafeArea(
              top: false,
              child: Material(
                key: WifiPositioningDiagnosticsKeys.panel,
                color: CampusNavigatorColors.card,
                elevation: 12,
                clipBehavior: Clip.antiAlias,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: const BorderSide(
                    color: CampusNavigatorColors.border,
                    width: 1.5,
                  ),
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.sizeOf(context).height * 0.5,
                  ),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
                    child: _DiagnosticsContent(
                      nowMs: _nowMs,
                      logState: _logState,
                      onClear: () =>
                          unawaited(widget.diagnosticsViewModel.clear()),
                      onClose: _close,
                      onExport: () =>
                          unawaited(widget.diagnosticsViewModel.export()),
                      onRetry: widget.onRetry,
                      state: widget.state,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

final class _DiagnosticsContent extends StatelessWidget {
  const _DiagnosticsContent({
    required this.nowMs,
    required this.logState,
    required this.onClear,
    required this.onClose,
    required this.onExport,
    required this.onRetry,
    required this.state,
  });

  final int nowMs;
  final WifiDiagnosticsViewState logState;
  final VoidCallback onClear;
  final VoidCallback onClose;
  final VoidCallback onExport;
  final VoidCallback onRetry;
  final WifiPositioningCoordinatorState state;

  @override
  Widget build(BuildContext context) {
    final access = state.access;
    final fix = state.lastFix;
    final scan = state.scanDiagnostics;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            const Icon(Icons.wifi_tethering, size: 20),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'Android Wi-Fi diagnostics',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
              ),
            ),
            IconButton(
              key: WifiPositioningDiagnosticsKeys.close,
              onPressed: onClose,
              tooltip: 'Close Wi-Fi diagnostics',
              icon: const Icon(Icons.close),
            ),
          ],
        ),
        const Divider(height: 10),
        _DiagnosticRow(label: 'Source', value: 'Android native'),
        _DiagnosticRow(label: 'Phase', value: _phaseLabel(state.phase)),
        _DiagnosticRow(
          label: 'Scan request',
          value: _scanRequestLabel(scan.requestActiveScan),
        ),
        _DiagnosticRow(
          label: 'Scan result',
          value: _scanSourceLabel(scan.source),
        ),
        _DiagnosticRow(
          label: 'Hardware cooldown',
          value: _cooldownLabel(scan.activeScanCooldownUntilMs, nowMs),
        ),
        _DiagnosticRow(
          label: 'Batch age',
          value: _ageLabel(scan.batchCompletedAtMs, nowMs),
        ),
        _DiagnosticRow(
          label: 'Reading age',
          value: _ageLabel(scan.latestReadingObservedAtMs, nowMs),
        ),
        _DiagnosticRow(
          label: 'Initial fix',
          value: fix == null ? 'Waiting' : 'Locked',
        ),
        _DiagnosticRow(
          label: 'Permission',
          value: access?.permission.name ?? 'Unknown',
        ),
        _DiagnosticRow(
          label: 'Wi-Fi',
          value: _enabledLabel(access?.wifiEnabled),
        ),
        _DiagnosticRow(
          label: 'Location',
          value: _enabledLabel(access?.locationServicesEnabled),
        ),
        _DiagnosticRow(
          label: 'Last attempt',
          value: _timeLabel(state.lastAttemptAtMs),
        ),
        _DiagnosticRow(
          label: 'Next check',
          value: _retryLabel(scan.nextPositioningCheckAtMs, nowMs),
        ),
        _DiagnosticRow(label: 'Server node', value: fix?.serverNodeId ?? '—'),
        _DiagnosticRow(label: 'Map node', value: fix?.localNodeId ?? '—'),
        _DiagnosticRow(
          label: 'Access points',
          value:
              scan.readingCount?.toString() ??
              fix?.readingCount.toString() ??
              '—',
        ),
        _DiagnosticRow(
          label: 'Saved events',
          value: logState.eventCount.toString(),
        ),
        _DiagnosticRow(
          label: 'Last log',
          value: _timeLabel(logState.lastEventAtMs),
        ),
        if (state.lastErrorMessage != null) ...[
          const SizedBox(height: 8),
          Text(
            state.lastErrorMessage!,
            style: const TextStyle(
              color: Color(0xFFB45309),
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
        if (logState.storageError != null) ...[
          const SizedBox(height: 8),
          Text(
            logState.storageError!,
            style: const TextStyle(
              color: Color(0xFFB91C1C),
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
        if (logState.message != null) ...[
          const SizedBox(height: 8),
          Text(
            logState.message!,
            style: const TextStyle(
              color: CampusNavigatorColors.textMuted,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
        const SizedBox(height: 10),
        FilledButton.icon(
          key: WifiPositioningDiagnosticsKeys.retry,
          onPressed: onRetry,
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Scan now'),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                key: WifiPositioningDiagnosticsKeys.export,
                onPressed: logState.isBusy ? null : onExport,
                icon: logState.isBusy
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.ios_share, size: 18),
                label: const Text('Export JSON'),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              key: WifiPositioningDiagnosticsKeys.clear,
              onPressed: logState.isBusy ? null : onClear,
              child: const Text('Clear'),
            ),
          ],
        ),
      ],
    );
  }
}

final class _DiagnosticRow extends StatelessWidget {
  const _DiagnosticRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 108,
            child: Text(
              label,
              style: const TextStyle(
                color: CampusNavigatorColors.textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

String _phaseLabel(WifiPositioningPhase phase) => switch (phase) {
  WifiPositioningPhase.checkingAccess => 'Checking access',
  WifiPositioningPhase.requestingPermission => 'Requesting permission',
  WifiPositioningPhase.scanning => 'Scanning / API request',
  WifiPositioningPhase.correcting => 'Applying correction',
  WifiPositioningPhase.throttled => 'Hardware cooldown',
  WifiPositioningPhase.ready => 'Ready',
  _ => phase.name,
};

String _enabledLabel(bool? value) => switch (value) {
  true => 'On',
  false => 'Off',
  null => 'Unknown',
};

String _retryLabel(int? retryAtMs, int nowMs) {
  if (retryAtMs == null) return '—';
  final remainingMs = retryAtMs - nowMs;
  if (remainingMs <= 0) return 'Now';
  return '${(remainingMs / 1000).ceil()}s';
}

String _cooldownLabel(int? cooldownUntilMs, int nowMs) {
  if (cooldownUntilMs == null || cooldownUntilMs <= nowMs) return 'Ready';
  return '${((cooldownUntilMs - nowMs) / 1000).ceil()}s remaining';
}

String _ageLabel(int? timestampMs, int nowMs) {
  if (timestampMs == null) return '—';
  final ageMs = nowMs - timestampMs;
  if (ageMs <= 0) return 'Now';
  if (ageMs < 1000) return '${ageMs}ms';
  return '${(ageMs / 1000).toStringAsFixed(1)}s';
}

String _scanRequestLabel(bool? requestActiveScan) =>
    switch (requestActiveScan) {
      true => 'Active hardware scan',
      false => 'Receiver cache check',
      null => '—',
    };

String _scanSourceLabel(WifiScanBatchSource? source) => switch (source) {
  WifiScanBatchSource.active => 'Active broadcast',
  WifiScanBatchSource.passive => 'Passive broadcast',
  WifiScanBatchSource.cached => 'Cached receiver batch',
  WifiScanBatchSource.manual => 'Manual sample',
  null => '—',
};

String _timeLabel(int? timestampMs) {
  if (timestampMs == null) return '—';
  final value = DateTime.fromMillisecondsSinceEpoch(timestampMs);
  String twoDigits(int number) => number.toString().padLeft(2, '0');
  return '${twoDigits(value.hour)}:${twoDigits(value.minute)}:'
      '${twoDigits(value.second)}';
}
