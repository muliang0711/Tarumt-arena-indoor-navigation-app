import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors, radii } from '../../../shared/theme/tokens';

export function ShellBackground() {
  const { width, height } = useWindowDimensions();
  const panelHeight = Math.min(430, height * 0.5);

  return (
    <View pointerEvents="none" style={styles.root}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="pageBase" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.pageGlowBlue} />
            <Stop offset="52%" stopColor={colors.pageBackground} />
            <Stop offset="100%" stopColor={colors.pageGlowPurple} />
          </LinearGradient>
          <LinearGradient id="blueAura" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.pageGlowBlueStrong} stopOpacity={0.34} />
            <Stop offset="100%" stopColor={colors.pageGlowBlueStrong} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="purpleAura" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.pageGlowPurpleStrong} stopOpacity={0.24} />
            <Stop offset="100%" stopColor={colors.pageGlowPurpleStrong} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="ribbonBlend" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.pageGlowBlueStrong} stopOpacity={0.16} />
            <Stop offset="62%" stopColor={colors.pageGlowPurpleStrong} stopOpacity={0.26} />
            <Stop offset="100%" stopColor={colors.white} stopOpacity={0.2} />
          </LinearGradient>
        </Defs>

        <Rect width={width} height={height} fill="url(#pageBase)" />
        <Circle
          cx={width * 0.04}
          cy={height * 0.15}
          r={width * 0.34}
          fill="url(#blueAura)"
        />
        <Circle
          cx={width * 0.88}
          cy={height * 0.14}
          r={width * 0.3}
          fill="url(#purpleAura)"
        />
        <Ellipse
          cx={width * 0.88}
          cy={height * 0.82}
          rx={width * 0.28}
          ry={height * 0.15}
          fill="url(#blueAura)"
          opacity={0.92}
        />
        <Path
          d={`
            M ${-width * 0.06} ${height * 0.84}
            C ${width * 0.12} ${height * 0.7},
              ${width * 0.28} ${height * 1.02},
              ${width * 0.48} ${height * 0.88}
            C ${width * 0.65} ${height * 0.76},
              ${width * 0.84} ${height * 0.78},
              ${width * 1.04} ${height * 0.68}
            L ${width * 1.04} ${height * 1.04}
            L ${-width * 0.06} ${height * 1.04}
            Z
          `}
          fill="url(#ribbonBlend)"
        />
      </Svg>

      <View
        style={[
          styles.glassOrb,
          styles.glassOrbTopLeft,
          { width: width * 0.36, height: width * 0.36 },
        ]}
      />
      <View
        style={[
          styles.glassOrb,
          styles.glassOrbBottomRight,
          { width: width * 0.44, height: width * 0.44 },
        ]}
      />
      <View
        style={[
          styles.heroGlassPanel,
          {
            top: Math.max(120, height * 0.17),
            left: width * 0.07,
            width: width * 0.86,
            height: panelHeight,
          },
        ]}
      >
        <View style={styles.heroGlassHighlight} />
      </View>
      <View style={styles.glassCube} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glassOrb: {
    position: 'absolute',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 34,
    elevation: 12,
  },
  glassOrbTopLeft: {
    top: 48,
    left: -72,
  },
  glassOrbBottomRight: {
    right: -92,
    bottom: -54,
  },
  heroGlassPanel: {
    position: 'absolute',
    borderRadius: 34,
    backgroundColor: colors.shellGlass,
    borderWidth: 1,
    borderColor: colors.glassStroke,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 1,
    shadowRadius: 36,
    elevation: 16,
    overflow: 'hidden',
  },
  heroGlassHighlight: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  glassCube: {
    position: 'absolute',
    top: 136,
    right: 52,
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(241, 234, 254, 0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 10,
  },
});
