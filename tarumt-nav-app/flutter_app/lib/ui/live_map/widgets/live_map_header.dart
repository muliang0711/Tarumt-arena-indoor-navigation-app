import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_state.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class LiveMapHeaderKeys {
  static const totalUsers = ValueKey<String>('live-map.total-users');
  static const floorUsers = ValueKey<String>('live-map.floor-users');
  static const simulated = ValueKey<String>('live-map.simulated');
  static const hybrid = ValueKey<String>('live-map.hybrid');
}

final class LiveMapHeader extends StatelessWidget {
  const LiveMapHeader({required this.state, super.key});

  final LiveMapViewState state;

  @override
  Widget build(BuildContext context) {
    final snapshot = state.snapshot;
    final floorUsers = snapshot?.activeUsersOnFloor(state.selectedFloorId) ?? 0;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  state.buildingName,
                  style: const TextStyle(
                    color: CampusNavigatorColors.text,
                    fontFamily: 'monospace',
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${snapshot?.totalAppUsers ?? 0} using the app · '
                  '${snapshot?.buildingUsers ?? 0} in this building',
                  key: LiveMapHeaderKeys.totalUsers,
                  style: const TextStyle(
                    color: CampusNavigatorColors.textMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                key: LiveMapHeaderKeys.floorUsers,
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: CampusNavigatorColors.text,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${state.selectedFloor.code} · $floorUsers active',
                  style: const TextStyle(
                    color: CampusNavigatorColors.card,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (_presenceModeLabel(state) case final label?) ...[
                const SizedBox(height: 5),
                Text(
                  label,
                  key:
                      state.presenceConnection.phase ==
                          PresenceConnectionPhase.simulated
                      ? LiveMapHeaderKeys.simulated
                      : LiveMapHeaderKeys.hybrid,
                  style: const TextStyle(
                    color: CampusNavigatorColors.accent,
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

String? _presenceModeLabel(LiveMapViewState state) {
  if (!state.isUsingSimulatedPresence) return null;
  return switch (state.presenceConnection.phase) {
    PresenceConnectionPhase.simulated => 'SIMULATED PRESENCE',
    PresenceConnectionPhase.connected => 'HYBRID TEST · REMOTE CONNECTED',
    PresenceConnectionPhase.connecting => 'HYBRID TEST · REMOTE CONNECTING',
    PresenceConnectionPhase.reconnecting => 'HYBRID TEST · REMOTE RECONNECTING',
    PresenceConnectionPhase.disconnected ||
    PresenceConnectionPhase.offline => 'HYBRID TEST · REMOTE OFFLINE',
  };
}
