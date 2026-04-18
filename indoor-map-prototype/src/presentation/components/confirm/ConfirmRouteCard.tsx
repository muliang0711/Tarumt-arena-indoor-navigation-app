import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DestinationAnchor, RouteModel } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface ConfirmRouteCardProps {
  buildingName: string;
  currentLocationLabel: string;
  floorLabel: string;
  route: RouteModel | null;
  selectedDestination: DestinationAnchor | null;
}

export function ConfirmRouteCard({
  buildingName,
  currentLocationLabel,
  floorLabel,
  route,
  selectedDestination,
}: ConfirmRouteCardProps) {
  return (
    <View style={styles.confirmCard}>
      <Text style={styles.confirmLabel}>Destination</Text>
      <Text style={styles.confirmTitle}>{selectedDestination?.label ?? 'Unknown'}</Text>
      <Text style={styles.confirmSubtitle}>{selectedDestination?.subtitle ?? ''}</Text>

      <View style={styles.confirmDivider} />

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>From</Text>
        <Text style={styles.infoValue}>{currentLocationLabel}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Building</Text>
        <Text style={styles.infoValue}>{buildingName}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Floor</Text>
        <Text style={styles.infoValue}>{floorLabel}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Estimated walk</Text>
        <Text style={styles.infoValue}>
          {route?.distanceMeters ?? 0} m / {route?.etaMinutes ?? 0} min
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassStroke,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
    gap: spacing.md,
  },
  confirmLabel: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  confirmTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  confirmSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: colors.border,
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
