import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { NavigationSensorStatus } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface NavigationMapTopOverlayProps {
  floorLabel: string;
  headingLabel: string;
  modeLabel: string;
  status: NavigationSensorStatus;
}

export function NavigationMapTopOverlay({
  floorLabel,
  headingLabel,
  modeLabel,
  status,
}: NavigationMapTopOverlayProps) {
  const statusStyle =
    status === 'active'
      ? styles.statusDotActive
      : status === 'fallback'
        ? styles.statusDotFallback
        : status === 'permission-denied' || status === 'unavailable'
          ? styles.statusDotBlocked
          : styles.statusDotIdle;

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
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
      </View>
    </View>
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
