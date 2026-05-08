import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { colors, radii } from '../../../shared/theme/tokens';

export function HomeMiniMapPreview() {
  return (
    <View style={styles.miniMapShell}>
      <Svg width="100%" height="100%" viewBox="0 0 320 150">
        <Rect x="0" y="0" width="320" height="150" rx="18" fill="#EEF4FB" />
        <Line x1="24" y1="38" x2="296" y2="38" stroke="#D9E2F2" strokeWidth="1" />
        <Line x1="24" y1="112" x2="296" y2="112" stroke="#D9E2F2" strokeWidth="1" />
        <Line x1="70" y1="20" x2="70" y2="130" stroke="#D9E2F2" strokeWidth="1" />
        <Line x1="158" y1="20" x2="158" y2="130" stroke="#D9E2F2" strokeWidth="1" />
        <Line x1="246" y1="20" x2="246" y2="130" stroke="#D9E2F2" strokeWidth="1" />

        <Rect x="22" y="18" width="48" height="38" rx="6" fill="#FFFFFF" stroke="#C8D5E8" />
        <Rect x="82" y="18" width="58" height="38" rx="6" fill="#FFFFFF" stroke="#C8D5E8" />
        <Rect x="180" y="18" width="54" height="38" rx="6" fill="#FFFFFF" stroke="#C8D5E8" />
        <Rect x="250" y="18" width="46" height="38" rx="6" fill="#FFFFFF" stroke="#C8D5E8" />
        <Rect x="22" y="94" width="60" height="38" rx="6" fill="#FFFFFF" stroke="#C8D5E8" />
        <Rect x="102" y="94" width="56" height="38" rx="6" fill="#FFFFFF" stroke="#C8D5E8" />
        <Rect x="202" y="94" width="44" height="38" rx="6" fill="#FFFFFF" stroke="#C8D5E8" />
        <Rect x="260" y="94" width="36" height="38" rx="6" fill="#FFFFFF" stroke="#C8D5E8" />

        <Path
          d="M 44 76 L 104 76 L 104 64 L 178 64 L 178 76 L 252 76"
          fill="none"
          stroke="#2F6BFF"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M 44 76 L 104 76 L 104 64 L 178 64 L 178 76 L 252 76"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.76"
        />
        <Circle cx="44" cy="76" r="11" fill="rgba(47, 107, 255, 0.18)" />
        <Circle cx="44" cy="76" r="6" fill="#2F6BFF" />
        <Circle cx="252" cy="76" r="8" fill="#22C55E" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  miniMapShell: {
    height: 150,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: '#EEF4FB',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
