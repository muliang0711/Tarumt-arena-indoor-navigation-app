import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface HomeHeroCardProps {
  title: string;
  subtitle: string;
  currentAnchorLabel: string;
  cameraPermissionLabel: string;
  mapPackageLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function HomeHeroCard({
  title,
  subtitle,
  currentAnchorLabel,
  cameraPermissionLabel,
  mapPackageLabel,
  style,
}: HomeHeroCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <InfoRow label="Current anchor" value={currentAnchorLabel} />
      <InfoRow label="Camera permission" value={cameraPermissionLabel} />
      <InfoRow label="Map package" value={mapPackageLabel} />
    </View>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
    gap: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
});
