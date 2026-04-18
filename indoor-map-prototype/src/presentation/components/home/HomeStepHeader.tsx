import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../../shared/theme/tokens';

interface HomeStepHeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export function HomeStepHeader({ eyebrow, title, subtitle }: HomeStepHeaderProps) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.systemRow}>
        <Text style={styles.timeText}>07:23 PM</Text>
        <View style={styles.systemChip}>
          <View style={styles.systemChipDot} />
          <Text style={styles.systemChipLabel}>System Active</Text>
        </View>
      </View>
      <Text style={styles.pageEyebrow}>{eyebrow}</Text>
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageSubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  systemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  timeText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  systemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentGreenSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  systemChipDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accentGreen,
  },
  systemChipLabel: {
    color: colors.accentGreen,
    fontSize: 12,
    fontWeight: '700',
  },
  pageEyebrow: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    marginTop: 8,
  },
  pageSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
});
