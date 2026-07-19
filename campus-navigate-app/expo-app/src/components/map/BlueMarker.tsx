import { Animated, StyleSheet, View } from 'react-native';

import type { RoutePosition } from '../../tiled/type';
import { useAnimatedMarkerStyle } from './useAnimatedMarkerStyle';

type BlueMarkerProps = {
  position: RoutePosition;
};

export function BlueMarker({ position }: BlueMarkerProps) {
  const size = 24;
  const animatedStyle = useAnimatedMarkerStyle({
    headingDegrees: position.headingDegrees,
    screenX: position.screenX,
    screenY: position.screenY,
    size,
  });

  return (
    <Animated.View
      style={[
        styles.blueMarker,
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.blueMarkerTriangle,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  blueMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
  },
  blueMarkerTriangle: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 8,
    borderLeftWidth: 18,
    borderLeftColor: '#2563eb',
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderTopWidth: 8,
    height: 0,
    width: 0,
  },
});
