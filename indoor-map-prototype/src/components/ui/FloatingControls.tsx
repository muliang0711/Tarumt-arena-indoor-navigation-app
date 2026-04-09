import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radii, spacing } from '../../theme/tokens';
import type { FloorOption } from '../../types';

interface FloatingControlsProps {
  floors: FloorOption[];
  activeFloorId: string;
  onSelectFloor: (floorId: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
}

function ControlButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.controlButton}>
      <Text style={styles.controlButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function FloatingControls({
  floors,
  activeFloorId,
  onSelectFloor,
  onZoomIn,
  onZoomOut,
  onRecenter,
}: FloatingControlsProps) {
  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={styles.floorRail}>
        {floors.map((floor) => {
          const isActive = floor.id === activeFloorId;
          const disabled = floor.availability !== 'available';

          return (
            <TouchableOpacity
              key={floor.id}
              activeOpacity={disabled ? 1 : 0.88}
              disabled={disabled}
              onPress={() => onSelectFloor(floor.id)}
              style={[
                styles.floorButton,
                isActive && styles.floorButtonActive,
                disabled && styles.floorButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.floorButtonLabel,
                  isActive && styles.floorButtonLabelActive,
                  disabled && styles.floorButtonLabelDisabled,
                ]}
              >
                {floor.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.controlRail}>
        <ControlButton label="Locate" onPress={onRecenter} />
        <ControlButton label="+" onPress={onZoomIn} />
        <ControlButton label="-" onPress={onZoomOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: spacing.md,
    top: 118,
    gap: spacing.md,
    alignItems: 'flex-end',
  },
  floorRail: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xs,
    gap: spacing.xs,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 10,
  },
  floorButton: {
    minWidth: 52,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  floorButtonActive: {
    backgroundColor: colors.textPrimary,
  },
  floorButtonDisabled: {
    opacity: 0.48,
  },
  floorButtonLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  floorButtonLabelActive: {
    color: colors.textOnDark,
  },
  floorButtonLabelDisabled: {
    color: colors.textMuted,
  },
  controlRail: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xs,
    gap: spacing.xs,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 10,
  },
  controlButton: {
    minWidth: 78,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
