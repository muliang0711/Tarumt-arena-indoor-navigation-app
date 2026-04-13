import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { PrimaryActionButton, SecondaryActionButton } from '../../components/controls/ActionButtons';
import { ScreenShell } from '../../components/layout/ScreenShell';

interface HomeStepProps {
  cameraGranted: boolean;
  currentLocationLabel: string;
  onRequestCamera: () => void;
  onStartNavigation: () => void;
}

export function HomeStep({
  cameraGranted,
  currentLocationLabel,
  onRequestCamera,
  onStartNavigation,
}: HomeStepProps) {
  return (
    <ScreenShell
      eyebrow="Campus navigator"
      title="Indoor location detected"
      subtitle="Confirm your indoor position first, then choose a destination before opening the map."
    >
      <View style={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Student Center</Text>
          <Text style={styles.heroSubtitle}>Level 3 locked with high confidence</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current anchor</Text>
            <Text style={styles.infoValue}>{currentLocationLabel}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Camera permission</Text>
            <Text style={styles.infoValue}>{cameraGranted ? 'Granted' : 'Not requested'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Map package</Text>
            <Text style={styles.infoValue}>village_demo_01</Text>
          </View>
        </View>

        <View style={styles.actionStack}>
          <SecondaryActionButton
            label={cameraGranted ? 'Camera ready' : 'Request camera'}
            onPress={onRequestCamera}
          />
          <PrimaryActionButton label="Start navigation" onPress={onStartNavigation} />
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
  heroCard: {
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
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  heroSubtitle: {
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
  actionStack: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
});
