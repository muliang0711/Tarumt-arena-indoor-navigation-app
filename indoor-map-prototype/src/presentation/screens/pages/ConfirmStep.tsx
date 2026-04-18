import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DestinationAnchor, ParsedMapFloor, RouteModel } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { PrimaryActionButton, SecondaryActionButton } from '../../components/controls/ActionButtons';
import { ScreenShell } from '../../components/layout/ScreenShell';

interface ConfirmStepProps {
  buildingName: string;
  currentLocationLabel: string;
  floor: ParsedMapFloor;
  route: RouteModel | null;
  selectedDestination: DestinationAnchor | null;
  onChooseAnother: () => void;
  onOpenMap: () => void;
}

export function ConfirmStep({
  buildingName,
  currentLocationLabel,
  floor,
  route,
  selectedDestination,
  onChooseAnother,
  onOpenMap,
}: ConfirmStepProps) {
  return (
    <ScreenShell
      eyebrow="Step 2"
      title="Confirm route"
      subtitle="Review the indoor route first. The live map opens only after you confirm."
    >
      <View style={styles.content}>
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
            <Text style={styles.infoValue}>{floor.label}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estimated walk</Text>
            <Text style={styles.infoValue}>
              {route?.distanceMeters ?? 0} m / {route?.etaMinutes ?? 0} min
            </Text>
          </View>
        </View>

        <View style={styles.actionStack}>
          <SecondaryActionButton label="Choose another" onPress={onChooseAnother} />
          <PrimaryActionButton label="Open navigation map" onPress={onOpenMap} />
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
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
  actionStack: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
});
