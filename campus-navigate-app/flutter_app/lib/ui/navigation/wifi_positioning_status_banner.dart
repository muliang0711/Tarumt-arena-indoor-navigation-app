import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator_state.dart';

abstract final class WifiPositioningStatusBannerKeys {
  static const banner = ValueKey<String>('wifi-positioning-status.banner');
  static const retry = ValueKey<String>('wifi-positioning-status.retry');
  static const title = ValueKey<String>('wifi-positioning-status.title');
  static const detail = ValueKey<String>('wifi-positioning-status.detail');
}

final class WifiPositioningStatusBanner extends StatelessWidget {
  const WifiPositioningStatusBanner({
    required this.onRetry,
    required this.state,
    super.key,
  });

  final VoidCallback onRetry;
  final WifiPositioningCoordinatorState state;

  @override
  Widget build(BuildContext context) {
    if (!state.isActionableFailure) return const SizedBox.shrink();
    final content = _contentFor(state.phase);
    return Semantics(
      container: true,
      liveRegion: true,
      label: '${content.title}. ${content.detail}',
      child: Material(
        key: WifiPositioningStatusBannerKeys.banner,
        color: content.background,
        elevation: 4,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 9, 8, 9),
          child: Row(
            children: [
              Icon(content.icon, color: Colors.white, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      content.title,
                      key: WifiPositioningStatusBannerKeys.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      content.detail,
                      key: WifiPositioningStatusBannerKeys.detail,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFFF8FAFC),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              if (content.canRetry) ...[
                const SizedBox(width: 6),
                TextButton(
                  key: WifiPositioningStatusBannerKeys.retry,
                  onPressed: onRetry,
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.white,
                    backgroundColor: const Color(0x26FFFFFF),
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(content.retryLabel),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

_WifiBannerContent _contentFor(WifiPositioningPhase phase) => switch (phase) {
  WifiPositioningPhase.permissionDenied => const _WifiBannerContent(
    detail: 'Precise location access is required for indoor Wi-Fi fixes.',
    icon: Icons.location_off_outlined,
    retryLabel: 'Allow',
    title: 'Wi-Fi positioning permission',
  ),
  WifiPositioningPhase.permissionPermanentlyDenied => const _WifiBannerContent(
    detail: 'Enable precise location permission in Android Settings.',
    icon: Icons.app_settings_alt_outlined,
    retryLabel: 'Check',
    title: 'Permission blocked',
  ),
  WifiPositioningPhase.wifiDisabled => const _WifiBannerContent(
    detail: 'Turn on Wi-Fi, then check again. Step navigation still works.',
    icon: Icons.wifi_off_outlined,
    retryLabel: 'Check',
    title: 'Wi-Fi is off',
  ),
  WifiPositioningPhase.locationServicesDisabled => const _WifiBannerContent(
    detail: 'Turn on Location Services to restore trusted position fixes.',
    icon: Icons.location_disabled_outlined,
    retryLabel: 'Check',
    title: 'Location Services are off',
  ),
  WifiPositioningPhase.throttled => const _WifiBannerContent(
    canRetry: false,
    detail: 'Android paused scanning briefly. It will retry automatically.',
    icon: Icons.hourglass_top_rounded,
    title: 'Wi-Fi scan cooling down',
  ),
  WifiPositioningPhase.noReadings => const _WifiBannerContent(
    detail: 'No fresh access points were found. Move slightly and retry.',
    icon: Icons.wifi_find_outlined,
    title: 'No Wi-Fi position yet',
  ),
  WifiPositioningPhase.networkUnavailable => const _WifiBannerContent(
    detail: 'PDR continues offline. Wi-Fi fixes will recover automatically.',
    icon: Icons.cloud_off_outlined,
    title: 'Positioning network unavailable',
  ),
  WifiPositioningPhase.serviceUnavailable => const _WifiBannerContent(
    detail: 'The positioning service is unavailable. PDR remains active.',
    icon: Icons.cloud_sync_outlined,
    title: 'Positioning service unavailable',
  ),
  WifiPositioningPhase.readingsRejected => const _WifiBannerContent(
    detail: 'The server could not use these readings. A fresh scan will retry.',
    icon: Icons.wifi_find_outlined,
    title: 'Wi-Fi sample not recognized',
  ),
  WifiPositioningPhase.configurationError => const _WifiBannerContent(
    canRetry: false,
    detail: 'The server node cannot be matched safely to this floor map.',
    icon: Icons.sync_problem_outlined,
    title: 'Wi-Fi map needs attention',
  ),
  _ => const _WifiBannerContent(
    detail: 'PDR continues while Wi-Fi positioning tries to recover.',
    icon: Icons.wifi_tethering_error_rounded,
    title: 'Wi-Fi positioning paused',
  ),
};

final class _WifiBannerContent {
  const _WifiBannerContent({
    this.canRetry = true,
    required this.detail,
    required this.icon,
    this.retryLabel = 'Retry',
    required this.title,
  });

  Color get background => const Color(0xFF92400E);
  final bool canRetry;
  final String detail;
  final IconData icon;
  final String retryLabel;
  final String title;
}
