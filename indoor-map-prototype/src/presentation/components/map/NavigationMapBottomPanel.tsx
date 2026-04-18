import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DestinationAnchor, FlowState, RouteModel } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface NavigationMapBottomPanelProps {
  mapState: FlowState;
  route: RouteModel | null;
  routeProgress: number;
  selectedDestination: DestinationAnchor | null;
  onExit: () => void;
}

export function NavigationMapBottomPanel({
  mapState,
  route,
  routeProgress,
  selectedDestination,
  onExit,
}: NavigationMapBottomPanelProps) {
  const summaryLabel =
    mapState === 'arrived'
      ? 'Arrived'
      : `${route?.etaMinutes ?? 0} min`;
  const distanceLabel =
    mapState === 'arrived' ? `${route?.distanceMeters ?? 0} m total` : `${route?.distanceMeters ?? 0} m route`;

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <View style={styles.topRow}>
          <View style={styles.routeInfo}>
            <Text style={styles.routeLabel}>Whole route</Text>
            <Text style={styles.summaryText}>{summaryLabel}</Text>
            <Text style={styles.distanceText} numberOfLines={1}>
              {selectedDestination?.label ?? 'Destination'} / {distanceLabel}
            </Text>
          </View>

          <View style={styles.actionRow}>
            <View style={styles.turnBadge}>
              <View style={styles.turnStem} />
              <View style={styles.turnHead} />
            </View>
            <Pressable
              onPress={onExit}
              style={({ pressed }) => [styles.exitButton, pressed && styles.exitButtonPressed]}
            >
              <Text style={styles.exitButtonLabel}>Exit</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(8, Math.round(Math.min(Math.max(routeProgress, 0), 1) * 100))}%` },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 'auto',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  panel: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(12, 15, 22, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: 'rgba(0, 0, 0, 0.34)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    color: 'rgba(248, 250, 253, 0.54)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryText: {
    color: colors.textOnDark,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  distanceText: {
    color: 'rgba(248, 250, 253, 0.72)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  turnBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  turnStem: {
    width: 3,
    height: 15,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    transform: [{ translateX: -5 }],
  },
  turnHead: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.white,
    top: 13,
    transform: [{ rotate: '-45deg' }],
  },
  exitButton: {
    minWidth: 84,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
  },
  exitButtonPressed: {
    opacity: 0.9,
  },
  exitButtonLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accentBlue,
  },
});
