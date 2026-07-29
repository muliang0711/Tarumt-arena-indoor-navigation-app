import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';

abstract final class WifiRouteRecalculationBannerKeys {
  static const banner = ValueKey<String>('wifi-route-recalculation.banner');
  static const detail = ValueKey<String>('wifi-route-recalculation.detail');
  static const title = ValueKey<String>('wifi-route-recalculation.title');
}

/// Brief, non-blocking feedback while an authoritative Wi-Fi fix changes route.
final class WifiRouteRecalculationBanner extends StatelessWidget {
  const WifiRouteRecalculationBanner({required this.correction, super.key});

  final WifiCorrectionVisualState correction;

  @override
  Widget build(BuildContext context) {
    final routeReady = correction.phase == WifiCorrectionVisualPhase.routeReady;
    final title = routeReady ? 'New route ready' : 'Location updated';
    final detail = routeReady
        ? 'Navigation is continuing from your trusted Wi-Fi position.'
        : 'Recalculating route from your trusted Wi-Fi position…';
    return Semantics(
      container: true,
      liveRegion: true,
      label: '$title. $detail',
      child: Material(
        key: WifiRouteRecalculationBannerKeys.banner,
        color: const Color(0xFF1D4ED8),
        elevation: 5,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
          child: Row(
            children: [
              if (routeReady)
                const Icon(Icons.route, color: Colors.white, size: 22)
              else
                const SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2.3,
                  ),
                ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      key: WifiRouteRecalculationBannerKeys.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      detail,
                      key: WifiRouteRecalculationBannerKeys.detail,
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
            ],
          ),
        ),
      ),
    );
  }
}
