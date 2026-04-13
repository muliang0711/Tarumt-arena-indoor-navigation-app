import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { colors, radii } from '../../../shared/theme/tokens';

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function PrimaryActionButton({
  label,
  onPress,
  disabled = false,
}: ActionButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.9}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled && styles.disabledButton]}
    >
      <Text style={styles.primaryButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryActionButton({ label, onPress, disabled = false }: ActionButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.88}
      disabled={disabled}
      onPress={onPress}
      style={[styles.secondaryButton, disabled && styles.disabledButton]}
    >
      <Text style={styles.secondaryButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    height: 54,
    borderRadius: radii.md,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: colors.textOnDark,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
});
