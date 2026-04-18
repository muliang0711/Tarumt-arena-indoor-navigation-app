import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FlowState, RouteModel } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface NavigationMapBottomPanelProps {
  mapState: FlowState;
  route: RouteModel | null;
  routeProgress: number;
  onExit: () => void;
}

export function NavigationMapBottomPanel({
  mapState,
  route,
  routeProgress,
  onExit,
}: NavigationMapBottomPanelProps) {
  const summaryLabel =
    mapState === 'arrived'
      ? 'Arrived'
      : `${route?.etaMinutes ?? 0} min`;

  const instructionLabel =
    mapState === 'arrived'
      ? 'You have reached your destination.'
      : route?.instruction ?? 'Turn left at the next intersection.';

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <View style={styles.topRow}>
          <Text style={styles.summaryText}>{summaryLabel}</Text>

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

        <Text style={styles.instructionText} numberOfLines={1}>
          {instructionLabel}
        </Text>

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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryText: {
    color: colors.textOnDark,
    fontSize: 18,
    fontWeight: '800',
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
  instructionText: {
    color: 'rgba(248, 250, 253, 0.88)',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
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
