import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../../shared/theme/tokens';
import { HeaderSystemRow } from '../shared/HeaderSystemRow';

interface ScreenHeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export function ScreenHeader({ eyebrow, title, subtitle }: ScreenHeaderProps) {
  return (
    <View style={styles.pageHeader}>
      <HeaderSystemRow style={styles.systemRow} />
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
    marginBottom: spacing.xl,
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
