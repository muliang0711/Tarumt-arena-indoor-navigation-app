import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { RouteIcon, ScanIcon } from '../shared/DashboardIcons';

interface HomePrimaryActionsProps {
  onStartNavigation: () => void;
  onScanAnchor: () => void;
}

export function HomePrimaryActions({ onStartNavigation, onScanAnchor }: HomePrimaryActionsProps) {
  return (
    <View style={styles.primaryActions}>
      <Pressable
        accessibilityRole="button"
        onPress={onStartNavigation}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <RouteIcon color={colors.white} />
        <Text style={styles.primaryButtonText}>Start Navigation</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onScanAnchor}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
      >
        <ScanIcon color={colors.accentBlue} />
        <Text style={styles.secondaryButtonText}>Scan Anchor</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  primaryActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: colors.accentBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    shadowColor: 'rgba(47, 107, 255, 0.42)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
});
