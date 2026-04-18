import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FlowState, NavigationSensorStatus, RouteModel } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface NavigationMapTopOverlayProps {
  floorLabel: string;
  headingLabel: string;
  detailLabel: string;
  mapState: FlowState;
  modeLabel: string;
  route: RouteModel | null;
  status: NavigationSensorStatus;
}

export function NavigationMapTopOverlay({
  floorLabel,
  headingLabel,
  detailLabel,
  mapState,
  modeLabel,
  route,
  status,
}: NavigationMapTopOverlayProps) {
  const [overlayMode, setOverlayMode] = useState<'user' | 'dev'>(__DEV__ ? 'dev' : 'user');
  const statusStyle =
    status === 'active'
      ? styles.statusDotActive
      : status === 'fallback'
        ? styles.statusDotFallback
        : status === 'permission-denied' || status === 'unavailable'
          ? styles.statusDotBlocked
          : styles.statusDotIdle;
  const instructionLabel =
    mapState === 'arrived'
      ? 'You have reached your destination.'
      : route?.instruction ?? 'Turn left at the next intersection.';
  const summaryLabel =
    mapState === 'arrived'
      ? 'Route complete'
      : `${route?.etaMinutes ?? 0} min remaining`;

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        {__DEV__ ? (
          <View style={styles.modeToggleRow}>
            <ModePill
              active={overlayMode === 'user'}
              label="User"
              onPress={() => setOverlayMode('user')}
            />
            <ModePill
              active={overlayMode === 'dev'}
              label="Dev"
              onPress={() => setOverlayMode('dev')}
            />
          </View>
        ) : null}

        {overlayMode === 'user' ? (
          <View style={styles.userPanel}>
            <Text style={styles.userEyebrow}>{summaryLabel}</Text>
            <Text style={styles.userInstruction} numberOfLines={2}>
              {instructionLabel}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.titleRow}>
              <View>
                <Text style={styles.eyebrow}>Live indoor view</Text>
                <Text style={styles.title}>Navigation map</Text>
              </View>
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, statusStyle]} />
                <Text style={styles.statusText}>{modeLabel}</Text>
              </View>
            </View>

            <Text style={styles.devDetail}>{detailLabel}</Text>

            <View style={styles.metricRow}>
              <View style={styles.metricChip}>
                <Text style={styles.metricLabel}>Floor</Text>
                <Text style={styles.metricValue}>{floorLabel}</Text>
              </View>
              <View style={styles.metricChip}>
                <Text style={styles.metricLabel}>Heading</Text>
                <Text style={styles.metricValue}>{headingLabel}</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function ModePill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modePill,
        active && styles.modePillActive,
        pressed && styles.modePillPressed,
      ]}
    >
      <Text style={[styles.modePillLabel, active && styles.modePillLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  panel: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(14, 24, 38, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: spacing.md,
  },
  modeToggleRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  modePill: {
    minWidth: 54,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(248, 250, 253, 0.08)',
  },
  modePillActive: {
    backgroundColor: colors.white,
  },
  modePillPressed: {
    opacity: 0.9,
  },
  modePillLabel: {
    color: colors.textOnDark,
    fontSize: 12,
    fontWeight: '700',
  },
  modePillLabelActive: {
    color: colors.textPrimary,
  },
  userPanel: {
    gap: spacing.xs,
  },
  userEyebrow: {
    color: 'rgba(248, 250, 253, 0.66)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  userInstruction: {
    color: colors.textOnDark,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    paddingRight: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyebrow: {
    color: 'rgba(248, 250, 253, 0.62)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: colors.textOnDark,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(248, 250, 253, 0.08)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  statusDotActive: {
    backgroundColor: colors.accentGreen,
  },
  statusDotFallback: {
    backgroundColor: colors.accentAmber,
  },
  statusDotBlocked: {
    backgroundColor: colors.accentRose,
  },
  statusDotIdle: {
    backgroundColor: colors.accentSlate,
  },
  statusText: {
    color: colors.textOnDark,
    fontSize: 12,
    fontWeight: '700',
  },
  devDetail: {
    color: 'rgba(248, 250, 253, 0.72)',
    fontSize: 12,
    lineHeight: 18,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricChip: {
    flex: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(248, 250, 253, 0.08)',
  },
  metricLabel: {
    color: 'rgba(248, 250, 253, 0.56)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    color: colors.textOnDark,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
});
