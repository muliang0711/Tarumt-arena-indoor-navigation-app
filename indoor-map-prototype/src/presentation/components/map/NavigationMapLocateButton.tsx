import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface NavigationMapLocateButtonProps {
  onPress: () => void;
}

export function NavigationMapLocateButton({ onPress }: NavigationMapLocateButtonProps) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <View style={styles.outerRing}>
          <View style={styles.innerRing}>
            <View style={styles.centerDot} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.md,
    bottom: 160,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 251, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.58)',
    shadowColor: 'rgba(0, 0, 0, 0.24)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 10,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  outerRing: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    borderWidth: 2.5,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDot: {
    width: 4,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.accentBlue,
  },
});
