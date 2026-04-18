import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface HomeHeroCardProps {
  title: string;
  subtitle: string;
  currentAnchorLabel: string;
  mapPackageLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function HomeHeroCard({
  title,
  subtitle,
  currentAnchorLabel,
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
        <View style={styles.headerBlock}>
          <View style={styles.statusBadge}>
            <View style={styles.statusBadgeCore}>
              <View style={styles.statusBadgeColumn}>
                <View style={styles.statusBadgeSquare} />
                <View style={styles.statusBadgeSquareSmall} />
              </View>
              <View style={styles.statusBadgeLineStack}>
                <View style={styles.statusBadgeLine} />
                <View style={styles.statusBadgeLineShort} />
                <View style={styles.statusBadgeLine} />
              </View>
            </View>
            <View style={[styles.statusBadgeDot, styles.statusBadgeDotActive]} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoPanel}>
          <InfoRow label="Current anchor" value={currentAnchorLabel} />
          <InfoRow label="Map package" value={mapPackageLabel} />
        </View>
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
      <View style={styles.infoIconWrap}>
        <View style={styles.infoIconOuter} />
        <View style={styles.infoIconInner} />
      </View>
      <View style={styles.infoTextBlock}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
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
  headerBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusBadge: {
    width: 82,
    height: 82,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(241, 234, 254, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statusBadgeCore: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.accentPurple,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  statusBadgeColumn: {
    gap: 3,
    alignItems: 'center',
  },
  statusBadgeSquare: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.accentPurple,
  },
  statusBadgeSquareSmall: {
    width: 6,
    height: 6,
    borderRadius: 2,
    backgroundColor: colors.accentPurple,
    opacity: 0.7,
  },
  statusBadgeLineStack: {
    gap: 3,
  },
  statusBadgeLine: {
    width: 11,
    height: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPurple,
  },
  statusBadgeLineShort: {
    width: 8,
    height: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPurple,
  },
  statusBadgeDot: {
    position: 'absolute',
    right: 6,
    bottom: 8,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.82)',
  },
  statusBadgeDotActive: {
    backgroundColor: colors.accentGreen,
  },
  title: {
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(168, 85, 247, 0.16)',
    marginTop: spacing.xs,
  },
  infoPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.26)',
    padding: spacing.md,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.accentPurpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  infoIconOuter: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.accentPurple,
  },
  infoIconInner: {
    width: 6,
    height: 6,
    borderRadius: 2,
    backgroundColor: colors.accentPurple,
  },
  infoTextBlock: {
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
});
