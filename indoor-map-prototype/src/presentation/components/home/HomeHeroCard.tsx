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
      <View pointerEvents="none" style={styles.glassWash} />
      <View pointerEvents="none" style={styles.glassHighlight} />
      <View pointerEvents="none" style={styles.glassBlueGlow} />
      <View pointerEvents="none" style={styles.glassPurpleGlow} />
      <View pointerEvents="none" style={styles.innerStroke} />

      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <InfoRow label="Current anchor" value={currentAnchorLabel} />
        <InfoRow label="Camera permission" value={cameraPermissionLabel} />
        <InfoRow label="Map package" value={mapPackageLabel} />
      </View>
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
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.26)',
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 14,
  },
  glassWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  glassBlueGlow: {
    position: 'absolute',
    top: -42,
    left: -18,
    width: 170,
    height: 170,
    borderRadius: radii.pill,
    backgroundColor: colors.accentBlueSoft,
    opacity: 0.95,
  },
  glassPurpleGlow: {
    position: 'absolute',
    right: -52,
    bottom: -70,
    width: 190,
    height: 190,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPurpleSoft,
    opacity: 0.82,
  },
  innerStroke: {
    position: 'absolute',
    inset: 1,
    borderRadius: radii.lg - 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  content: {
    position: 'relative',
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
