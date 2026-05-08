import React from 'react';
import { BlurView } from 'expo-blur';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { radii } from '../../../shared/theme/tokens';

interface DashboardGlassPanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function DashboardGlassPanel({ children, style, contentStyle }: DashboardGlassPanelProps) {
  return (
    <View style={[styles.glassPanel, style]}>
      <BlurView
        tint="light"
        intensity={38}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" style={styles.glassFill} />
      <View pointerEvents="none" style={styles.glassStroke} />
      <View style={[styles.glassContent, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassPanel: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.64)',
    shadowColor: 'rgba(15, 23, 42, 0.22)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.8,
    shadowRadius: 22,
    elevation: 8,
  },
  glassFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  glassStroke: {
    position: 'absolute',
    inset: 1,
    borderRadius: radii.md - 1,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.26)',
  },
  glassContent: {
    position: 'relative',
  },
});
