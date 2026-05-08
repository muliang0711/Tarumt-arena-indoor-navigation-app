import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

export function DashboardFloorPlanBackground() {
  return (
    <View pointerEvents="none" style={styles.backgroundLayer}>
      <Svg width="100%" height="100%" viewBox="0 0 430 920" preserveAspectRatio="none">
        <Rect width="430" height="920" fill="#F7FAFC" />
        {Array.from({ length: 12 }).map((_, index) => (
          <Line
            key={`vertical-${index}`}
            x1={index * 40}
            y1="0"
            x2={index * 40}
            y2="920"
            stroke="#E6EDF7"
            strokeWidth="1"
            opacity="0.48"
          />
        ))}
        {Array.from({ length: 24 }).map((_, index) => (
          <Line
            key={`horizontal-${index}`}
            x1="0"
            y1={index * 40}
            x2="430"
            y2={index * 40}
            stroke="#E6EDF7"
            strokeWidth="1"
            opacity="0.48"
          />
        ))}
        <Path
          d="M 42 138 L 160 138 L 160 236 L 300 236 L 300 334 L 390 334"
          fill="none"
          stroke="#CBD8EA"
          strokeWidth="2"
          opacity="0.48"
        />
        <Path
          d="M 32 610 L 136 610 L 136 530 L 266 530 L 266 468 L 394 468"
          fill="none"
          stroke="#CBD8EA"
          strokeWidth="2"
          opacity="0.42"
        />
        <Rect x="42" y="178" width="82" height="58" rx="8" fill="none" stroke="#D8E2F0" />
        <Rect x="204" y="118" width="132" height="74" rx="8" fill="none" stroke="#D8E2F0" />
        <Rect x="58" y="694" width="112" height="80" rx="8" fill="none" stroke="#D8E2F0" />
        <Rect x="238" y="648" width="118" height="70" rx="8" fill="none" stroke="#D8E2F0" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
