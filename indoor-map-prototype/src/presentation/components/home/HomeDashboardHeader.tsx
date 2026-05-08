import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../../shared/theme/tokens';

export function HomeDashboardHeader() {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>Campus Navigator</Text>
          <Text style={styles.subtitle}>Indoor positioning ready</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Tracking Active</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    paddingBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0,
  },
  statusPill: {
    minHeight: 32,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(236, 253, 245, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.22)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accentGreen,
  },
  statusText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '800',
  },
});
