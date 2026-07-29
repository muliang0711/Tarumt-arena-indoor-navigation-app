import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class LivePresenceConnectionBannerKeys {
  static const banner = ValueKey<String>('live-map.connection-banner');
}

final class LivePresenceConnectionBanner extends StatelessWidget {
  const LivePresenceConnectionBanner({required this.connection, super.key});

  final PresenceConnectionState connection;

  @override
  Widget build(BuildContext context) {
    final message = switch (connection.phase) {
      PresenceConnectionPhase.connecting => 'Connecting to live activity…',
      PresenceConnectionPhase.reconnecting =>
        'Connection interrupted · reconnecting…',
      PresenceConnectionPhase.offline => 'Live activity is temporarily offline',
      PresenceConnectionPhase.disconnected => 'Live activity is paused',
      PresenceConnectionPhase.connected ||
      PresenceConnectionPhase.simulated => null,
    };
    if (message == null) return const SizedBox.shrink();
    return Container(
      key: LivePresenceConnectionBannerKeys.banner,
      width: double.infinity,
      color: CampusNavigatorColors.accent.withValues(alpha: 0.14),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
      child: Row(
        children: [
          const SizedBox(
            height: 12,
            width: 12,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: CampusNavigatorColors.text,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
