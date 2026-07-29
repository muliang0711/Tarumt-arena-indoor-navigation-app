import { Animated, StyleSheet, View } from 'react-native';

import type { RedMarkerState } from '../../tiled/type';
import { useAnimatedMarkerStyle } from './useAnimatedMarkerStyle';

type RedMarkerProps = {
  marker: RedMarkerState;
};

export function RedMarker({ marker }: RedMarkerProps) {
  const size = 22;
  const animatedStyle = useAnimatedMarkerStyle({
    headingDegrees: marker.headingDegrees,
    screenX: marker.screenX,
    screenY: marker.screenY,
    size,
  });

  return (
    <Animated.View
      style={[
        styles.redMarker,
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.redMarkerTriangle,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  redMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
  },
  redMarkerTriangle: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 7,
    borderLeftWidth: 17,
    borderLeftColor: '#dc2626',
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderTopWidth: 7,
    height: 0,
    width: 0,
  },
});
